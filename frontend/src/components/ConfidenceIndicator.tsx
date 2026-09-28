export default function ConfidenceIndicator({ value }: { value: number }) {
  const tone = value >= 67 ? "bg-safe" : value >= 50 ? "bg-amber-500" : "bg-danger"
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
        <span>Confidence</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}
