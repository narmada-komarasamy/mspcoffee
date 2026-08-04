import { Suspense } from 'react';
import { EmailComposerClient } from './EmailComposerClient';

export default function EmailComposerPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--t-muted)' }}>Loading email composer...</div>}>
      <EmailComposerClient />
    </Suspense>
  );
}
