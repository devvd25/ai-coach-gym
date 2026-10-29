import type { AiMeta } from '@ai-coach/shared';
import { useElapsed } from './api.js';
import './ai.css';

const seconds = (ms: number) =>
  `${(ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây`;

/** Shown while the local model is generating, with a running clock so a long wait does not look stuck. */
export function AiBusy({ active, label }: { active: boolean; label: string }) {
  const elapsed = useElapsed(active);
  if (!active) return null;
  return (
    <div className="ai-busy" role="status" aria-live="polite">
      <span className="ai-busy-bar" aria-hidden="true" />
      <div>
        <p>{label}</p>
        <p className="muted">
          {elapsed} giây · mô hình chạy trên máy nên thường mất 10–60 giây, vui lòng không đóng
          trang.
        </p>
      </div>
    </div>
  );
}

export function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini">
      <span className="caption">{label}</span>
      <span className="number">{value}</span>
    </div>
  );
}

/** How the answer was produced: model, latency, retries and which safety checks failed. */
export function AiMetaLine({ meta }: { meta: AiMeta }) {
  return (
    <div className="ai-meta">
      <p className="muted">
        {meta.model} · {meta.promptVersion} · {seconds(meta.latencyMs)}
        {meta.retryCount > 0 && ' · đã thử lại 1 lần'}
      </p>
      {meta.usedFallback ? (
        <p className="ai-fallback">
          AI chưa đưa ra kết quả đạt luật an toàn nên hệ thống dùng <strong>mẫu chuẩn</strong> theo
          hồ sơ của bạn.
        </p>
      ) : (
        <p className="muted">Đã qua kiểm tra đúng định dạng và luật an toàn của hệ thống.</p>
      )}
      {meta.violations.length > 0 && (
        <details>
          <summary className="muted">
            Lỗi AI đã mắc trước khi được chấp nhận ({meta.violations.length})
          </summary>
          <ul className="ai-violations">
            {meta.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
