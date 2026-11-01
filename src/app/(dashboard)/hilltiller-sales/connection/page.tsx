import { CheckCircle2, KeyRound, LockKeyhole, PlugZap, Store } from 'lucide-react';
import s from '../hilltiller-sales.module.css';

const checklist = [
  'Create a custom app in Shopify admin for hilltiller.com.',
  'Approve read-only scopes for orders, products, inventory, customers, discounts, refunds, fulfillments, and transactions.',
  'Request all-order history access before the full historical import.',
  'Confirm token storage flow before any credential field is enabled in MSP.',
  'Register webhooks only after the first import and dashboard review are approved.',
];

export default function HillTillerConnectionPage() {
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>Connection Setup</p>
          <h1 className={s.title}>Shopify Connection</h1>
          <p className={s.subtitle}>
            Phase 1 keeps this page as a safe setup checklist. No Shopify token is stored
            yet. Credential entry should be enabled only after the security flow is approved.
          </p>
        </div>
        <span className={s.statusPill}><PlugZap size={16} /> Not connected</span>
      </section>

      <section className={s.panelGrid}>
        <article className={`${s.panel} ${s.panelLarge}`}>
          <h2 className={s.panelTitle}>Store Details</h2>
          <div className={s.settingList}>
            <div className={s.settingItem}>
              <div>
                <p className={s.settingTitle}>Shopify store</p>
                <p className={s.settingText}>hilltiller.com</p>
              </div>
              <span className={s.badge}><Store size={13} /> Confirmed</span>
            </div>
            <div className={s.settingItem}>
              <div>
                <p className={s.settingTitle}>Connection mode</p>
                <p className={s.settingText}>Read-only data sync into MSP.</p>
              </div>
              <span className={s.badge}><LockKeyhole size={13} /> Read only</span>
            </div>
            <div className={s.settingItem}>
              <div>
                <p className={s.settingTitle}>Credential storage</p>
                <p className={s.settingText}>Token input intentionally disabled in Phase 1.</p>
              </div>
              <span className={s.badge}><KeyRound size={13} /> Approval needed</span>
            </div>
          </div>
        </article>

        <article className={`${s.panel} ${s.panelSmall}`}>
          <h2 className={s.panelTitle}>Setup Checklist</h2>
          <div className={s.settingList}>
            {checklist.map((item) => (
              <div className={s.settingItem} key={item}>
                <CheckCircle2 size={17} color="var(--t-accent)" />
                <p className={s.settingText}>{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
