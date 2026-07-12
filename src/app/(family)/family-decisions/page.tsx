'use client';

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Lightbulb,
  Mail,
  MessageSquareWarning,
  Plus,
  Printer,
  Send,
  UserRound,
  Vote,
  XCircle,
} from 'lucide-react';

const votes = [
  { name: 'Ashok', vote: 'Yes', note: 'Use the shorter name if the domain is clean.' },
  { name: 'Meera', vote: 'Yes', note: 'Works for family and estate updates.' },
  { name: 'Rohan', vote: 'No', note: 'Concerned the name sounds too formal.' },
  { name: 'Anika', vote: 'Pending', note: 'Will decide after seeing logo options.' },
];

const objections = [
  {
    by: 'Rohan',
    concern: 'The name may not feel warm enough for a family site.',
    response: 'Check 2 alternate names before the vote closes.',
  },
  {
    by: 'Anika',
    concern: 'Need to confirm the domain and Instagram handle.',
    response: 'Owner to verify availability before final approval.',
  },
];

const suggestions = [
  'MSP Family Circle',
  'Stanmore Stories',
  'MSP Home Board',
];

const decisionSteps = [
  { label: 'Question posted', date: '11 Jul', done: true },
  { label: 'Family votes', date: '12 Jul', done: true },
  { label: 'Objections resolved', date: '14 Jul', done: false },
  { label: 'Decision locked', date: '15 Jul', done: false },
];

const decisionQuestion = 'Should we name the new family website "MSP Family Circle"?';
const estimatedCost = 'Rs 35,000';
const projectLead = 'Ashok';
const timeline = '15 Jul - 31 Jul';
const emailSubject = `Family decision needed: ${decisionQuestion}`;
const emailBody = [
  'Dear family,',
  '',
  'Please vote on this decision:',
  decisionQuestion,
  '',
  'Reply with:',
  '1. Yes or No',
  '2. Any objection that must be resolved',
  '3. Any better suggestion',
  '',
  'Project details:',
  `Estimated cost: ${estimatedCost}`,
  `Project lead: ${projectLead}`,
  `Timeline: ${timeline}`,
  '',
  'Decision rule: passes with 3 yes votes and no unresolved major objections.',
].join('\n');
const emailHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

