'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Download, Printer } from 'lucide-react';
import type { UserGuide } from '@/lib/user-guides';
import s from './guides.module.css';

export default function GuideLibrary({ guideId }: { guideId?: string }) {
  const [guides, setGuides] = useState<readonly UserGuide[] | null>(null);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/user-guides', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in again to view your guides.' : 'Unable to load your guides. Please try again.');
        return response.json();
      })
      .then(data => { setGuides(data.guides); setError(''); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  const guide = guides?.find(item => item.id === guideId);
  return <main className={s.main}>
    <header className={s.header}>
      {guideId && <Link href="/user-guides">← All user guides</Link>}
      <h1><BookOpen aria-hidden="true" /> {guideId ? guide?.title ?? 'User Guide' : 'User Guides'}</h1>
      <p>MSP Coffee · Step-by-step instructions in English and Tamil</p>
    </header>
    {error ? <div role="alert"><p>{error}</p><button onClick={() => { setError(''); setAttempt(value => value + 1); }}>Try again</button></div>
      : guides === null ? <p role="status">Loading guides…</p>
      : guideId ? guide ? <>
        <div className={s.actions}>
          <a href={`/api/user-guides/${guide.id}?download=1`}><Download size={17} aria-hidden="true" /> Download PDF</a>
          <button disabled={previewError || loadedPages.size < guide.pages} onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> Print guide</button>
          <Link href={guide.featureHref}>Open {guide.featureLabel} →</Link>
        </div>
        <p className={s.meta}>{guide.languages} · {guide.pages} pages · Version {guide.version} · {guide.updated}</p>
        {previewError && <p role="alert">The page preview could not load. You can still download the PDF above.</p>}
        <div className={s.pages}>{Array.from({ length: guide.pages }, (_, index) =>
          <figure key={index} className={s.sheet}>
            {/* Approved page renders keep the guide readable on mobile browsers too. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/user-guides/${guide.id}?page=${index + 1}`} alt={`${guide.title}, page ${index + 1}. Download the PDF for selectable text.`} onLoad={() => setLoadedPages(pages => new Set([...pages, index]))} onError={() => setPreviewError(true)} />
            <figcaption>Page {index + 1} of {guide.pages}</figcaption>
          </figure>)}</div>
      </> : <p>This guide is unavailable or you do not have access to its feature.</p>
      : <>
        <p>Find the approved guides for the features you can use. New guides will appear here after review.</p>
        {guides.length ? <div className={s.grid}>{guides.map(item => <article key={item.id} className={s.card}>
          <h2>{item.title}</h2><p>{item.description}</p>
          <p className={s.meta}>{item.languages} · {item.pages} pages · Version {item.version}</p>
          <Link href={`/user-guides/${item.id}`} className={s.primary}>Read guide →</Link>
        </article>)}</div> : <p>No approved guides are available for your current feature access.</p>}
      </>}
  </main>;
}
