'use client';

import { useState } from 'react';

export default function ProcessingSelect({ label, value, options, onChange, required = false, allowNew = false }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void; required?: boolean; allowNew?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const custom = allowNew && (adding || (!!value && !options.includes(value)));
  return <div><label>{label}<select value={custom ? '__add_new__' : value} required={required && !custom} onChange={e => {
    if (e.target.value === '__add_new__') { setAdding(true); onChange(''); }
    else { setAdding(false); onChange(e.target.value); }
  }}><option value="">Choose {label.toLowerCase()}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}{allowNew && <option value="__add_new__">Add new…</option>}</select></label>
    {custom && <label>New {label.toLowerCase()}<input maxLength={label === 'Variety' ? 40 : 100} value={value} required={required} placeholder={`Enter new ${label.toLowerCase()}`} onChange={e => onChange(e.target.value)} /></label>}
  </div>;
}
