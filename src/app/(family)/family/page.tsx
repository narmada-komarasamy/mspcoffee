import Link from 'next/link';
import { Plane } from 'lucide-react';

export default function FamilyPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--t-muted)' }}>MSP Coffee Family</p>
        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--t-text)' }}>Family and Personal</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Link
          href="/travel-allowance"
          className="group rounded-xl border p-5 transition active:scale-[0.99]"
          style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)', boxShadow: '0 8px 26px rgba(0,0,0,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: '#e8c84a', color: '#1b4a1b' }}>
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--t-text)' }}>Travel Allowance</h2>
              <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Employee trips, locations, and monthly payment reports.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
