'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Globe, Award, BarChart2, Menu, X, LogOut, Coffee, Warehouse, Maximize2, Minimize2, ClipboardList } from 'lucide-react';
import { useActivityTracker } from '@/lib/useActivityTracker';
import { supabase } from '@/lib/supabase';

const THEMES = {
  forest:   { label: 'Forest Green', swatch: '#1b4a1b', dark: '#1b4a1b', mid: '#2d6e2d' },
  coffee:   { label: 'Deep Coffee',  swatch: '#3e2010', dark: '#3e2010', mid: '#6b3a1f' },
  navy:     { label: 'Navy Blue',    swatch: '#1a2a4a', dark: '#1a2a4a', mid: '#253d6e' },
  burgundy: { label: 'Burgundy',     swatch: '#4a1020', dark: '#4a1020', mid: '#7a1f35' },
  slate:    { label: 'Slate',        swatch: '#2a3540', dark: '#2a3540', mid: '#3d5060' },
} as const;
type ThemeKey = keyof typeof THEMES;

const FONT_SIZES = { sm: '13px', md: '15px', lg: '17px' } as const;
type FontKey = keyof typeof FONT_SIZES;

type AppUser = { id: string; name: string; pin: string; role: string; estate: string | null };
type NavItem = { label: string; href: string; icon: React.ElementType; roles: string[]; children?: NavItem[] };

const navItems: NavItem[] = [
  {
    label: 'Cup Score Catalogue',
    href: '/cup-scores-catalogue',
    icon: Award,
    roles: ['admin', 'supervisor', 'ceo'],
    children: [
      { label: 'Board Meetings', href: '/board-meetings', icon: ClipboardList, roles: ['admin', 'ceo'] },
    ],
  },
  { label: 'B2B Trading Hub',       href: '/trading-dashboard',    icon: BarChart2,  roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'Export Operations',     href: '/export-operations',    icon: Globe,      roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'Coffee Storage Central', href: '/coffee-storage',      icon: Warehouse,  roles: ['admin', 'supervisor', 'ceo'] },
];

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]               = useState<AppUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeKey, setThemeKey]       = useState<ThemeKey>('forest');
  const [fontKey, setFontKey]         = useState<FontKey>('md');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const theme = THEMES[themeKey];

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }

    const cached = JSON.parse(stored) as AppUser;

    // Apply theme/font from localStorage (display prefs only)
    const t = localStorage.getItem('msp_theme') as ThemeKey | null;
    const f = localStorage.getItem('msp_font') as FontKey | null;
    if (t && THEMES[t]) setThemeKey(t);
    if (f && FONT_SIZES[f as FontKey]) { setFontKey(f as FontKey); document.documentElement.style.fontSize = FONT_SIZES[f as FontKey]; }

    // Security: re-fetch role from database — never trust localStorage for access control
    supabase
      .from('app_users')
      .select('id, name, role, estate')
      .eq('id', cached.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setUser(cached);
          return;
        }
        const verified: AppUser = { ...cached, role: data.role, name: data.name, estate: data.estate };
        setUser(verified);
        localStorage.setItem('msp_user', JSON.stringify({ ...cached, role: data.role, name: data.name, estate: data.estate }));
      });
  }, [router]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const applyTheme = (k: ThemeKey) => { setThemeKey(k); localStorage.setItem('msp_theme', k); };
  const applyFont  = (k: FontKey)  => { setFontKey(k);  localStorage.setItem('msp_font', k); document.documentElement.style.fontSize = FONT_SIZES[k]; };
  const handleLogout = () => {
    localStorage.removeItem('msp_user');
    document.cookie = 'msp_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useActivityTracker(navItems.flatMap(i => [i, ...(i.children ?? [])]).find(i => i.href === pathname)?.label);

  if (!user) return null;

  const filteredNav  = navItems.filter(item => item.roles.includes(user.role));
  const allItems     = navItems.flatMap(item => [item, ...(item.children ?? [])]);
  const currentTitle = allItems.find(item => item.href === pathname)?.label ?? 'Trading Management';
  const today        = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const sidebarGrad  = `linear-gradient(180deg, ${theme.dark} 0%, ${theme.mid} 100%)`;
  const headerGrad   = `linear-gradient(135deg, ${theme.dark} 0%, ${theme.mid} 100%)`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--t-bg)', color: 'var(--t-text)', fontSize: FONT_SIZES[fontKey] }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar — hidden in fullscreen */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ${isFullscreen ? 'hidden' : sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: sidebarGrad, borderRight: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full font-black text-base shrink-0"
               style={{ background: '#e8c84a', color: theme.dark }}>M</div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">MSP Coffee</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Trading Management</div>
          </div>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-1">
          <Link href="/home" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold w-full transition"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Main Menu
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filteredNav.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const childActive = item.children?.some(c => pathname === c.href);
            return (
              <div key={item.href}>
                <Link href={item.href} onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                  style={active || childActive ? { background: 'rgba(255,255,255,0.18)', color: '#e8c84a' } : { color: 'rgba(255,255,255,0.75)' }}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
                {item.children && item.children.filter(c => c.roles.includes(user.role)).map(child => {
                  const ChildIcon = child.icon;
                  const childIsActive = pathname === child.href;
                  return (
                    <Link key={child.href} href={child.href} onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ml-4 mt-0.5"
                      style={childIsActive ? { background: 'rgba(255,255,255,0.14)', color: '#e8c84a' } : { color: 'rgba(255,255,255,0.6)' }}>
                      <span className="w-px h-3 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.25)', marginLeft: '2px' }} />
                      <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm shrink-0"
                 style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {user.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.55)' }}>{user.role}</p>
            </div>
            <button onClick={handleLogout} className="transition hover:text-red-300"
                    style={{ color: 'rgba(255,255,255,0.4)' }} title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 lg:px-6 py-3 shrink-0"
          style={{ background: headerGrad, borderBottom: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 3px 16px rgba(0,0,0,0.18)' }}>
          <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Coffee className="h-5 w-5 shrink-0" style={{ color: '#e8c84a' }} />
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{currentTitle}</h2>

          <div className="ml-auto flex items-center gap-2">
            {/* Font size */}
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
              {(['sm','md','lg'] as FontKey[]).map((f, i) => (
                <button key={f} onClick={() => applyFont(f)} className="transition"
                  style={{
                    padding: '4px 9px',
                    background: fontKey === f ? 'rgba(255,255,255,0.25)' : 'transparent',
                    color: fontKey === f ? '#e8c84a' : 'rgba(255,255,255,0.7)',
                    fontSize: f === 'sm' ? '11px' : f === 'md' ? '13px' : '15px',
                    fontWeight: 700,
                    borderRight: i < 2 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  }}>A</button>
              ))}
            </div>

            {/* Fullscreen toggle */}
            <button onClick={toggleFullscreen}
              className="flex items-center justify-center w-8 h-8 rounded-full transition"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.85)' }}
              title={isFullscreen ? 'Exit full page' : 'Full page'}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <span className="text-sm hidden lg:block" style={{ color: 'rgba(255,255,255,0.7)', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>{today}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
