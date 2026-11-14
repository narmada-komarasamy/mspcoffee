'use client';

import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { DateInput, dateChangeEvent } from './date-input';

export function DateTimeInput({ value, onChange, min, max, className, style, name, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'datetime-local' }) {
  const source = String(value ?? '');
  const [day, setDay] = useState(source.split('T')[0] || '');
  const [time, setTime] = useState(source.split('T')[1]?.slice(0, 5) || '');
  useEffect(() => { setDay(source.split('T')[0] || ''); setTime(source.split('T')[1]?.slice(0, 5) || ''); }, [source]);
  function emit(event: ChangeEvent<HTMLInputElement>, date: string, clock: string) {
    if (date && clock) onChange?.(dateChangeEvent(event, `${date}T${clock}`));
    else onChange?.(dateChangeEvent(event, ''));
  }
  return <span className="msp-date-time-control">
    <DateInput {...props} type="date" className={className} style={style} value={day} min={min ? String(min).split('T')[0] : undefined} max={max ? String(max).split('T')[0] : undefined} onChange={event => { setDay(event.target.value); emit(event, event.target.value, time); }} />
    <input aria-label="Time (24 hour)" type="time" className={className} style={style} disabled={props.disabled} readOnly={props.readOnly} required={props.required} value={time} min={min && day === String(min).split('T')[0] ? String(min).split('T')[1] : undefined} max={max && day === String(max).split('T')[0] ? String(max).split('T')[1] : undefined} onChange={event => { setTime(event.target.value); emit(event, day, event.target.value); }} />
    {name && <input type="hidden" name={name} disabled={props.disabled} value={day && time ? `${day}T${time}` : ''} />}
  </span>;
}
