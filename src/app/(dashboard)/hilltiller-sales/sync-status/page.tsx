import { Clock3, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import s from '../hilltiller-sales.module.css';

const stages = [
  ['Historical Import', 'Waiting for approved Shopify token and all-order access.'],
  ['Daily Incremental Sync', 'Planned for orders, products, customers, inventory, payments, and refunds.'],
  ['Webhook Updates', 'Planned after initial import review.'],
  ['Data Health Checks', 'Will compare Shopify totals against MSP imported totals.'],
];

export default function HillTillerSyncStatusPage() {
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>Data Sync</p>
          <h1 className={s.title}>Sync Status</h1>
          <p className={s.subtitle}>
            This will become the control room for Shopify import progress, last sync
            timestamps, webhook health, and data checks.
          </p>
        </div>
        <span className={s.statusPill}><RefreshCw size={16} /> Not started</span>
      </section>

      <section className={s.kpiGrid}>
        <article className={s.kpiCard}><Database size={19} color="var(--t-accent)" /><p className={s.kpiLabel}>Imported Orders</p><p className={s.kpiValue}>0</p><p className={s.kpiMeta}>Awaiting connection</p></article>
        <article className={s.kpiCard}><Clock3 size={19} color="var(--t-accent)" /><p className={s.kpiLabel}>Last Sync</p><p className={s.kpiValue}>None</p><p className={s.kpiMeta}>No Shopify token stored</p></article>
        <article className={s.kpiCard}><ShieldCheck size={19} color="var(--t-accent)" /><p className={s.kpiLabel}>Mode</p><p className={s.kpiValue}>Read</p><p className={s.kpiMeta}>No Shopify writes planned</p></article>
      </section>

      <section className={s.panel}>
        <h2 className={s.panelTitle}>Phase 1 Sync Plan</h2>
        <div className={s.settingList}>
          {stages.map(([title, text]) => (
            <div className={s.settingItem} key={title}>
              <div>
                <p className={s.settingTitle}>{title}</p>
                <p className={s.settingText}>{text}</p>
              </div>
              <span className={s.badge}>Planned</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
