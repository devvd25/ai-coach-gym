import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { FormAlert } from '../../components/form.js';
import { Icon } from '../../components/Icon.js';
import { Logo } from '../../components/Logo.js';
import { ApiError } from '../../lib/api.js';
import { useSaveProfile } from './api.js';
import {
  emptyDraft,
  validateBodyStep,
  validateProfile,
  type ProfileDraft,
} from './profile-draft.js';
import { BodySection, ScheduleSection } from './ProfileSections.js';
import './onboarding.css';

const STEPS = [
  {
    caption: 'Bước 2/3 · Mục tiêu & thể trạng',
    title: 'Mục tiêu của bạn là gì?',
    lead: 'AI Coach dùng thông tin này để tạo lịch tập và mức calo phù hợp. Bạn có thể đổi lại trong Hồ sơ.',
  },
  {
    caption: 'Bước 3/3 · Lịch tập & dụng cụ',
    title: 'Bạn tập được bao nhiêu?',
    lead: 'Lịch tập sẽ được chia theo số buổi, thời lượng và dụng cụ bạn có.',
  },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const save = useSaveProfile();
  const [step, setStep] = useState<0 | 1>(0);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string>();
  const update = (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const s = STEPS[step];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(undefined);
    if (step === 0) {
      const errs = validateBodyStep(draft);
      setErrors(errs);
      if (Object.keys(errs).length === 0) {
        setStep(1);
        window.scrollTo({ top: 0 });
      }
      return;
    }
    const result = validateProfile(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(result.profile);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      setAlert(err instanceof ApiError ? err.message : 'Không lưu được hồ sơ, vui lòng thử lại');
    }
  }

  return (
    <div className="onboarding">
      <header className="onboarding-top">
        <Logo />
        <span className="muted">Bước {step + 2}/3</span>
      </header>
      <form className="onboarding-content" onSubmit={onSubmit} noValidate>
        <div className="steps" aria-hidden="true">
          <span className="done" />
          <span className="done" />
          <span className={step === 1 ? 'done' : ''} />
        </div>
        <div className="auth-heading">
          <p className="caption logo-accent">{s.caption}</p>
          <h1>{s.title}</h1>
          <p className="muted">{s.lead}</p>
        </div>
        <FormAlert message={alert} />
        {step === 0 ? (
          <BodySection draft={draft} errors={errors} update={update} />
        ) : (
          <ScheduleSection draft={draft} errors={errors} update={update} />
        )}
        <div className="onboarding-footer">
          {step === 1 ? (
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setStep(0)}>
              <Icon name="back" size={20} /> Quay lại
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary btn-icon" disabled={save.isPending}>
            {step === 0 ? 'Tiếp tục' : save.isPending ? 'Đang lưu…' : 'Hoàn tất hồ sơ'}
            <Icon name="chevron" size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
