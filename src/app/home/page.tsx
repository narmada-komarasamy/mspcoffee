'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AppUser = { id: string; name: string; role: string; estate: string | null };

const CARDS = [
  {
    id: 'estate',
    topLine: 'MSP Coffee',
    badge: true,
    hasMSP: true,
    photo: '/msp-logo.png',
    label: 'COFFEE',
    sub: 'Estate Management',
    href: '/rainfall',
    active: true,
  },
  {
    id: 'trading',
    topLine: 'MSP (P) Ltd',
    badge: true,
    hasMSP: true,
    photo: '/msp-sacks.png',
    label: 'COFFEE',
    sub: 'Trading Management',
    href: null,
    active: false,
  },
  {
    id: 'sales',
    topLine: 'HillTiller\nCoffee Roasters',
    badge: false,
    hasMSP: false,
    hillTiller: true,
    photo: '/hill-packages.png',
    label: 'COFFEE',
    sub: 'Sales Management',
    href: null,
    active: false,
  },
];

/* Coffee cherry SVG between ESTD and 1920 */
function Cherry() {
  return (
    <svg width="26" height="26" viewBox="0 0 50 50" className="inline-block mx-1 align-middle">
      <circle cx="16" cy="28" r="9" fill="#c0392b"/>
      <circle cx="30" cy="28" r="9" fill="#e74c3c"/>
      <circle cx="16" cy="28" r="3.5" fill="#7b241c" opacity="0.5"/>
      <circle cx="30" cy="28" r="3.5" fill="#7b241c" opacity="0.5"/>
      <path d="M16 19 Q23 5 30 19" stroke="#27ae60" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="23" cy="13" rx="7" ry="4" fill="#2ecc71" transform="rotate(-10 23 13)"/>
      <ellipse cx="23" cy="13" rx="7" ry="4" fill="#27ae60" opacity="0.7" transform="rotate(20 23 13)"/>
    </svg>
  );
}

/* Big MSP text with coffee-bean inside P */
function MSPLogo() {
  return (
    <div className="flex items-center justify-center" style={{ lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Arial Black','Impact',sans-serif",
        fontSize: '82px', fontWeight: 900, color: 'white',
        textShadow: '0 3px 16px rgba(0,0,0,0.8)',
        letterSpacing: '-1px',
      }}>MS</span>
      <span className="relative" style={{ display: 'inline-block', width: '68px', height: '90px' }}>
        <span style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: '82px', fontWeight: 900, color: 'white',
          textShadow: '0 3px 16px rgba(0,0,0,0.8)',
          position: 'absolute', left: 0, top: 0,
        }}>P</span>
        <svg viewBox="0 0 42 52" style={{
          position: 'absolute', top: '12px', left: '16px',
          width: '34px', height: '42px', pointerEvents: 'none',
        }}>
          <ellipse cx="21" cy="26" rx="18" ry="22" fill="#5c2d0a"/>
          <path d="M21 6 Q34 16 32 26 Q34 36 21 46"
                stroke="#a0522d" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        </svg>
      </span>
    </div>
  );
}

/* HillTiller logo block for card 3 */
function HTLogo() {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <Image src="/hill-logo.png" alt="Hill Tiller" width={160} height={128}
             className="object-contain" style={{ filter: 'brightness(1.1)' }}/>
      <p style={{
        fontFamily: "'Arial Black','Impact',sans-serif",
        fontSize: '11px', letterSpacing: '3px', color: 'rgba(255,255,255,0.8)',
        fontWeight: 900,
      }}>SPECIALTY BLENDS</p>
    </div>
  );
}

function Card({ card, onEnter }: { card: typeof CARDS[0]; onEnter: () => void }) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:scale-[1.015]"
      style={{
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(22px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
        border: '1.5px solid rgba(255,255,255,0.35)',
        boxShadow: '0 16px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
      }}
    >
      {/* Company name */}
      <div className="text-center px-3 pt-4 pb-0">
        {card.topLine.split('\n').map((line, i) => (
          <p key={i} style={{
            fontFamily: "'Arial Black','Impact',sans-serif",
            fontSize: '21px', fontWeight: 900, color: 'white', lineHeight: 1.2,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}>{line}</p>
        ))}
      </div>

      {/* ESTD / HillTiller logo */}
      <div className="text-center px-3 pb-0">
        {card.badge ? (
          <p className="flex items-center justify-center text-white/90 font-bold text-sm tracking-widest">
            ESTD <Cherry /> 1920
          </p>
        ) : card.hillTiller ? (
          <HTLogo />
        ) : null}
      </div>

      {/* MSP + bean */}
      {card.hasMSP && (
        <div className="px-2 pt-0 pb-0">
          <MSPLogo />
        </div>
      )}

      {/* Card photo */}
      <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height: '185px' }}>
        <Image
          src={card.photo}
          alt={card.sub}
          fill
          className="object-cover"
          style={{ filter: 'brightness(0.92) saturate(1.1)' }}
        />
      </div>

      {/* COFFEE + subtitle */}
      <div className="text-center px-3 pt-2 pb-0">
        <p style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: '40px', fontWeight: 900, color: 'white',
          letterSpacing: '2px',
          textShadow: '0 3px 14px rgba(0,0,0,0.8)',
          lineHeight: 1.05,
        }}>COFFEE</p>
        <p className="text-white/80 font-semibold text-sm mt-0.5">{card.sub}</p>
      </div>

      {/* Enter button */}
      <div className="px-4 py-4">
        <button
          onClick={onEnter}
          className="w-full py-2.5 rounded-xl font-semibold text-base text-white transition-all duration-150 active:scale-95"
          style={{
            background: 'rgba(155,115,75,0.52)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 14px rgba(0,0,0,0.35)',
          }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

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
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <Image src="/bg.png" alt="background" fill
               className="object-cover" style={{ filter: 'blur(8px) brightness(0.55)', transform: 'scale(1.08)' }}/>
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(150deg,rgba(70,38,12,0.5) 0%,rgba(90,55,18,0.38) 100%)' }}/>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center px-4 mb-6 mt-4">
        <h1 className="uppercase" style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: 'clamp(26px,5vw,60px)', fontWeight: 900, color: 'white',
          letterSpacing: '3px',
          textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)',
        }}>
          Welcome to MSP Coffee World
        </h1>
      </div>

      {/* Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl px-4">
        {CARDS.map(card => (
          <Card key={card.id} card={card} onEnter={() => handleEnter(card)} />
        ))}
      </div>

      {/* Diamond */}
      <div className="relative z-10 mt-8 mb-4 text-white/35 text-2xl select-none">✦</div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-2xl"
             style={{ background: 'rgba(20,10,5,0.93)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(14px)' }}>
          🚧 {toast}
        </div>
      )}
    </div>
  );
}
