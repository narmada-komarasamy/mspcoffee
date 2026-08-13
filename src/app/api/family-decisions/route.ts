import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireTravelAllowanceUser } from '../travel-allowance/_auth';

const FAMILY_MEMBERS = ['Ashok', 'Meera', 'Rohan', 'Anika'];
const DEFAULT_RULE = 'Passes with 3 yes votes and no unresolved major objections.';

type DecisionInput = {
  question?: unknown;
  cost?: unknown;
  lead?: unknown;
  timeline?: unknown;
  rule?: unknown;
  openingSuggestion?: unknown;
};

type ResponseInput = {
  decisionId?: unknown;
  memberName?: unknown;
  vote?: unknown;
  note?: unknown;
  objection?: unknown;
  suggestion?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function voteValue(value: unknown): 'Yes' | 'No' | 'Pending' {
  return value === 'Yes' || value === 'No' || value === 'Pending' ? value : 'Pending';
}

async function ensureActiveDecision(supabase: SupabaseClient, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('family_decisions')
    .select('id, question, cost, lead, timeline, rule, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('family_decisions')
    .insert({
      question: 'Should we name the new family website "MSP Family Circle"?',
      cost: 'Rs. 35,000',
      lead: 'Ashok',
      timeline: '15 Jul - 31 Jul',
      rule: DEFAULT_RULE,
      created_by: userId,
    })
    .select('id, question, cost, lead, timeline, rule, status')
    .single();

  if (createError) throw createError;

  await supabase.from('family_decision_votes').insert([
    { decision_id: created.id, member_name: 'Ashok', vote: 'Yes', note: 'Use the shorter name if the domain is clean.', recorded_by: userId },
    { decision_id: created.id, member_name: 'Meera', vote: 'Yes', note: 'Works for family and estate updates.', recorded_by: userId },
    { decision_id: created.id, member_name: 'Rohan', vote: 'No', note: 'Concerned the name sounds too formal.', recorded_by: userId },
    { decision_id: created.id, member_name: 'Anika', vote: 'Pending', note: 'Will decide after seeing logo options.', recorded_by: userId },
  ]);

  await supabase.from('family_decision_objections').insert([
    {
      decision_id: created.id,
      member_name: 'Rohan',
      concern: 'The name may not feel warm enough for a family site.',
      response: 'Check 2 alternate names before the vote closes.',
      recorded_by: userId,
    },
    {
      decision_id: created.id,
      member_name: 'Anika',
      concern: 'Need to confirm the domain and Instagram handle.',
      response: 'Owner to verify availability before final approval.',
      recorded_by: userId,
    },
  ]);

  await supabase.from('family_decision_suggestions').insert([
    { decision_id: created.id, suggestion: 'MSP Family Circle', recorded_by: userId },
    { decision_id: created.id, suggestion: 'Stanmore Stories', recorded_by: userId },
    { decision_id: created.id, suggestion: 'MSP Home Board', recorded_by: userId },
  ]);

  return created;
}

async function loadState(supabase: SupabaseClient, userId: string) {
  const decision = await ensureActiveDecision(supabase, userId);

  const [votesRes, objectionsRes, suggestionsRes] = await Promise.all([
    supabase
      .from('family_decision_votes')
      .select('member_name, vote, note')
      .eq('decision_id', decision.id)
      .order('member_name'),
    supabase
      .from('family_decision_objections')
      .select('member_name, concern, response')
      .eq('decision_id', decision.id)
      .order('created_at'),
    supabase
      .from('family_decision_suggestions')
      .select('suggestion')
      .eq('decision_id', decision.id)
      .order('created_at'),
  ]);

  if (votesRes.error) throw votesRes.error;
  if (objectionsRes.error) throw objectionsRes.error;
  if (suggestionsRes.error) throw suggestionsRes.error;

  const votes = FAMILY_MEMBERS.map((name) => {
    const row = votesRes.data?.find((item) => item.member_name === name);
    return {
      name,
      vote: voteValue(row?.vote),
      note: text(row?.note) || 'Waiting for response.',
    };
  });

  return {
    decision: {
      id: decision.id,
      question: decision.question,
      cost: decision.cost,
      lead: decision.lead,
      timeline: decision.timeline,
      rule: decision.rule,
    },
    votes,
    objections: (objectionsRes.data ?? []).map((item) => ({
      by: item.member_name,
      concern: item.concern,
      response: item.response,
    })),
    suggestions: (suggestionsRes.data ?? []).map((item) => item.suggestion),
  };
}

export async function GET(request: Request) {
  const auth = await requireTravelAllowanceUser(request);
  if ('error' in auth) return auth.error;

  try {
    return NextResponse.json(await loadState(auth.supabase, auth.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load family decision' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireTravelAllowanceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as DecisionInput | null;
  const question = text(body?.question);
  if (!question) {
    return NextResponse.json({ error: 'Enter a decision question' }, { status: 400 });
  }

  try {
    await auth.supabase
      .from('family_decisions')
      .update({ status: 'archived' })
      .eq('status', 'active');

    const { data: decision, error } = await auth.supabase
      .from('family_decisions')
      .insert({
        question,
        cost: text(body?.cost) || 'Not set',
        lead: text(body?.lead) || 'Not assigned',
        timeline: text(body?.timeline) || 'Not set',
        rule: text(body?.rule) || DEFAULT_RULE,
        created_by: auth.user.id,
      })
      .select('id')
      .single();

    if (error || !decision) throw error ?? new Error('Could not save family decision');

    await auth.supabase.from('family_decision_votes').insert(FAMILY_MEMBERS.map((name) => ({
      decision_id: decision.id,
      member_name: name,
      vote: 'Pending',
      note: 'Waiting for response.',
      recorded_by: auth.user.id,
    })));

    const openingSuggestion = text(body?.openingSuggestion);
    if (openingSuggestion) {
      await auth.supabase.from('family_decision_suggestions').insert({
        decision_id: decision.id,
        suggestion: openingSuggestion,
        recorded_by: auth.user.id,
      });
    }

    return NextResponse.json(await loadState(auth.supabase, auth.user.id), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save family decision' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireTravelAllowanceUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as ResponseInput | null;
  const decisionId = text(body?.decisionId);
  const memberName = text(body?.memberName);
  const vote = voteValue(body?.vote);
  const note = text(body?.note) || (vote === 'Pending' ? 'Waiting for response.' : `Recorded ${vote.toLowerCase()} in app.`);
  const objection = text(body?.objection);
  const suggestion = text(body?.suggestion);

  if (!decisionId || !FAMILY_MEMBERS.includes(memberName)) {
    return NextResponse.json({ error: 'Choose a family member' }, { status: 400 });
  }

  try {
    const { error: voteError } = await auth.supabase
      .from('family_decision_votes')
      .upsert({
        decision_id: decisionId,
        member_name: memberName,
        vote,
        note,
        recorded_by: auth.user.id,
        recorded_at: new Date().toISOString(),
      }, {
        onConflict: 'decision_id,member_name',
      });

    if (voteError) throw voteError;

    if (objection) {
      const { error } = await auth.supabase.from('family_decision_objections').insert({
        decision_id: decisionId,
        member_name: memberName,
        concern: objection,
        response: 'Needs response before close-out.',
        recorded_by: auth.user.id,
      });
      if (error) throw error;
    }

    if (suggestion) {
      await auth.supabase.from('family_decision_suggestions').upsert({
        decision_id: decisionId,
        suggestion,
        suggested_by: memberName,
        recorded_by: auth.user.id,
      }, {
        onConflict: 'decision_id,suggestion',
      });
    }

    return NextResponse.json(await loadState(auth.supabase, auth.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not record response' }, { status: 500 });
  }
}
