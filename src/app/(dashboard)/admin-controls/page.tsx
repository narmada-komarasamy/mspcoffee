'use client';

import Link from 'next/link';
import { UserCog, Activity, Lock, Bell } from 'lucide-react';

const sections = [
  {
    href: '/admin-controls/users',
    icon: UserCog,
    title: 'User Management',
    description: 'Invite, edit, deactivate users. Send password resets and change roles.',
    available: true,
  },
  {
    href: '/admin-controls/activity-log',
    icon: Activity,
    title: 'Activity Log',
    description: 'See who logged in, which pages they visited, and for how long.',
    available: true,
  },
  {
    href: '/admin-controls/permissions',
    icon: Lock,
    title: 'Role & Permissions',
    description: 'Control which roles can access which modules.',
    available: true,
  },
  {
    href: '/admin-controls/security',
    icon: Bell,
    title: 'Security & Alerts',
    description: 'PIN expiry, session controls, and threshold alerts.',
    available: false,
  },
];

export default function AdminControlsPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', fontFamily: 'var(--t-font)' }}>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--t-heading)', margin: 0 }}>
          Admin Controls
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--t-muted)', marginTop: '0.25rem' }}>
          Manage users, permissions, and system settings.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {sections.map(({ href, icon: Icon, title, description, available }) => (
          available ? (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '1rem',
                background: 'var(--t-card)', border: '1px solid var(--t-border)',
                borderRadius: '12px', padding: '1.25rem',
                textDecoration: 'none', transition: 'box-shadow 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(27,74,27,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(74,158,74,0.12)', border: '1px solid rgba(74,158,74,0.2)',
              }}>
                <Icon size={20} style={{ color: 'var(--t-heading)' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--t-heading)', margin: 0, fontSize: '0.9375rem' }}>{title}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--t-muted)', marginTop: '0.25rem' }}>{description}</p>
              </div>
            </Link>
          ) : (
            <div
              key={href}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '1rem',
                background: 'var(--t-card)', border: '1px solid var(--t-border)',
                borderRadius: '12px', padding: '1.25rem', opacity: 0.5, cursor: 'not-allowed',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                background: 'var(--t-subtle)', border: '1px solid var(--t-border)',
              }}>
                <Icon size={20} style={{ color: 'var(--t-muted)' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--t-text)', margin: 0, fontSize: '0.9375rem' }}>
                  {title}
                  <span style={{
                    marginLeft: '8px', fontSize: '11px', fontWeight: 600,
                    padding: '2px 8px', borderRadius: '999px',
                    background: 'var(--t-subtle)', color: 'var(--t-muted)',
                    border: '1px solid var(--t-border)',
                  }}>Coming soon</span>
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--t-muted)', marginTop: '0.25rem' }}>{description}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
