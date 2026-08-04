import { Suspense } from 'react';
import { EmailReportsClient } from './EmailReportsClient';

export default function EmailReportsPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--t-muted)' }}>Loading email reports...</div>}>
      <EmailReportsClient />
    </Suspense>
  );
}
