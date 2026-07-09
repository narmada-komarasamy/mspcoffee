/**
 * Single source of truth for role-based nav and access control.
 * Imported by both the dashboard layout (nav filtering) and page-level guards.
 * Keep this file serializable — no React imports, no server-only imports.
 */

export type Role = 'admin' | 'supervisor' | 'worker' | 'ceo';

export type NavLeafDef  = { label: string; href: string };
export type NavGroupDef = { label: string; href?: never; children: NavLeafDef[] };
export type NavChildDef = NavLeafDef | NavGroupDef;

export type NavItemDef = {
  label: string;
  href: string;
  iconName: string; // lucide icon name as string — resolved to component in layout
  roles: Role[];
  children?: NavChildDef[];
};

export const NAV_ITEMS: NavItemDef[] = [
  { label: 'Rain Gauge',          href: '/rainfall',        iconName: 'CloudRain',    roles: ['admin', 'supervisor', 'worker', 'ceo'] },
  { label: 'Fleet Fuel Expenses', href: '/fuel-expenses',   iconName: 'Fuel',         roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'HO Fuel',             href: '/ho-fuel',         iconName: 'Droplets',     roles: ['admin', 'supervisor', 'ceo'] },
  {
    label: 'Processing Data', href: '/processing-dashboard', iconName: 'BarChart2', roles: ['admin', 'supervisor', 'ceo'],
    children: [
      {
        label: 'Estate Management',
        children: [
          { label: 'Estate Staff Meetings', href: '/processing-dashboard/estate-management/staff-meetings' },
        ],
      },
      {
        label: '2025–2026',
        children: [
          { label: 'Stanmore Estate',     href: '/processing-dashboard/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/processing-dashboard/bve' },
          { label: 'Moganad Estate',      href: '/processing-dashboard/moganad-estate' },
          { label: 'Orchardale Estate',   href: '/processing-dashboard/orchardale-estate' },
          { label: 'Hidden Falls Estate', href: '/processing-dashboard/hidden-falls-estate' },
        ],
      },
      {
        label: '2024–2025',
        children: [
          { label: 'Stanmore Estate',     href: '/processing-dashboard/2024-2025/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/processing-dashboard/2024-2025/bve' },
          { label: 'Moganad Estate',      href: '/processing-dashboard/2024-2025/moganad-estate' },
          { label: 'Orchardale Estate',   href: '/processing-dashboard/2024-2025/orchardale-estate' },
          { label: 'Hidden Falls Estate', href: '/processing-dashboard/2024-2025/hidden-falls-estate' },
        ],
      },
      {
        label: '2023–2024',
        children: [
          { label: 'Stanmore Estate',     href: '/processing-dashboard/2023-2024/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/processing-dashboard/2023-2024/bve' },
          { label: 'Moganad Estate',      href: '/processing-dashboard/2023-2024/moganad-estate' },
          { label: 'Orchardale Estate',   href: '/processing-dashboard/2023-2024/orchardale-estate' },
          { label: 'Hidden Falls Estate', href: '/processing-dashboard/2023-2024/hidden-falls-estate' },
        ],
      },
      {
        label: '2022–2023',
        children: [
          { label: 'Stanmore Estate',     href: '/processing-dashboard/2022-2023/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/processing-dashboard/2022-2023/bve' },
          { label: 'Moganad Estate',      href: '/processing-dashboard/2022-2023/moganad-estate' },
          { label: 'Orchardale Estate',   href: '/processing-dashboard/2022-2023/orchardale-estate' },
          { label: 'Hidden Falls Estate', href: '/processing-dashboard/2022-2023/hidden-falls-estate' },
        ],
      },
      {
        label: '2021–2022',
        children: [
          { label: 'Stanmore Estate',     href: '/processing-dashboard/2021-2022/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/processing-dashboard/2021-2022/bve' },
          { label: 'Moganad Estate',      href: '/processing-dashboard/2021-2022/moganad-estate' },
          { label: 'Orchardale Estate',   href: '/processing-dashboard/2021-2022/orchardale-estate' },
          { label: 'Hidden Falls Estate', href: '/processing-dashboard/2021-2022/hidden-falls-estate' },
        ],
      },
      {
        label: '2020–2021',
        children: [
          { label: 'Stanmore Estate',     href: '/processing-dashboard/2020-2021/stanmore-estate' },
          { label: 'Bison Valley Estate', href: '/processing-dashboard/2020-2021/bve' },
          { label: 'Moganad Estate',      href: '/processing-dashboard/2020-2021/moganad-estate' },
          { label: 'Orchardale Estate',   href: '/processing-dashboard/2020-2021/orchardale-estate' },
          { label: 'Hidden Falls Estate', href: '/processing-dashboard/2020-2021/hidden-falls-estate' },
        ],
      },
    ],
  },
  { label: 'Labour Costs',        href: '/labour-costs',    iconName: 'DollarSign',   roles: ['admin'] },
  { label: 'Cup Score Catalogue', href: '/cup-scores',      iconName: 'Award',        roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'Daily Report',        href: '/daily-report',    iconName: 'FileText',     roles: ['admin', 'supervisor', 'worker', 'ceo'] },
  { label: 'Muster Roll',         href: '/muster-roll',     iconName: 'Users',        roles: ['admin', 'supervisor', 'worker', 'ceo'] },
  { label: 'Harvest Yield',       href: '/harvest-yield',   iconName: 'Wheat',        roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'Nursery',             href: '/nursery',         iconName: 'Sprout',       roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'Spraying Log',        href: '/spraying-log',    iconName: 'SprayCan',     roles: ['admin', 'supervisor', 'ceo'] },
  { label: 'Vehicle Log',         href: '/vehicle-log',     iconName: 'Truck',        roles: ['admin', 'supervisor', 'ceo'] },
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
