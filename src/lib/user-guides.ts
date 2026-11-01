export const USER_GUIDES = [{
  id: 'courier-tracking', title: 'Courier Tracking & Billing',
  description: 'Register dispatches, upload monthly bills, reconcile consignments and record payments.',
  languages: 'English + தமிழ்', version: '1.0', updated: '1 November 2026', pages: 2,
  featureHref: '/employee-portal/ramesh/courier-tracking',
}] as const;
export type UserGuide = (typeof USER_GUIDES)[number];
