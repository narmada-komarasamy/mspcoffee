'use client';

import Link from 'next/link';
import { UserCog, Activity, Lock, Bell } from 'lucide-react';

const sections = [
  {
    href: '/admin-controls/users',
    icon: UserCog,
    title: 'User Management',
    description: 'Add, edit, deactivate users. Reset PINs and change roles.',
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
    available: false,
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Controls</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--msp-neutral)' }}>
          Manage users, permissions, and system settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(({ href, icon: Icon, title, description, available }) => (
          available ? (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-xl p-5 transition hover:opacity-90"
              style={{ background: 'var(--msp-navy-mid)', border: '1px solid var(--msp-navy-border)' }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                style={{ background: 'rgba(134,239,172,0.12)' }}>
                <Icon className="h-5 w-5" style={{ color: 'var(--msp-green)' }} />
              </div>
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--msp-neutral)' }}>{description}</p>
              </div>
            </Link>
          ) : (
            <div
              key={href}
              className="flex items-start gap-4 rounded-xl p-5 opacity-40 cursor-not-allowed"
              style={{ background: 'var(--msp-navy-mid)', border: '1px solid var(--msp-navy-border)' }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                style={{ background: 'rgba(134,239,172,0.08)' }}>
                <Icon className="h-5 w-5" style={{ color: 'var(--msp-neutral)' }} />
              </div>
              <div>
                <p className="font-semibold text-white">{title}
                  <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--msp-neutral)' }}>
                    Coming soon
                  </span>
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--msp-neutral)' }}>{description}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
