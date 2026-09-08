export const EMPLOYEE_PORTAL_ROLES = ['admin', 'supervisor', 'ceo'] as const;

export type EmployeePortalRole = (typeof EMPLOYEE_PORTAL_ROLES)[number];

export type EmployeePortalSection = {
  label: string;
  slug: string;
  description: string;
};

export type EmployeePortalTool = EmployeePortalSection & {
  href: string;
};

export type EmployeePortalPerson = {
  name: string;
  slug: string;
};

export const EMPLOYEE_PRODUCTIVITY_SECTIONS: EmployeePortalSection[] = [
  {
    label: 'Task Sheet',
    slug: 'task-sheet',
    description: 'Daily and dated work items that can appear on the Operations Calendar.',
  },
  {
    label: 'Reports',
    slug: 'reports',
    description: 'Employee work summaries linked back to tasks, dates, and calendar records.',
  },
  {
    label: 'Checklist',
    slug: 'checklist',
    description: 'Repeatable follow-up items with optional due dates for the calendar.',
  },
];

export const RAMESH_DIRECT_WORK_AREAS: EmployeePortalSection[] = [
  {
    label: 'Quotations',
    slug: 'quotations',
    description: 'Quotation requests, supplier follow-ups, and dated approval notes.',
  },
  {
    label: 'Estimates',
    slug: 'estimates',
    description: 'Estimate preparation, review status, and calendar-linked due dates.',
  },
];

export const RAMESH_STORES_TOOLS: EmployeePortalTool[] = [
  {
    label: 'Estate Produce',
    slug: 'estate-produce',
    href: '/employee-portal/ramesh/stores/estate-produce',
    description: 'Incoming fruits and estate products available for sale, with search and comparisons.',
  },
  {
    label: 'Produce Sales',
    slug: 'produce-sales',
    href: '/employee-portal/ramesh/stores/produce-sales',
    description: 'Sales entries, available stock balance, revenue totals, and payment status tracking.',
  },
];

export const EMPLOYEE_PORTAL_SECTIONS: EmployeePortalSection[] = [
  ...EMPLOYEE_PRODUCTIVITY_SECTIONS,
  ...RAMESH_DIRECT_WORK_AREAS,
  ...RAMESH_STORES_TOOLS,
];

export const EMPLOYEE_PORTAL_PEOPLE: EmployeePortalPerson[] = [
  { name: 'Ramesh', slug: 'ramesh' },
  { name: 'Ponraj', slug: 'ponraj' },
  { name: 'Venkatesh', slug: 'venkatesh' },
  { name: 'Chandrashekaran', slug: 'chandrashekaran' },
  { name: 'Azhau', slug: 'azhau' },
  { name: 'Mani', slug: 'mani' },
  { name: 'Eswaran', slug: 'eswaran' },
];

export function findEmployee(slug: string) {
  return EMPLOYEE_PORTAL_PEOPLE.find((employee) => employee.slug === slug);
}

export function findEmployeeSection(slug: string) {
  return EMPLOYEE_PORTAL_SECTIONS.find((section) => section.slug === slug);
}

export function sectionsForEmployee(employeeSlug: string) {
  if (employeeSlug === 'ramesh') {
    return [...EMPLOYEE_PRODUCTIVITY_SECTIONS, ...RAMESH_DIRECT_WORK_AREAS];
  }

  return EMPLOYEE_PRODUCTIVITY_SECTIONS;
}
