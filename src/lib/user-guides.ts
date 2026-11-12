export const USER_GUIDES = [{
  id: 'courier-tracking', title: 'Courier Tracking & Billing',
  description: 'Register dispatches, upload monthly bills, reconcile consignments and record payments.',
  languages: 'English + தமிழ்', version: '1.0', updated: '1 November 2026', pages: 2,
  featureHref: '/employee-portal/ramesh/courier-tracking', featureLabel: 'Courier Tracking',
  pdfFile: 'MSP_Coffee_Approved_Cream_Guide.pdf', pagePrefix: 'courier-guide-page',
}, {
  id: 'fleet-fuel', title: 'Fleet Fuel Expenses',
  description: 'Record fuel and kilometres, retain photos, add maintenance and insurance bills, and prepare consolidated expense reports.',
  languages: 'English + தமிழ்', version: '1.0', updated: '1 November 2026', pages: 4,
  featureHref: '/fuel-expenses', featureLabel: 'Fleet Fuel Expenses',
  pdfFile: 'MSP_Coffee_Fleet_Fuel_Guide.pdf', pagePrefix: 'fleet-guide-page',
}, {
  id: 'ho-fuel', title: 'HO Fuel Stock & Entries',
  description: 'Upload purchase bills, review automatically read details, record issues, find saved bills and reconcile physical fuel stock.',
  languages: 'English + தமிழ்', version: '1.1', updated: '12 November 2026', pages: 2,
  featureHref: '/ho-fuel', featureLabel: 'HO Fuel',
  pdfFile: 'MSP_Coffee_HO_Fuel_Guide.pdf', pagePrefix: 'ho-fuel-guide-page',
}] as const;
export type UserGuide = (typeof USER_GUIDES)[number];
