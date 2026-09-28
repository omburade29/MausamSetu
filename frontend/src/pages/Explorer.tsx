import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import EmptyState from "@/components/EmptyState"
import ForecastMap from "@/components/ForecastMap"
import PanchayatDetails from "@/components/PanchayatDetails"
import UncertaintyBadge from "@/components/UncertaintyBadge"
import { useApp } from "@/context/AppContext"
import { formatValue } from "@/lib/format"
import type { RiskLevel } from "@/types"

export default function Explorer() {
  const { run, staleRun, selection, panchayats, blockForecast, selectedPanchayatId, setSelectedPanchayatId } = useApp()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"forecast" | "uncertainty">("forecast")
  const [priority, setPriority] = useState<"All" | RiskLevel>("All")
  const active = run && !staleRun ? run : null
  const rows = useMemo(() => {
    const source = active?.panchayat_forecasts ?? []
    return source
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
      .filter((item) => priority === "All" || item.advisory_priority === priority)
      .sort((a, b) => {
        if (sort === "uncertainty") {
          return b.uncertainty_by_variable[selection.variable].value - a.uncertainty_by_variable[selection.variable].value
        }
        return b.forecasts[selection.variable] - a.forecasts[selection.variable]
      })
  }, [active, priority, query, selection.variable, sort])

  if (!active) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Explorer is ready for a downscaled run"
          message="Run downscaling to color Panchayats by the selected weather variable. Boundaries can still be previewed on the dashboard."
          action={<Link to="/workspace" className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Open workspace</Link>}
        />
        {blockForecast && (
          <ForecastMap
            blockGeometry={blockForecast.geometry}
            places={panchayats.map((place) => ({ ...place, value: blockForecast.values[selection.variable] }))}
            mode="block"
            variable={selection.variable}
            blockValue={blockForecast.values[selection.variable]}
          />
        )}
      </div>
    )
  }

  const places = active.panchayat_forecasts.map((item) => ({
    id: item.panchayat_id,
    name: item.name,
    geometry: item.geometry,
    latitude: item.latitude,
    longitude: item.longitude,
    value: item.forecasts[selection.variable],
    uncertainty: item.uncertainty_by_variable[selection.variable].category,
  }))
  const selected = active.panchayat_forecasts.find((item) => item.panchayat_id === selectedPanchayatId) ?? null

  return (
    <div className="rise space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Panchayat explorer</p>
        <h2 className="text-2xl font-semibold text-navy-900">Compare local estimates inside {active.geography.block_name}</h2>
      </div>
      <div className="card flex flex-wrap gap-3 p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Panchayat"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sort} onChange={(event) => setSort(event.target.value as "forecast" | "uncertainty")}>
          <option value="forecast">Sort by forecast</option>
          <option value="uncertainty">Sort by uncertainty</option>
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as "All" | RiskLevel)}>
          <option value="All">All advisory priorities</option>
          <option value="High">High</option>
          <option value="Moderate">Moderate</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="card max-h-[640px] overflow-auto p-2">
          {rows.length === 0 && <p className="p-3 text-sm text-slate-500">No Panchayat matches this search or filter.</p>}
          {rows.map((item) => (
            <button
              key={item.panchayat_id}
              type="button"
              onClick={() => setSelectedPanchayatId(item.panchayat_id)}
              className={`mb-2 w-full rounded-xl px-3 py-3 text-left ${item.panchayat_id === selectedPanchayatId ? "bg-skybrand-50 ring-1 ring-skybrand-500" : "hover:bg-slate-50"}`}
            >
              <span className="font-semibold text-navy-900">{item.name}</span>
              <span className="mt-1 block text-sm">{formatValue(selection.variable, item.forecasts[selection.variable])}</span>
              <span className="mt-2 block"><UncertaintyBadge category={item.uncertainty_by_variable[selection.variable].category} /></span>
            </button>
          ))}
        </div>
        <ForecastMap
          blockGeometry={active.block_geometry}
          places={places}
          mode="panchayat"
          variable={selection.variable}
          selectedId={selectedPanchayatId}
          onSelect={setSelectedPanchayatId}
        />
        <PanchayatDetails panchayat={selected} variable={selection.variable} modelLabel={active.model_label} />
      </div>
    </div>
  )
}
