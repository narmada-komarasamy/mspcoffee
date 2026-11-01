import { AlertTriangle, Boxes, Clock3, ReceiptText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import s from '../hilltiller-sales.module.css';

const alerts: { title: string; text: string; Icon: LucideIcon }[] = [
  { title: 'Low stock units', text: 'Alert when a variant falls below a fixed unit threshold.', Icon: Boxes },
  { title: 'Days of stock left', text: 'Alert when sales velocity suggests stock will run out soon.', Icon: Clock3 },
  { title: 'Refund spike', text: 'Alert when refunds rise above a chosen daily threshold.', Icon: ReceiptText },
  { title: 'Unfulfilled aging', text: 'Alert when orders remain unfulfilled beyond the agreed time.', Icon: AlertTriangle },
];

export default function HillTillerAlertsPage() {
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>Thresholds</p>
          <h1 className={s.title}>Alert Settings</h1>
          <p className={s.subtitle}>
            Phase 1 defines the alert types. Actual thresholds can be set after
            Shopify products and inventory are imported.
          </p>
        </div>
        <span className={s.statusPill}><AlertTriangle size={16} /> Draft settings</span>
      </section>

      <section className={s.menuGrid}>
        {alerts.map(({ title, text, Icon }) => (
          <article className={s.menuCard} key={title}>
            <span className={s.menuIcon}><Icon size={22} /></span>
            <div>
              <h2 className={s.menuTitle}>{title}</h2>
              <p className={s.menuText}>{text}</p>
            </div>
            <span className={s.menuAction}>Configure after sync</span>
          </article>
        ))}
      </section>
    </div>
  );
}
