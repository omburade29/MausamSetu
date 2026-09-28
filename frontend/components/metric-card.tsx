export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl text-ink">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </article>
  );
}
