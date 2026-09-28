import { VARIABLE_META } from "@/content/copy"
import { scaleStops } from "@/lib/colors"
import { formatValue } from "@/lib/format"
import type { VariableId } from "@/types"

export default function MapLegend({
  variable,
  min,
  max,
  mode,
}: {
  variable: VariableId
  min?: number
  max?: number
  mode: "block" | "panchayat"
}) {
  const stops = scaleStops(variable)
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-card">
      <p className="font-semibold text-navy-900">
        {mode === "block" ? "Single block value" : `${VARIABLE_META[variable].label} choropleth`}
      </p>
      {mode === "panchayat" ? (
        <>
          <div className="mt-2 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
          <div className="mt-1 flex justify-between text-slate-500">
            <span>{formatValue(variable, min)}</span>
            <span>{formatValue(variable, max)}</span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-slate-600">Every Panchayat still carries the same coarse value.</p>
      )}
      <p className="mt-2 font-medium text-slate-500">Demo values · schematic boundaries</p>
    </div>
  )
}
