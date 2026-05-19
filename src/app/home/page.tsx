'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

type AppUser = {
  id: string;
  name: string;
  role: string;
  estate: string | null;
};

const WORLDS = [
  {
    id: 'estate',
    company: 'MSP Coffee',
    estd: 'ESTD 🍒 1920',
    subtitle: 'Estate Management',
    href: '/rainfall',
    active: true,
    photo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
    // coffee beans + map on wood table
  },
  {
    id: 'trading',
    company: 'MSP (P) Ltd',
    estd: 'ESTD 🍒 1920',
    subtitle: 'Trading Management',
    href: null,
    active: false,
    photo: 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=600&q=80',
    // burlap coffee sacks
  },
  {
    id: 'sales',
    company: 'HillTiller Coffee Roasters',
    estd: 'SPECIALTY BLENDS',
    subtitle: 'Sales Management',
    href: null,
    active: false,
    photo: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80',
    // packaged coffee bags
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('msp_user');
    router.push('/login');
  };

  const handleEnter = (world: typeof WORLDS[0]) => {
    if (world.active && world.href) {
      router.push(world.href);
    } else {
      setToast(`${world.subtitle} is coming soon!`);
      setTimeout(() => setToast(''), 3000);
    }
  };

  if (!user) return null;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-8">

      {/* Background photo — warm kitchen/café */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&q=80')",
          filter: 'blur(6px) brightness(0.55)',
          transform: 'scale(1.05)',
        }}
      />
      {/* Warm overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(60,30,10,0.35)' }} />

      {/* ── Header ── */}
      <div className="relative z-10 text-center mb-8">
        <h1
          className="text-4xl sm:text-6xl font-black text-white uppercase tracking-widest"
          style={{ textShadow: '0 3px 20px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)' }}
        >
          Welcome to MSP Coffee World
        </h1>
        <p className="mt-2 text-white/60 text-sm">
          Signed in as <span className="text-white font-semibold">{user.name}</span>
          {user.estate && <span className="text-white/50"> · {user.estate}</span>}
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl">
        {WORLDS.map((world) => (
          <div
            key={world.id}
            className="flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(18px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
              border: '1.5px solid rgba(255,255,255,0.28)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
            }}
          >
            {/* Card top — company name */}
            <div className="px-4 pt-4 pb-2 text-center">
              <p className="text-white font-bold text-xl leading-tight drop-shadow"
                 style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                {world.company}
              </p>
              <p className="text-white/70 text-xs mt-0.5 tracking-widest uppercase">
                {world.estd}
              </p>
            </div>

            {/* MSP large text */}
            <div className="text-center py-1">
              <span
                className="text-7xl font-black text-white leading-none"
                style={{ textShadow: '0 3px 16px rgba(0,0,0,0.7)' }}
              >
                MSP
              </span>
            </div>

            {/* Photo */}
            <div className="relative mx-3 rounded-xl overflow-hidden" style={{ height: '180px' }}>
              <img
                src={world.photo}
                alt={world.subtitle}
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.9)' }}
              />
              {!world.active && (
                <div className="absolute inset-0 flex items-center justify-center"
                     style={{ background: 'rgba(0,0,0,0.35)' }}>
                  <span className="text-white/80 text-xs font-bold tracking-widest uppercase bg-black/40 px-3 py-1 rounded-full">
                    Coming Soon
                  </span>
                </div>
              )}
            </div>

            {/* COFFEE + subtitle */}
            <div className="text-center pt-3 pb-1 px-4">
              <p className="text-white font-black text-3xl tracking-widest uppercase"
                 style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
                COFFEE
              </p>
              <p className="text-white/75 text-sm font-medium mt-0.5">{world.subtitle}</p>
            </div>

            {/* Enter button */}
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={() => handleEnter(world)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95"
                style={{
                  background: 'rgba(180,150,110,0.55)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                  cursor: world.active ? 'pointer' : 'not-allowed',
                }}
              >
                Enter
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="relative z-10 mt-8 flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium text-white shadow-xl"
          style={{
            background: 'rgba(30,15,5,0.92)',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(12px)',
          }}
        >
          🚧 {toast}
        </div>
      )}
    </div>
  );
}
