export default function LoadingState({ label = "Loading demo data" }: { label?: string }) {
  return (
    <div className="card p-5" role="status" aria-live="polite">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  )
}
