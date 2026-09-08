import Link from 'next/link';
import { CalendarDays, CheckSquare, FileText, ListChecks, Package, ReceiptText, Users, Warehouse } from 'lucide-react';
import {
  EMPLOYEE_PORTAL_PEOPLE,
  EMPLOYEE_PRODUCTIVITY_SECTIONS,
  RAMESH_WORK_AREAS,
} from '@/lib/employee-portal';

const sectionIcons = {
  'task-sheet': ListChecks,
  reports: FileText,
  checklist: CheckSquare,
  quotations: ReceiptText,
  stores: Warehouse,
  estimates: Package,
};

export default function EmployeePortalPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Employee Portal
            </p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">
              Team work pages
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Select an employee to open their task sheet, reports, and checklist.
              Task and checklist dates are prepared to connect with the Operations Calendar.
            </p>
          </div>
          <Link
            href="/operations-calendar"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            <CalendarDays className="h-4 w-4" />
            Operations Calendar
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EMPLOYEE_PORTAL_PEOPLE.map((employee) => (
          <div key={employee.slug} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">{employee.name}</h2>
            <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
              <h3 className="text-sm font-bold text-emerald-900">Productivity</h3>
              <div className="mt-3 space-y-2">
                {EMPLOYEE_PRODUCTIVITY_SECTIONS.map((section) => {
                  const Icon = sectionIcons[section.slug as keyof typeof sectionIcons] ?? FileText;

                  return (
                    <Link
                      key={section.slug}
                      href={`/employee-portal/${employee.slug}/${section.slug}`}
                      className="flex items-center gap-3 rounded-md border border-stone-100 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
                    >
                      <Icon className="h-4 w-4 text-emerald-700" />
                      {section.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            {employee.slug === 'ramesh' && (
              <div className="mt-3 space-y-2">
                {RAMESH_WORK_AREAS.map((section) => {
                const Icon = sectionIcons[section.slug as keyof typeof sectionIcons] ?? FileText;

                return (
                  <Link
                    key={section.slug}
                    href={`/employee-portal/${employee.slug}/${section.slug}`}
                    className="flex items-center gap-3 rounded-md border border-stone-100 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
                  >
                    <Icon className="h-4 w-4 text-emerald-700" />
                    {section.label}
                  </Link>
                );
              })}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
