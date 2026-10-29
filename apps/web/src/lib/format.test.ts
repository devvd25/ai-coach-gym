import { describe, expect, it } from 'vitest';
import { dayMonth, kg } from './format.js';

describe('format', () => {
  it('always renders dd/mm', () => {
    expect(dayMonth('2026-10-05')).toBe('05/10');
    expect(dayMonth(new Date(2026, 0, 31))).toBe('31/01');
  });

  it('uses Vietnamese separators for kg', () => {
    expect(kg(10350)).toBe('10.350 kg');
    expect(kg(68.4)).toBe('68,4 kg');
  });
});
