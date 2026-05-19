'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AppUser = {
  id: string;
  name: string;
  role: string;
  estate: string | null;
};

/* ─── Card data ─────────────────────────────────────────────── */
const CARDS = [
  {
    id: 'estate',
    topLine: 'MSP Coffee',
    badge: 'ESTD',
    year: '1920',
    hasMSP: true,
    photo: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=700&q=85',
    label: 'COFFEE',
    sub: 'Estate Management',
    href: '/rainfall',
    active: true,
  },
  {
    id: 'trading',
    topLine: 'MSP (P) Ltd',
    badge: 'ESTD',
    year: '1920',
    hasMSP: true,
    photo: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=700&q=85',
    label: 'COFFEE',
    sub: 'Trading Management',
    href: null,
    active: false,
  },
  {
    id: 'sales',
    topLine: 'HillTiller\nCoffee Roasters',
    badge: null,
    year: null,
    hasMSP: false,
    hillTiller: true,
    photo: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=700&q=85',
    label: 'COFFEE',
    sub: 'Sales Management',
    href: null,
    active: false,
  },
];

/* ─── Coffee berry SVG (replaces the 🍒 between ESTD / 1920) ── */
function CoffeeBerry() {
  return (
    <svg width="22" height="22" viewBox="0 0 40 40" fill="none" className="inline-block mx-1 align-middle">
      <circle cx="14" cy="24" r="8" fill="#c0392b"/>
      <circle cx="26" cy="24" r="8" fill="#e74c3c"/>
      <circle cx="14" cy="24" r="3" fill="#922b21" opacity="0.5"/>
      <circle cx="26" cy="24" r="3" fill="#922b21" opacity="0.5"/>
      <path d="M14 16 Q20 4 26 16" stroke="#27ae60" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="20" cy="11" rx="5" ry="3" fill="#27ae60" transform="rotate(-15 20 11)"/>
      <ellipse cx="20" cy="11" rx="5" ry="3" fill="#2ecc71" opacity="0.6" transform="rotate(15 20 11)"/>
    </svg>
  );
}

/* ─── MSP text with coffee-bean P ───────────────────────────── */
function MSPText() {
  return (
    <div className="flex items-center justify-center select-none" style={{ lineHeight: 1 }}>
      {/* M S */}
      <span
        style={{
          fontFamily: "'Arial Black', 'Impact', sans-serif",
          fontSize: '88px',
          fontWeight: 900,
          color: 'white',
          textShadow: '0 4px 18px rgba(0,0,0,0.7)',
          letterSpacing: '-2px',
        }}
      >
        MS
      </span>
      {/* P with bean */}
      <span className="relative inline-block" style={{ width: '72px', height: '96px' }}>
        <span
          style={{
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            fontSize: '88px',
            fontWeight: 900,
            color: 'white',
            textShadow: '0 4px 18px rgba(0,0,0,0.7)',
            position: 'absolute',
            left: 0,
            top: 0,
            letterSpacing: '-2px',
          }}
        >
          P
        </span>
        {/* Bean overlay inside the P bowl */}
        <svg
          viewBox="0 0 38 46"
          style={{
            position: 'absolute',
            top: '12px',
            left: '14px',
            width: '36px',
            height: '44px',
            pointerEvents: 'none',
          }}
        >
          <ellipse cx="19" cy="23" rx="16" ry="20" fill="#5c2d0a"/>
          <path
            d="M19 6 Q30 14 28 23 Q30 32 19 40"
            stroke="#a0522d"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
}

/* ─── HillTiller logo placeholder ───────────────────────────── */
function HillTillerLogo() {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {/* Simple mountain + tree silhouette */}
      <svg width="110" height="54" viewBox="0 0 220 108" fill="none">
        <rect width="220" height="108" rx="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
        {/* Mountains */}
        <polygon points="30,80 70,30 110,80" fill="rgba(255,255,255,0.55)"/>
        <polygon points="80,80 120,40 160,80" fill="rgba(255,255,255,0.4)"/>
        {/* Trees */}
        <polygon points="170,80 178,58 186,80" fill="rgba(255,255,255,0.6)"/>
        <polygon points="182,80 190,62 198,80" fill="rgba(255,255,255,0.5)"/>
        {/* Text */}
        <text x="110" y="98" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold"
              fontFamily="Arial, sans-serif" letterSpacing="2">HILL TILLER</text>
      </svg>
      <p className="text-white/80 text-[10px] font-bold tracking-[3px] uppercase mt-0.5">
        COFFEE ROASTERS
      </p>
      <p className="text-white/60 text-[9px] tracking-widest uppercase">
        Specialty Blends
      </p>
    </div>
  );
}

