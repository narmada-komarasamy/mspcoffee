'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  CloudRain,
  Fuel,
  Droplets,
  FileText,
  Users,
  Wheat,
  DollarSign,
  Sprout,
  SprayCan,
  Truck,
  Package,
  ShoppingCart,
  CloudSun,
  Brain,
  BarChart2,
  Menu,
  X,
  LogOut,
  Coffee,
} from 'lucide-react';

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

type AppUser = {
  id: string;
  name: string;
  pin: string;
  role: string;
  estate: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
};

const navItems: NavItem[] = [
  { label: 'Rain Gauge',           href: '/rainfall',             icon: CloudRain,    roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Fleet Fuel Expenses',  href: '/fuel-expenses',        icon: Fuel,         roles: ['admin', 'supervisor'] },
  { label: 'HO Fuel',              href: '/ho-fuel',              icon: Droplets,     roles: ['admin', 'supervisor'] },
  { label: 'Processing Dashboard', href: '/processing-dashboard', icon: BarChart2,    roles: ['admin', 'supervisor'] },
  { label: 'Labour Costs',         href: '/labour-costs',         icon: DollarSign,   roles: ['admin'] },
  { label: 'Daily Report',         href: '/daily-report',         icon: FileText,     roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Muster Roll',          href: '/muster-roll',          icon: Users,        roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Harvest Yield',        href: '/harvest-yield',        icon: Wheat,        roles: ['admin', 'supervisor'] },
  { label: 'Nursery',              href: '/nursery',              icon: Sprout,       roles: ['admin', 'supervisor'] },
  { label: 'Spraying Log',         href: '/spraying-log',         icon: SprayCan,     roles: ['admin', 'supervisor'] },
  { label: 'Vehicle Log',          href: '/vehicle-log',          icon: Truck,        roles: ['admin', 'supervisor'] },
  { label: 'Store Inventory',      href: '/store-inventory',      icon: Package,      roles: ['admin'] },
  { label: 'Shopify Orders',       href: '/shopify-orders',       icon: ShoppingCart, roles: ['admin'] },
  { label: 'Weather',              href: '/weather',              icon: CloudSun,     roles: ['admin', 'worker'] },
  { label: 'AI Insights',          href: '/ai-insights',          icon: Brain,        roles: ['admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]               = useState<AppUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeKey, setThemeKey]       = useState<ThemeKey>('forest');
  const [fontKey, setFontKey]         = useState<FontKey>('md');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  const theme = THEMES[themeKey];

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
    const t = localStorage.getItem('msp_theme') as ThemeKey | null;
    const f = localStorage.getItem('msp_font') as FontKey | null;
    if (t && THEMES[t]) setThemeKey(t);
    if (f && FONT_SIZES[f]) { setFontKey(f); document.documentElement.style.fontSize = FONT_SIZES[f]; }
  }, [router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node))
        setPaletteOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyTheme = (k: ThemeKey) => {
    setThemeKey(k);
    localStorage.setItem('msp_theme', k);
    setPaletteOpen(false);
  };

  const applyFont = (k: FontKey) => {
    setFontKey(k);
    localStorage.setItem('msp_font', k);
    document.documentElement.style.fontSize = FONT_SIZES[k];
  };

  const handleLogout = () => {
    localStorage.removeItem('msp_user');
    router.push('/login');
  };

  if (!user) return null;

  const filteredNav  = navItems.filter((item) => item.roles.includes(user.role));
  const currentTitle = navItems.find((item) => item.href === pathname)?.label ?? 'Dashboard';
  const today        = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  const sidebarGrad = `linear-gradient(180deg, ${theme.dark} 0%, ${theme.mid} 100%)`;
  const headerGrad  = `linear-gradient(135deg, ${theme.dark} 0%, ${theme.mid} 100%)`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#fdf8ee', color: '#1a1a1a', fontSize: FONT_SIZES[fontKey] }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: sidebarGrad, borderRight: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full font-black text-base shrink-0"
               style={{ background: '#e8c84a', color: theme.dark }}>M</div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">MSP Coffee</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Estate Management</div>
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
          {filteredNav.map((item) => {
            const Icon   = item.icon;
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

      {/* Main content */}
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
                <button key={f} onClick={() => applyFont(f)}
                  className="transition"
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

            {/* Colour palette */}
            <div className="relative" ref={paletteRef}>
              <button onClick={() => setPaletteOpen(v => !v)}
                className="flex items-center justify-center w-8 h-8 rounded-full transition text-base"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)' }}
                title="Colour theme">🎨</button>

              {paletteOpen && (
                <div className="absolute top-full right-0 mt-2 rounded-xl py-3 px-3 z-50"
                     style={{ background: 'white', border: '1px solid #e5dfc8', boxShadow: '0 8px 28px rgba(27,74,27,0.18)', minWidth: '180px' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>🎨 Colour Theme</div>
                  {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, t]) => (
                    <button key={key} onClick={() => applyTheme(key)}
                      className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left text-sm font-medium transition"
                      style={{ background: key === themeKey ? '#f0ead4' : 'transparent', color: '#1a1a1a', outline: key === themeKey ? `2px solid ${t.mid}` : 'none' }}>
                      <span className="w-5 h-5 rounded-full shrink-0 border-2 border-black/10" style={{ background: t.swatch }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-sm hidden lg:block" style={{ color: 'rgba(255,255,255,0.7)', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>{today}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: '#fdf8ee' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
