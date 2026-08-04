export type EmailType =
  | 'production_report'
  | 'daily_operations_digest'
  | 'email_report'
  | 'sales_inventory_summary'
  | 'order_notification'
  | 'alert'
  | 'custom_report';

export type EmailMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type EmailSection = {
  title: string;
  rows: EmailMetric[];
};

export type EmailPayload = {
  type: EmailType;
  recipients: string[];
  cc?: string[];
  subject?: string;
  note?: string;
  reportTitle: string;
  sourcePath: string;
  attachmentName?: string;
  data: {
    summary: EmailMetric[];
    sections?: EmailSection[];
  };
};

export const EMAIL_TYPES: EmailType[] = [
  'production_report',
  'daily_operations_digest',
  'email_report',
  'sales_inventory_summary',
  'order_notification',
  'alert',
  'custom_report',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmailMetric(value: unknown): value is EmailMetric {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.label === 'string'
    && row.label.trim().length > 0
    && typeof row.value === 'string'
    && row.value.trim().length > 0
    && (row.detail === undefined || typeof row.detail === 'string');
}

function isEmailSection(value: unknown): value is EmailSection {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.title === 'string'
    && row.title.trim().length > 0
    && Array.isArray(row.rows)
    && row.rows.length > 0
    && row.rows.every(isEmailMetric);
}

export function normalizeEmailList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function validateEmailPayload(value: unknown) {
  if (!value || typeof value !== 'object') return { error: 'Enter email details' };

  const row = value as Record<string, unknown>;
  const type = typeof row.type === 'string' ? row.type : '';
  const recipients = normalizeEmailList(row.recipients);
  const cc = normalizeEmailList(row.cc);
  const reportTitle = typeof row.reportTitle === 'string' ? row.reportTitle.trim() : '';
  const sourcePath = typeof row.sourcePath === 'string' ? row.sourcePath.trim() : '';
  const subject = typeof row.subject === 'string' ? row.subject.trim() : '';
  const note = typeof row.note === 'string' ? row.note.trim() : '';
  const attachmentName = typeof row.attachmentName === 'string' ? row.attachmentName.trim() : '';

  if (!EMAIL_TYPES.includes(type as EmailType)) return { error: 'Choose a valid email type' };
  if (recipients.length === 0) return { error: 'Add at least one recipient' };
  if (recipients.length > 25 || cc.length > 25) return { error: 'Use 25 recipients or fewer' };
  if ([...recipients, ...cc].some((email) => !EMAIL_RE.test(email))) {
    return { error: 'Check recipient email addresses' };
  }
  if (!reportTitle) return { error: 'Add a report title' };
  if (!sourcePath.startsWith('/')) return { error: 'Source path is required' };

  const data = row.data;
  if (!data || typeof data !== 'object') return { error: 'Report data is required' };
  const dataRow = data as Record<string, unknown>;
  if (!Array.isArray(dataRow.summary) || dataRow.summary.length === 0 || !dataRow.summary.every(isEmailMetric)) {
    return { error: 'Report summary is required' };
  }
  if (dataRow.sections !== undefined && (!Array.isArray(dataRow.sections) || !dataRow.sections.every(isEmailSection))) {
    return { error: 'Report sections are invalid' };
  }

  return {
    payload: {
      type: type as EmailType,
      recipients,
      cc,
      subject,
      note,
      reportTitle,
      sourcePath,
      attachmentName,
      data: {
        summary: dataRow.summary,
        sections: dataRow.sections,
      },
    } satisfies EmailPayload,
  };
}
