"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
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
  Menu,
  X,
  LogOut,
  Coffee,
} from "lucide-react";

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
  { label: "Rain Gauge", href: "/rainfall", icon: CloudRain, roles: ["admin", "supervisor", "worker"] },
  { label: "Fleet Fuel Expenses", href: "/fuel-expenses", icon: Fuel, roles: ["admin", "supervisor"] },
  { label: "HO Fuel", href: "/ho-fuel", icon: Droplets, roles: ["admin", "supervisor"] },
  { label: "Daily Report", href: "/daily-report", icon: FileText, roles: ["admin", "supervisor", "worker"] },
  { label: "Muster Roll", href: "/muster-roll", icon: Users, roles: ["admin", "supervisor", "worker"] },
  { label: "Harvest Yield", href: "/harvest-yield", icon: Wheat, roles: ["admin", "supervisor"] },
  { label: "Labour Costs", href: "/labour-costs", icon: DollarSign, roles: ["admin"] },
  { label: "Nursery", href: "/nursery", icon: Sprout, roles: ["admin", "supervisor"] },
  { label: "Spraying Log", href: "/spraying-log", icon: SprayCan, roles: ["admin", "supervisor"] },
  { label: "Vehicle Log", href: "/vehicle-log", icon: Truck, roles: ["admin", "supervisor"] },
  { label: "Store Inventory", href: "/store-inventory", icon: Package, roles: ["admin"] },
  { label: "Shopify Orders", href: "/shopify-orders", icon: ShoppingCart, roles: ["admin"] },
  { label: "Weather", href: "/weather", icon: CloudSun, roles: ["admin", "worker"] },
  { label: "AI Insights", href: "/ai-insights", icon: Brain, roles: ["admin"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AppUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("msp_user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("msp_user");
    router.push("/login");
  };

  if (!user) return null;

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  const currentTitle =
    navItems.find((item) => item.href === pathname)?.label ?? "Dashboard";

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex h-screen bg-[#1a2e3e] text-white overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#14222e] border-r border-white/10 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#86efac]/15 text-[#86efac]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#86efac]/20 text-[#86efac] font-bold text-sm">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-white/50 capitalize">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-red-400 transition"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
