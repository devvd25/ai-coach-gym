import { useRef, useState } from 'react';
import { FormAlert } from '../../components/form.js';
import { COUNTER_CONFIG, EVAL_FPS_OPTIONS, POSE_MODELS, type PoseModel } from './config.js';
import { initialState, step } from './counter.js';
import { countingAccuracy, evaluationCsv, type EvaluationRow } from './evaluation.js';
import { detectPose, getLandmarker, nextTimeline } from './pose.js';

function waitFor(el: HTMLVideoElement, event: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      el.removeEventListener(event, done);
      el.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      el.removeEventListener(event, done);
      el.removeEventListener('error', fail);
      reject(new Error('Không đọc được video'));
    };
    el.addEventListener(event, done);
    el.addEventListener('error', fail);
  });
}

/**
 * Steps through the file frame by frame (seek, detect, count) instead of playing it, so the result
 * does not depend on how fast the machine is and is the same every run.
 */
async function analyze(
  file: File,
  model: PoseModel,
  fps: number,
  onProgress: (fraction: number) => void,
  cancelled: () => boolean,
): Promise<EvaluationRow> {
  const started = performance.now();
  const landmarker = await getLandmarker(model);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const url = URL.createObjectURL(file);
  try {
    v.src = url;
    await waitFor(v, 'loadeddata');
    let duration = v.duration;
    if (!Number.isFinite(duration)) {
      // Files recorded by browsers (MediaRecorder WebM) often report Infinity until seeked to the end.
      v.currentTime = Number.MAX_SAFE_INTEGER;
      await waitFor(v, 'seeked');
      duration = v.duration;
      v.currentTime = 0;
      await waitFor(v, 'seeked');
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Không đọc được thời lượng của video ${file.name}`);
    }
    const aspect = v.videoWidth / v.videoHeight;
    const base = nextTimeline(landmarker);
    let state = initialState;
    for (let i = 0; i * (1 / fps) < duration; i++) {
      if (cancelled()) throw new Error('Đã hủy');
      const t = i / fps;
      if (Math.abs(v.currentTime - t) > 1e-6) {
        v.currentTime = t;
        await waitFor(v, 'seeked');
      }
      const landmarks = detectPose(landmarker, v, base + t * 1000);
      state = step(state, { timestampMs: t * 1000, landmarks, aspect }, COUNTER_CONFIG);
      if (i % 5 === 0) onProgress(t / duration);
    }
    onProgress(1);
    return {
      video: file.name,
      model,
      fps,
      durationSec: duration,
      processingSec: (performance.now() - started) / 1000,
      result: state,
      groundTruth: null,
    };
  } finally {
    URL.revokeObjectURL(url);
    v.removeAttribute('src');
  }
}

function download(name: string, content: string) {
  // BOM so Excel opens the Vietnamese file names correctly.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function EvaluationPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [model, setModel] = useState<PoseModel>('lite');
  const [fps, setFps] = useState<number>(EVAL_FPS_OPTIONS[0]);
  const [rows, setRows] = useState<EvaluationRow[]>([]);
  const [progress, setProgress] = useState<{ index: number; fraction: number } | null>(null);
  const [error, setError] = useState<string>();
  const cancel = useRef(false);
  const accuracy = countingAccuracy(rows);

  async function run() {
    setError(undefined);
    setRows([]);
    cancel.current = false;
    const done: EvaluationRow[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ index, fraction: 0 });
        done.push(
          await analyze(
            file,
            model,
            fps,
            (fraction) => setProgress({ index, fraction }),
            () => cancel.current,
          ),
        );
        setRows([...done]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xử lý được video');
    } finally {
      setProgress(null);
    }
  }

  function exportCsv() {
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    download(`squat-eval-${model}-${fps}fps-${stamp}.csv`, evaluationCsv(rows, COUNTER_CONFIG));
  }

  const running = progress !== null;

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Chế độ đánh giá bằng video</h2>
        <p className="muted">
          Chọn một hoặc nhiều video quay nghiêng khi tập Squat. Hệ thống chạy từng frame ngay trên
          trình duyệt (không tải video lên máy chủ), đếm rep rồi xuất CSV để so với số đếm tay.
        </p>
        <div className="row">
          <label className="field">
            <span className="field-label">Video</span>
            <input
              className="input"
              type="file"
              accept="video/*"
              multiple
              disabled={running}
              onChange={(e) => setFiles([...(e.target.files ?? [])])}
            />
          </label>
          <label className="field">
            <span className="field-label">Mô hình</span>
            <select
              className="input"
              value={model}
              disabled={running}
              onChange={(e) => setModel(e.target.value as PoseModel)}
            >
              {Object.entries(POSE_MODELS).map(([key, m]) => (
                <option key={key} value={key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Lấy mẫu</span>
            <select
              className="input"
              value={fps}
              disabled={running}
              onChange={(e) => setFps(Number(e.target.value))}
            >
              {EVAL_FPS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f} frame/giây
                </option>
              ))}
            </select>
          </label>
        </div>
        <FormAlert message={error} />
        {progress && (
          <div className="stack">
            <p className="muted">
              Video {progress.index + 1}/{files.length}: {files[progress.index]?.name} ·{' '}
              {Math.round(progress.fraction * 100)}%
            </p>
            <div className="progress">
              <span style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="row-actions">
          {running ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                cancel.current = true;
              }}
            >
              Hủy
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={files.length === 0}
              onClick={() => void run()}
            >
              Chạy đánh giá {files.length > 0 && `(${files.length} video)`}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={rows.length === 0 || running}
            onClick={exportCsv}
          >
            Tải CSV
          </button>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card stack">
          <div className="card-title">
            <h2>Kết quả</h2>
            {accuracy && (
              <p className="muted">
                {accuracy.videos} video có số đếm tay · MAE{' '}
                {accuracy.mae.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} rep · đúng hoàn
                toàn {Math.round(accuracy.exact * 100)}%
              </p>
            )}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col">Rep đếm được</th>
                <th scope="col">Thời điểm rep (giây)</th>
                <th scope="col">Đếm tay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.video}-${i}`}>
                  <td>{r.video}</td>
                  <td className="number">{r.result.reps.length}</td>
                  <td className="muted">
                    {r.result.reps
                      .map((rep) => (rep.timestampMs / 1000).toFixed(1).replace('.', ','))
                      .join(' · ') || '—'}
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`gt-${i}`}>
                      Số rep đếm tay của {r.video}
                    </label>
                    <input
                      id={`gt-${i}`}
                      className="input input-sm"
                      type="number"
                      min={0}
                      value={r.groundTruth ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : Number(e.target.value);
                        setRows(rows.map((x, j) => (j === i ? { ...x, groundTruth: value } : x)));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
