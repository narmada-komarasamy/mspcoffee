const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function rememberedEmails(logs: { recipients?: unknown; cc?: unknown }[]) {
  const addresses = new Set<string>();
  for (const log of logs) {
    for (const values of [log.recipients, log.cc]) {
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (typeof value !== 'string') continue;
        const email = value.trim().toLowerCase();
        if (email.length <= 254 && EMAIL.test(email)) addresses.add(email);
      }
    }
  }
  return [...addresses].slice(0, 200);
}

export function addressToken(value: string, caret = value.length) {
  const position = Math.max(0, Math.min(caret, value.length));
  const before = value.slice(0, position);
  const start = Math.max(before.lastIndexOf(','), before.lastIndexOf(';'), before.lastIndexOf('\n')) + 1;
  const tail = value.slice(position).search(/[,;\n]/);
  const end = tail < 0 ? value.length : position + tail;
  return { start, end, query: value.slice(start, end).trim().toLowerCase() };
}

export function suggestedEmails(value: string, caret: number, saved: string[]) {
  const token = addressToken(value, caret);
  const others = `${value.slice(0, token.start)},${value.slice(token.end)}`.split(/[,;\n]/).map(v => v.trim().toLowerCase());
  return saved.filter(email => email.includes(token.query) && !others.includes(email)).slice(0, 6);
}

export function chooseEmail(value: string, caret: number, email: string) {
  const { start, end } = addressToken(value, caret);
  const prefix = value.slice(0, start);
  const next = `${prefix}${prefix ? ' ' : ''}${email}`;
  return { value: next + value.slice(end), caret: next.length };
}
