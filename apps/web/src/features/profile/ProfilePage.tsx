import { useEffect, useState, type FormEvent } from 'react';
import { FormAlert, Toggle } from '../../components/form.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useProfile, useSaveProfile } from './api.js';
import {
  draftFromProfile,
  emptyDraft,
  validateProfile,
  type ProfileDraft,
} from './profile-draft.js';
import { BodySection, ScheduleSection } from './ProfileSections.js';
import './profile.css';

export function ProfilePage() {
  const { user, giveConsent, logout } = useAuth();
  const profile = useProfile();
  const save = useSaveProfile();
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const update = (patch: Partial<ProfileDraft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  useEffect(() => {
    if (profile.data) setDraft(draftFromProfile(profile.data));
  }, [profile.data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(undefined);
    const result = validateProfile(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setAlert('Một vài thông tin chưa hợp lệ, xem các ô được đánh dấu.');
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(result.profile);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      setAlert(err instanceof ApiError ? err.message : 'Không lưu được hồ sơ, vui lòng thử lại');
    }
  }

  async function setConsent(key: 'camera' | 'research', value: boolean) {
    if (!user) return;
    setPrivacyBusy(true);
    try {
      await giveConsent({ profileData: true, trainingLogs: true, ...user.consents, [key]: value });
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Không cập nhật được quyền riêng tư');
    } finally {
      setPrivacyBusy(false);
    }
  }

  if (profile.isPending) return <p className="muted">Đang tải hồ sơ…</p>;

  return (
    <form className="stack profile-page" onSubmit={onSubmit} noValidate>
      <PageHeader
        caption="Thông tin cá nhân, mục tiêu và quyền riêng tư"
        title="Hồ sơ & cài đặt"
        actions={
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        }
      />
      <FormAlert message={alert} />
      {saved && (
        <p className="form-success" role="status">
          Đã lưu hồ sơ. Kế hoạch mới sẽ áp dụng từ tuần sau.
        </p>
      )}

      <div className="profile-grid">
        <div className="stack">
          <section className="card stack">
            <div className="identity">
              <span className="avatar avatar-lg" aria-hidden="true">
                {user?.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
              </span>
              <div>
                <h2>{user?.fullName}</h2>
                <p className="muted">{user?.email}</p>
              </div>
            </div>
          </section>
          <section className="card stack">
            <h2>Mục tiêu & thể trạng</h2>
            <BodySection draft={draft} errors={errors} update={update} />
          </section>
          <section className="card stack">
            <h2>Lịch tập & dụng cụ</h2>
            <ScheduleSection draft={draft} errors={errors} update={update} />
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            <h2>Quyền riêng tư</h2>
            <Toggle
              label="Camera Squat"
              description="Video xử lý trên trình duyệt, không lưu."
              checked={user?.consents.camera ?? false}
              disabled={privacyBusy}
              onChange={(v) => void setConsent('camera', v)}
            />
            <Toggle
              label="Dữ liệu ẩn danh cho nghiên cứu"
              description="Đóng góp cho đề tài NCKH, có thể tắt bất cứ lúc nào."
              checked={user?.consents.research ?? false}
              disabled={privacyBusy}
              onChange={(v) => void setConsent('research', v)}
            />
          </section>
          <section className="card stack">
            <h2>Tài khoản</h2>
            <button type="button" className="btn btn-secondary btn-block" onClick={logout}>
              Đăng xuất
            </button>
          </section>
        </aside>
      </div>
    </form>
  );
}
