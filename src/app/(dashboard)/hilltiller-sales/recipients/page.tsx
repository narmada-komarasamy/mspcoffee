import { MailPlus, Users } from 'lucide-react';
import s from '../hilltiller-sales.module.css';

export default function HillTillerRecipientsPage() {
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div>
          <p className={s.eyebrow}>Report Distribution</p>
          <h1 className={s.title}>Recipients</h1>
          <p className={s.subtitle}>
            Manage users who will receive the daily HillTiller email. Phase 1 creates
            the place for this; live send behavior comes after report approval.
          </p>
        </div>
        <span className={s.statusPill}><Users size={16} /> Admin managed</span>
      </section>

      <section className={s.panelGrid}>
        <article className={`${s.panel} ${s.panelLarge}`}>
          <h2 className={s.panelTitle}>Recipient List</h2>
          <div className={s.emptyState}>
            No recipients added yet. The database structure is ready for recipient
            name, email, active status, report frequency, and notes.
          </div>
        </article>

        <article className={`${s.panel} ${s.panelSmall}`}>
          <h2 className={s.panelTitle}>Planned Controls</h2>
          <div className={s.settingList}>
            <div className={s.settingItem}>
              <MailPlus size={17} color="var(--t-accent)" />
              <p className={s.settingText}>Add recipient</p>
            </div>
            <div className={s.settingItem}>
              <MailPlus size={17} color="var(--t-accent)" />
              <p className={s.settingText}>Pause recipient</p>
            </div>
            <div className={s.settingItem}>
              <MailPlus size={17} color="var(--t-accent)" />
              <p className={s.settingText}>Choose daily or weekly summary later</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
