import { z } from 'zod';
import { DAYS } from './profile.js';

export type Day = (typeof DAYS)[number];

export const isoDateSchema = z.iso.date({ error: 'Ngày không hợp lệ (YYYY-MM-DD)' });

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (not UTC, so 00:30 in Vietnam stays on the right day). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Monday of the week containing the date (weeks start on Monday in Vietnam). */
export function mondayOf(date: Date | string): string {
  const d = typeof date === 'string' ? parseIsoDate(date) : new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toIsoDate(d);
}

export function isMonday(iso: string): boolean {
  return parseIsoDate(iso).getDay() === 1;
}

/** Calendar date of a weekday inside the week that starts at weekStart. */
export function dateOfDay(weekStart: string, day: Day): string {
  return addDays(weekStart, DAYS.indexOf(day));
}

export function dayOf(date: Date | string): Day {
  const d = typeof date === 'string' ? parseIsoDate(date) : date;
  return DAYS[(d.getDay() + 6) % 7] as Day;
}

export const weekStartSchema = isoDateSchema.refine(isMonday, 'Tuần phải bắt đầu từ thứ Hai');
