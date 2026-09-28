import { RotateCcw } from "lucide-react"
import { useApp } from "@/context/AppContext"

export default function Header() {
  const { backendOnline, resetDemo, processing } = useApp()
  const online = backendOnline === true
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-900 text-sky-200">
          <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
            <path d="M8 42h48M14 42c5-12 10-12 15 0M29 42c5-16 10-16 15 0M44 42c4-9 7-9 10 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <circle cx="48" cy="16" r="6" fill="#FBBF24" />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="font-serif text-2xl leading-none text-navy-900">MausamSetu</h1>
            <span className="hidden text-xs font-medium text-slate-500 sm:inline">Panchayat-Level Weather Intelligence</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Turning coarse weather forecasts into localized, uncertainty-aware farm intelligence.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-skybrand-100 px-2.5 py-1 text-[11px] font-semibold text-navy-800">SIH26074 Prototype</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-navy-800">Team Hexabyte</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">Demo Mode</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-safe" : backendOnline === false ? "bg-amber-500" : "bg-slate-300"}`} />
          {online ? "API connected" : backendOnline === false ? "Local demo fallback" : "Checking API"}
        </span>
        <button
          type="button"
          onClick={() => void resetDemo()}
          disabled={processing}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw size={14} />
          Reset demo
        </button>
      </div>
    </header>
  )
}
