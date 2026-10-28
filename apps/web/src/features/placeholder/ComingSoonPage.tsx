import { PageHeader } from '../../layouts/AppLayout.js';

/** Menu entries whose feature lands in a later milestone (see AGENTS.md §10). */
export function ComingSoonPage({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title} />
      <section className="card stack">
        <span className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>
          Mốc {milestone}
        </span>
        <h2>Tính năng đang được phát triển</h2>
        <p className="muted">{description}</p>
      </section>
    </>
  );
}
