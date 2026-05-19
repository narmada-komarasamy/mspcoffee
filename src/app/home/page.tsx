'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AppUser = { id: string; name: string; role: string; estate: string | null };

/* Card 1 — MSP Coffee logo image is the card face (no overlaid MSP text needed) */
/* Card 2 — MSP (P) Ltd with sacks photo + overlaid MSP branding               */
/* Card 3 — HillTiller with packages photo                                      */

function Cherry() {
  return (
    <svg width="24" height="24" viewBox="0 0 50 50" className="inline-block mx-1 align-middle">
      <circle cx="16" cy="30" r="10" fill="#c0392b"/>
      <circle cx="30" cy="30" r="10" fill="#e74c3c"/>
      <path d="M16 20 Q23 5 30 20" stroke="#27ae60" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="23" cy="13" rx="9" ry="5.5" fill="#2ecc71" transform="rotate(-8 23 13)"/>
      <ellipse cx="23" cy="13" rx="9" ry="5.5" fill="#27ae60" opacity="0.65" transform="rotate(22 23 13)"/>
    </svg>
  );
}

function MSPText() {
  return (
    <div className="flex items-center justify-center select-none" style={{ lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Arial Black','Impact',sans-serif",
        fontSize: '100px', fontWeight: 900, color: 'white',
        textShadow: '0 4px 20px rgba(0,0,0,0.9)',
        letterSpacing: '-2px',
      }}>MS</span>
      <span style={{ position: 'relative', display: 'inline-block', width: '84px', height: '108px' }}>
        <span style={{
          fontFamily: "'Arial Black','Impact',sans-serif",
          fontSize: '100px', fontWeight: 900, color: 'white',
          textShadow: '0 4px 20px rgba(0,0,0,0.9)',
          position: 'absolute', left: 0, top: 0,
        }}>P</span>
        <svg viewBox="0 0 46 58" style={{
          position: 'absolute', top: '14px', left: '19px',
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

/* ── Card 1: MSP Coffee — logo image fills the card centre ── */
function Card1({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
         style={{
           background: 'rgba(255,255,255,0.15)',
           backdropFilter: 'blur(22px) saturate(1.6)',
           WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
           border: '1.5px solid rgba(255,255,255,0.32)',
           boxShadow: '0 16px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
         }}>
      {/* Company */}
      <div className="text-center px-4 pt-4 pb-1">
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'22px', fontWeight:900,
                    color:'white', textShadow:'0 2px 8px rgba(0,0,0,0.8)' }}>MSP Coffee</p>
      </div>
      {/* Full MSP logo image — already has ESTD / MSP / COFFEE */}
      <div className="relative mx-3 rounded-xl overflow-hidden flex-1" style={{ minHeight: '380px' }}>
        <Image src="/msp-logo.png" alt="MSP Coffee" fill className="object-cover object-center"
               style={{ filter: 'brightness(0.95)' }}/>
      </div>
      {/* Subtitle */}
      <div className="text-center px-3 pt-2 pb-0">
        <p style={{ color:'rgba(255,255,255,0.82)', fontWeight:600, fontSize:'15px' }}>Estate Management</p>
      </div>
      {/* Enter */}
      <div className="px-4 py-4">
        <button onClick={onEnter}
          className="w-full py-2.5 rounded-xl font-semibold text-base text-white active:scale-95 transition-all duration-150"
          style={{ background:'rgba(145,108,68,0.50)', border:'1.5px solid rgba(255,255,255,0.32)',
                   backdropFilter:'blur(10px)', boxShadow:'0 2px 14px rgba(0,0,0,0.35)' }}>
          Enter
        </button>
      </div>
    </div>
  );
}

/* ── Card 2: MSP (P) Ltd — sacks photo with overlaid branding ── */
function Card2({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
         style={{
           background: 'rgba(255,255,255,0.15)',
           backdropFilter: 'blur(22px) saturate(1.6)',
           WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
           border: '1.5px solid rgba(255,255,255,0.32)',
           boxShadow: '0 16px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
         }}>
      <div className="text-center px-4 pt-4 pb-0.5">
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'22px', fontWeight:900,
                    color:'white', textShadow:'0 2px 8px rgba(0,0,0,0.8)' }}>MSP (P) Ltd</p>
        <span style={{ color:'rgba(255,255,255,0.88)', fontWeight:700, fontSize:'13px', letterSpacing:'2px' }}>
          ESTD <Cherry /> 1920
        </span>
      </div>
      <MSPText />
      <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height:'200px' }}>
        <Image src="/msp-sacks.png" alt="MSP Sacks" fill className="object-cover object-center"
               style={{ filter:'brightness(0.93) saturate(1.1)' }}/>
      </div>
      <div className="text-center px-3 pt-2 pb-0">
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'44px', fontWeight:900,
                    color:'white', letterSpacing:'3px', textShadow:'0 3px 14px rgba(0,0,0,0.8)', lineHeight:1.05 }}>
          COFFEE
        </p>
        <p style={{ color:'rgba(255,255,255,0.82)', fontWeight:600, fontSize:'14px', marginTop:'2px' }}>
          Trading Management
        </p>
      </div>
      <div className="px-4 py-4">
        <button onClick={onEnter}
          className="w-full py-2.5 rounded-xl font-semibold text-base text-white active:scale-95 transition-all duration-150"
          style={{ background:'rgba(145,108,68,0.50)', border:'1.5px solid rgba(255,255,255,0.32)',
                   backdropFilter:'blur(10px)', boxShadow:'0 2px 14px rgba(0,0,0,0.35)' }}>
          Enter
        </button>
      </div>
    </div>
  );
}

