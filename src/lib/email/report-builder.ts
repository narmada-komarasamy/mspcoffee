import type { EmailMetric, EmailPayload, EmailSection } from './payload';

export type ReportBlockId =
  | 'estate_overview'
  | 'harvest_crop_report'
  | 'quality_cupping_results'
  | 'inventory_stock_levels'
  | 'sustainability_certification'
  | 'financial_summary'
  | 'custom_text';

export type RecipientReportConfig = {
  name: string;
  email: string;
  blocks?: ReportBlockId[];
  variables?: Record<string, string>;
};

export type EmailReportTemplate = {
  name: string;
  subject: string;
  estateName: string;
  date: string;
  defaultBlocks: ReportBlockId[];
  customText?: string;
  variables?: Record<string, string>;
};

export type ReportPreview = {
  recipient: RecipientReportConfig;
  payload: EmailPayload;
  subject: string;
  text: string;
  html: string;
};

export const REPORT_BLOCKS: {
  id: ReportBlockId;
  label: string;
  sourcePath: string;
  description: string;
  defaultBody: string;
}[] = [
  {
    id: 'estate_overview',
    label: 'Estate Overview',
    sourcePath: '/estate-management',
    description: 'Estate profile, status notes, and management overview.',
    defaultBody: '{{estate_name}} overview prepared for {{date}}.',
  },
  {
    id: 'harvest_crop_report',
    label: 'Harvest / Crop Report',
    sourcePath: '/processing-dashboard',
    description: 'Harvest, processing, and crop performance snapshot.',
    defaultBody: 'Harvest and crop summary for {{estate_name}} as of {{date}}.',
  },
  {
    id: 'quality_cupping_results',
    label: 'Quality / Cupping Results',
    sourcePath: '/cup-scores',
    description: 'Quality and cupping-score highlights.',
    defaultBody: 'Quality and cupping highlights selected for {{recipient_name}}.',
  },
  {
    id: 'inventory_stock_levels',
    label: 'Inventory / Stock Levels',
    sourcePath: '/coffee-storage',
    description: 'Inventory, stock, and availability snapshot.',
    defaultBody: 'Inventory and stock position for {{estate_name}}.',
  },
  {
    id: 'sustainability_certification',
    label: 'Sustainability / Certification Status',
    sourcePath: '/estate-management',
    description: 'Certification and sustainability status notes.',
    defaultBody: 'Sustainability and certification update for {{estate_name}}.',
  },
  {
    id: 'financial_summary',
    label: 'Financial Summary',
    sourcePath: '/admin-controls',
    description: 'Admin-only financial summary section.',
    defaultBody: 'Financial summary prepared on {{date}}.',
  },
  {
    id: 'custom_text',
    label: 'Custom Text Block',
    sourcePath: '/estate-management/email-reports',
    description: 'Rich-text message and notes entered in this template.',
    defaultBody: '{{custom_text}}',
  },
];

export const RECIPIENT_GROUPS: {
  id: string;
  label: string;
  recipients: RecipientReportConfig[];
}[] = [
  {
    id: 'estate_managers',
    label: 'Estate Managers',
    recipients: [
      { name: 'Estate Manager', email: 'manager@mspcoffee.com' },
    ],
  },
  {
    id: 'buyers',
    label: 'Buyers',
    recipients: [
      { name: 'Buyer', email: 'buyer@example.com', blocks: ['harvest_crop_report', 'quality_cupping_results', 'inventory_stock_levels'] satisfies ReportBlockId[] },
    ],
  },
  {
    id: 'internal_team',
    label: 'Internal Team',
    recipients: [
      { name: 'Internal Team', email: 'team@mspcoffee.com' },
    ],
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function blockById(id: ReportBlockId) {
  return REPORT_BLOCKS.find((block) => block.id === id);
}

export function normalizeReportBlocks(value: unknown): ReportBlockId[] {
  const ids = new Set(REPORT_BLOCKS.map((block) => block.id));
  if (!Array.isArray(value)) return ['estate_overview', 'harvest_crop_report', 'inventory_stock_levels'];
  const blocks = Array.from(new Set(value.filter((item): item is ReportBlockId => typeof item === 'string' && ids.has(item as ReportBlockId))));
  return blocks.length ? blocks : ['estate_overview', 'harvest_crop_report', 'inventory_stock_levels'];
}

export function normalizeRecipients(value: unknown): RecipientReportConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .map<RecipientReportConfig | null>((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
      const name = typeof row.name === 'string' ? row.name.trim() : email;
      if (!email || !EMAIL_RE.test(email)) return null;

      return {
        name,
        email,
        blocks: Array.isArray(row.blocks) ? normalizeReportBlocks(row.blocks) : undefined,
        variables: row.variables && typeof row.variables === 'object' ? row.variables as Record<string, string> : undefined,
      } satisfies RecipientReportConfig;
    })
    .filter((item): item is RecipientReportConfig => Boolean(item));
}

export function normalizeTemplate(value: unknown): EmailReportTemplate {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const date = typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    ? row.date
    : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
  const estateName = typeof row.estateName === 'string' && row.estateName.trim()
    ? row.estateName.trim()
    : 'MSP Coffee';
  const subject = typeof row.subject === 'string' && row.subject.trim()
    ? row.subject.trim()
    : `MSP Coffee Report - ${date}`;

  return {
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `Email Report - ${date}`,
    subject,
    estateName,
    date,
    defaultBlocks: normalizeReportBlocks(row.defaultBlocks),
    customText: typeof row.customText === 'string' ? row.customText.trim() : '',
    variables: row.variables && typeof row.variables === 'object' ? row.variables as Record<string, string> : {},
  };
}

export function applyVariables(text: string, variables: Record<string, string>) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function variablesFor(template: EmailReportTemplate, recipient: RecipientReportConfig) {
  return {
    estate_name: template.estateName,
    date: template.date,
    recipient_name: recipient.name || recipient.email,
    recipient_email: recipient.email,
    custom_text: template.customText || '',
    ...(template.variables ?? {}),
    ...(recipient.variables ?? {}),
  };
}

export function buildRecipientReportPayload(template: EmailReportTemplate, recipient: RecipientReportConfig): EmailPayload {
  const blocks = recipient.blocks?.length ? recipient.blocks : template.defaultBlocks;
  const variables = variablesFor(template, recipient);
  const rows: EmailMetric[] = blocks
    .map(blockById)
    .filter((block): block is NonNullable<ReturnType<typeof blockById>> => Boolean(block))
    .map((block) => ({
      label: block.label,
      value: applyVariables(block.id === 'custom_text' ? (template.customText || block.defaultBody) : block.defaultBody, variables),
      detail: block.sourcePath,
    }));

  const sections: EmailSection[] = [
    {
      title: 'Included Report Sections',
      rows,
    },
  ];

  return {
    type: 'email_report',
    recipients: [recipient.email],
    cc: [],
    reportTitle: template.name,
    sourcePath: '/estate-management/email-reports',
    subject: applyVariables(template.subject, variables),
    note: template.customText ? applyVariables(template.customText, variables) : undefined,
    attachmentName: `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'email-report'}.html`,
    data: {
      summary: [
        { label: 'Recipient', value: recipient.name || recipient.email, detail: recipient.email },
        { label: 'Estate', value: template.estateName },
        { label: 'Sections', value: String(rows.length), detail: rows.map((row) => row.label).join(', ') },
      ],
      sections,
    },
  };
}
