export function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null || Number.isNaN(score)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">
        <span aria-hidden>—</span> Unavailable
      </span>
    );
  }
  const low = score < 0.5;
  const moderate = score < 0.75;
  const label = low ? "Low confidence" : moderate ? "Moderate confidence" : "Higher confidence";
  const tone = low ? "bg-stone-200 text-stone-800" : moderate ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <span aria-hidden>{low ? "!" : "●"}</span>
      {label}: {Math.round(score * 100)}%
    </span>
  );
}
