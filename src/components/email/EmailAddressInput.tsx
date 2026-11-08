'use client';

import { useId, useRef, useState } from 'react';
import { chooseEmail, suggestedEmails } from '@/lib/email/contacts';

export function EmailAddressInput({ label, value, onChange, addresses, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; addresses: string[]; placeholder: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(-1);
  const matches = focused ? suggestedEmails(value, caret, addresses) : [];
  function choose(email: string) {
    const next = chooseEmail(value, caret, email);
    onChange(next.value); setCaret(next.caret); setFocused(false); setActive(-1);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.caret, next.caret); });
  }
  return <div style={{ position: 'relative' }}>
    <input ref={input} aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls={matches.length ? id : undefined} aria-activedescendant={active >= 0 && matches[active] ? `${id}-${active}` : undefined}
      autoComplete="off" autoCapitalize="none" spellCheck={false} type="text" value={value} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d8cfb5', borderRadius: 8, padding: 10, fontSize: 13 }}
      onChange={e => { onChange(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); setFocused(true); setActive(-1); }}
      onFocus={e => { setFocused(true); setCaret(e.target.selectionStart ?? value.length); }}
      onClick={e => { setCaret(e.currentTarget.selectionStart ?? value.length); setFocused(true); setActive(-1); }}
      onSelect={e => setCaret(e.currentTarget.selectionStart ?? value.length)}
      onBlur={() => { setFocused(false); setActive(-1); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { setFocused(false); setActive(-1); return; }
        if (!matches.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
        if ((e.key === 'Enter' || e.key === 'Tab') && active >= 0 && matches[active]) { e.preventDefault(); choose(matches[active]); }
      }} />
    {matches.length > 0 && <div id={id} role="listbox" aria-label={`${label} suggestions`} style={{ position: 'absolute', zIndex: 80, left: 0, right: 0, top: '100%', background: '#fffdf7', border: '1px solid #d8cfb5', borderRadius: 8, boxShadow: '0 6px 18px #0002', maxHeight: 200, overflowY: 'auto' }}>
      {matches.map((email, index) => <div id={`${id}-${index}`} role="option" aria-selected={index === active} key={email}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(email)}
        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#1b4a1b', background: index === active ? '#e9efdf' : 'transparent', overflowWrap: 'anywhere' }}>{email}</div>)}
    </div>}
  </div>;
}
