import Link from 'next/link';
import {
  BarChart3,
  Bell,
  Mail,
  PlugZap,
  RefreshCw,
  Settings,
  Upload,
  Users,
} from 'lucide-react';
import s from './hilltiller-sales.module.css';

const menuItems = [
  {
    href: '/hilltiller-sales/dashboard',
    icon: BarChart3,
    title: 'Sales Dashboard',
    text: 'Simple and complex views for new sales, POS vs Online, orders, inventory, GST, and product performance.',
    action: 'Open dashboard',
  },
  {
    href: '/hilltiller-sales/import',
    icon: Upload,
    title: 'Data Import',
    text: 'Load Shopify orders, transactions, products, and inventory CSV files, review the detected data, and save a dashboard snapshot.',
    action: 'Import CSV files',
  },
  {
    href: '/hilltiller-sales/connection',
    icon: PlugZap,
    title: 'Shopify Connection',
    text: 'Setup checklist for the read-only HillTiller Shopify connection. Token entry stays off until approved.',
    action: 'Review setup',
  },
  {
    href: '/hilltiller-sales/sync-status',
    icon: RefreshCw,
    title: 'Sync Status',
    text: 'Track historical import, live webhook readiness, last sync time, and data health checks.',
    action: 'View status',
  },
  {
    href: '/hilltiller-sales/reports',
    icon: Mail,
    title: 'Daily Reports',
    text: '11 AM IST daily email format for yesterday completed plus the morning sales headline.',
    action: 'Design report',
  },
  {
    href: '/hilltiller-sales/recipients',
    icon: Users,
    title: 'Recipients',
    text: 'Manage who receives HillTiller daily updates, starting with email before WhatsApp.',
    action: 'Manage recipients',
  },
  {
    href: '/hilltiller-sales/alerts',
    icon: Bell,
    title: 'Alert Settings',
    text: 'Low stock by fixed units and days of cover, plus refund, unfulfilled order, and sales alerts.',
    action: 'Set thresholds',
  },
];

export default function HillTillerSalesMenuPage() {
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>HillTiller Coffee Roasters</p>
          <h1 className={s.title}>HillTiller Coffee Sales Management</h1>
          <p className={s.subtitle}>
            Phase 1 foundation for the read-only Shopify integration: dashboard shell,
            settings, recipients, sync status, and database structure. Live Shopify sync
            remains off until the access flow is approved.
          </p>
        </div>
        <span className={s.statusPill}>
          <Settings size={16} />
          Phase 1 setup
        </span>
      </section>

      <section className={s.menuGrid}>
        {menuItems.map(({ href, icon: Icon, title, text, action }) => (
          <Link className={s.menuCard} href={href} key={href}>
            <span className={s.menuIcon}><Icon size={22} /></span>
            <div>
              <h2 className={s.menuTitle}>{title}</h2>
              <p className={s.menuText}>{text}</p>
            </div>
            <span className={s.menuAction}>{action}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