export default function FamilyDecisionsPage() {
  const yesVotes = votes.filter(vote => vote.vote === 'Yes').length;
  const noVotes = votes.filter(vote => vote.vote === 'No').length;
  const pendingVotes = votes.filter(vote => vote.vote === 'Pending').length;
  const totalCast = yesVotes + noVotes;
  const yesPercent = totalCast ? Math.round((yesVotes / totalCast) * 100) : 0;

  return (
    <div id="family-decision-print" className="mx-auto max-w-7xl space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #family-decision-print, #family-decision-print * { visibility: visible; }
          #family-decision-print {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            max-width: none;
            padding: 24px;
            background: #fff;
          }
          .family-decision-no-print { display: none !important; }
        }
      `}</style>
      <section className="flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-end lg:justify-between" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)', boxShadow: '0 8px 26px rgba(27,74,27,0.08)' }}>
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--t-muted)' }}>Family and Personal</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight" style={{ color: 'var(--t-heading)' }}>Family Decisions</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--t-muted)' }}>
            A simple decision room: ask one clear question, collect yes/no votes, capture objections and suggestions, assign cost, owner, and timeline, then close the decision.
          </p>
        </div>
        <div className="family-decision-no-print grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[430px]">
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition active:scale-[0.99]" style={{ background: 'var(--t-green)' }}>
            <Plus className="h-4 w-4" />
            New question
          </button>
          <button onClick={() => window.print()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition active:scale-[0.99]" style={{ background: 'var(--t-subtle)', borderColor: 'var(--t-border)', color: 'var(--t-heading)' }}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <a href={emailHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition active:scale-[0.99]" style={{ background: '#fff', borderColor: 'var(--t-border)', color: 'var(--t-heading)' }}>
            <Mail className="h-4 w-4" />
            Email family
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_0.9fr]">
        <div className="rounded-xl border p-5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)', boxShadow: '0 8px 26px rgba(27,74,27,0.08)' }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)', color: 'var(--t-heading)' }}>
                <Vote className="h-3.5 w-3.5" />
                Active vote
              </div>
              <h2 className="mt-3 text-2xl font-black leading-tight" style={{ color: 'var(--t-text)' }}>
                {decisionQuestion}
              </h2>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--t-muted)' }}>
                Decision closes once objections are answered and at least 3 family members vote yes.
              </p>
            </div>
            <div className="rounded-lg border px-4 py-3 text-right" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--t-label)' }}>Recommendation</p>
              <p className="mt-1 text-xl font-black" style={{ color: yesVotes > noVotes ? 'var(--t-green)' : '#b42318' }}>
                {yesVotes > noVotes ? 'Proceed' : 'Hold'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: '#f7fbf4' }}>
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t-green)' }}>
                <CheckCircle2 className="h-4 w-4" />
                Yes
              </div>
              <p className="mt-2 text-3xl font-black" style={{ color: 'var(--t-heading)' }}>{yesVotes}</p>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: '#fff7f5' }}>
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#b42318' }}>
                <XCircle className="h-4 w-4" />
                No
              </div>
              <p className="mt-2 text-3xl font-black" style={{ color: '#7a271a' }}>{noVotes}</p>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)' }}>
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t-muted)' }}>
                <Clock3 className="h-4 w-4" />
                Pending
              </div>
              <p className="mt-2 text-3xl font-black" style={{ color: 'var(--t-text)' }}>{pendingVotes}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--t-label)' }}>
              <span>Yes majority</span>
              <span>{yesPercent}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: 'var(--t-subtle)' }}>
              <div className="h-full rounded-full" style={{ width: `${yesPercent}%`, background: 'var(--t-green)' }} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-black text-white" style={{ background: 'var(--t-green)' }}>
              <CheckCircle2 className="h-5 w-5" />
              Vote yes
            </button>
            <button className="flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-black" style={{ borderColor: '#f3b2a8', background: '#fff7f5', color: '#9f2a1d' }}>
              <XCircle className="h-5 w-5" />
              Vote no
            </button>
          </div>
        </div>

        <aside className="rounded-xl border p-5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)', boxShadow: '0 8px 26px rgba(27,74,27,0.08)' }}>
          <h2 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: 'var(--t-heading)' }}>Project details</h2>
          <div className="mt-4 space-y-3">
            <DetailRow icon={IndianRupee} label="Estimated cost" value="₹35,000" note="Domain, design, setup" />
            <DetailRow icon={UserRound} label="Project lead" value={projectLead} note="Responsible after approval" />
            <DetailRow icon={CalendarDays} label="Timeline" value={timeline} note="Two-week first version" />
          </div>

          <div className="mt-5 rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--t-label)' }}>Decision rule</p>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--t-text)' }}>
              Passes with 3 yes votes and no unresolved major objections.
            </p>
          </div>

          <div className="family-decision-no-print mt-5 rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: '#fff' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--t-label)' }}>
              <Send className="h-4 w-4" />
              Email response flow
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--t-muted)' }}>
              The email asks each person to reply with Yes, No, objections, and suggestions. Those replies can be entered here now; the next production step is to save replies directly into the app.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_0.85fr]">
        <div className="rounded-xl border p-5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em]" style={{ color: 'var(--t-heading)' }}>
            <MessageSquareWarning className="h-4 w-4" />
            Objections to resolve
          </h2>
          <div className="mt-4 space-y-3">
            {objections.map(objection => (
              <div key={objection.concern} className="rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)' }}>
                <p className="text-sm font-bold" style={{ color: 'var(--t-text)' }}>{objection.by}</p>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--t-muted)' }}>{objection.concern}</p>
                <p className="mt-3 rounded-md px-3 py-2 text-xs font-semibold" style={{ background: '#fff', color: 'var(--t-heading)' }}>{objection.response}</p>
              </div>
            ))}
          </div>
          <textarea className="mt-4 min-h-24 w-full resize-none rounded-lg border p-3 text-sm outline-none" style={{ borderColor: 'var(--t-border)', background: '#fff', color: 'var(--t-text)' }} placeholder="Add an objection that must be answered before the decision closes" />
        </div>

        <div className="rounded-xl border p-5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em]" style={{ color: 'var(--t-heading)' }}>
            <Lightbulb className="h-4 w-4" />
            Suggestions
          </h2>
          <div className="mt-4 space-y-2">
            {suggestions.map(suggestion => (
              <div key={suggestion} className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--t-text)' }}>{suggestion}</span>
                <button className="rounded-md border px-3 py-1 text-xs font-bold" style={{ borderColor: 'var(--t-border)', background: '#fff', color: 'var(--t-heading)' }}>Use</button>
              </div>
            ))}
          </div>
          <input className="mt-4 h-11 w-full rounded-lg border px-3 text-sm outline-none" style={{ borderColor: 'var(--t-border)', background: '#fff', color: 'var(--t-text)' }} placeholder="Suggest another name or approach" />
        </div>

        <div className="rounded-xl border p-5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
          <h2 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: 'var(--t-heading)' }}>Close-out plan</h2>
          <div className="mt-5 space-y-4">
            {decisionSteps.map(step => (
              <div key={step.label} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: step.done ? 'var(--t-green)' : 'var(--t-border)', background: step.done ? 'var(--t-green)' : 'var(--t-subtle)', color: step.done ? '#fff' : 'var(--t-muted)' }}>
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--t-text)' }}>{step.label}</p>
                  <p className="text-xs" style={{ color: 'var(--t-muted)' }}>{step.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }}>
        <h2 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: 'var(--t-heading)' }}>Member votes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr style={{ color: 'var(--t-label)' }}>
                <th className="border-b px-3 py-2 text-left font-black uppercase tracking-[0.08em]" style={{ borderColor: 'var(--t-border)' }}>Member</th>
                <th className="border-b px-3 py-2 text-left font-black uppercase tracking-[0.08em]" style={{ borderColor: 'var(--t-border)' }}>Vote</th>
                <th className="border-b px-3 py-2 text-left font-black uppercase tracking-[0.08em]" style={{ borderColor: 'var(--t-border)' }}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {votes.map(vote => (
                <tr key={vote.name}>
                  <td className="border-b px-3 py-3 font-bold" style={{ borderColor: 'var(--t-border)', color: 'var(--t-text)' }}>{vote.name}</td>
                  <td className="border-b px-3 py-3" style={{ borderColor: 'var(--t-border)' }}>
                    <span className="rounded-full px-3 py-1 text-xs font-black" style={getVoteStyle(vote.vote)}>{vote.vote}</span>
                  </td>
                  <td className="border-b px-3 py-3" style={{ borderColor: 'var(--t-border)', color: 'var(--t-muted)' }}>{vote.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, note }: { icon: React.ElementType; label: string; value: string; note: string }) {
  return (
    <div className="flex gap-3 rounded-lg border p-4" style={{ borderColor: 'var(--t-border)', background: 'var(--t-subtle)' }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: '#fff', color: 'var(--t-heading)' }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--t-label)' }}>{label}</p>
        <p className="mt-1 text-base font-black" style={{ color: 'var(--t-text)' }}>{value}</p>
        <p className="text-xs" style={{ color: 'var(--t-muted)' }}>{note}</p>
      </div>
    </div>
  );
}

function getVoteStyle(vote: string): React.CSSProperties {
  if (vote === 'Yes') return { background: '#e7f6df', color: 'var(--t-green)' };
  if (vote === 'No') return { background: '#fff0ed', color: '#9f2a1d' };
  return { background: 'var(--t-subtle)', color: 'var(--t-muted)' };
}
