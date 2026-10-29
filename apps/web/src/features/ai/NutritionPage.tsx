import { addDays, macroKcal, toIsoDate, type AiMeta, type NutritionDay } from '@ai-coach/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { FormAlert } from '../../components/form.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { dayMonth } from '../../lib/format.js';
import { AiBusy, AiMetaLine, Mini } from './AiBits.js';
import { useGenerateNutrition, useNutrition } from './api.js';

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export function NutritionPage() {
  const [params, setParams] = useSearchParams();
  const today = toIsoDate(new Date());
  const date = params.get('ngay') ?? today;
  const day = useNutrition(date);
  const generate = useGenerateNutrition();
  const [alert, setAlert] = useState<string>();
  const meta = generate.data?.nutrition.date === date ? generate.data.meta : undefined;

  const goDay = (by: number) => {
    const next = addDays(date, by);
    setParams(next === today ? {} : { ngay: next });
  };
  const run = async () => {
    if (day.data && !window.confirm('Tạo lại sẽ thay thực đơn hiện tại của ngày này. Tiếp tục?')) {
      return;
    }
    setAlert(undefined);
    try {
      await generate.mutateAsync(date);
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  return (
    <>
      <PageHeader
        caption={`${dayMonth(date)}${date === today ? ' · Hôm nay' : ''}`}
        title="Dinh dưỡng"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => goDay(-1)}>
              ← Hôm trước
            </button>
            {date !== today && (
              <button type="button" className="btn btn-secondary" onClick={() => setParams({})}>
                Hôm nay
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => goDay(1)}>
              Hôm sau →
            </button>
          </>
        }
      />
      <FormAlert message={alert} />
      <AiBusy active={generate.isPending} label="AI đang tính calo, macro và lên thực đơn…" />

      {day.isPending && <p className="muted">Đang tải…</p>}
      {day.data === null && !generate.isPending && (
        <section className="card card-accent stack">
          <p className="caption logo-accent">Chưa có thực đơn</p>
          <h2>Gợi ý dinh dưỡng cho ngày {dayMonth(date)}</h2>
          <p className="muted">
            AI tính calo và macro theo hồ sơ (tuổi, cân nặng, mục tiêu, số buổi tập) rồi gợi ý thực
            đơn món Việt. Kết quả được kiểm tra ngưỡng calo tối thiểu và lượng protein hợp lý.
          </p>
          <div>
            <button type="button" className="btn btn-primary" onClick={() => void run()}>
              Tạo thực đơn bằng AI
            </button>
          </div>
        </section>
      )}

      {day.data && (
        <NutritionView
          day={day.data}
          busy={generate.isPending}
          onRegenerate={() => void run()}
          meta={meta}
        />
      )}
    </>
  );
}

function NutritionView({
  day,
  busy,
  onRegenerate,
  meta,
}: {
  day: NutritionDay;
  busy: boolean;
  onRegenerate: () => void;
  meta?: AiMeta;
}) {
  const t = day.targets;
  const total = macroKcal(t) || 1;
  const pct = (kcal: number) => Math.round((kcal / total) * 100);
  const shares = [pct(t.proteinG * 4), pct(t.carbG * 4), pct(t.fatG * 9)] as const;

  return (
    <>
      <section className="card card-accent stack">
        <div className="card-title">
          <div>
            <p className="caption">Mục tiêu mỗi ngày</p>
            <p className="display">
              {num(t.kcal)} <span className="caption">kcal</span>
            </p>
          </div>
          <span className={`badge ${day.source === 'ai' ? 'badge-primary' : 'badge-neutral'}`}>
            {day.source === 'ai' ? 'AI đề xuất' : 'Mẫu chuẩn'}
          </span>
        </div>
        <div className="row">
          <Mini label="Protein" value={`${t.proteinG} g`} />
          <Mini label="Carb" value={`${t.carbG} g`} />
          <Mini label="Chất béo" value={`${t.fatG} g`} />
          <Mini label="Nước" value={`${num(t.waterL)} lít`} />
        </div>
        <div className="macro-bar" aria-hidden="true">
          {shares.map((s, i) => (
            <span key={i} style={{ width: `${s}%` }} />
          ))}
        </div>
        <p className="macro-legend muted">
          <span>Protein {shares[0]}%</span>
          <span>Carb {shares[1]}%</span>
          <span>Chất béo {shares[2]}%</span>
        </p>
        <p className="ai-note">{day.explanation}</p>
        {meta && <AiMetaLine meta={meta} />}
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onRegenerate}
          >
            Tạo lại bằng AI
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Thực đơn mẫu</h2>
        <ol className="meals">
          {day.meals.map((m) => (
            <li key={`${m.time}-${m.name}`} className="meal">
              <span className="meal-time">{m.time}</span>
              <div>
                <p>
                  <strong>{m.name}</strong>
                </p>
                <p className="muted">{m.dish}</p>
              </div>
              <div className="meal-kcal">
                <p className="number">{num(m.kcal)}</p>
                <p className="muted">
                  P {m.proteinG} · C {m.carbG} · F {m.fatG}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="muted">
          Thông tin chỉ mang tính tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh
          dưỡng. Nếu bạn có bệnh lý (tiểu đường, thận, tim mạch…), hãy hỏi ý kiến chuyên gia trước.
        </p>
      </section>
    </>
  );
}
