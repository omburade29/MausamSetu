import { Droplets, MapPinned, Shield, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import CoarseForecastCard from "@/components/CoarseForecastCard"
import Disclaimer from "@/components/Disclaimer"
import EmptyState from "@/components/EmptyState"
import ForecastMap from "@/components/ForecastMap"
import HistoryTable from "@/components/HistoryTable"
import RegionSelector from "@/components/RegionSelector"
import SimulationModeBanner from "@/components/SimulationModeBanner"
import WeatherMetricCard from "@/components/WeatherMetricCard"
import { useApp } from "@/context/AppContext"
import { formatValue } from "@/lib/format"

const JOURNEY = ["Region", "Block forecast", "Downscale", "Panchayat", "Validation", "Advisory"]

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    selection,
    blockForecast,
    panchayats,
    run,
    staleRun,
    history,
    openRun,
    useDemoRegion,
    processing,
    fallbackNote,
  } = useApp()
  const [hint, setHint] = useState("")
  const activeRun = run && !staleRun ? run : null
  const values = activeRun?.panchayat_forecasts.map((item) => item.forecasts[selection.variable]) ?? []
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : blockForecast?.values[selection.variable]
  const confidence = activeRun
    ? `${Math.round(
        activeRun.panchayat_forecasts.reduce(
          (sum, item) => sum + item.uncertainty_by_variable[selection.variable].confidence,
          0,
        ) / activeRun.panchayat_forecasts.length,
      )}%`
    : "—"
  const places = panchayats.map((place) => {
    const match = activeRun?.panchayat_forecasts.find((item) => item.panchayat_id === place.id)
    return {
      ...place,
      value: match ? match.forecasts[selection.variable] : blockForecast?.values[selection.variable],
      uncertainty: match?.uncertainty_by_variable[selection.variable].category,
    }
  })

  return (
    <div className="rise space-y-5">
      <SimulationModeBanner note={fallbackNote} />
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Judge path · about three minutes</p>
            <h2 className="mt-1 text-2xl font-semibold text-navy-900">From one block value to eight Panchayat estimates</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              A block forecast covers a wide area. MausamSetu keeps that coarse value visible, then estimates how elevation,
              location, land cover, moisture, water distance, and vegetation could shift it locally. Uncertainty stays on screen.
            </p>
          </div>
          <button type="button" onClick={useDemoRegion} className="rounded-xl bg-skybrand-100 px-4 py-2 text-sm font-semibold text-navy-900">
            Use demo region
          </button>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {JOURNEY.map((label, index) => (
            <li key={label} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span className="font-semibold text-skybrand-600">{index + 1}.</span> {label}
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-navy-900">Choose the geography</h2>
        <div className="mt-4">
          <RegionSelector includeDate includeVariable />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WeatherMetricCard label="Panchayats analyzed" value={String(activeRun?.panchayat_forecasts.length ?? panchayats.length ?? "—")} hint={activeRun ? "Downscaled in the latest run" : "Ready in the selected block"} icon={<MapPinned size={18} />} />
        <WeatherMetricCard label="Average forecast" value={formatValue(selection.variable, average)} hint={activeRun ? "Mean of Panchayat estimates" : "Block value until downscaling"} icon={<Droplets size={18} />} />
        <WeatherMetricCard label="Average confidence" value={confidence} hint="Prototype confidence, not a skill score" icon={<Shield size={18} />} />
        <WeatherMetricCard label="Highest-risk Panchayat" value={activeRun?.uncertainty_summary.highest_risk_panchayat.name ?? "—"} hint={activeRun ? `${activeRun.uncertainty_summary.highest_risk_panchayat.priority} advisory priority` : "Available after downscaling"} icon={<TriangleAlert size={18} />} />
      </section>

      {selection.blockId && blockForecast ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <CoarseForecastCard />
          <div>
            <ForecastMap
              blockGeometry={blockForecast.geometry}
              places={places}
              mode={activeRun ? "panchayat" : "block"}
              variable={selection.variable}
              blockValue={blockForecast.values[selection.variable]}
              onSelect={() => navigate("/explorer")}
            />
          </div>
        </section>
      ) : (
        <EmptyState title="Block forecast is waiting" message="Choose Odisha, Kendrapara, and Marshaghai, or use the demo region button." />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={processing}
          onClick={() => {
            if (!selection.blockId) {
              setHint("Choose a state, district, and block first.")
              return
            }
            setHint("")
            navigate("/workspace", { state: { autostart: true } })
          }}
          className="rounded-xl bg-skybrand-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {processing ? "Running downscaling…" : "Run Downscaling"}
        </button>
        {hint && <p className="text-sm text-danger">{hint}</p>}
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-navy-900">Recent downscaling runs</h2>
        <div className="mt-3">
          <HistoryTable
            compact
            rows={history.slice(0, 5)}
            onView={(runId) => {
              void openRun(runId).then(() => navigate("/workspace"))
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Important limitation</p>
        <p className="mt-1">
          Finer spatial detail does not automatically imply higher forecast accuracy. Validation depends on available
          fine-scale reference data, and this demonstration uses simulated references.
        </p>
      </section>
      <Disclaimer />
    </div>
  )
}
