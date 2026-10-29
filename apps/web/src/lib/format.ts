import { parseIsoDate } from '@ai-coach/shared';

const pad = (n: number) => String(n).padStart(2, '0');

/** "dd/mm". Built by hand because browsers disagree on the vi-VN separator ("26/10" vs "26-10"). */
export function dayMonth(value: string | Date): string {
  const d =
    typeof value === 'string'
      ? value.length === 10
        ? parseIsoDate(value)
        : new Date(value)
      : value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Vietnamese number formatting: 10.350 and 68,4. */
export function kg(n: number): string {
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg`;
}
