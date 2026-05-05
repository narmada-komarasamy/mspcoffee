import { requireUser } from '@/lib/auth/require';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();

  return (
    <DashboardShell profile={profile}>
      {children}
    </DashboardShell>
  );
}
