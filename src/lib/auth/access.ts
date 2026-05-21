/**
 * Single source of truth for role-based nav and access control.
 * Imported by both the dashboard layout (nav filtering) and page-level guards.
 * Keep this file serializable — no React imports, no server-only imports.
 */

export type Role = 'admin' | 'supervisor' | 'worker';

export type NavItemDef = {
  label: string;
  href: string;
  iconName: string; // lucide icon name as string — resolved to component in layout
  roles: Role[];
  children?: { label: string; href: string }[];
};

export const NAV_ITEMS: NavItemDef[] = [
  { label: 'Rain Gauge',          href: '/rainfall',        iconName: 'CloudRain',    roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Fleet Fuel Expenses', href: '/fuel-expenses',   iconName: 'Fuel',         roles: ['admin', 'supervisor'] },
  { label: 'HO Fuel',             href: '/ho-fuel',         iconName: 'Droplets',     roles: ['admin', 'supervisor'] },
  {
    label: 'Processing Data', href: '/processing-dashboard', iconName: 'BarChart2', roles: ['admin', 'supervisor'],
    children: [
      { label: 'Stanmore Estate', href: '/processing-dashboard/stanmore-estate' },
      { label: 'Bison Valley Estate',   href: '/processing-dashboard/bve' },
      { label: 'Moganad Estate',        href: '/processing-dashboard/moganad-estate' },
      { label: 'Orchardale Estate',     href: '/processing-dashboard/orchardale-estate' },
    ],
  },
  { label: 'Labour Costs',        href: '/labour-costs',    iconName: 'DollarSign',   roles: ['admin'] },
  { label: 'Cup Score Catalogue', href: '/cup-scores',      iconName: 'Award',        roles: ['admin', 'supervisor'] },
  { label: 'Daily Report',        href: '/daily-report',    iconName: 'FileText',     roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Muster Roll',         href: '/muster-roll',     iconName: 'Users',        roles: ['admin', 'supervisor', 'worker'] },
  { label: 'Harvest Yield',       href: '/harvest-yield',   iconName: 'Wheat',        roles: ['admin', 'supervisor'] },
  { label: 'Nursery',             href: '/nursery',         iconName: 'Sprout',       roles: ['admin', 'supervisor'] },
  { label: 'Spraying Log',        href: '/spraying-log',    iconName: 'SprayCan',     roles: ['admin', 'supervisor'] },
  { label: 'Vehicle Log',         href: '/vehicle-log',     iconName: 'Truck',        roles: ['admin', 'supervisor'] },
  { label: 'Store Inventory',     href: '/store-inventory', iconName: 'Package',      roles: ['admin'] },
  { label: 'Shopify Orders',      href: '/shopify-orders',  iconName: 'ShoppingCart', roles: ['admin'] },
  { label: 'Weather',             href: '/weather',         iconName: 'CloudSun',     roles: ['admin', 'worker'] },
  { label: 'AI Insights',         href: '/ai-insights',     iconName: 'Brain',        roles: ['admin'] },
  { label: 'Users',               href: '/admin/users',     iconName: 'UserCog',      roles: ['admin'] },
];

/**
 * Returns true if the given role is allowed on this pathname.
 * Non-nav routes (e.g. /account/*) return true here —
 * they are governed by page-level requireRole() checks instead.
 */
export function canAccess(pathname: string, role: Role): boolean {
  const match = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/')
  );
  if (!match) return true;
  return match.roles.includes(role);
}
