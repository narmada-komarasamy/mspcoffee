import { CalendarClock, Mail, ReceiptText } from 'lucide-react';
import s from '../hilltiller-sales.module.css';

export default function HillTillerReportsPage() {
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>Daily Email</p>
          <h1 className={s.title}>Daily Reports</h1>
          <p className={s.subtitle}>
            The first scheduled report will use yesterday completed data and go out
            daily at 11:00 AM IST after recipients and Shopify sync are approved.
          </p>
        </div>
        <span className={s.statusPill}><CalendarClock size={16} /> 11 AM IST</span>
      </section>

      <section className={s.panelGrid}>
        <article className={`${s.panel} ${s.panelLarge}`}>
          <h2 className={s.panelTitle}>Report Sections</h2>
          <div className={s.settingList}>
            {[
              'New sales headline',
              'POS vs Online split',
              'Orders, net sales, discounts, refunds, and unfulfilled orders',
              'Top products by weight',
              'Low stock by units and days of cover',
              'GST and accounting summary',
            ].map((item) => (
              <div className={s.settingItem} key={item}>
                <p className={s.settingTitle}>{item}</p>
                <span className={s.badge}>Included</span>
              </div>
            ))}
          </div>
        </article>

        <article className={`${s.panel} ${s.panelSmall}`}>
          <h2 className={s.panelTitle}>Draft Summary</h2>
          <div className={s.emptyState}>
            Good morning. HillTiller sales for yesterday will appear here after Shopify
            data is connected. The email will include sales, orders, channel split,
            inventory warnings, and GST totals.
          </div>
          <div style={{ height: 12 }} />
          <span className={s.badge}><Mail size={13} /> Email first</span>
          <span className={s.badge} style={{ marginLeft: 8 }}><ReceiptText size={13} /> GST ready</span>
        </article>
      </section>
    </div>
  );
}
