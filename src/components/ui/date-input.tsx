'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';
import { dateInputError, formatDate, parseAppDate } from '@/lib/date-format';

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'date' };

/** Keep existing handlers and FormData on ISO values while the visible field is DD/MM/YYYY. */
export function dateChangeEvent(event: ChangeEvent<HTMLInputElement>, value: string): ChangeEvent<HTMLInputElement> {
  const target = new Proxy(event.target, { get(input, key) { if (key === 'value') return value; const item = Reflect.get(input, key, input); return typeof item === 'function' ? item.bind(input) : item; } });
  return new Proxy(event, { get(original, key) { return key === 'target' || key === 'currentTarget' ? target : Reflect.get(original, key, original); } });
}
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput({ value, defaultValue, onChange, name, min, max, readOnly, disabled, className, style, placeholder: ignoredPlaceholder, ...props }, forwardedRef) {
  void ignoredPlaceholder;
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(String(defaultValue ?? ''));
  const isoValue = controlled ? String(value ?? '') : internal;
  const [draft, setDraft] = useState(() => formatDate(isoValue, ''));
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const minimum = min == null ? undefined : String(min);
  const maximum = max == null ? undefined : String(max);
  useImperativeHandle(forwardedRef, () => input.current!, []);
  useEffect(() => { setDraft(formatDate(isoValue, '')); }, [isoValue]);
  useEffect(() => { input.current?.setCustomValidity(dateInputError(draft, minimum, maximum)); }, [draft, minimum, maximum]);
  function emit(event: ChangeEvent<HTMLInputElement>, next: string) {
    if (!controlled) setInternal(next);
    onChange?.(dateChangeEvent(event, next));
  }
  function openCalendar() {
    if (disabled || readOnly) return;
    try { picker.current?.showPicker(); } catch { /* Typing remains available if the browser has no picker. */ }
  }
  return <span className="msp-date-control" style={{ width: style?.width, minWidth: style?.minWidth, maxWidth: style?.maxWidth }}>
    <input {...props} ref={input} type="text" className={className} style={style} inputMode="numeric" autoComplete={props.autoComplete || 'off'} placeholder="DD/MM/YYYY" maxLength={10} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" disabled={disabled} readOnly={readOnly} value={draft} onClick={event => { props.onClick?.(event); if (!event.defaultPrevented) openCalendar(); }} onChange={event => {
      const raw = event.target.value;
      const parsed = parseAppDate(raw);
      const nextDraft = parsed ? formatDate(parsed, '') : raw.replace(/\D/g, '').slice(0, 8);
      setDraft(nextDraft);
      event.target.setCustomValidity(dateInputError(nextDraft, minimum, maximum));
      if (!nextDraft || parsed) emit(event, parsed);
    }} />
    {!readOnly && <button type="button" className="msp-date-calendar" aria-label={`Choose ${props['aria-label'] || 'date'} from calendar`} disabled={disabled} onClick={openCalendar}><CalendarDays size={17} aria-hidden="true" /></button>}
    <input ref={picker} type="date" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', opacity: 0, width: 36, right: 0, top: 0, height: '100%', pointerEvents: 'none', padding: 0, border: 0 }} disabled={disabled || readOnly} min={minimum} max={maximum} value={parseAppDate(isoValue)} onChange={event => { const iso = event.target.value; setDraft(formatDate(iso, '')); emit(event, iso); }} />
    {name && <input type="hidden" name={name} value={parseAppDate(isoValue)} disabled={disabled} />}
  </span>;
});
