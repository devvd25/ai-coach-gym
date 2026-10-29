import type { SquatSessionInput } from '@ai-coach/shared';
import { useEffect, useRef, useState } from 'react';
import { FormAlert } from '../../components/form.js';
import { ApiError } from '../../lib/api.js';
import { useSaveSquatSession } from './api.js';
import { COUNTER_CONFIG, POSE_MODELS, type PoseModel } from './config.js';
import { averageMinAngle, initialState, step, type CounterState } from './counter.js';
import { drawPose } from './draw.js';
import { detectPose, getLandmarker, nextTimeline } from './pose.js';

type Status = 'idle' | 'loading' | 'running' | 'done';

const PHASE_LABELS: Record<CounterState['phase'], string> = {
  waiting: 'Đứng thẳng để bắt đầu',
  up: 'Đứng',
  down: 'Xuống',
};

function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError')
    return 'Trình duyệt chưa cho phép dùng camera. Bấm biểu tượng camera trên thanh địa chỉ để cho phép.';
  if (name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị này.';
  if (name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng.';
  return 'Không tải được mô hình nhận dạng tư thế. Kiểm tra kết nối mạng rồi thử lại.';
}

export function LiveSquat() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const loop = useRef<{ raf: number; stream: MediaStream | null; startedAt: number } | null>(null);
  const [model, setModel] = useState<PoseModel>('lite');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>();
  const [view, setView] = useState({ counter: initialState, fps: 0 });
  const [result, setResult] = useState<SquatSessionInput | null>(null);
  const save = useSaveSquatSession();

  const stopStream = () => {
    if (!loop.current) return;
    cancelAnimationFrame(loop.current.raf);
    loop.current.stream?.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => stopStream, []);

  async function start() {
    setError(undefined);
    setResult(null);
    save.reset();
    setStatus('loading');
    let stream: MediaStream | null = null;
    try {
      const landmarker = await getLandmarker(model);
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      const v = video.current!;
      v.srcObject = stream;
      await v.play();

      let counter = initialState;
      let lastVideoTime = -1;
      let lastFrameAt = 0;
      let fps = 0;
      const base = nextTimeline(landmarker);
      loop.current = { raf: 0, stream, startedAt: performance.now() };
      const tick = () => {
        if (!loop.current) return;
        if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
          lastVideoTime = v.currentTime;
          const now = performance.now();
          const landmarks = detectPose(landmarker, v, base + now - loop.current.startedAt);
          counter = step(
            counter,
            { timestampMs: now, landmarks, aspect: v.videoWidth / v.videoHeight },
            COUNTER_CONFIG,
          );
          if (lastFrameAt) fps = 0.9 * fps + 0.1 * (1000 / (now - lastFrameAt));
          lastFrameAt = now;
          const c = canvas.current;
          if (c) {
            if (c.width !== v.videoWidth) c.width = v.videoWidth;
            if (c.height !== v.videoHeight) c.height = v.videoHeight;
            drawPose(c, landmarks, counter.visible ? counter.side : null);
          }
          setView({ counter, fps });
        }
        loop.current.raf = requestAnimationFrame(tick);
      };
      loop.current.raf = requestAnimationFrame(tick);
      setStatus('running');
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      setError(cameraError(err));
      setStatus('idle');
    }
  }

  function stop() {
    const current = loop.current;
    stopStream();
    loop.current = null;
    if (video.current) video.current.srcObject = null;
    const c = view.counter;
    const seconds = current ? (performance.now() - current.startedAt) / 1000 : 0;
    setResult({
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
      durationSec: Math.max(1, Math.round(seconds)),
      repCount: c.reps.length,
      avgMinKneeAngle: averageMinAngle(c.reps),
      model,
      avgFps: seconds > 0 ? Math.round((c.frames / seconds) * 10) / 10 : null,
    });
    setStatus('done');
  }

  async function onSave() {
    if (!result) return;
    try {
      await save.mutateAsync(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được kết quả');
    }
  }

  const c = view.counter;
  const running = status === 'running';

  return (
    <div className="squat">
      <div className="squat-stage">
        <video ref={video} className="squat-video" playsInline muted aria-label="Hình từ camera" />
        <canvas ref={canvas} className="squat-overlay" aria-hidden="true" />
        {!running && (
          <div className="squat-placeholder">
            <p className="caption">Camera tắt</p>
            <p className="muted">
              Hình ảnh chỉ được xử lý trên trình duyệt, không gửi đi và không lưu lại.
            </p>
          </div>
        )}
        {running && !c.visible && (
          <p className="squat-warning" role="status">
            Không thấy rõ hông – gối – cổ chân. Lùi ra xa để toàn thân nằm trong khung.
          </p>
        )}
      </div>

      <aside className="card stack squat-panel">
        <div>
          <p className="caption">Số rep</p>
          <p className="squat-reps" aria-live="polite">
            {c.reps.length}
          </p>
        </div>
        <div className="row">
          <div className="mini">
            <span className="caption">Góc gối</span>
            <span className="number">
              {c.angle === null || !c.visible ? '—' : `${Math.round(c.angle)}°`}
            </span>
          </div>
          <div className="mini">
            <span className="caption">Trạng thái</span>
            <span className="number">{running ? PHASE_LABELS[c.phase] : '—'}</span>
          </div>
          <div className="mini">
            <span className="caption">FPS</span>
            <span className="number">{running ? Math.round(view.fps) : '—'}</span>
          </div>
        </div>
        <p className="muted">
          Đếm 1 rep khi gối gập xuống dưới {COUNTER_CONFIG.downAngle}° rồi đứng lại trên{' '}
          {COUNTER_CONFIG.upAngle}°.
        </p>

        <label className="field">
          <span className="field-label">Mô hình</span>
          <select
            className="input"
            value={model}
            disabled={status === 'loading' || running}
            onChange={(e) => setModel(e.target.value as PoseModel)}
          >
            {Object.entries(POSE_MODELS).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <FormAlert message={error} />
        {running ? (
          <button type="button" className="btn btn-primary" onClick={stop}>
            Kết thúc
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={status === 'loading'}
            onClick={() => void start()}
          >
            {status === 'loading' ? 'Đang tải mô hình…' : 'Bật camera và bắt đầu'}
          </button>
        )}

        {status === 'done' && result && (
          <div className="stack squat-result">
            <p className="caption logo-accent">Kết quả buổi</p>
            <p>
              <strong>{result.repCount} rep</strong> trong {result.durationSec} giây
              {result.avgMinKneeAngle !== null &&
                ` · góc gối thấp nhất TB ${result.avgMinKneeAngle}°`}
            </p>
            {save.isSuccess ? (
              <p className="muted">Đã lưu vào nhật ký Squat.</p>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={save.isPending}
                onClick={() => void onSave()}
              >
                Lưu kết quả
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