/* ─── Single card ────────────────────────────────────────────── */
function WorldCard({ card, onEnter }: { card: typeof CARDS[0]; onEnter: () => void }) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:scale-[1.015]"
      style={{
        background: 'rgba(255,255,255,0.16)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        border: '1.5px solid rgba(255,255,255,0.35)',
        boxShadow: '0 12px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
        minHeight: '520px',
      }}
    >
      {/* ── Top: company name ── */}
      <div className="text-center px-3 pt-4 pb-1">
        {card.topLine.includes('\n') ? (
          card.topLine.split('\n').map((line, i) => (
            <p key={i}
               style={{
                 fontFamily: "'Arial Black', 'Impact', sans-serif",
                 fontSize: '20px',
                 fontWeight: 900,
                 color: 'white',
                 lineHeight: 1.15,
                 textShadow: '0 2px 8px rgba(0,0,0,0.7)',
               }}>{line}</p>
          ))
        ) : (
          <p style={{
               fontFamily: "'Arial Black', 'Impact', sans-serif",
               fontSize: '22px',
               fontWeight: 900,
               color: 'white',
               textShadow: '0 2px 8px rgba(0,0,0,0.7)',
             }}>{card.topLine}</p>
        )}
      </div>

      {/* ── ESTD / HillTiller logo area ── */}
      <div className="text-center px-3 pb-1">
        {card.badge ? (
          <p className="text-white/85 font-bold text-sm tracking-widest flex items-center justify-center gap-0.5">
            <span>{card.badge}</span>
            <CoffeeBerry />
            <span>{card.year}</span>
          </p>
        ) : card.hillTiller ? (
          <HillTillerLogo />
        ) : null}
      </div>

      {/* ── MSP large text ── */}
      {card.hasMSP && (
        <div className="px-2 pt-1 pb-0">
          <MSPText />
        </div>
      )}

      {/* ── Photo ── */}
      <div className="relative mx-3 rounded-xl overflow-hidden flex-1" style={{ minHeight: '175px', maxHeight: '200px' }}>
        <img
          src={card.photo}
          alt={card.sub}
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.88) saturate(1.1)' }}
        />
        {!card.active && (
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.15)' }} />
        )}
      </div>

      {/* ── COFFEE label ── */}
      <div className="text-center px-3 pt-2 pb-0">
        <p style={{
             fontFamily: "'Arial Black', 'Impact', sans-serif",
             fontSize: '42px',
             fontWeight: 900,
             color: 'white',
             letterSpacing: '2px',
             textShadow: '0 3px 14px rgba(0,0,0,0.7)',
             lineHeight: 1.1,
           }}>
          COFFEE
        </p>
        <p className="text-white/80 font-semibold text-sm mt-0.5">{card.sub}</p>
      </div>

      {/* ── Enter button ── */}
      <div className="px-4 py-4">
        <button
          onClick={onEnter}
          className="w-full py-2.5 rounded-xl font-semibold text-base text-white transition-all duration-150 active:scale-95"
          style={{
            background: 'rgba(160,120,80,0.50)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 14px rgba(0,0,0,0.35)',
            cursor: card.active ? 'pointer' : 'default',
          }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
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
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
         style={{ fontFamily: 'Arial, sans-serif' }}>

      {/* ── Background ── */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1800&q=85')",
          filter: 'blur(8px) brightness(0.6) saturate(0.9)',
          transform: 'scale(1.08)',
        }}
      />
      {/* Warm tint overlay */}
      <div className="absolute inset-0"
           style={{ background: 'linear-gradient(160deg,rgba(80,45,15,0.45) 0%,rgba(100,60,20,0.35) 100%)' }} />

      {/* ── Header ── */}
      <div className="relative z-10 text-center px-4 mb-6 mt-4">
        <h1
          className="uppercase"
          style={{
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            fontSize: 'clamp(28px, 5vw, 62px)',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '3px',
            textShadow: '0 4px 24px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,1)',
            lineHeight: 1.1,
          }}
        >
          Welcome to MSP Coffee World
        </h1>
      </div>

      {/* ── Cards ── */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl px-4">
        {CARDS.map((card) => (
          <WorldCard key={card.id} card={card} onEnter={() => handleEnter(card)} />
        ))}
      </div>

      {/* ── Diamond sparkle ── */}
      <div className="relative z-10 mt-8 mb-4 text-white/40 text-2xl select-none">✦</div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-2xl"
          style={{
            background: 'rgba(20,10,5,0.92)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(14px)',
          }}
        >
          🚧 {toast}
        </div>
      )}
    </div>
  );
}
