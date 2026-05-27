'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AppUser = { id: string; name: string; role: string; estate: string | null };

const CARDS = [
  {
    id: 'estate',
    company: 'MSP Coffee',
    abbr: 'MSP',
    photo: '/MSP ESTATE.png',
    photoBg: '#1a120a',
    objectFit: 'contain' as const,
    sub: 'Estate Management',
    href: '/rainfall',
    active: true,
  },
  {
    id: 'trading',
    company: 'MSP (P) Ltd',
    abbr: 'MSP',
    photo: '/MSP TRADING.png',
    photoBg: '#0a0a0a',
    objectFit: 'contain' as const,
    sub: 'Trading Management',
    href: '/export-operations',
    active: true,
  },
  {
    id: 'sales',
    company: 'HillTiller Coffee Roasters',
    abbr: 'HT',
    photo: '/HILLTILLER.png',
    photoBg: '#0a0a0a',
    objectFit: 'cover' as const,
    sub: 'Sales Management',
    href: null,
    active: false,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser]   = useState<AppUser | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  const handleEnter = (card: typeof CARDS[0]) => {
    if (card.active && card.href) {
      router.push(card.href);
    } else {
      setToast(`${card.sub} is coming soon!`);
      setTimeout(() => setToast(''), 3000);
    }
  };

  if (!user) return null;

  return (
    <>

      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 py-8">

        {/* ── Background: warm café bokeh ── */}
        <div className="absolute inset-0">
          <Image
            src="/bg.png"
            alt="background"
            fill
            className="object-cover"
            style={{ filter: 'blur(12px) brightness(0.58) saturate(1.2)', transform: 'scale(1.12)' }}
          />
          {/* warm amber overlay */}
          <div className="absolute inset-0"
               style={{ background: 'linear-gradient(180deg, rgba(60,30,10,0.35) 0%, rgba(40,18,6,0.45) 100%)' }} />
        </div>

        {/* ── Header ── */}
        <div className="relative z-10 text-center mb-8">
          <h1 style={{
            fontFamily: 'var(--t-font-display)',
            fontSize: 'clamp(30px, 5.5vw, 68px)',
            fontStyle: 'italic',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '2px',
            textShadow: '0 2px 20px rgba(0,0,0,0.8)',
            lineHeight: 1.1,
          }}>
            Welcome to MSP Coffee World
          </h1>
          {/* decorative underline */}
          <div style={{
            width: '60%', height: '1.5px', margin: '10px auto 0',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
          }} />
        </div>

        {/* ── Cards ── */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl">
          {CARDS.map(card => (
            <div
              key={card.id}
              className="flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(24px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              }}
            >
              {/* Company name — italic serif */}
              <div className="text-center px-4 pt-5 pb-0">
                <p style={{
                  fontFamily: 'var(--t-font-display)',
                  fontStyle: 'italic',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.90)',
                  letterSpacing: '0.5px',
                }}>
                  {card.company}
                </p>
              </div>

              {/* Abbreviation — big bold */}
              <div className="text-center px-4 pt-0 pb-1">
                <p style={{
                  fontFamily: 'var(--t-font)',
                  fontSize: '80px',
                  fontWeight: 900,
                  color: 'white',
                  lineHeight: 1,
                  textShadow: '0 3px 16px rgba(0,0,0,0.7)',
                  letterSpacing: '-1px',
                }}>
                  {card.abbr}
                </p>
              </div>

              {/* Photo */}
              <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height: '200px', background: card.photoBg }}>
                <Image
                  src={card.photo}
                  alt={card.sub}
                  fill
                  className="object-center"
                  style={{ objectFit: card.objectFit, filter: 'brightness(0.97)' }}
                />
              </div>

              {/* COFFEE */}
              <div className="text-center px-4 pt-3 pb-0">
                <p style={{
                  fontFamily: 'var(--t-font)',
                  fontSize: '42px',
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '4px',
                  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                  lineHeight: 1,
                }}>
                  COFFEE
                </p>
                <p style={{
                  fontFamily: 'var(--t-font-display)',
                  fontStyle: 'italic',
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.80)',
                  marginTop: '4px',
                  letterSpacing: '0.5px',
                }}>
                  {card.sub}
                </p>
              </div>

              {/* Enter button */}
              <div className="px-4 pb-5 pt-4">
                <button
                  onClick={() => handleEnter(card)}
                  className="w-full py-2.5 rounded-xl font-bold tracking-widest text-sm text-white/90 transition-all duration-150 active:scale-95 uppercase"
                  style={{
                    background: card.active
                      ? 'rgba(180,140,90,0.45)'
                      : 'rgba(100,80,60,0.40)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    backdropFilter: 'blur(8px)',
                    letterSpacing: '3px',
                  }}
                >
                  Enter
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* diamond */}
        <div className="relative z-10 mt-6 text-white/30 text-xl select-none">◆</div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white"
               style={{ background: 'rgba(20,10,5,0.93)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(14px)' }}>
            🚧 {toast}
          </div>
        )}
      </div>
    </>
  );
}
