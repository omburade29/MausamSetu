import ConfidenceIndicator from "@/components/ConfidenceIndicator"
import UncertaintyBadge from "@/components/UncertaintyBadge"
import { formatValue } from "@/lib/format"
import { riskTone } from "@/lib/colors"
import type { PanchayatForecast, VariableId } from "@/types"

export default function PanchayatDetails({
  panchayat,
  variable,
  modelLabel,
}: {
  panchayat: PanchayatForecast | null
  variable: VariableId
  modelLabel?: string
}) {
  if (!panchayat) {
    return (
      <aside className="card p-5 text-sm text-slate-600">
        Select a Panchayat on the map to see its local forecast, uncertainty, and predictor contribution.
      </aside>
    )
  }
  const uncertainty = panchayat.uncertainty_by_variable[variable]
  const contributions = panchayat.predictor_contributions[variable] ?? []
  const maxEffect = Math.max(...contributions.map((item) => Math.abs(item.weighted_effect)), 0.001)
  const tone = riskTone(panchayat.advisory_priority)
  return (
    <aside className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Panchayat</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <h2 className="text-2xl font-semibold text-navy-900">{panchayat.name}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}>
          {panchayat.advisory_priority} priority
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        demo_simulation · is_simulated true{modelLabel ? ` · ${modelLabel}` : ""}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Rainfall</dt>
          <dd className="font-semibold">{formatValue("rainfall_mm", panchayat.forecasts.rainfall_mm)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Temperature</dt>
          <dd className="font-semibold">{formatValue("temperature_c", panchayat.forecasts.temperature_c)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Humidity</dt>
          <dd className="font-semibold">{formatValue("humidity_pct", panchayat.forecasts.humidity_pct)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Wind</dt>
          <dd className="font-semibold">{formatValue("wind_kmh", panchayat.forecasts.wind_kmh)}</dd>
        </div>
      </dl>
      <div className="mt-4 space-y-3">
        <UncertaintyBadge category={uncertainty.category} />
        <ConfidenceIndicator value={uncertainty.confidence} />
        <p className="text-xs leading-5 text-slate-600">{uncertainty.explanation}</p>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-navy-900">Predictor contribution</h3>
        <ul className="mt-2 space-y-2">
          {contributions.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between text-xs text-slate-600">
                <span>
                  {item.label}
                  {item.imputed ? " · imputed" : ""}
                </span>
                <span>{item.weighted_effect.toFixed(3)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-skybrand-500"
                  style={{ width: `${(Math.abs(item.weighted_effect) / maxEffect) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
