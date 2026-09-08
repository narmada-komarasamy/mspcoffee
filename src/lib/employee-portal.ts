export const EMPLOYEE_PORTAL_ROLES = ['admin', 'supervisor', 'ceo'] as const;

export type EmployeePortalRole = (typeof EMPLOYEE_PORTAL_ROLES)[number];

export type EmployeePortalSection = {
  label: string;
  slug: string;
  description: string;
};

export type EmployeePortalPerson = {
  name: string;
  slug: string;
};

export const EMPLOYEE_PORTAL_SECTIONS: EmployeePortalSection[] = [
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
