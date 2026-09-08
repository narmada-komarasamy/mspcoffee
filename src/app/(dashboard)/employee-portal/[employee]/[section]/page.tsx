import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  FileText,
  ListChecks,
} from 'lucide-react';
import {
  EMPLOYEE_PORTAL_PEOPLE,
  EMPLOYEE_PORTAL_SECTIONS,
  findEmployee,
  findEmployeeSection,
} from '@/lib/employee-portal';

type PageProps = {
  params: Promise<{
    employee: string;
    section: string;
  }>;
};

const sectionIcons = {
  'task-sheet': ListChecks,
  reports: FileText,
  checklist: CheckSquare,
};

const starterRows = {
  'task-sheet': [
    ['Today', 'Add assigned work', 'Calendar date required'],
    ['This week', 'Review pending work', 'Shows on calendar once dated'],
    ['Upcoming', 'Plan next follow-up', 'Ready for reminders'],
  ],
  reports: [
    ['Daily', 'Work summary report', 'Linked to employee and date'],
    ['Weekly', 'Productivity review', 'Can reference calendar tasks'],
    ['Monthly', 'Manager review report', 'Prepared for approvals'],
  ],
  checklist: [
    ['Open', 'Routine checklist item', 'Optional due date'],
    ['Pending', 'Manager follow-up', 'Can appear on calendar'],
    ['Done', 'Completed checklist item', 'Stored for reports'],
  ],
} as const;

export function generateStaticParams() {
  return EMPLOYEE_PORTAL_PEOPLE.flatMap((employee) =>
    EMPLOYEE_PORTAL_SECTIONS.map((section) => ({
      employee: employee.slug,
      section: section.slug,
    })),
  );
}

export default async function EmployeePortalSectionPage({ params }: PageProps) {
  const { employee: employeeSlug, section: sectionSlug } = await params;
  const employee = findEmployee(employeeSlug);
  const section = findEmployeeSection(sectionSlug);

  if (!employee || !section) notFound();

  const Icon = sectionIcons[section.slug as keyof typeof sectionIcons] ?? ClipboardList;
  const rows = starterRows[section.slug as keyof typeof starterRows] ?? starterRows['task-sheet'];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Employee Portal / {employee.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">{section.label}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              {section.description}
            </p>
          </div>
          <Link
            href="/operations-calendar"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="text-base font-bold text-stone-900">Starter workspace</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {rows.map(([timing, title, calendarNote]) => (
              <div key={`${timing}-${title}`} className="grid gap-3 px-4 py-3 sm:grid-cols-[120px_1fr_180px]">
                <div className="text-sm font-semibold text-emerald-800">{timing}</div>
                <div className="text-sm text-stone-800">{title}</div>
                <div className="inline-flex items-center gap-2 text-sm text-stone-500">
                  <CalendarDays className="h-4 w-4 text-emerald-700" />
                  {calendarNote}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-stone-900">Calendar connection</h2>
          <div className="mt-4 space-y-3">
            {[
              'Employee name is ready for calendar filtering.',
              'Dated tasks and checklist items can appear as calendar events.',
              'Managers and admins can review everyone from one calendar view.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm leading-5 text-stone-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3 text-sm text-emerald-900">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This is a starter page. The next step is to decide the fields each employee needs for
            their custom workflow before saving real task, report, and checklist records.
          </p>
        </div>
      </section>
    </div>
  );
}
