import { useEffect, useRef, useState } from 'react';
import { FormAlert } from '../../components/form.js';
import {
  COUNTER_CONFIG,
  EVAL_FPS_OPTIONS,
  EVAL_GENTLE,
  POSE_MODELS,
  type PoseModel,
} from './config.js';
import { countingAccuracy, evaluationCsv, type EvaluationRow } from './evaluation.js';
import { isSquat, mergeLabels, parseLabels, videoKey, type LabelSet } from './labels.js';
import { analyzeVideo, rest } from './video-eval.js';

function download(name: string, content: string) {
  // BOM so Excel opens the Vietnamese file names correctly.
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
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
  const [labels, setLabels] = useState<LabelSet | null>(null);
  const [onlySquat, setOnlySquat] = useState(true);
  const [gentle, setGentle] = useState(true);
  const cancel = useRef(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const accuracy = countingAccuracy(rows);

  useEffect(() => {
    // Not in React's typings; lets the user pick a whole dataset folder.
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const labelOf = (f: File) => labels?.byVideo.get(videoKey(f.name)) ?? null;
  const usesTypes = (labels?.types.length ?? 0) > 0;
  /** With a label file, only labelled videos are run (and only squats, unless unticked). */
  const queue = files.filter((f) => {
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|avi|mkv)$/i.test(f.name)) return false;
    if (!labels) return true;
    const l = labelOf(f);
    return l !== null && (!onlySquat || !usesTypes || isSquat(l.type));
  });

  async function loadLabels(list: FileList | null) {
    setError(undefined);
    try {
      const sets = await Promise.all(
        [...(list ?? [])].map(async (f) => parseLabels(await f.text())),
      );
      setLabels(sets.length ? mergeLabels(sets) : null);
    } catch (err) {
      setLabels(null);
      setError(err instanceof Error ? err.message : 'Không đọc được file nhãn');
    }
  }

  async function run() {
    setError(undefined);
    setRows([]);
    cancel.current = false;
    const done: EvaluationRow[] = [];
    try {
      for (const [index, file] of queue.entries()) {
        if (index > 0 && gentle) await rest(EVAL_GENTLE.videoRestMs);
        if (cancel.current) break;
        setProgress({ index, fraction: 0 });
        const row = await analyzeVideo(file, {
          model,
          fps,
          frameRestMs: gentle ? EVAL_GENTLE.frameRestMs : 0,
          onProgress: (fraction) => setProgress({ index, fraction }),
          cancelled: () => cancel.current,
        });
        done.push({ ...row, groundTruth: labelOf(file)?.count ?? null });
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
          Chọn video (hoặc cả thư mục bộ dữ liệu) và, nếu có, file nhãn số rep (CSV của RepCount,
          JSONL trên Hugging Face, hoặc CSV đã xuất từ trang này). Hệ thống chạy từng frame ngay
          trên trình duyệt (không tải video lên máy chủ), đếm rep rồi so với nhãn và xuất CSV.
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
            <span className="field-label">Hoặc cả thư mục</span>
            <input
              ref={folderInput}
              className="input"
              type="file"
              multiple
              disabled={running}
              onChange={(e) => setFiles([...(e.target.files ?? [])])}
            />
          </label>
          <label className="field">
            <span className="field-label">Nhãn số rep (tùy chọn)</span>
            <input
              className="input"
              type="file"
              accept=".csv,.jsonl,.json,text/csv"
              multiple
              disabled={running}
              onChange={(e) => void loadLabels(e.target.files)}
            />
          </label>
        </div>
        <div className="row">
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
        <div className="row-actions">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={gentle}
              disabled={running}
              onChange={(e) => setGentle(e.target.checked)}
            />
            <span>
              Chế độ nhẹ: nghỉ {EVAL_GENTLE.frameRestMs} ms mỗi frame và{' '}
              {EVAL_GENTLE.videoRestMs / 1000} giây giữa các video để máy không nóng (kết quả không
              đổi, chỉ chạy lâu hơn)
            </span>
          </label>
          {labels && usesTypes && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={onlySquat}
                disabled={running}
                onChange={(e) => setOnlySquat(e.target.checked)}
              />
              <span>Chỉ chạy video được gán nhãn squat</span>
            </label>
          )}
        </div>
        {labels && (
          <p className="muted">
            Đã đọc nhãn của {labels.byVideo.size} video
            {usesTypes && ` (${labels.types.length} loại động tác)`}; {queue.length}/{files.length}{' '}
            file đã chọn sẽ được chạy.
          </p>
        )}
        <FormAlert message={error} />
        {progress && (
          <div className="stack">
            <p className="muted">
              Video {progress.index + 1}/{queue.length}: {queue[progress.index]?.name} ·{' '}
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
              disabled={queue.length === 0}
              onClick={() => void run()}
            >
              Chạy đánh giá {queue.length > 0 && `(${queue.length} video)`}
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
                {accuracy.videos} video có nhãn · MAE{' '}
                {accuracy.mae.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} rep
                {accuracy.normMae !== null &&
                  ` · MAE chuẩn hóa ${accuracy.normMae.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}`}{' '}
                · OBO {Math.round(accuracy.obo * 100)}% · đúng hoàn toàn{' '}
                {Math.round(accuracy.exact * 100)}%
              </p>
            )}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col">Rep đếm được</th>
                <th scope="col">Thời điểm rep (giây)</th>
                <th scope="col">Nhãn / đếm tay</th>
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
