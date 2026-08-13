import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATE_RE, UUID_RE, requireTravelAllowanceUser } from '../_auth';

const REPORT_TYPES = ['week', 'month', 'employee', 'custom'];
const STATUSES = ['paid', 'unpaid', 'void'];
const BUCKET = 'travel-allowance-receipts';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function fileSafeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function withSignedReceiptUrls(
  supabase: SupabaseClient,
  rows: Array<Record<string, unknown>>
) {
  return Promise.all(rows.map(async (row) => {
    const path = text(row.receipt_file_path);
    if (!path) return { ...row, receipt_signed_url: null };

    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);

    return { ...row, receipt_signed_url: data?.signedUrl ?? null };
  }));
}

export async function GET(request: Request) {
  const auth = await requireTravelAllowanceUser(request);
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from('travel_allowance_payments')
    .select('id, employee_id, period_start, period_end, report_type, events, amount, status, paid_at, receipt_file_name, receipt_file_path, notes')
    .order('period_start', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payments = await withSignedReceiptUrls(auth.supabase, data ?? []);
  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  const auth = await requireTravelAllowanceUser(request);
  if ('error' in auth) return auth.error;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Enter payment details' }, { status: 400 });
  }

  const employeeId = text(formData.get('employee_id'));
  const periodStart = text(formData.get('period_start'));
  const periodEnd = text(formData.get('period_end'));
  const reportType = text(formData.get('report_type')) || 'month';
  const status = text(formData.get('status')) || 'paid';
  const events = Number(formData.get('events') ?? 0);
  const amount = Number(formData.get('amount') ?? 0);
  const existingReceiptPath = text(formData.get('existing_receipt_file_path'));
  const existingReceiptName = text(formData.get('existing_receipt_file_name'));
  const notes = text(formData.get('notes'));

  if (
    !UUID_RE.test(employeeId)
    || !DATE_RE.test(periodStart)
    || !DATE_RE.test(periodEnd)
    || periodEnd < periodStart
    || !REPORT_TYPES.includes(reportType)
    || !STATUSES.includes(status)
    || !Number.isInteger(events)
    || events < 0
    || !Number.isFinite(amount)
    || amount < 0
  ) {
    return NextResponse.json({ error: 'Enter valid payment details' }, { status: 400 });
  }

  const receipt = formData.get('receipt');
  const receiptFile = receipt instanceof File && receipt.size > 0 ? receipt : null;

  if (status === 'paid' && !receiptFile && !existingReceiptPath) {
    return NextResponse.json({ error: 'Attach a receipt before marking this report as paid' }, { status: 400 });
  }

  let receiptFileName = existingReceiptName || null;
  let receiptFilePath = existingReceiptPath || null;

  if (status === 'paid' && receiptFile) {
    if (receiptFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Receipt must be 10 MB or smaller' }, { status: 400 });
    }

    const path = `${employeeId}/${periodStart}_${periodEnd}_${Date.now()}_${fileSafeName(receiptFile.name)}`;
    const bytes = await receiptFile.arrayBuffer();
    const { error: uploadError } = await auth.supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), {
        contentType: receiptFile.type || undefined,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Receipt upload failed: ${uploadError.message}` }, { status: 500 });
    }

    receiptFileName = receiptFile.name;
    receiptFilePath = path;
  }

  const { data, error } = await auth.supabase
    .from('travel_allowance_payments')
    .upsert({
      employee_id: employeeId,
      period_start: periodStart,
      period_end: periodEnd,
      report_type: reportType,
      events,
      amount,
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      paid_by: status === 'paid' ? auth.user.id : null,
      receipt_file_name: status === 'paid' ? receiptFileName : null,
      receipt_file_path: status === 'paid' ? receiptFilePath : null,
      receipt_public_url: null,
      notes: notes || null,
    }, {
      onConflict: 'employee_id,period_start,period_end',
    })
    .select('id, employee_id, period_start, period_end, report_type, events, amount, status, paid_at, receipt_file_name, receipt_file_path, notes')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [payment] = await withSignedReceiptUrls(auth.supabase, data ? [data] : []);
  return NextResponse.json({ payment });
}
