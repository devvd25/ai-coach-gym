import {
  DAY_LABELS,
  DAYS,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  GOAL_LABELS,
  GOALS,
  LEVEL_LABELS,
  LEVELS,
  LOCATION_LABELS,
  LOCATIONS,
  SESSION_MINUTES,
  SEX_LABELS,
  SEXES,
} from '@ai-coach/shared';
import { ChoiceGroup, TextField } from '../../components/form.js';
import { toggleIn, type ProfileDraft } from './profile-draft.js';

interface SectionProps {
  draft: ProfileDraft;
  errors: Record<string, string>;
  update(patch: Partial<ProfileDraft>): void;
}

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

/** Onboarding step 2/3 (Figma 02a): goal and body. */
export function BodySection({ draft, errors, update }: SectionProps) {
  return (
    <>
      <ChoiceGroup
        label="Mục tiêu"
        variant="card"
        options={GOALS.map((g) => ({
          value: g,
          label: GOAL_LABELS[g].title,
          hint: GOAL_LABELS[g].hint,
        }))}
        selected={draft.goal ? [draft.goal] : []}
        onToggle={(goal) => update({ goal })}
        error={errors.goal}
      />
      <ChoiceGroup
        label="Giới tính"
        options={options(SEXES, SEX_LABELS)}
        selected={draft.sex ? [draft.sex] : []}
        onToggle={(sex) => update({ sex })}
        error={errors.sex}
      />
      <div className="row">
        <TextField
          label="Tuổi"
          inputMode="numeric"
          value={draft.age}
          onChange={(age) => update({ age })}
          error={errors.age}
        />
        <TextField
          label="Chiều cao (cm)"
          inputMode="decimal"
          value={draft.heightCm}
          onChange={(heightCm) => update({ heightCm })}
          error={errors.heightCm}
        />
        <TextField
          label="Cân nặng (kg)"
          inputMode="decimal"
          value={draft.weightKg}
          onChange={(weightKg) => update({ weightKg })}
          error={errors.weightKg}
        />
      </div>
      <ChoiceGroup
        label="Trình độ tập luyện"
        options={options(LEVELS, LEVEL_LABELS)}
        selected={draft.level ? [draft.level] : []}
        onToggle={(level) => update({ level })}
        error={errors.level}
      />
      <TextField
        label="Chấn thương / hạn chế (không bắt buộc)"
        placeholder="Ví dụ: đau gối trái khi xuống sâu"
        value={draft.injuries}
        onChange={(injuries) => update({ injuries })}
        error={errors.injuries}
        maxLength={500}
      />
    </>
  );
}

/** Onboarding step 3/3 (Figma 02b): schedule and equipment. */
export function ScheduleSection({ draft, errors, update }: SectionProps) {
  return (
    <>
      <ChoiceGroup
        label="Số buổi mỗi tuần"
        hint="Khuyến nghị 3–4"
        variant="square"
        options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
        selected={[draft.sessionsPerWeek]}
        onToggle={(sessionsPerWeek) => update({ sessionsPerWeek })}
        error={errors.sessionsPerWeek}
      />
      <ChoiceGroup
        label="Thời lượng mỗi buổi"
        options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} phút` }))}
        selected={[draft.sessionMinutes]}
        onToggle={(sessionMinutes) => update({ sessionMinutes })}
        error={errors.sessionMinutes}
      />
      <ChoiceGroup
        label="Ngày ưu tiên"
        hint={`Chọn ${draft.sessionsPerWeek} ngày hoặc bỏ trống để AI tự xếp`}
        variant="square"
        options={options(DAYS, DAY_LABELS)}
        selected={draft.preferredDays}
        onToggle={(day) => update({ preferredDays: toggleIn(draft.preferredDays, day) })}
        error={errors.preferredDays}
      />
      <ChoiceGroup
        label="Nơi tập"
        options={options(LOCATIONS, LOCATION_LABELS)}
        selected={[draft.location]}
        onToggle={(location) => update({ location })}
        error={errors.location}
      />
      <ChoiceGroup
        label="Dụng cụ có sẵn"
        hint="Chọn nhiều"
        options={options(EQUIPMENT, EQUIPMENT_LABELS)}
        selected={draft.equipment}
        onToggle={(e) => update({ equipment: toggleIn(draft.equipment, e) })}
        error={errors.equipment}
      />
    </>
  );
}
