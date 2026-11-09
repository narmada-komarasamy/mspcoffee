import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { MR_MONEY_SECTIONS } from '@/lib/mr-money';

export default function MrMoneyPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--t-muted)' }}>Family and Personal</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-black tracking-tight" style={{ color: 'var(--t-text)' }}>
          <Wallet className="h-7 w-7" aria-hidden="true" />
          MR Money
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {MR_MONEY_SECTIONS.map(section => (
          <Link key={section.href} href={section.href} className="rounded-xl border p-5 text-lg font-bold transition hover:shadow-md"
            style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }}>
            {section.label} →
          </Link>
        ))}
      </div>
      <Link href="/family" className="inline-block text-sm font-semibold" style={{ color: 'var(--t-accent)' }}>
        ← Family and Personal
      </Link>
    </div>
  );
}
