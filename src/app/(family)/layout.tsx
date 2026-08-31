'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Coffee, Home, LogOut, Maximize2, Menu, Minimize2, Plane, Vote, X } from 'lucide-react';

const THEMES = {
  forest: { dark: '#1b4a1b', mid: '#2d6e2d' },
  coffee: { dark: '#3e2010', mid: '#6b3a1f' },
  navy: { dark: '#1a2a4a', mid: '#253d6e' },
  burgundy: { dark: '#4a1020', mid: '#7a1f35' },
  slate: { dark: '#2a3540', mid: '#3d5060' },
} as const;

type ThemeKey = keyof typeof THEMES;
type AppUser = { id: string; name: string; role: string; estate: string | null };

const PREVIEW_USER: AppUser = { id: 'family-decisions-preview', name: 'Preview', role: 'preview', estate: null };
const isLocalPreview = process.env.NODE_ENV === 'development';

const navItems = [
  { label: 'Family Decisions', href: '/family-decisions', icon: Vote },
  { label: 'Travel Allowance', href: '/travel-allowance', icon: Plane },
];

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AppUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeKey, setThemeKey] = useState<ThemeKey>('forest');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const theme = THEMES[themeKey];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch('/api/auth/me')
        .then(async (response) => {
          if (!response.ok) {
            localStorage.removeItem('msp_user');
            if (isLocalPreview && pathname === '/family-decisions') {
              setUser(PREVIEW_USER);
              return;
            }
            router.push('/login');
            return;
          }

          const body = await response.json() as { user?: AppUser };
          if (!body.user) {
            localStorage.removeItem('msp_user');
            router.push('/login');
            return;
          }

          const verified = { ...body.user, role: body.user.role.trim().toLowerCase() };
          setUser(verified);
          localStorage.setItem('msp_user', JSON.stringify(verified));
        })
        .catch(() => {
        if (isLocalPreview && pathname === '/family-decisions') {
          setUser(PREVIEW_USER);
          return;
        }
        router.push('/login');
        });

      const storedTheme = localStorage.getItem('msp_theme') as ThemeKey | null;
      if (storedTheme && THEMES[storedTheme]) setThemeKey(storedTheme);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('msp_user');
    void fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (!user) return null;

  const currentTitle = navItems.find(item => item.href === pathname)?.label ?? 'Family and Personal';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const sidebarGrad = `linear-gradient(180deg, ${theme.dark} 0%, ${theme.mid} 100%)`;
  const headerGrad = `linear-gradient(135deg, ${theme.dark} 0%, ${theme.mid} 100%)`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ${
          isFullscreen ? 'hidden' : sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: sidebarGrad, borderRight: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full font-black text-base shrink-0" style={{ background: '#e8c84a', color: theme.dark }}>M</div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">MSP Coffee</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Family and Personal</div>
          </div>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)} title="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-1">
          <Link href="/home" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold w-full transition"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Home className="h-4 w-4 shrink-0" />
            Main Menu
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={active ? { background: 'rgba(255,255,255,0.18)', color: '#e8c84a' } : { color: 'rgba(255,255,255,0.75)' }}>
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm shrink-0" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {user.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.55)' }}>{user.role}</p>
            </div>
            <button onClick={handleLogout} className="transition hover:text-red-300" style={{ color: 'rgba(255,255,255,0.4)' }} title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 lg:px-6 py-3 shrink-0" style={{ background: headerGrad, borderBottom: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 3px 16px rgba(0,0,0,0.18)' }}>
          <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(true)} title="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <Coffee className="h-5 w-5 shrink-0" style={{ color: '#e8c84a' }} />
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{currentTitle}</h2>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleFullscreen}
              className="flex items-center justify-center w-8 h-8 rounded-full transition"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.85)' }}
              title={isFullscreen ? 'Exit full page' : 'Full page'}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <span className="text-sm hidden lg:block" style={{ color: 'rgba(255,255,255,0.7)', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>{today}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: 'var(--t-bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
