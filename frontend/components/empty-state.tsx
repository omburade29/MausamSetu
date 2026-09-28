export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-sm">
      <p className="font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-muted">{hint}</p> : null}
    </div>
  );
}
