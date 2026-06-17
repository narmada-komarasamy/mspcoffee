'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useActivityTracker } from '@/lib/useActivityTracker';
import { supabase } from '@/lib/supabase';
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
  Activity,
  Shield,
  UserCog,
  Menu,
  X,
  LogOut,
  Coffee,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const THEMES = {
  forest:   { label: 'Forest Green', swatch: '#1b4a1b', dark: '#1b4a1b', mid: '#2d6e2d' },
  coffee:   { label: 'Deep Coffee',  swatch: '#3e2010', dark: '#3e2010', mid: '#6b3a1f' },
  navy:     { label: 'Navy Blue',    swatch: '#1a2a4a', dark: '#1a2a4a', mid: '#253d6e' },
  burgundy: { label: 'Burgundy',     swatch: '#4a1020', dark: '#4a1020', mid: '#7a1f35' },
  slate:    { label: 'Slate',        swatch: '#2a3540', dark: '#2a3540', mid: '#3d5060' },
} as const;
type ThemeKey = keyof typeof THEMES;

const FONT_SIZES = { md: '14px', lg: '16px', xl: '19px' } as const;
type FontKey = keyof typeof FONT_SIZES;

type AppUser = {
  id: string;
  name: string;
  pin: string;
  role: string;
  estate: string | null;
};

// hrefs the current user's role is allowed to access (null = not loaded yet)
type AllowedSet = Set<string> | null;

