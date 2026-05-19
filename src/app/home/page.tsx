'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AppUser = { id: string; name: string; role: string; estate: string | null };

const CARDS = [
  {
    id: 'estate',
    company: 'MSP Coffee',
    badge: true,
    photo: '/home/card1-beans.jpg',
    photoH: 200,
    sub: 'Estate Management',
    href: '/rainfall',
    active: true,
  },
  {
    id: 'trading',
    company: 'MSP (P) Ltd',
    badge: true,
    photo: '/home/card2-sacks-crop.jpg',
    photoH: 200,
    sub: 'Trading Management',
    href: null,
    active: false,
  },
  {
    id: 'sales',
    company: 'HillTiller\nCoffee Roasters',
    badge: false,
    hillTiller: true,
    photo: '/home/card3-pkgs-crop.jpg',
    photoH: 190,
    sub: 'Sales Management',
    href: null,
    active: false,
  },
];

function Cherry() {
  return (
    <svg width="22" height="22" viewBox="0 0 50 50" className="inline-block mx-1 align-middle -mt-0.5">
      <circle cx="16" cy="30" r="9" fill="#c0392b"/>
      <circle cx="30" cy="30" r="9" fill="#e74c3c"/>
      <path d="M16 21 Q23 6 30 21" stroke="#27ae60" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="23" cy="14" rx="8" ry="5" fill="#2ecc71" transform="rotate(-10 23 14)"/>
      <ellipse cx="23" cy="14" rx="8" ry="5" fill="#27ae60" opacity="0.6" transform="rotate(20 23 14)"/>
    </svg>
  );
}

function MSPText() {
  return (
    <div className="flex items-center justify-center select-none" style={{ lineHeight: 1, margin: '2px 0' }}>
      <span style={{
        fontFamily: "'Arial Black','Impact',sans-serif",
        fontSize: '96px', fontWeight: 900, color: 'white',
        textShadow: '0 3px 18px rgba(0,0,0,0.85)',
        letterSpacing: '-2px',
      }}>MS</span>
      {/* P with coffee bean */}
      <span style={{ position: 'relative', display: 'inline-block', width: '80px', height: '104px' }}>
        <span style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: '96px', fontWeight: 900, color: 'white',
          textShadow: '0 3px 18px rgba(0,0,0,0.85)',
          position: 'absolute', left: 0, top: 0,
        }}>P</span>
        <svg viewBox="0 0 46 58" style={{
          position: 'absolute', top: '13px', left: '18px',
          width: '36px', height: '46px', pointerEvents: 'none',
        }}>
          <ellipse cx="23" cy="29" rx="20" ry="25" fill="#5c2d0a"/>
          <path d="M23 7 Q37 18 35 29 Q37 40 23 51"
            stroke="#a0522d" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        </svg>
      </span>
    </div>
  );
}

function Card({ card, onEnter }: { card: typeof CARDS[0]; onEnter: () => void }) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(22px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
        border: '1.5px solid rgba(255,255,255,0.32)',
        boxShadow: '0 16px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
      }}
    >
      {/* Company name */}
      <div className="text-center px-4 pt-4 pb-0.5">
        {card.company.split('\n').map((line, i) => (
          <p key={i} style={{
            fontFamily: "'Arial Black','Impact',sans-serif",
            fontSize: '22px', fontWeight: 900, color: 'white',
            lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}>{line}</p>
        ))}
      </div>

      {/* ESTD / HillTiller logo + SPECIALTY BLENDS */}
      <div className="text-center px-3">
        {card.badge ? (
          <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: '13px', letterSpacing: '2px' }}>
            ESTD <Cherry /> 1920
          </span>
        ) : card.hillTiller ? (
          <div className="flex flex-col items-center gap-0.5 py-1">
            <div className="relative" style={{ width: 160, height: 98 }}>
              <Image src="/home/hill-logo-trans.png" alt="Hill Tiller" fill className="object-contain"/>
            </div>
            <p style={{
              fontFamily: "'Arial Black','Impact',sans-serif",
              fontSize: '10px', letterSpacing: '4px', color: 'rgba(255,255,255,0.85)', fontWeight: 900,
            }}>SPECIALTY BLENDS</p>
          </div>
        ) : null}
      </div>

      {/* MSP big text (cards 1 & 2 only) */}
      {card.badge && <MSPText />}

      {/* Photo */}
      <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height: `${card.photoH}px`, flexShrink: 0 }}>
        <Image src={card.photo} alt={card.sub} fill className="object-cover"
               style={{ filter: 'brightness(0.93) saturate(1.1)' }}/>
      </div>

      {/* COFFEE + subtitle */}
      <div className="text-center px-3 pt-2 pb-0">
        <p style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: '44px', fontWeight: 900, color: 'white',
          letterSpacing: '3px', textShadow: '0 3px 14px rgba(0,0,0,0.8)', lineHeight: 1.05,
        }}>COFFEE</p>
        <p style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
          {card.sub}
        </p>
      </div>

      {/* Enter */}
      <div className="px-4 py-4">
        <button
          onClick={onEnter}
          className="w-full py-2.5 rounded-xl font-semibold text-base text-white transition-all duration-150 active:scale-95"
          style={{
            background: 'rgba(145,108,68,0.50)',
            border: '1.5px solid rgba(255,255,255,0.32)',
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
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6">

      {/* Background */}
      <div className="absolute inset-0">
        <Image src="/bg.png" alt="bg" fill className="object-cover"
               style={{ filter: 'blur(10px) brightness(0.52)', transform: 'scale(1.1)' }}/>
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(145deg,rgba(65,35,10,0.55) 0%,rgba(85,50,18,0.4) 100%)' }}/>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h1 className="uppercase" style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: 'clamp(28px, 5.5vw, 64px)',
          fontWeight: 900, color: 'white', letterSpacing: '4px',
          textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)',
          lineHeight: 1.05,
        }}>
          Welcome to MSP Coffee World
        </h1>
      </div>

      {/* Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl">
        {CARDS.map(card => (
          <Card key={card.id} card={card} onEnter={() => handleEnter(card)} />
        ))}
      </div>

      {/* Diamond */}
      <div className="relative z-10 mt-6 text-white/30 text-2xl select-none">✦</div>

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
