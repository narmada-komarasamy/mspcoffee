import type { EmailPayload } from './payload';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function metricText(label: string, value: string, detail?: string) {
  return detail ? `${label}: ${value} (${detail})` : `${label}: ${value}`;
}

export function defaultSubject(payload: EmailPayload) {
  const prefix: Record<EmailPayload['type'], string> = {
    production_report: 'Production Report',
    daily_operations_digest: 'Daily Operations Digest',
    sales_inventory_summary: 'Sales and Inventory Summary',
    order_notification: 'Order Update',
    alert: 'MSP Coffee Alert',
    custom_report: 'MSP Coffee Report',
  };

  return `${prefix[payload.type]} - ${payload.reportTitle}`;
}

export function renderEmail(payload: EmailPayload) {
  const subject = payload.subject || defaultSubject(payload);
  const summaryText = payload.data.summary
    .map((item) => metricText(item.label, item.value, item.detail))
    .join('\n');
  const sectionsText = payload.data.sections
    ?.map((section) => {
      const rows = section.rows.map((item) => metricText(item.label, item.value, item.detail)).join('\n');
      return `${section.title}\n${rows}`;
    })
    .join('\n\n');

  const text = [
    payload.reportTitle,
    payload.note ? `Note: ${payload.note}` : '',
    summaryText,
    sectionsText ?? '',
    `Source: ${payload.sourcePath}`,
  ].filter(Boolean).join('\n\n');

  const summaryHtml = payload.data.summary.map((item) => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td><strong>${escapeHtml(item.value)}</strong>${item.detail ? `<br><span>${escapeHtml(item.detail)}</span>` : ''}</td>
    </tr>
  `).join('');

  const sectionsHtml = payload.data.sections?.map((section) => `
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      ${section.rows.map((item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td><strong>${escapeHtml(item.value)}</strong>${item.detail ? `<br><span>${escapeHtml(item.detail)}</span>` : ''}</td>
        </tr>
      `).join('')}
    </table>
  `).join('') ?? '';

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; background: #f7f1e4; color: #1f2933; font-family: Arial, sans-serif; }
        .wrap { max-width: 680px; margin: 0 auto; padding: 28px 20px; }
        .header { border-bottom: 4px solid #2d6e2d; padding-bottom: 14px; margin-bottom: 20px; }
        h1 { color: #1b4a1b; font-size: 24px; margin: 0 0 6px; }
        h2 { color: #1b4a1b; font-size: 15px; margin: 24px 0 8px; text-transform: uppercase; }
        p { line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e5dfc8; }
        td { padding: 11px 13px; border-bottom: 1px solid #f0ead4; vertical-align: top; }
        td:first-child { color: #6b7280; font-size: 12px; text-transform: uppercase; width: 42%; }
        span { color: #6b7280; font-size: 12px; }
        .note { background: #fff8e1; border: 1px solid #ead58a; padding: 12px 14px; margin: 16px 0; }
        .source { color: #6b7280; font-size: 12px; margin-top: 18px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <h1>${escapeHtml(payload.reportTitle)}</h1>
          <div>MSP Coffee</div>
        </div>
        ${payload.note ? `<div class="note">${escapeHtml(payload.note)}</div>` : ''}
        <table>${summaryHtml}</table>
        ${sectionsHtml}
        <p class="source">Source: ${escapeHtml(payload.sourcePath)}</p>
      </div>
    </body>
  </html>`;

  return { subject, text, html };
}
