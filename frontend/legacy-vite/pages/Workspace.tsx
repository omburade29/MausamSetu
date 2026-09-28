import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import DownscalingProgress from "@/components/DownscalingProgress"
import ErrorState from "@/components/ErrorState"
import ForecastMap from "@/components/ForecastMap"
import PanchayatDetails from "@/components/PanchayatDetails"
import PredictorSelector from "@/components/PredictorSelector"
import RegionSelector from "@/components/RegionSelector"
import SimulationModeBanner from "@/components/SimulationModeBanner"
import { MODEL_LABELS, MODEL_LIMITATIONS, VARIABLE_META } from "@/content/copy"
import { useApp } from "@/context/AppContext"
import { formatValue } from "@/lib/format"
import type { ModelId } from "@/types"

let autostartLock = false

export default function Workspace() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    selection,
    setSelection,
    blockForecast,
    panchayats,
    run,
    staleRun,
    processing,
    processStep,
    downscale,
    error,
    clearError,
    reload,
    selectedPanchayatId,
    setSelectedPanchayatId,
    fallbackNote,
  } = useApp()

  useEffect(() => {
    const state = location.state as { autostart?: boolean } | null
    if (!state?.autostart || autostartLock) return
    autostartLock = true
    navigate(location.pathname, { replace: true, state: null })
    void downscale().finally(() => {
      autostartLock = false
    })
  }, [downscale, location.pathname, location.state, navigate])

  const active = run && !staleRun ? run : null
  const places = (active ? active.panchayat_forecasts : panchayats).map((place) => {
    if ("forecasts" in place) {
      return {
        id: place.panchayat_id,
        name: place.name,
        geometry: place.geometry,
        latitude: place.latitude,
        longitude: place.longitude,
        value: place.forecasts[selection.variable],
        uncertainty: place.uncertainty_by_variable[selection.variable].category,
      }
    }
    return {
      id: place.id,
      name: place.name,
      geometry: place.geometry,
      latitude: place.latitude,
      longitude: place.longitude,
      value: blockForecast?.values[selection.variable],
    }
  })
  const selected = active?.panchayat_forecasts.find((item) => item.panchayat_id === selectedPanchayatId) ?? null
  const importance = active?.feature_importance[selection.variable] ?? []

  return (
    <div className="rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Downscaling workspace</p>
          <h2 className="text-2xl font-semibold text-navy-900">Block forecast to Panchayat estimates</h2>
        </div>
        <span className="rounded-full bg-navy-900 px-3 py-1 text-xs font-semibold text-white">Uncertainty-Aware Forecast</span>
      </div>
      <SimulationModeBanner note={active?.simulation_metadata.fallback_note || fallbackNote} />
      {staleRun && run && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Inputs changed since run {run.run_id}. The map is showing the coarse block view until you downscale again.
        </p>
      )}
      {error && <ErrorState message={error} onRetry={() => { clearError(); reload() }} />}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <section className="card space-y-4 p-4">
          <RegionSelector includeDate includeVariable stacked />
          <label className="block text-sm font-medium text-slate-700">
            Model
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={selection.model}
              onChange={(event) => setSelection({ model: event.target.value as ModelId })}
            >
              <option value="contextual_baseline">{MODEL_LABELS.contextual_baseline}</option>
              <option value="random_forest">{MODEL_LABELS.random_forest}</option>
            </select>
          </label>
          <p className="text-xs leading-5 text-slate-600">{MODEL_LIMITATIONS[selection.model]}</p>
          <PredictorSelector />
          <button
            type="button"
            disabled={processing}
            onClick={() => void downscale()}
            className="w-full rounded-xl bg-skybrand-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? "Downscaling…" : "Downscale Forecast"}
          </button>
          {importance.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Feature importance</h3>
              <ul className="mt-2 space-y-2">
                {importance.map((item) => (
                  <li key={item.id}>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{item.label}</span>
                      <span>{Math.round(item.value * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-navy-800" style={{ width: `${item.value * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                {importance[0]?.kind === "impurity_importance"
                  ? "Impurity-based importance from the prototype forest. Indicative only."
                  : "Share of mean absolute contextual weight. Not a causal ranking."}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="relative">
            <ForecastMap
              blockGeometry={active?.block_geometry ?? blockForecast?.geometry ?? null}
              places={places}
              mode={active ? "panchayat" : "block"}
              variable={selection.variable}
              blockValue={blockForecast?.values[selection.variable]}
              selectedId={selectedPanchayatId}
              onSelect={setSelectedPanchayatId}
            />
            {processing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-navy-950/35 p-4">
                <div className="w-full max-w-md">
                  <DownscalingProgress step={processStep} />
                </div>
              </div>
            )}
          </div>
          <article className="card p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Before · demo values</p>
                <p className="mt-2 text-sm text-slate-600">Current resolution: Block level</p>
                <p className="mt-2 text-2xl font-semibold text-navy-900">
                  Block forecast: {formatValue(selection.variable, blockForecast?.values[selection.variable])}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">After · demo values</p>
                <p className="mt-2 text-sm text-slate-600">
                  {active ? "Output resolution: Panchayat level" : "Run downscaling to replace the single block value."}
                </p>
                {active && (
                  <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {active.panchayat_forecasts.map((item) => (
                      <li key={item.panchayat_id}>
                        <button type="button" className="text-left font-medium text-navy-900" onClick={() => setSelectedPanchayatId(item.panchayat_id)}>
                          {item.name}: {formatValue(selection.variable, item.forecasts[selection.variable])}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {active && (
              <p className="mt-3 text-xs text-slate-500">
                Model: {active.model_label}. Mean confidence {active.uncertainty_summary.mean_confidence}% for {VARIABLE_META[selection.variable].label}. These are demo values.
              </p>
            )}
          </article>
        </section>

        <PanchayatDetails panchayat={selected} variable={selection.variable} modelLabel={active?.model_label} />
      </div>
    </div>
  )
}