/* ── Card 3: HillTiller Coffee Roasters ── */
function Card3({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
         style={{
           background: 'rgba(255,255,255,0.15)',
           backdropFilter: 'blur(22px) saturate(1.6)',
           WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
           border: '1.5px solid rgba(255,255,255,0.32)',
           boxShadow: '0 16px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
         }}>
      <div className="text-center px-4 pt-4 pb-0">
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'22px', fontWeight:900,
                    color:'white', lineHeight:1.2, textShadow:'0 2px 8px rgba(0,0,0,0.8)' }}>HillTiller</p>
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'22px', fontWeight:900,
                    color:'white', lineHeight:1.2, textShadow:'0 2px 8px rgba(0,0,0,0.8)' }}>Coffee Roasters</p>
      </div>
      {/* HillTiller logo */}
      <div className="flex flex-col items-center gap-0.5 py-2">
        <div className="relative rounded-xl overflow-hidden" style={{ width:170, height:104 }}>
          <Image src="/home/hill-logo-trans.png" alt="HillTiller Logo" fill className="object-contain"/>
        </div>
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'10px',
                    letterSpacing:'4px', color:'rgba(255,255,255,0.85)', fontWeight:900 }}>
          SPECIALTY BLENDS
        </p>
      </div>
      {/* Packages photo */}
      <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height:'210px' }}>
        <Image src="/hill-packages.png" alt="HillTiller Packages" fill className="object-cover object-center"
               style={{ filter:'brightness(0.95) saturate(1.05)' }}/>
      </div>
      <div className="text-center px-3 pt-2 pb-0">
        <p style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:'44px', fontWeight:900,
                    color:'white', letterSpacing:'3px', textShadow:'0 3px 14px rgba(0,0,0,0.8)', lineHeight:1.05 }}>
          COFFEE
        </p>
        <p style={{ color:'rgba(255,255,255,0.82)', fontWeight:600, fontSize:'14px', marginTop:'2px' }}>
          Sales Management
        </p>
      </div>
      <div className="px-4 py-4">
        <button onClick={onEnter}
          className="w-full py-2.5 rounded-xl font-semibold text-base text-white active:scale-95 transition-all duration-150"
          style={{ background:'rgba(145,108,68,0.50)', border:'1.5px solid rgba(255,255,255,0.32)',
                   backdropFilter:'blur(10px)', boxShadow:'0 2px 14px rgba(0,0,0,0.35)' }}>
          Enter
        </button>
      </div>
    </div>
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
               style={{ filter:'blur(10px) brightness(0.52)', transform:'scale(1.1)' }}/>
        <div className="absolute inset-0"
             style={{ background:'linear-gradient(145deg,rgba(65,35,10,0.55) 0%,rgba(85,50,18,0.4) 100%)' }}/>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h1 className="uppercase" style={{
          fontFamily:"'Arial Black','Impact',sans-serif",
          fontSize:'clamp(28px,5.5vw,64px)', fontWeight:900, color:'white',
          letterSpacing:'4px', textShadow:'0 4px 24px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)',
        }}>
          Welcome to MSP Coffee World
        </h1>
      </div>

      {/* Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl">
        <Card1 onEnter={() => router.push('/rainfall')} />
        <Card2 onEnter={() => soon('Trading Management')} />
        <Card3 onEnter={() => soon('Sales Management')} />
      </div>

      <div className="relative z-10 mt-6 text-white/30 text-2xl select-none">✦</div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-2xl"
             style={{ background:'rgba(20,10,5,0.93)', border:'1px solid rgba(255,255,255,0.2)', backdropFilter:'blur(14px)' }}>
          🚧 {toast}
        </div>
      )}
    </div>
  );
}
