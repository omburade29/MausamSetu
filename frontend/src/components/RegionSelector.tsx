import { useApp } from "@/context/AppContext"
import type { Selection } from "@/types"

export default function RegionSelector({
  includeDate = false,
  includeVariable = false,
  stacked = false,
}: {
  includeDate?: boolean
  includeVariable?: boolean
  stacked?: boolean
}) {
  const { regions, selection, setSelection, blockForecast } = useApp()
  const state = regions.states.find((item) => item.id === selection.stateId)
  const district = state?.districts.find((item) => item.id === selection.districtId)

  function update(patch: Partial<Selection>) {
    setSelection(patch)
  }

  return (
    <div className={stacked ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      <label className="text-sm font-medium text-slate-700">
        State
        <select
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          value={selection.stateId}
          onChange={(event) => update({ stateId: event.target.value, districtId: "", blockId: "" })}
        >
          <option value="">Choose state</option>
          {regions.states.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        District
        <select
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
          value={selection.districtId}
          disabled={!state}
          onChange={(event) => update({ districtId: event.target.value, blockId: "" })}
        >
          <option value="">Choose district</option>
          {state?.districts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Block
        <select
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
          value={selection.blockId}
          disabled={!district}
          onChange={(event) => update({ blockId: event.target.value })}
        >
          <option value="">Choose block</option>
          {district?.blocks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {includeDate && (
        <label className="text-sm font-medium text-slate-700">
          Date
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={selection.date}
            onChange={(event) => update({ date: event.target.value })}
          >
            {(blockForecast?.dates ?? ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"]).map(
              (date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ),
            )}
          </select>
        </label>
      )}
      {includeVariable && (
        <label className="text-sm font-medium text-slate-700">
          Weather variable
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={selection.variable}
            onChange={(event) => update({ variable: event.target.value as Selection["variable"] })}
          >
            <option value="rainfall_mm">Rainfall (mm)</option>
            <option value="temperature_c">Temperature (°C)</option>
            <option value="humidity_pct">Humidity (%)</option>
            <option value="wind_kmh">Wind (km/h)</option>
          </select>
        </label>
      )}
    </div>
  )
}
