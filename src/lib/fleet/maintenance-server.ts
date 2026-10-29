import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BILL_BUCKET } from './maintenance';

export const billFingerprint = (bytes: ArrayBuffer) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const summaryColumns = 'id,date,vehicle_id,maint_cost,maintenance_vendor,maintenance_bill_path,maintenance_bill_name';

export async function findExactBill(supabase: SupabaseClient, hash: string) {
  const { data: indexed, error } = await supabase.from('fleet_daily').select(summaryColumns).eq('maintenance_bill_sha256', hash).limit(1);
  if (error) throw new Error('Could not check saved bills. Please retry.');
  if (indexed?.length) return indexed[0];

  // Fingerprint older attachments too. Pagination advances even if historical
  // duplicates cannot both receive the same unique fingerprint.
  let after = 0;
  while (true) {
    const { data: legacy, error: lookupError } = await supabase.from('fleet_daily').select(summaryColumns)
      .neq('maintenance_bill_path', '').is('maintenance_bill_sha256', null).gt('id', after).order('id').limit(50);
    if (lookupError) throw new Error('Could not check older bills. Please retry.');
    if (!legacy?.length) break;
    for (const row of legacy) {
      after = Number(row.id);
      const { data: file, error: downloadError } = await supabase.storage.from(BILL_BUCKET).download(row.maintenance_bill_path);
      if (downloadError || !file) throw new Error('An older bill could not be checked. Please retry before uploading.');
      const fingerprint = billFingerprint(await file.arrayBuffer());
      const { error: updateError } = await supabase.from('fleet_daily').update({ maintenance_bill_sha256: fingerprint })
        .eq('id', row.id).eq('maintenance_bill_path', row.maintenance_bill_path).is('maintenance_bill_sha256', null);
      if (updateError && updateError.code !== '23505') throw new Error('Could not index an older bill. Please retry.');
      if (fingerprint === hash) return row;
    }
  }
  // Another upload may have completed while legacy attachments were checked.
  const { data: recent, error: recentError } = await supabase.from('fleet_daily').select(summaryColumns).eq('maintenance_bill_sha256', hash).limit(1);
  if (recentError) throw new Error('Could not finish checking saved bills. Please retry.');
  return recent?.[0] ?? null;
}
