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

function isTravelAllowanceReport(payload: EmailPayload) {
  return payload.sourcePath === '/travel-allowance';
}

function isFamilyDecisionReport(payload: EmailPayload) {
  return payload.sourcePath === '/family-decisions';
}

function metricValue(payload: EmailPayload, label: string) {
  return payload.data.summary.find((item) => item.label === label)?.value ?? '';
}

function renderMetricCards(payload: EmailPayload) {
  const displayMetrics = payload.data.summary.filter((item) => item.label !== 'Date filter');

  return `
    <div class="metric-grid">
      ${displayMetrics.map((item) => `
        <div class="metric-card">
          <div class="metric-value">${escapeHtml(item.value)}</div>
          <div class="metric-label">${escapeHtml(item.label)}</div>
          ${item.detail ? `<div class="metric-detail">${escapeHtml(item.detail)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderSectionTable(section: NonNullable<EmailPayload['data']['sections']>[number], columns: [string, string, string]) {
  return `
    <div class="section">
      <h2>${escapeHtml(section.title)}</h2>
      <table class="report-table">
        <thead>
          <tr>
            <th>${escapeHtml(columns[0])}</th>
            <th>${escapeHtml(columns[1])}</th>
            <th>${escapeHtml(columns[2])}</th>
          </tr>
        </thead>
        <tbody>
          ${section.rows.map((item) => `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${escapeHtml(item.value)}</td>
              <td>${escapeHtml(item.detail ?? '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTravelAllowanceHtml(payload: EmailPayload) {
  const sections = payload.data.sections ?? [];
  const employeeSection = sections.find((section) => section.title === 'By employee');
  const locationSection = sections.find((section) => section.title === 'By location');
  const entriesSection = sections.find((section) => section.title === 'Entries');
  const dateFilter = metricValue(payload, 'Date filter') || 'Selected report period';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; background: #f7f1e4; color: #1f2933; font-family: Arial, sans-serif; }
        .wrap { max-width: 920px; margin: 0 auto; padding: 28px 18px; }
        .eyebrow { color: #6b7280; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        h1 { color: #171717; font-size: 28px; line-height: 1.12; margin: 7px 0 8px; }
        h2 { color: #171717; font-size: 16px; margin: 0 0 10px; }
        .sub { color: #6b7280; font-size: 14px; line-height: 1.45; margin: 0 0 20px; }
        .report-shell { background: #fffdf8; border: 1px solid #e5dfc8; border-radius: 14px; padding: 16px; }
        .filter-row { display: table; width: 100%; margin-bottom: 16px; table-layout: fixed; }
        .filter-cell { display: table-cell; padding-right: 12px; vertical-align: top; }
        .filter-label { color: #6b7280; font-size: 12px; font-weight: 800; margin-bottom: 6px; }
        .filter-box { border: 1px solid #e5dfc8; border-radius: 8px; padding: 10px 12px; color: #171717; font-size: 15px; font-weight: 800; background: #fff; }
        .metric-grid { display: table; width: 100%; border-spacing: 0; margin: 0 0 18px; }
        .metric-card { display: table-cell; width: 25%; background: #fbf6ec; border-right: 12px solid #fffdf8; border-radius: 12px; padding: 16px 18px; }
        .metric-value { color: #171717; font-size: 28px; font-weight: 900; line-height: 1; }
        .metric-label { color: #6b7280; font-size: 13px; font-weight: 800; margin-top: 8px; }
        .metric-detail { color: #6b7280; font-size: 12px; font-weight: 700; margin-top: 4px; }
        .two-col { display: table; width: 100%; table-layout: fixed; border-spacing: 0; }
        .two-col .section { display: table-cell; width: 50%; vertical-align: top; }
        .two-col .section:first-child { padding-right: 12px; }
        .section { margin: 18px 0 0; }
        .report-table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #e5dfc8; border-radius: 10px; background: #fff; }
        .report-table th { background: #fbf6ec; color: #6b7280; font-size: 13px; text-align: left; padding: 12px 14px; }
        .report-table td { color: #242424; font-size: 14px; padding: 12px 14px; border-top: 1px solid #f0ead4; }
        .note { background: #fff8e1; border: 1px solid #ead58a; border-radius: 9px; color: #384433; padding: 11px 13px; margin: 0 0 16px; font-size: 13px; }
        .source { color: #6b7280; font-size: 11px; margin: 16px 0 0; }
        @media only screen and (max-width: 680px) {
          .filter-row, .filter-cell, .metric-grid, .metric-card, .two-col, .two-col .section { display: block; width: auto; }
          .filter-cell, .two-col .section:first-child { padding-right: 0; margin-bottom: 10px; }
          .metric-card { border-right: 0; margin-bottom: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="eyebrow">Family and Personal</div>
        <h1>${escapeHtml(payload.reportTitle)}</h1>
        <p class="sub">Log employee travel events at Rs. 250 per event and prepare weekly, monthly, or employee reports.</p>
        <div class="report-shell">
          ${payload.note ? `<div class="note">${escapeHtml(payload.note)}</div>` : ''}
          <div class="filter-row">
            <div class="filter-cell">
              <div class="filter-label">Report</div>
              <div class="filter-box">${escapeHtml(payload.reportTitle.replace('Travel Allowance - ', ''))}</div>
            </div>
            <div class="filter-cell">
              <div class="filter-label">Date filter</div>
              <div class="filter-box">${escapeHtml(dateFilter)}</div>
            </div>
          </div>
          ${renderMetricCards(payload)}
          <div class="two-col">
            ${employeeSection ? renderSectionTable(employeeSection, ['Name', 'Events', 'Amount']) : ''}
            ${locationSection ? renderSectionTable(locationSection, ['Name', 'Events', 'Amount']) : ''}
          </div>
          ${entriesSection ? renderSectionTable(entriesSection, ['Date', 'Employee / Events', 'Location / Amount']) : ''}
        </div>
        <p class="source">Source: MSP Coffee ${escapeHtml(payload.sourcePath)}</p>
      </div>
    </body>
  </html>`;
}

function renderFamilyDecisionHtml(payload: EmailPayload) {
  const sections = payload.data.sections ?? [];
  const projectDetails = sections.find((section) => section.title === 'Project details');
  const decisionRule = sections.find((section) => section.title === 'Decision rule');
  const memberVotes = sections.find((section) => section.title === 'Member votes');
  const objections = sections.find((section) => section.title === 'Objections to resolve');
  const suggestions = sections.find((section) => section.title === 'Suggestions');
  const closeOut = sections.find((section) => section.title === 'Close-out plan');
  const question = metricValue(payload, 'Question');
  const recommendation = metricValue(payload, 'Recommendation');
  const yesVotes = metricValue(payload, 'Yes votes');
  const noVotes = metricValue(payload, 'No votes');
  const pendingVotes = metricValue(payload, 'Pending votes');
  const yesDetail = payload.data.summary.find((item) => item.label === 'Yes votes')?.detail ?? '';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; background: #f7f1e4; color: #1f2933; font-family: Arial, sans-serif; }
        .wrap { max-width: 920px; margin: 0 auto; padding: 28px 18px; }
        .hero { background: #fffdf8; border: 1px solid #e5dfc8; border-radius: 14px; padding: 22px; }
        .eyebrow { color: #6b7280; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        h1 { color: #1b4a1b; font-size: 30px; line-height: 1.1; margin: 7px 0 10px; }
        h2 { color: #1b4a1b; font-size: 15px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .1em; }
        .sub { color: #6b7280; font-size: 14px; line-height: 1.55; margin: 0 0 18px; }
        .decision { display: table; width: 100%; table-layout: fixed; margin-top: 18px; }
        .question { display: table-cell; vertical-align: top; padding-right: 18px; }
        .recommendation { display: table-cell; width: 190px; vertical-align: top; }
        .badge { border: 1px solid #e5dfc8; background: #fbf6ec; border-radius: 12px; padding: 16px; text-align: center; }
        .badge-label { color: #374151; font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
        .badge-value { color: #1b4a1b; font-size: 26px; font-weight: 900; margin-top: 8px; }
        .question h3 { color: #171717; font-size: 26px; line-height: 1.18; margin: 0; }
        .vote-grid { display: table; width: 100%; border-spacing: 0; margin: 22px 0 18px; }
        .vote-card { display: table-cell; width: 33%; border-right: 12px solid #fffdf8; border-radius: 12px; padding: 16px 18px; border: 1px solid #e5dfc8; }
        .yes { background: #f7fbf4; color: #1b4a1b; }
        .no { background: #fff7f5; color: #9f2a1d; }
        .pending { background: #fbf6ec; color: #6b7280; }
        .vote-label { font-size: 14px; font-weight: 900; }
        .vote-value { color: #171717; font-size: 32px; font-weight: 900; margin-top: 8px; }
        .progress-label { color: #374151; font-size: 12px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .bar { height: 10px; background: #fbf6ec; border-radius: 999px; overflow: hidden; margin-top: 8px; }
        .bar-fill { height: 100%; background: #2d6e2d; width: ${escapeHtml(yesDetail.replace(' yes majority', ''))}; }
        .section-grid { display: table; width: 100%; table-layout: fixed; border-spacing: 0; margin-top: 18px; }
        .section-col { display: table-cell; vertical-align: top; width: 50%; }
        .section-col:first-child { padding-right: 12px; }
        .panel { background: #fffdf8; border: 1px solid #e5dfc8; border-radius: 14px; padding: 18px; margin-top: 18px; }
        .detail { display: table; width: 100%; border-spacing: 0 10px; }
        .detail-row { display: table-row; }
        .detail-label, .detail-value { display: table-cell; background: #fbf6ec; border-top: 1px solid #e5dfc8; border-bottom: 1px solid #e5dfc8; padding: 12px 14px; vertical-align: top; }
        .detail-label { color: #6b7280; font-size: 12px; font-weight: 900; text-transform: uppercase; border-left: 1px solid #e5dfc8; border-radius: 10px 0 0 10px; width: 36%; }
        .detail-value { color: #171717; font-size: 14px; font-weight: 800; border-right: 1px solid #e5dfc8; border-radius: 0 10px 10px 0; }
        .detail-value span { display: block; color: #6b7280; font-size: 12px; font-weight: 700; margin-top: 4px; }
        .note { background: #fff8e1; border: 1px solid #ead58a; border-radius: 9px; color: #384433; padding: 11px 13px; margin: 16px 0 0; font-size: 13px; }
        .source { color: #6b7280; font-size: 11px; margin: 16px 0 0; }
        @media only screen and (max-width: 680px) {
          .decision, .question, .recommendation, .vote-grid, .vote-card, .section-grid, .section-col { display: block; width: auto; }
          .question, .section-col:first-child { padding-right: 0; }
          .recommendation, .vote-card { margin-top: 12px; border-right: 1px solid #e5dfc8; }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="hero">
          <div class="eyebrow">Family and Personal</div>
          <h1>Family Decisions</h1>
          <p class="sub">A simple decision room: ask one clear question, collect yes/no votes, capture objections and suggestions, assign cost, owner, and timeline, then close the decision.</p>
          <div class="decision">
            <div class="question">
              <div class="eyebrow">Active vote</div>
              <h3>${escapeHtml(question)}</h3>
              <p class="sub">Decision closes once objections are answered and at least 3 family members vote yes.</p>
            </div>
            <div class="recommendation">
              <div class="badge">
                <div class="badge-label">Recommendation</div>
                <div class="badge-value">${escapeHtml(recommendation)}</div>
              </div>
            </div>
          </div>
          <div class="vote-grid">
            <div class="vote-card yes"><div class="vote-label">Yes</div><div class="vote-value">${escapeHtml(yesVotes)}</div></div>
            <div class="vote-card no"><div class="vote-label">No</div><div class="vote-value">${escapeHtml(noVotes)}</div></div>
            <div class="vote-card pending"><div class="vote-label">Pending</div><div class="vote-value">${escapeHtml(pendingVotes)}</div></div>
          </div>
          <div class="progress-label">Yes majority ${escapeHtml(yesDetail)}</div>
          <div class="bar"><div class="bar-fill"></div></div>
          ${payload.note ? `<div class="note">${escapeHtml(payload.note)}</div>` : ''}
        </div>

        <div class="section-grid">
          <div class="section-col">
            ${projectDetails ? `<div class="panel"><h2>Project details</h2>${renderDetailRows(projectDetails)}</div>` : ''}
            ${decisionRule ? `<div class="panel"><h2>Decision rule</h2>${renderDetailRows(decisionRule)}</div>` : ''}
            ${objections ? `<div class="panel"><h2>Objections to resolve</h2>${renderDetailRows(objections)}</div>` : ''}
          </div>
          <div class="section-col">
            ${memberVotes ? `<div class="panel"><h2>Member votes</h2>${renderDetailRows(memberVotes)}</div>` : ''}
            ${suggestions ? `<div class="panel"><h2>Suggestions</h2>${renderDetailRows(suggestions)}</div>` : ''}
            ${closeOut ? `<div class="panel"><h2>Close-out plan</h2>${renderDetailRows(closeOut)}</div>` : ''}
          </div>
        </div>
        <p class="source">Source: MSP Coffee ${escapeHtml(payload.sourcePath)}</p>
      </div>
    </body>
  </html>`;
}

function renderDetailRows(section: NonNullable<EmailPayload['data']['sections']>[number]) {
  return `
    <div class="detail">
      ${section.rows.map((item) => `
        <div class="detail-row">
          <div class="detail-label">${escapeHtml(item.label)}</div>
          <div class="detail-value">${escapeHtml(item.value)}${item.detail ? `<span>${escapeHtml(item.detail)}</span>` : ''}</div>
        </div>
      `).join('')}
    </div>
  `;
}

export function defaultSubject(payload: EmailPayload) {
  const prefix: Record<EmailPayload['type'], string> = {
    production_report: 'Production Report',
    daily_operations_digest: 'Daily Operations Digest',
    email_report: 'Email Report',
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

  const html = isTravelAllowanceReport(payload)
    ? renderTravelAllowanceHtml(payload)
    : isFamilyDecisionReport(payload)
      ? renderFamilyDecisionHtml(payload)
      : `<!doctype html>
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
