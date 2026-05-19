'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AppUser = { id: string; name: string; role: string; estate: string | null };

/* ── Shared style constants ── */
const S = {
  companyFont: { fontFamily: "'Arial Black','Impact',sans-serif", fontSize: '22px', fontWeight: 900, color: 'white', lineHeight: 1.2, textShadow: '0 2px 10px rgba(0,0,0,0.9)' } as React.CSSProperties,
  coffeeFont:  { fontFamily: "'Arial Black','Impact',sans-serif", fontSize: '46px', fontWeight: 900, color: 'white', letterSpacing: '3px', textShadow: '0 3px 16px rgba(0,0,0,0.9)', lineHeight: 1 } as React.CSSProperties,
  subFont:     { color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' } as React.CSSProperties,
  estdFont:    { color: 'rgba(255,255,255,0.92)', fontWeight: 700, fontSize: '13px', letterSpacing: '2px' } as React.CSSProperties,
  mspSize:     '96px',
  photoHeight: 195,
  cardStyle:   {
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(22px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
    border: '1.5px solid rgba(255,255,255,0.30)',
    boxShadow: '0 16px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
  } as React.CSSProperties,
  btnStyle: {
    background: 'rgba(140,102,62,0.52)',
    border: '1.5px solid rgba(255,255,255,0.30)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  } as React.CSSProperties,
};

function Cherry() {
  return (
    <svg width="22" height="22" viewBox="0 0 50 50" className="inline-block mx-1 align-middle">
      <circle cx="16" cy="30" r="10" fill="#c0392b"/>
      <circle cx="30" cy="30" r="10" fill="#e74c3c"/>
      <path d="M16 20 Q23 5 30 20" stroke="#27ae60" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="23" cy="13" rx="9" ry="5.5" fill="#2ecc71" transform="rotate(-8 23 13)"/>
      <ellipse cx="23" cy="13" rx="9" ry="5.5" fill="#27ae60" opacity="0.65" transform="rotate(22 23 13)"/>
    </svg>
  );
}

function MSPBig() {
  return (
    <div className="flex items-center justify-center select-none" style={{ lineHeight: 1, margin: '0' }}>
      <span style={{ fontFamily: "'Arial Black','Impact',sans-serif", fontSize: S.mspSize, fontWeight: 900, color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.9)', letterSpacing: '-2px' }}>MS</span>
      <span style={{ position: 'relative', display: 'inline-block', width: '80px', height: '104px' }}>
        <span style={{ fontFamily: "'Arial Black','Impact',sans-serif", fontSize: S.mspSize, fontWeight: 900, color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.9)', position: 'absolute', left: 0, top: 0 }}>P</span>
        <svg viewBox="0 0 46 58" style={{ position: 'absolute', top: '14px', left: '18px', width: '36px', height: '46px', pointerEvents: 'none' }}>
          <ellipse cx="23" cy="29" rx="20" ry="25" fill="#5c2d0a"/>
          <path d="M23 7 Q37 18 35 29 Q37 40 23 51" stroke="#a0522d" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        </svg>
      </span>
    </div>
  );
}

/* ── Uniform card wrapper ── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={S.cardStyle}>
      {children}
    </div>
  );
}

function EnterBtn({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-4 pb-4 pt-3">
      <button onClick={onClick} className="w-full py-2.5 rounded-xl font-semibold text-base text-white transition-all duration-150 active:scale-95" style={S.btnStyle}>
        Enter
      </button>
    </div>
  );
}

function PhotoBox({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height: S.photoHeight, flexShrink: 0 }}>
      <Image src={src} alt={alt} fill className="object-cover object-center" style={{ filter: 'brightness(0.94) saturate(1.05)' }}/>
    </div>
  );
}

function CoffeeSub({ sub }: { sub: string }) {
  return (
    <div className="text-center px-3 pt-2 pb-0">
      <p style={S.coffeeFont}>COFFEE</p>
      <p style={{ ...S.subFont, marginTop: '3px' }}>{sub}</p>
    </div>
  );
}

/* ── Card 1: MSP Coffee ── */
function Card1({ onEnter }: { onEnter: () => void }) {
  return (
    <Card>
      <div className="text-center px-4 pt-4 pb-0.5">
        <p style={S.companyFont}>MSP Coffee</p>
        <p style={S.estdFont}>ESTD <Cherry /> 1920</p>
      </div>
      <MSPBig />
      <PhotoBox src="/home/card1-beans.jpg" alt="Estate" />
      <CoffeeSub sub="Estate Management" />
      <EnterBtn onClick={onEnter} />
    </Card>
  );
}

/* ── Card 2: MSP (P) Ltd ── */
function Card2({ onEnter }: { onEnter: () => void }) {
  return (
    <Card>
      <div className="text-center px-4 pt-4 pb-0.5">
        <p style={S.companyFont}>MSP (P) Ltd</p>
        <p style={S.estdFont}>ESTD <Cherry /> 1920</p>
      </div>
      <MSPBig />
      <PhotoBox src="/home/card2-sacks-crop.jpg" alt="Sacks" />
      <CoffeeSub sub="Trading Management" />
      <EnterBtn onClick={onEnter} />
    </Card>
  );
}

/* ── Card 3: HillTiller ── */
function Card3({ onEnter }: { onEnter: () => void }) {
  return (
    <Card>
      <div className="text-center px-4 pt-4 pb-0">
        <p style={S.companyFont}>HillTiller</p>
        <p style={S.companyFont}>Coffee Roasters</p>
      </div>
      {/* HillTiller logo + SPECIALTY BLENDS takes same vertical space as ESTD + MSP rows */}
      <div className="flex flex-col items-center justify-center" style={{ height: '128px' }}>
        <div className="relative" style={{ width: 168, height: 96 }}>
          <Image src="/home/hill-logo-trans.png" alt="HillTiller" fill className="object-contain"/>
        </div>
        <p style={{ fontFamily: "'Arial Black','Impact',sans-serif", fontSize: '10px', letterSpacing: '4px', color: 'rgba(255,255,255,0.88)', fontWeight: 900, marginTop: '2px' }}>
          SPECIALTY BLENDS
        </p>
      </div>
      <PhotoBox src="/home/card3-pkgs-crop.jpg" alt="Packages" />
      <CoffeeSub sub="Sales Management" />
      <EnterBtn onClick={onEnter} />
    </Card>
  );
}

/* ── Page ── */
export default function HomePage() {
  const router = useRouter();
  const [user, setUser]   = useState<AppUser | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  const soon = (label: string) => {
    setToast(`${label} is coming soon!`);
    setTimeout(() => setToast(''), 3000);
  };

  if (!user) return null;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6">

      {/* Background */}
      <div className="absolute inset-0">
        <Image src="/bg.png" alt="bg" fill className="object-cover"
               style={{ filter: 'blur(10px) brightness(0.52)', transform: 'scale(1.1)' }}/>
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(145deg,rgba(65,35,10,0.50) 0%,rgba(85,50,18,0.38) 100%)' }}/>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h1 style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: 'clamp(26px, 5vw, 62px)',
          fontWeight: 900, color: 'white', letterSpacing: '3px', textTransform: 'uppercase',
          textShadow: '0 4px 24px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,1)',
          lineHeight: 1.05,
        }}>
          Welcome to MSP Coffee World
        </h1>
      </div>

      {/* Cards — equal height via grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl items-start">
        <Card1 onEnter={() => router.push('/rainfall')} />
        <Card2 onEnter={() => soon('Trading Management')} />
        <Card3 onEnter={() => soon('Sales Management')} />
      </div>

      <div className="relative z-10 mt-6 text-white/30 text-2xl select-none">✦</div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white"
             style={{ background: 'rgba(20,10,5,0.93)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(14px)' }}>
          🚧 {toast}
        </div>
      )}
    </div>
  );
}
