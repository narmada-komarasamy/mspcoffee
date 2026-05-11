'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  CloudRain, Fuel, Droplets, FileText, Users, Wheat, DollarSign,
  Sprout, SprayCan, Truck, Package, ShoppingCart, CloudSun, Brain,
  UserCog, Menu, X, LogOut, Coffee, Globe, Award,
} from 'lucide-react';
import { NAV_ITEMS } from '@/lib/auth/access';
import type { Role } from '@/lib/auth/access';
import { signOut } from './actions';

const ICON_MAP: Record<string, React.ElementType> = {
  CloudRain, Fuel, Droplets, FileText, Users, Wheat, DollarSign,
  Sprout, SprayCan, Truck, Package, ShoppingCart, CloudSun, Brain, UserCog, Globe, Award,
};

type Profile = { name: string; role: string; estate: string | null };

/* ── Colour themes (mirrors the HTML catalogue) ──────────────────────────── */
const THEMES: Record<string, { label: string; swatch: string; sidebar: string; sidebarMid: string; accent: string; accentText: string }> = {
  forest:   { label: 'Forest Green', swatch: '#1b4a1b', sidebar: '#1b4a1b', sidebarMid: '#2d6e2d', accent: '#e8c84a', accentText: '#1b4a1b' },
  coffee:   { label: 'Deep Coffee',  swatch: '#3e2010', sidebar: '#3e2010', sidebarMid: '#6b3a1f', accent: '#e8c84a', accentText: '#3e2010' },
  navy:     { label: 'Navy Blue',    swatch: '#1a2a4a', sidebar: '#1a2a4a', sidebarMid: '#253d6e', accent: '#e8c84a', accentText: '#1a2a4a' },
  burgundy: { label: 'Burgundy',     swatch: '#4a1020', sidebar: '#4a1020', sidebarMid: '#7a1f35', accent: '#e8c84a', accentText: '#4a1020' },
  slate:    { label: 'Slate',        swatch: '#2a3540', sidebar: '#2a3540', sidebarMid: '#3d5060', accent: '#e8c84a', accentText: '#2a3540' },
};

export default function DashboardShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname       = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock,        setClock]       = useState('');
  const [dateStr,      setDateStr]     = useState('');
  const [themeKey,     setThemeKey]    = useState('forest');
  const [paletteOpen,  setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  const theme = THEMES[themeKey] ?? THEMES.forest;

  /* ── Clock ── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Persist + apply theme ── */
  useEffect(() => {
    const saved = localStorage.getItem('msp_shell_theme') ?? 'forest';
    setThemeKey(saved);
  }, []);

  /* ── Close palette on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyTheme = (key: string) => {
    setThemeKey(key);
    localStorage.setItem('msp_shell_theme', key);
    setPaletteOpen(false);
  };

  const filteredNav  = NAV_ITEMS.filter(item => item.roles.includes(profile.role as Role));
  const currentTitle = NAV_ITEMS.find(item => item.href === pathname)?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#fdf8ee', color: '#1a1a1a' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: `linear-gradient(180deg, ${theme.sidebar} 0%, ${theme.sidebarMid} 100%)`, borderRight: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full font-black text-base shrink-0"
               style={{ background: theme.accent, color: theme.accentText }}>M</div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">MSP Coffee</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>P Ltd</div>
          </div>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filteredNav.map(item => {
            const Icon   = ICON_MAP[item.iconName] ?? FileText;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={active
                  ? { background: 'rgba(255,255,255,0.18)', color: theme.accent }
                  : { color: 'rgba(255,255,255,0.75)' }
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm shrink-0"
                 style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {profile.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.name}</p>
              <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.55)' }}>{profile.role}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="transition hover:text-red-300" style={{ color: 'rgba(255,255,255,0.4)' }} title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header
          className="flex items-center gap-3 px-4 lg:px-6 py-3 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.sidebar} 0%, ${theme.sidebarMid} 100%)`,
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 3px 16px rgba(0,0,0,0.18)',
          }}
        >
          <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>

          <Coffee className="h-5 w-5 shrink-0" style={{ color: theme.accent }} />
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{currentTitle}</h2>

          {/* Clock */}
          <div className="ml-auto flex items-center gap-2 pr-3 mr-1" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="text-right">
              <div className="text-sm font-bold tracking-wide text-white leading-tight">{clock}</div>
              <div className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>{dateStr}</div>
            </div>
          </div>

          {/* Palette button */}
          <div className="relative" ref={paletteRef}>
            <button
              onClick={() => setPaletteOpen(v => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-full transition text-base"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)' }}
              title="Change colour theme"
            >
              🎨
            </button>

            {paletteOpen && (
              <div className="absolute top-full right-0 mt-2 rounded-xl py-3 px-3 z-50 min-w-[180px]"
                   style={{ background: 'white', border: '1px solid #e5dfc8', boxShadow: '0 8px 28px rgba(27,74,27,0.18)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>
                  🎨 Colour Theme
                </div>
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => applyTheme(key)}
                    className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left transition text-sm font-medium"
                    style={{
                      background: key === themeKey ? '#f0ead4' : 'transparent',
                      color: '#1a1a1a',
                      outline: key === themeKey ? '2px solid #2d6e2d' : 'none',
                    }}
                  >
                    <span className="w-6 h-6 rounded-full shrink-0 border-2 border-black/10" style={{ background: t.swatch }} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: '#fdf8ee' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
