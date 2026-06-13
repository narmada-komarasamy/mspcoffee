'use client';

import Link from 'next/link';
import { ShieldOff, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center', padding: '2rem',
    }}>
      <div style={{
        background: 'var(--t-card)', border: '1px solid #e5dfc8', borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(27,74,27,0.08)', padding: '3rem 2.5rem', maxWidth: '420px', width: '100%',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
        }}>
          <ShieldOff size={30} style={{ color: '#dc2626' }} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--t-heading)', margin: '0 0 0.5rem' }}>
          Access Restricted
        </h1>
        <p style={{ color: 'var(--t-muted)', fontSize: '0.9rem', margin: '0 0 2rem', lineHeight: 1.6 }}>
          You don&apos;t have permission to view this page. Contact your administrator if you believe this is a mistake.
        </p>

        <Link href="/rainfall" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '8px', background: 'var(--t-heading)',
          color: 'white', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
        }}>
          <ArrowLeft size={15} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
