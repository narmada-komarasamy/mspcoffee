import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from('cup_scores')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Block deletion of seed rows at the API level (RLS also enforces this)
  const { data: row } = await supabase
    .from('cup_scores')
    .select('is_seed')
    .eq('id', id)
    .single();

  if (row?.is_seed) {
    return NextResponse.json({ error: 'Seed entries cannot be deleted' }, { status: 403 });
  }

  const { error } = await supabase.from('cup_scores').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
