import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Checkbox, FormAlert, Toggle } from '../../components/form.js';
import { AuthHeading, AuthLayout } from '../../layouts/AuthLayout.js';
import { ApiError } from '../../lib/api.js';
import { useAuth } from './AuthProvider.js';
import { nextStep } from './next-step.js';

export function ConsentPage() {
  const { giveConsent, logout } = useAuth();
  const navigate = useNavigate();
  const [required, setRequired] = useState({ profileData: false, trainingLogs: false });
  const [optional, setOptional] = useState({ camera: true, research: false });
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onAccept() {
    if (!required.profileData || !required.trainingLogs) {
      setAlert('Cần đồng ý 2 mục bắt buộc để AI Coach tạo kế hoạch cho bạn.');
      return;
    }
    setBusy(true);
    setAlert(undefined);
    try {
      const user = await giveConsent({ profileData: true, trainingLogs: true, ...optional });
      navigate(nextStep(user) ?? '/', { replace: true });
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout wide>
      <AuthHeading
        caption="Bước 1/3 · Quyền riêng tư"
        title="Dữ liệu của bạn, quyền của bạn"
        lead="Chọn những dữ liệu AI Coach được phép xử lý. Bạn có thể thay đổi bất cứ lúc nào trong Hồ sơ."
      />
      <FormAlert message={alert} />

      <ConsentItem
        title="Hồ sơ & thể trạng"
        badge="Bắt buộc"
        text="Tuổi, giới tính, chiều cao, cân nặng, mục tiêu và chấn thương — để tạo kế hoạch an toàn."
      >
        <Checkbox
          checked={required.profileData}
          onChange={(v) => setRequired((r) => ({ ...r, profileData: v }))}
        >
          <span className="sr-only">Đồng ý xử lý hồ sơ & thể trạng</span>
        </Checkbox>
      </ConsentItem>
      <ConsentItem
        title="Nhật ký tập luyện & dinh dưỡng"
        badge="Bắt buộc"
        text="Để theo dõi tiến độ và cá nhân hóa gợi ý của AI Coach."
      >
        <Checkbox
          checked={required.trainingLogs}
          onChange={(v) => setRequired((r) => ({ ...r, trainingLogs: v }))}
        >
          <span className="sr-only">Đồng ý lưu nhật ký tập luyện & dinh dưỡng</span>
        </Checkbox>
      </ConsentItem>
      <ConsentItem
        title="Camera Squat"
        badge="Tùy chọn"
        text="Video xử lý ngay trên trình duyệt, không lưu, không gửi lên máy chủ. Chỉ lưu số rep và góc gối."
      >
        <Toggle
          label="Camera Squat"
          hideLabel
          checked={optional.camera}
          onChange={(v) => setOptional((o) => ({ ...o, camera: v }))}
        />
      </ConsentItem>
      <ConsentItem
        title="Dữ liệu ẩn danh cho nghiên cứu"
        badge="Tùy chọn"
        text="Dữ liệu đã ẩn danh dùng để đánh giá AI và mô hình dự đoán tiến độ trong đề tài NCKH."
      >
        <Toggle
          label="Dữ liệu ẩn danh cho nghiên cứu"
          hideLabel
          checked={optional.research}
          onChange={(v) => setOptional((o) => ({ ...o, research: v }))}
        />
      </ConsentItem>

      <div className="row">
        <button type="button" className="btn btn-secondary" onClick={logout}>
          Đăng xuất
        </button>
        <button type="button" className="btn btn-primary" onClick={onAccept} disabled={busy}>
          {busy ? 'Đang lưu…' : 'Đồng ý và tiếp tục'}
        </button>
      </div>
    </AuthLayout>
  );
}

function ConsentItem({
  title,
  badge,
  text,
  children,
}: {
  title: string;
  badge: 'Bắt buộc' | 'Tùy chọn';
  text: string;
  children: ReactNode;
}) {
  return (
    <section className="consent-item">
      <div className="consent-text">
        <h2 className="consent-title">
          {title}
          <span className={`badge ${badge === 'Bắt buộc' ? 'badge-primary' : 'badge-neutral'}`}>
            {badge}
          </span>
        </h2>
        <p className="muted">{text}</p>
      </div>
      {children}
    </section>
  );
}
