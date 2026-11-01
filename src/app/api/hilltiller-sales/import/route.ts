import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import type { CsvRow, HillTillerImportFileKind, HillTillerImportSnapshot } from '@/lib/hilltiller/import-summary';

type ImportFilePayload = {
  kind: HillTillerImportFileKind;
  name: string;
  rows: CsvRow[];
  columnCount: number;
};

type ImportPayload = {
  snapshot?: HillTillerImportSnapshot;
  files?: ImportFilePayload[];
};

const FILE_KINDS = new Set(['orders', 'transactions', 'products', 'inventory']);
const MAX_ROWS_PER_FILE = 20000;

export async function GET(request: Request) {
  const auth = await requireApiUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const { data: batch, error } = await auth.supabase
    .from('hilltiller_sales_import_batches')
    .select('id, source, status, summary, imported_by, imported_by_name, created_at')
    .eq('status', 'saved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!batch) return NextResponse.json({ batch: null, snapshot: null, files: [] });

  const { data: files, error: filesError } = await auth.supabase
    .from('hilltiller_sales_import_files')
    .select('id, file_kind, file_name, row_count, column_count, created_at')
    .eq('batch_id', batch.id)
    .order('file_kind', { ascending: true });

  if (filesError) return NextResponse.json({ error: filesError.message }, { status: 500 });

  return NextResponse.json({
    batch,
    snapshot: batch.summary,
    files: files ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, ['admin']);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as ImportPayload | null;
  if (!body?.snapshot || !Array.isArray(body.files)) {
    return NextResponse.json({ error: 'Import snapshot and files are required' }, { status: 400 });
  }

  const files = body.files.filter((file) => FILE_KINDS.has(file.kind));
  if (!files.length) return NextResponse.json({ error: 'At least one valid CSV file is required' }, { status: 400 });

  for (const file of files) {
    if (!file.name || !Array.isArray(file.rows)) {
      return NextResponse.json({ error: 'Each file needs a name and parsed rows' }, { status: 400 });
    }
    if (file.rows.length > MAX_ROWS_PER_FILE) {
      return NextResponse.json({ error: `${file.name} has too many rows for this importer` }, { status: 400 });
    }
  }

  const { data: batch, error: batchError } = await auth.supabase
    .from('hilltiller_sales_import_batches')
    .insert({
      source: 'csv_upload',
      status: 'saved',
      summary: body.snapshot,
      imported_by: auth.user.id,
      imported_by_name: auth.user.name,
    })
    .select('id, source, status, summary, imported_by, imported_by_name, created_at')
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? 'Could not create import batch' }, { status: 500 });
  }

  const fileRows = files.map((file) => ({
    batch_id: batch.id,
    file_kind: file.kind,
    file_name: file.name,
    row_count: file.rows.length,
    column_count: file.columnCount,
    rows: file.rows,
  }));

  const { error: filesError } = await auth.supabase
    .from('hilltiller_sales_import_files')
    .insert(fileRows);

  if (filesError) {
    return NextResponse.json({ error: filesError.message }, { status: 500 });
  }

  return NextResponse.json({ batch, snapshot: body.snapshot }, { status: 201 });
}
