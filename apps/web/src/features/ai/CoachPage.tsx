import { mondayOf, toIsoDate, type AiTask, type ChatMessage } from '@ai-coach/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FormAlert } from '../../components/form.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { dayMonth, kg } from '../../lib/format.js';
import { AiBusy, AiMetaLine, Mini } from './AiBits.js';
import { useAiRequests, useAiStatus, useChat, useReview } from './api.js';

const STARTERS = [
  'Vì sao lịch tuần này được xếp như vậy?',
  'Squat bị đau lưng dưới thì nên sửa gì?',
  'Trước buổi tập nên ăn gì?',
];

const TASK_LABELS: Record<AiTask, string> = {
  plan: 'Lịch tập',
  nutrition: 'Dinh dưỡng',
  explain: 'Nhận xét tuần',
  chat: 'Hỏi đáp',
};

/** The API accepts the last 12 messages; older ones are dropped from the context. */
const HISTORY = 12;

export function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [draft, setDraft] = useState('');
  const [alert, setAlert] = useState<string>();
  const chat = useChat();
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, chat.isPending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || chat.isPending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: content.slice(0, 1500) }];
    setMessages(next);
    setDraft('');
    setAlert(undefined);
    try {
      const res = await chat.mutateAsync(next.slice(-HISTORY));
      setMessages([...next, { role: 'assistant', content: res.answer }]);
      setSuggestions(res.suggestions);
    } catch (err) {
      setMessages(messages);
      setDraft(content);
      setAlert(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra');
    }
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <>
      <PageHeader caption="Chạy local bằng Ollama" title="AI Coach" />
      <div className="coach">
        <section className="card stack">
          <div className="card-title">
            <h2>Hỏi đáp</h2>
            {messages.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMessages([]);
                  setSuggestions(STARTERS);
                }}
              >
                Cuộc trò chuyện mới
              </button>
            )}
          </div>
          <div className="chat-log" aria-live="polite">
            {messages.length === 0 && (
              <p className="muted">
                Hỏi về kỹ thuật bài tập, lịch tập, dinh dưỡng hoặc hồi phục. AI Coach đọc hồ sơ,
                lịch tuần này và các buổi tập gần đây của bạn để trả lời.
              </p>
            )}
            {messages.map((m, i) => (
              <p key={i} className={`bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                {m.content}
              </p>
            ))}
            <AiBusy active={chat.isPending} label="AI Coach đang trả lời…" />
            <div ref={logEnd} />
          </div>
          {chat.data && !chat.isPending && <AiMetaLine meta={chat.data.meta} />}
          <FormAlert message={alert} />
          {suggestions.length > 0 && (
            <div className="chips">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  disabled={chat.isPending}
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form className="chat-form" onSubmit={onSubmit}>
            <label htmlFor="chat-input" className="sr-only">
              Câu hỏi
            </label>
            <input
              id="chat-input"
              className="input"
              value={draft}
              maxLength={1500}
              placeholder="Nhập câu hỏi cho AI Coach…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={chat.isPending || !draft.trim()}
            >
              Gửi
            </button>
          </form>
          <p className="muted">
            AI có thể sai. Khi đau nhói, chóng mặt hoặc chấn thương, hãy dừng tập và hỏi bác sĩ.
          </p>
        </section>

        <div className="stack">
          <WeeklyReview />
          <RecentRequests />
        </div>
      </div>
    </>
  );
}

function WeeklyReview() {
  const review = useReview();
  const weekStart = mondayOf(toIsoDate(new Date()));
  const data = review.data;

  return (
    <section className="card card-accent stack">
      <p className="caption logo-accent">Tuần từ {dayMonth(weekStart)}</p>
      <h2>Nhận xét tiến độ</h2>
      {!data && !review.isPending && (
        <p className="muted">
          Hệ thống tính số buổi hoàn thành, khối lượng và cân nặng của tuần; AI giải thích ý nghĩa
          và gợi ý việc nên làm tiếp.
        </p>
      )}
      <AiBusy active={review.isPending} label="AI đang đọc số liệu tuần…" />
      <FormAlert message={review.error instanceof ApiError ? review.error.message : undefined} />
      {data && (
        <>
          <div className="row">
            <Mini
              label="Hoàn thành"
              value={
                data.stats.completionPct === null
                  ? '—'
                  : `${data.stats.completedSessions}/${data.stats.plannedSessions}`
              }
            />
            <Mini label="Khối lượng" value={kg(data.stats.volumeKg)} />
            <Mini
              label="RPE TB"
              value={data.stats.avgRpe === null ? '—' : String(data.stats.avgRpe)}
            />
          </div>
          <p className="ai-note">{data.review.verdict}</p>
          <div>
            <p className="caption">Điểm chính</p>
            <ul className="review-list">
              {data.review.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="caption">Tuần tới nên</p>
            <ul className="review-list">
              {data.review.nextSteps.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <AiMetaLine meta={data.meta} />
        </>
      )}
      <div>
        <button
          type="button"
          className={`btn ${data ? 'btn-secondary' : 'btn-primary'}`}
          disabled={review.isPending}
          onClick={() => review.mutate(weekStart)}
        >
          {data ? 'Nhận xét lại' : 'Nhận xét tuần này'}
        </button>
      </div>
    </section>
  );
}

function RecentRequests() {
  const requests = useAiRequests(8);
  const status = useAiStatus();
  return (
    <section className="card stack">
      <h2>Lần gọi AI gần đây</h2>
      {requests.data?.length === 0 && <p className="muted">Chưa có lần gọi nào.</p>}
      {requests.data && requests.data.length > 0 && (
        <ul className="request-list">
          {requests.data.map((r) => (
            <li key={r.id}>
              <span>
                {TASK_LABELS[r.task]} · {dayMonth(r.createdAt)}
              </span>
              <span className="muted">
                {(r.latencyMs / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây
                {r.usedFallback ? ' · mẫu' : r.retryCount > 0 ? ' · thử lại' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {status.data && (
        <p className="muted">
          Mô hình {status.data.model} · thinking {status.data.think ? 'bật' : 'tắt'} · tối đa{' '}
          {status.data.requestsPerHour} lượt/giờ
        </p>
      )}
    </section>
  );
}
