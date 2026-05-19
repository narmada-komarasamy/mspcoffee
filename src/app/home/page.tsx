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
    subtitle: 'Estate Management',
    href: '/rainfall',
    active: true,
    accent: '#4ade80',
    bg: 'linear-gradient(160deg,#1a3a1a 0%,#2d5a2d 60%,#1a3a1a 100%)',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" className="w-20 h-20 mx-auto mb-3 opacity-90">
        {/* Coffee plant / leaf */}
        <circle cx="40" cy="40" r="36" fill="rgba(74,222,128,0.12)" />
        <ellipse cx="40" cy="38" rx="18" ry="26" fill="rgba(74,222,128,0.25)" stroke="#4ade80" strokeWidth="1.5"/>
        <line x1="40" y1="14" x2="40" y2="62" stroke="#4ade80" strokeWidth="1.5"/>
        <line x1="40" y1="26" x2="28" y2="34" stroke="#4ade80" strokeWidth="1.2"/>
        <line x1="40" y1="34" x2="52" y2="42" stroke="#4ade80" strokeWidth="1.2"/>
        <line x1="40" y1="42" x2="29" y2="50" stroke="#4ade80" strokeWidth="1.2"/>
        {/* Coffee berries */}
        <circle cx="26" cy="34" r="4" fill="#ef4444" opacity="0.9"/>
        <circle cx="53" cy="42" r="4" fill="#ef4444" opacity="0.9"/>
        <circle cx="28" cy="50" r="3.5" fill="#ef4444" opacity="0.8"/>
      </svg>
    ),
    badge: 'LIVE',
  },
  {
    id: 'trading',
    company: 'MSP (P) Ltd',
    subtitle: 'Trading Management',
    href: null,
    active: false,
    accent: '#fbbf24',
    bg: 'linear-gradient(160deg,#3e2010 0%,#6b3a1f 60%,#3e2010 100%)',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" className="w-20 h-20 mx-auto mb-3 opacity-80">
        <circle cx="40" cy="40" r="36" fill="rgba(251,191,36,0.10)" />
        {/* Coffee sacks */}
        <rect x="18" y="32" width="22" height="28" rx="4" fill="rgba(251,191,36,0.2)" stroke="#fbbf24" strokeWidth="1.5"/>
        <rect x="40" y="36" width="20" height="24" rx="4" fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth="1.5"/>
        <text x="27" y="50" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">MSP</text>
        <path d="M22 42 Q29 40 36 42" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.6"/>
        <path d="M22 46 Q29 44 36 46" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.6"/>
      </svg>
    ),
    badge: 'SOON',
  },
  {
    id: 'sales',
    company: 'HillTiller',
    subtitle: 'Coffee Roasters · Sales',
    href: null,
    active: false,
    accent: '#a78bfa',
    bg: 'linear-gradient(160deg,#1a1a3a 0%,#2d2d5a 60%,#1a1a3a 100%)',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" className="w-20 h-20 mx-auto mb-3 opacity-80">
        <circle cx="40" cy="40" r="36" fill="rgba(167,139,250,0.10)" />
        {/* Coffee bag packages */}
        <rect x="14" y="28" width="15" height="30" rx="3" fill="rgba(167,139,250,0.2)" stroke="#a78bfa" strokeWidth="1.5"/>
        <rect x="32" y="24" width="15" height="34" rx="3" fill="rgba(167,139,250,0.25)" stroke="#a78bfa" strokeWidth="1.5"/>
        <rect x="50" y="30" width="14" height="28" rx="3" fill="rgba(167,139,250,0.2)" stroke="#a78bfa" strokeWidth="1.5"/>
        <line x1="32" y1="34" x2="47" y2="34" stroke="#a78bfa" strokeWidth="1" opacity="0.5"/>
        <circle cx="39" cy="44" r="5" fill="rgba(167,139,250,0.3)" stroke="#a78bfa" strokeWidth="1"/>
      </svg>
    ),
    badge: 'SOON',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) {
      router.push('/login');
      return;
    }
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
      setToast(`${world.company} – ${world.subtitle} is coming soon!`);
      setTimeout(() => setToast(''), 3000);
    }
  };

  if (!user) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 py-10"
      style={{
        background: 'linear-gradient(135deg, #3b1f0a 0%, #6b3a1f 30%, #8b6914 60%, #5a3010 100%)',
      }}
    >
      {/* Decorative blurred blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #4ade80, transparent 70%)' }} />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, #fbbf24, transparent 70%)' }} />
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
        {/* Subtle grain texture overlay */}
        <div className="absolute inset-0 opacity-5"
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-10">
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-widest uppercase drop-shadow-lg">
          Welcome to MSP Coffee World
        </h1>
        <p className="mt-2 text-white/60 text-sm tracking-wide">
          Signed in as <span className="text-white font-medium">{user.name}</span>
          {user.estate && <span className="text-white/50"> · {user.estate}</span>}
          <span className="text-white/40 capitalize"> · {user.role}</span>
        </p>
      </div>

      {/* Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
        {WORLDS.map((world) => (
          <div
            key={world.id}
            className="relative flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: world.active
                ? `0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px ${world.accent}33`
                : '0 8px 40px rgba(0,0,0,0.3)',
            }}
          >
            {/* Card header band */}
            <div className="px-5 pt-5 pb-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-white font-bold text-lg leading-tight">{world.company}</p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: world.active ? `${world.accent}22` : 'rgba(255,255,255,0.1)',
                    color: world.active ? world.accent : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${world.active ? world.accent + '55' : 'rgba(255,255,255,0.2)'}`,
                  }}
                >
                  {world.badge}
                </span>
              </div>
            </div>

            {/* Icon area */}
            <div
              className="flex-1 flex flex-col items-center justify-center py-8"
              style={{ background: world.bg }}
            >
              {world.icon}
              <p className="text-5xl font-black text-white tracking-widest drop-shadow-lg">MSP</p>
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 pb-5" style={{ background: 'rgba(0,0,0,0.25)' }}>
              <p className="text-center text-white font-bold text-xl tracking-widest uppercase mb-1">COFFEE</p>
              <p className="text-center text-sm mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {world.subtitle}
              </p>
              <button
                onClick={() => handleEnter(world)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95"
                style={
                  world.active
                    ? {
                        background: `linear-gradient(135deg, ${world.accent}cc, ${world.accent}88)`,
                        color: '#1a1a1a',
                        boxShadow: `0 4px 16px ${world.accent}44`,
                      }
                    : {
                        background: 'rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.5)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        cursor: 'not-allowed',
                      }
                }
              >
                {world.active ? 'Enter' : 'Coming Soon'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="relative z-10 mt-10 flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium text-white shadow-xl transition-all"
          style={{ background: 'rgba(30,20,10,0.92)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}
        >
          🚧 {toast}
        </div>
      )}
    </div>
  );
}
