import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { FormAlert } from '../../components/form.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { dayMonth } from '../../lib/format.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useSquatSessions } from './api.js';
import { EvaluationPanel } from './EvaluationPanel.js';
import { LiveSquat } from './LiveSquat.js';
import './squat.css';

const TIPS = [
  'Đặt camera ngang hông, cách 2–3 m, đứng nghiêng khoảng 90° so với camera.',
  'Toàn thân (từ đầu đến bàn chân) phải nằm trong khung hình.',
  'Phòng đủ sáng, nền phía sau gọn; mặc quần áo không quá rộng ở chân.',
  'Bắt đầu ở tư thế đứng thẳng; mỗi rep hạ đùi đến song song sàn rồi đứng lên hết.',
];

export function CameraPage() {
  const [params, setParams] = useSearchParams();
  const evaluate = params.get('che-do') === 'danh-gia';
  const { user, giveConsent } = useAuth();
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const allowed = user?.consents.camera ?? false;

  async function allowCamera() {
    if (!user) return;
    setBusy(true);
    setAlert(undefined);
    try {
      await giveConsent({ profileData: true, trainingLogs: true, ...user.consents, camera: true });
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        caption="MediaPipe Pose · chạy trên trình duyệt"
        title="Camera Squat"
        actions={
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!evaluate}
              className={`btn ${evaluate ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setParams({})}
            >
              Tập với camera
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={evaluate}
              className={`btn ${evaluate ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setParams({ 'che-do': 'danh-gia' })}
            >
              Đánh giá bằng video
            </button>
          </div>
        }
      />

      {!allowed ? (
        <section className="card card-accent stack">
          <p className="caption logo-accent">Cần bạn đồng ý</p>
          <h2>Cho phép dùng camera để đếm rep</h2>
          <p className="muted">
            Hình ảnh từ camera chỉ được xử lý ngay trên trình duyệt của bạn để nhận dạng tư thế. Ứng
            dụng <strong>không gửi và không lưu video</strong>; chỉ lưu số rep, thời gian và góc gối
            trung bình khi bạn bấm lưu. Bạn có thể tắt quyền này bất cứ lúc nào trong Hồ sơ.
          </p>
          <FormAlert message={alert} />
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void allowCamera()}
            >
              Đồng ý sử dụng camera
            </button>
          </div>
        </section>
      ) : evaluate ? (
        <EvaluationPanel />
      ) : (
        <>
          <section className="card stack">
            <h2>Chuẩn bị</h2>
            <ol className="squat-tips">
              {TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
          <LiveSquat />
          <RecentSquats />
        </>
      )}
    </>
  );
}

function RecentSquats() {
  const sessions = useSquatSessions(90);
  if (!sessions.data || sessions.data.length === 0) return null;
  return (
    <section className="card stack">
      <h2>Buổi Squat gần đây</h2>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Ngày</th>
            <th scope="col">Rep</th>
            <th scope="col">Thời gian</th>
            <th scope="col">Góc gối thấp nhất TB</th>
            <th scope="col">Mô hình</th>
          </tr>
        </thead>
        <tbody>
          {sessions.data.slice(0, 10).map((s) => (
            <tr key={s.id}>
              <td>{dayMonth(s.startedAt)}</td>
              <td className="number">{s.repCount}</td>
              <td className="muted">
                {Math.floor(s.durationSec / 60)}:{String(s.durationSec % 60).padStart(2, '0')}
              </td>
              <td className="muted">
                {s.avgMinKneeAngle === null ? '—' : `${s.avgMinKneeAngle}°`}
              </td>
              <td className="muted">{s.model}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
