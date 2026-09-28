import { Check, Loader2 } from "lucide-react"
import { cx } from "@/lib/format"

const STEPS = [
  "Reading the block forecast",
  "Assembling spatial predictors",
  "Normalizing local geographic context",
  "Estimating Panchayat-level values",
  "Scoring uncertainty and drafting advisories",
]

export default function DownscalingProgress({ step }: { step: number }) {
  return (
    <div className="rounded-2xl bg-white/95 p-5 shadow-card backdrop-blur" role="status" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Downscaling in progress</p>
      <h3 className="mt-1 text-lg font-semibold text-navy-900">Five-step prototype run</h3>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-skybrand-500 transition-all" style={{ width: `${((Math.min(step, 4) + 1) / 5) * 100}%` }} />
      </div>
      <ol className="mt-4 space-y-2">
        {STEPS.map((label, index) => {
          const done = index < step
          const active = index === step
          return (
            <li key={label} className={cx("flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm", active && "bg-skybrand-50")}>
              <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", done ? "bg-safe text-white" : active ? "bg-skybrand-500 text-white" : "bg-slate-100 text-slate-500")}>
                {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : index + 1}
              </span>
              <span className={done || active ? "font-medium text-navy-900" : "text-slate-500"}>{label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
