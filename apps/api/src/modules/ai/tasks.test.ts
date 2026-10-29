import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LIBRARY, PROFILE } from '../../test/library.js';
import { planTask } from './tasks.js';
import { templatePlan } from './templates.js';

describe('plan prompt versions', () => {
  const template = templatePlan(PROFILE, LIBRARY);
  const withFirst = (patch: Record<string, unknown>) => ({
    ...template,
    sessions: template.sessions.map((s, i) =>
      i === 0 ? { ...s, ...patch, exercises: s.exercises } : s,
    ),
  });
  const withReps = (reps: string) => ({
    ...template,
    sessions: template.sessions.map((s, i) =>
      i === 0 ? { ...s, exercises: s.exercises.map((e) => ({ ...e, reps })) } : s,
    ),
  });

  it('plan.v2 fixes the title list and the reps format in the JSON Schema', () => {
    const v2 = planTask(1, PROFILE, LIBRARY, 'plan.v2');
    expect(v2.promptVersion).toBe('plan.v2');
    expect(v2.schema.safeParse(template).success).toBe(true);
    expect(v2.schema.safeParse(withFirst({ title: 'Ngày nghỉ' })).success).toBe(false);
    expect(v2.schema.safeParse(withReps('x10')).success).toBe(false);
    expect(v2.schema.safeParse(withReps(']')).success).toBe(false);
    for (const ok of ['8', '8-12', '45s'])
      expect(v2.schema.safeParse(withReps(ok)).success).toBe(true);

    // What Ollama receives: an enum for the title and a pattern for reps.
    const json = JSON.stringify(z.toJSONSchema(v2.schema));
    expect(json).toContain('"pattern"');
    expect(json).toContain('Đẩy (ngực, vai, tay sau)');
  });

  it('plan.v1 is unchanged, so the two versions can be compared', () => {
    const v1 = planTask(1, PROFILE, LIBRARY, 'plan.v1');
    expect(v1.schema.safeParse(withFirst({ title: 'Ngày nghỉ' })).success).toBe(true);
    expect(v1.schema.safeParse(withReps('x10')).success).toBe(true);
    // ...and the safety rules still catch both mistakes afterwards.
    expect(v1.check(withFirst({ title: 'Ngày nghỉ' })).join()).toContain('ngày nghỉ');
    expect(v1.check(withReps('x10')).join()).toContain('sai định dạng');
  });
});
