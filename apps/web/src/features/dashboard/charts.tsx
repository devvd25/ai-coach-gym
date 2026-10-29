import { useId, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/*
 * One series per chart, so no legend box: the card title names what is plotted. Marks follow the
 * dataviz specs: bars ≤ 24px with a 4px rounded end, 2px lines, ≥ 8px dots with a surface ring,
 * hairline recessive grid, text in text tokens, a hover tooltip and a table view on every chart.
 * Animation is off: data appears at once (and nothing moves for reduced-motion users).
 */

const AXIS = { stroke: 'var(--color-text-muted)', tickLine: false, axisLine: false, fontSize: 12 };
const GRID = <CartesianGrid stroke="var(--color-border)" strokeWidth={1} vertical={false} />;
const TOOLTIP = {
  cursor: { fill: 'var(--color-surface-2)' },
  contentStyle: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
  },
  labelStyle: { color: 'var(--color-text-muted)' },
  itemStyle: { color: 'var(--color-text)' },
};

export interface Point {
  label: string;
  /** Long label for the tooltip and the table ("Tuần 26/10"). */
  name: string;
  value: number | null;
}

export function ChartCard({
  title,
  subtitle,
  data,
  format,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  data: readonly Point[];
  format: (v: number) => string;
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: string;
  children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  const id = useId();
  return (
    <section className="card stack chart-card" aria-labelledby={id}>
      <div className="card-title">
        <div>
          <h2 id={id}>{title}</h2>
          <p className="muted">{subtitle}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost chart-toggle"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? 'Biểu đồ' : 'Bảng'}
        </button>
      </div>
      {empty ? (
        <div className="empty">{empty}</div>
      ) : table ? (
        <table className="table">
          <tbody>
            {data.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="number-cell">{p.value === null ? '—' : format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-plot">{children}</div>
      )}
    </section>
  );
}

const tooltipFormatter = (format: (v: number) => string, label: string) => (v: unknown) => [
  typeof v === 'number' ? format(v) : '—',
  label,
];
const nameOf = (_: unknown, payload: readonly { payload?: Point }[]) =>
  payload[0]?.payload?.name ?? '';

export function Columns({
  data,
  label,
  format,
  target,
  domainMax,
}: {
  data: readonly Point[];
  label: string;
  format: (v: number) => string;
  /** Optional horizontal reference (e.g. the 80% completion goal). */
  target?: { value: number; label: string };
  domainMax?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={[...data]} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
        {GRID}
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
        <YAxis
          {...AXIS}
          allowDecimals={false}
          domain={[0, domainMax ?? 'auto']}
          tickFormatter={compact}
        />
        <Tooltip {...TOOLTIP} formatter={tooltipFormatter(format, label)} labelFormatter={nameOf} />
        {target && (
          <ReferenceLine
            y={target.value}
            stroke="var(--color-text-muted)"
            strokeWidth={1}
            label={{
              value: target.label,
              position: 'insideTopRight',
              fill: 'var(--color-text-muted)',
              fontSize: 12,
            }}
          />
        )}
        <Bar
          dataKey="value"
          fill="var(--color-primary)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Trend({
  data,
  label,
  format,
}: {
  data: readonly Point[];
  label: string;
  format: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={[...data]} margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
        {GRID}
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
        <YAxis {...AXIS} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={compact} />
        <Tooltip
          {...TOOLTIP}
          cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }}
          formatter={tooltipFormatter(format, label)}
          labelFormatter={nameOf}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          isAnimationActive={false}
          dot={{
            r: 4,
            fill: 'var(--color-primary)',
            stroke: 'var(--color-surface)',
            strokeWidth: 2,
          }}
          activeDot={{
            r: 6,
            fill: 'var(--color-primary)',
            stroke: 'var(--color-surface)',
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Axis ticks: 0 / 950 / 1,2K / 12K. */
function compact(v: number): string {
  if (Math.abs(v) < 1000) return v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${(v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}K`;
}