type NavLeaf  = { label: string; href: string };
type NavGroup = { label: string; href?: never; children: NavLeaf[] };
type NavChild = NavLeaf | NavGroup;

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { label: 'Rain Gauge',           href: '/rainfall',             icon: CloudRain,    roles: ['admin', 'supervisor', 'worker', 'ceo'] },
  { label: 'Fleet Fuel Expenses',  href: '/fuel-expenses',        icon: Fuel,         roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'HO Fuel',              href: '/ho-fuel',              icon: Droplets,     roles: ['admin', 'supervisor', 'ceo'] },
  {
    label: 'Processing Dashboard', href: '/processing-dashboard', icon: BarChart2, roles: ['admin', 'supervisor', 'ceo'],
    children: [
      {
        label: '2025–2026',
        children: [
          { label: 'Stanmore Estate',       href: '/processing-dashboard/stanmore-estate' },
          { label: 'Bison Valley Estate',   href: '/processing-dashboard/bve' },
          { label: 'Moganad Estate',        href: '/processing-dashboard/moganad-estate' },
          { label: 'Orchardale Estate',     href: '/processing-dashboard/orchardale-estate' },
          { label: 'Hidden Falls Estate',   href: '/processing-dashboard/hidden-falls-estate' },
        ],
      },
      {
        label: '2024–2025',
        children: [
          { label: 'Stanmore Estate',       href: '/processing-dashboard/2024-2025/stanmore-estate' },
          { label: 'Bison Valley Estate',   href: '/processing-dashboard/2024-2025/bve' },
          { label: 'Moganad Estate',        href: '/processing-dashboard/2024-2025/moganad-estate' },
          { label: 'Orchardale Estate',     href: '/processing-dashboard/2024-2025/orchardale-estate' },
          { label: 'Hidden Falls Estate',   href: '/processing-dashboard/2024-2025/hidden-falls-estate' },
        ],
      },
      {
        label: '2023–2024',
        children: [
          { label: 'Stanmore Estate',       href: '/processing-dashboard/2023-2024/stanmore-estate' },
          { label: 'Bison Valley Estate',   href: '/processing-dashboard/2023-2024/bve' },
          { label: 'Moganad Estate',        href: '/processing-dashboard/2023-2024/moganad-estate' },
          { label: 'Orchardale Estate',     href: '/processing-dashboard/2023-2024/orchardale-estate' },
          { label: 'Hidden Falls Estate',   href: '/processing-dashboard/2023-2024/hidden-falls-estate' },
        ],
      },
      {
        label: '2022–2023',
        children: [
          { label: 'Stanmore Estate',       href: '/processing-dashboard/2022-2023/stanmore-estate' },
          { label: 'Bison Valley Estate',   href: '/processing-dashboard/2022-2023/bve' },
          { label: 'Moganad Estate',        href: '/processing-dashboard/2022-2023/moganad-estate' },
          { label: 'Orchardale Estate',     href: '/processing-dashboard/2022-2023/orchardale-estate' },
          { label: 'Hidden Falls Estate',   href: '/processing-dashboard/2022-2023/hidden-falls-estate' },
        ],
      },
      {
        label: '2021–2022',
        children: [
          { label: 'Stanmore Estate',       href: '/processing-dashboard/2021-2022/stanmore-estate' },
          { label: 'Bison Valley Estate',   href: '/processing-dashboard/2021-2022/bve' },
          { label: 'Moganad Estate',        href: '/processing-dashboard/2021-2022/moganad-estate' },
          { label: 'Orchardale Estate',     href: '/processing-dashboard/2021-2022/orchardale-estate' },
          { label: 'Hidden Falls Estate',   href: '/processing-dashboard/2021-2022/hidden-falls-estate' },
        ],
      },
      {
        label: '2020–2021',
        children: [
          { label: 'Stanmore Estate',       href: '/processing-dashboard/2020-2021/stanmore-estate' },
          { label: 'Bison Valley Estate',   href: '/processing-dashboard/2020-2021/bve' },
          { label: 'Moganad Estate',        href: '/processing-dashboard/2020-2021/moganad-estate' },
          { label: 'Orchardale Estate',     href: '/processing-dashboard/2020-2021/orchardale-estate' },
          { label: 'Hidden Falls Estate',   href: '/processing-dashboard/2020-2021/hidden-falls-estate' },
        ],
      },
    ],
  },
  { label: 'Labour Costs',         href: '/labour-costs',         icon: DollarSign,   roles: ['admin'] },
  {
    label: 'Daily Report', href: '/daily-report', icon: FileText, roles: ['admin', 'supervisor', 'worker', 'ceo'],
    children: [
      { label: 'Stanmore Estate', href: '/daily-report/stanmore-estate' },
    ],
  },
  { label: 'Muster Roll',          href: '/muster-roll',          icon: Users,        roles: ['admin', 'supervisor', 'worker', 'ceo'] },
  {
    label: 'Harvest Yield', href: '/harvest-yield', icon: Wheat, roles: ['admin', 'supervisor', 'ceo'],
    children: [
      {
        label: '2024–2025',
        children: [
          { label: 'Moganad Estate',      href: '/harvest-yield/moganad-estate' },
          { label: 'Stanmore Estate',     href: '/harvest-yield/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/harvest-yield/bison-valley' },
          { label: 'Hidden Falls Estate', href: '/harvest-yield/hidden-falls-estate' },
          { label: 'Orchardale Estate',   href: '/harvest-yield/orchardale-estate' },
        ],
      },
    ],
  },
  { label: 'Nursery',              href: '/nursery',              icon: Sprout,       roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'AI Insights',          href: '/ai-insights',          icon: Brain,        roles: ['admin', 'supervisor', 'worker', 'ceo'] },
  {
    label: 'Admin Controls', href: '/admin-controls', icon: Shield, roles: ['admin'],
    children: [
      { label: 'User Management',   href: '/admin-controls/users' },
      { label: 'Role & Permissions', href: '/admin-controls/permissions' },
      { label: 'Activity Log',      href: '/admin-controls/activity-log' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]               = useState<AppUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeKey, setThemeKey]       = useState<ThemeKey>('forest');
  const [fontKey, setFontKey]         = useState<FontKey>('md');
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [allowedPages, setAllowedPages] = useState<AllowedSet>(null);

  const theme = THEMES[themeKey];

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) { router.push('/login'); return; }

    const cached = JSON.parse(stored) as AppUser;

    // Apply theme/font from localStorage (display prefs only)
    const t = localStorage.getItem('msp_theme') as ThemeKey | null;
    const f = localStorage.getItem('msp_font') as FontKey | null;
    if (t && THEMES[t]) setThemeKey(t);
    const validFont = (f && FONT_SIZES[f as FontKey]) ? f as FontKey : 'md';
    setFontKey(validFont);
    document.documentElement.style.fontSize = FONT_SIZES[validFont];

    // Security: re-fetch role from database — never trust localStorage for access control
    supabase
      .from('app_users')
      .select('id, name, role, estate')
      .eq('id', cached.id)
      .single()
      .then(async ({ data, error }) => {
        const verifiedRole = (!error && data) ? data.role : cached.role;
        const verified: AppUser = { ...cached, role: verifiedRole, name: data?.name ?? cached.name, estate: data?.estate ?? cached.estate };
        setUser(verified);
        localStorage.setItem('msp_user', JSON.stringify(verified));

        // Admin always sees everything; for other roles, load from role_permissions
        if (verifiedRole === 'admin') {
          setAllowedPages(null); // null = show all
          return;
        }

        const { data: perms } = await supabase
          .from('role_permissions')
          .select('page_href, access')
          .eq('role', verifiedRole)
          .neq('access', 'none');

        if (perms) {
          setAllowedPages(new Set(perms.map(p => p.page_href)));
        } else {
          // Table not yet created — fall back to static role array
          setAllowedPages(null);
        }
      });
  }, [router]);

  // Route-level guard: redirect if user navigates directly to a blocked page
  useEffect(() => {
    if (!user || user.role === 'admin' || allowedPages === null) return;
    // Find the top-level nav item whose href matches the current path prefix
    const matchedItem = navItems.find(item => pathname.startsWith(item.href));
    if (!matchedItem) return; // unknown route — let it through
    if (!allowedPages.has(matchedItem.href)) {
      router.replace('/unauthorized');
    }
  }, [pathname, user, allowedPages, router]);

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

  const applyTheme = (k: ThemeKey) => {
    setThemeKey(k);
    localStorage.setItem('msp_theme', k);
  };

  const applyFont = (k: FontKey) => {
    setFontKey(k);
    localStorage.setItem('msp_font', k);
    document.documentElement.style.fontSize = FONT_SIZES[k];
  };

  const handleLogout = () => {
    localStorage.removeItem('msp_user');
    document.cookie = 'msp_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  // Auto-expand parent nav and sub-groups when on a child/grandchild route
  useEffect(() => {
    navItems.forEach(item => {
      const matchesChild = item.children?.some(c => {
        if ('href' in c && c.href === pathname) return true;
        if ('children' in c) return c.children.some(gc => gc.href === pathname);
        return false;
      });
      if (matchesChild) {
        setExpandedNav(prev => ({ ...prev, [item.href]: true }));
      }
      // Also auto-expand the season group if a grandchild matches
      item.children?.forEach(child => {
        if ('children' in child && child.children.some(gc => gc.href === pathname)) {
          const groupKey = `${item.href}__${child.label}`;
          setExpandedNav(prev => ({ ...prev, [groupKey]: true }));
        }
      });
    });
  }, [pathname]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useActivityTracker(navItems.find(i => i.href === pathname)?.label);

  if (!user) return null;

  // If allowedPages is loaded (non-null), use DB permissions; otherwise fall back to static roles
  const filteredNav = navItems.filter((item) => {
    if (user.role === 'admin') return true;
    if (allowedPages !== null) return allowedPages.has(item.href);
    return item.roles.includes(user.role);
  });
  const allLeaves = [
    ...navItems.flatMap(i => i.children ?? []).flatMap(c =>
      'children' in c ? c.children : [c]
    ),
    ...navItems.flatMap(i => i.children ?? []).filter(c => 'href' in c),
  ];
  const currentTitle =
    allLeaves.find(c => c.href === pathname)?.label ??
    navItems.find((item) => item.href === pathname)?.label ??
    'Dashboard';
  const today        = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  const sidebarGrad = `linear-gradient(180deg, ${theme.dark} 0%, ${theme.mid} 100%)`;
  const headerGrad  = `linear-gradient(135deg, ${theme.dark} 0%, ${theme.mid} 100%)`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--t-bg)', color: 'var(--t-text)', fontSize: FONT_SIZES[fontKey] }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden in fullscreen */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ${
          isFullscreen ? 'hidden' : sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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
            const Icon        = item.icon;
            const active      = pathname === item.href;
            const hasChildren = !!(item.children && item.children.length > 0);
            const isExpanded  = expandedNav[item.href] ?? false;
            const childActive = hasChildren && item.children!.some(c =>
              ('href' in c && pathname === c.href) ||
              ('children' in c && c.children.some(gc => pathname === gc.href))
            );

            if (hasChildren) {
              return (
                <div key={item.href}>
                  <div className="flex items-center rounded-lg transition"
                    style={childActive || active ? { background: 'rgba(255,255,255,0.18)' } : {}}>
                    <Link href={item.href} onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium flex-1 min-w-0"
                      style={childActive || active ? { color: '#e8c84a' } : { color: 'rgba(255,255,255,0.75)' }}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      onClick={() => setExpandedNav(prev => ({ ...prev, [item.href]: !prev[item.href] }))}
                      className="px-2 py-2.5 transition"
                      style={{ color: childActive || active ? '#e8c84a' : 'rgba(255,255,255,0.5)' }}>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="ml-7 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                      {item.children!.map(child => {
                        // ── Season group (e.g. "2025–2026") ──────────────────
                        if ('children' in child) {
                          const groupKey     = `${item.href}__${child.label}`;
                          const groupExp     = expandedNav[groupKey] ?? false;
                          const groupActive  = child.children.some(gc => pathname === gc.href);
                          return (
                            <div key={child.label}>
                              <button
                                onClick={() => setExpandedNav(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-bold tracking-widest uppercase transition w-full text-left"
                                style={{ color: groupActive ? '#e8c84a' : 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>
                                <span className="flex-1">{child.label}</span>
                                <ChevronDown className="h-3 w-3 shrink-0 transition-transform duration-200"
                                  style={{ transform: groupExp ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }} />
                              </button>
                              {groupExp && (
                                <div className="ml-2 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                  {child.children.map(gc => {
                                    const gcActive = pathname === gc.href;
                                    return (
                                      <Link key={gc.href} href={gc.href} onClick={() => setSidebarOpen(false)}
                                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition"
                                        style={gcActive ? { background: 'rgba(255,255,255,0.18)', color: '#e8c84a' } : { color: 'rgba(255,255,255,0.85)' }}>
                                        <span className="h-1.5 w-1.5 rounded-full shrink-0"
                                          style={{ background: gcActive ? '#e8c84a' : 'rgba(255,255,255,0.7)' }} />
                                        {gc.label}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }
                        // ── Plain link child ──────────────────────────────────
                        const childIsActive = pathname === child.href;
                        return (
                          <Link key={child.href} href={child.href} onClick={() => setSidebarOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition"
                            style={childIsActive ? { background: 'rgba(255,255,255,0.18)', color: '#e8c84a' } : { color: 'white' }}>
                            <span className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ background: childIsActive ? '#e8c84a' : 'white' }} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

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
              {(['md','lg','xl'] as FontKey[]).map((f, i) => (
                <button key={f} onClick={() => applyFont(f)}
                  className="transition"
                  style={{
                    padding: '4px 9px',
                    background: fontKey === f ? 'rgba(255,255,255,0.25)' : 'transparent',
                    color: fontKey === f ? '#e8c84a' : 'rgba(255,255,255,0.7)',
                    fontSize: f === 'md' ? '11px' : f === 'lg' ? '13px' : '16px',
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: 'var(--t-bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
