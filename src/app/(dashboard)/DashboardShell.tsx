'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  CloudRain, Fuel, Droplets, FileText, Users, Wheat, DollarSign,
  Sprout, SprayCan, Truck, Package, ShoppingCart, CloudSun, Brain,
  UserCog, Menu, X, LogOut, Coffee, Globe,
} from 'lucide-react';
import { NAV_ITEMS } from '@/lib/auth/access';
import type { Role } from '@/lib/auth/access';
import { signOut } from './actions';

const ICON_MAP: Record<string, React.ElementType> = {
  CloudRain, Fuel, Droplets, FileText, Users, Wheat, DollarSign,
  Sprout, SprayCan, Truck, Package, ShoppingCart, CloudSun, Brain, UserCog, Globe,
};

type Profile = {
  name: string;
  role: string;
  estate: string | null;
};

export default function DashboardShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(profile.role as Role)
  );

  const currentTitle =
    NAV_ITEMS.find((item) => item.href === pathname)?.label ?? 'Dashboard';

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="flex h-screen bg-[#1a2e3e] text-white overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#14222e] border-r border-white/10 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <Coffee className="h-7 w-7 text-[#86efac]" />
          <span className="text-lg font-bold tracking-tight">
            MSP <span className="text-[#86efac]">Coffee</span>
          </span>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filteredNav.map((item) => {
            const Icon = ICON_MAP[item.iconName] ?? FileText;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-[#86efac]/15 text-[#86efac]'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#86efac]/20 text-[#86efac] font-bold text-sm shrink-0">
              {profile.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.name}</p>
              <p className="text-xs text-white/50 capitalize">{profile.role}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-white/40 hover:text-red-400 transition"
                title="Sign out"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-4 px-4 lg:px-6 py-4 border-b border-white/10 bg-[#14222e]/50">
          <button
            className="lg:hidden text-white/70 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <h2 className="text-lg font-semibold">{currentTitle}</h2>
          <span className="ml-auto text-sm text-white/50">{today}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
