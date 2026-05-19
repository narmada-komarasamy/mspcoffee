'use client';

import { useEffect, useState } from 'react';
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
  { label: 'Rain Gauge',           href: '/rainfall',       icon: CloudRain,    roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Fleet Fuel Expenses',  href: '/fuel-expenses',  icon: Fuel,         roles: ['admin', 'supervisor'] },
  { label: 'HO Fuel',              href: '/ho-fuel',        icon: Droplets,     roles: ['admin', 'supervisor'] },
  { label: 'Daily Report',         href: '/daily-report',   icon: FileText,     roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Muster Roll',          href: '/muster-roll',    icon: Users,        roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Harvest Yield',        href: '/harvest-yield',  icon: Wheat,        roles: ['admin', 'supervisor'] },
  { label: 'Labour Costs',         href: '/labour-costs',   icon: DollarSign,   roles: ['admin'] },
  { label: 'Nursery',              href: '/nursery',        icon: Sprout,       roles: ['admin', 'supervisor'] },
  { label: 'Spraying Log',         href: '/spraying-log',   icon: SprayCan,     roles: ['admin', 'supervisor'] },
  { label: 'Vehicle Log',          href: '/vehicle-log',    icon: Truck,        roles: ['admin', 'supervisor'] },
  { label: 'Store Inventory',      href: '/store-inventory',icon: Package,      roles: ['admin'] },
  { label: 'Shopify Orders',       href: '/shopify-orders', icon: ShoppingCart, roles: ['admin'] },
  { label: 'Weather',              href: '/weather',        icon: CloudSun,     roles: ['admin', 'worker'] },
  { label: 'AI Insights',          href: '/ai-insights',    icon: Brain,        roles: ['admin'] },
  { label: 'Processing Dashboard', href: '/processing-dashboard', icon: BarChart2, roles: ['admin', 'supervisor'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]             = useState<AppUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (!user) return null;

  const filteredNav  = navItems.filter((item) => item.roles.includes(user.role));
  const currentTitle = navItems.find((item) => item.href === pathname)?.label ?? 'Dashboard';
  const today        = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#fdf8ee', color: '#1a1a1a' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'linear-gradient(180deg, #1b4a1b 0%, #2d6e2d 100%)', borderRight: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full font-black text-base shrink-0"
               style={{ background: '#e8c84a', color: '#1b4a1b' }}>M</div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">MSP Coffee</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Estate Management</div>
          </div>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Menu */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold w-full transition"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Main Menu
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filteredNav.map((item) => {
            const Icon   = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={active
                  ? { background: 'rgba(255,255,255,0.18)', color: '#e8c84a' }
                  : { color: 'rgba(255,255,255,0.75)' }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
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
        {/* Top bar */}
        <header
          className="flex items-center gap-3 px-4 lg:px-6 py-3 shrink-0"
          style={{ background: 'linear-gradient(135deg, #1b4a1b 0%, #2d6e2d 100%)', borderBottom: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 3px 16px rgba(0,0,0,0.18)' }}
        >
          <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Coffee className="h-5 w-5 shrink-0" style={{ color: '#e8c84a' }} />
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{currentTitle}</h2>
          <span className="ml-auto text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{today}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: '#fdf8ee' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
