import { useNavigate } from "react-router-dom"
import HistoryTable from "@/components/HistoryTable"
import SimulationModeBanner from "@/components/SimulationModeBanner"
import { useApp } from "@/context/AppContext"

export default function History() {
  const navigate = useNavigate()
  const { history, openRun, resetDemo, processing } = useApp()
  return (
    <div className="rise space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Run history</p>
          <h2 className="text-2xl font-semibold text-navy-900">Saved downscaling runs</h2>
        </div>
        <button type="button" disabled={processing} onClick={() => void resetDemo()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900">
          Reset demo
        </button>
      </div>
      <SimulationModeBanner note="Runs stay in SQLite when the API is connected, and in this browser when the local fallback is used." />
      <section className="card p-4">
        <HistoryTable
          rows={history}
          onView={(runId) => {
            void openRun(runId).then(() => navigate("/workspace"))
          }}
        />
      </section>
    </div>
  )
}
