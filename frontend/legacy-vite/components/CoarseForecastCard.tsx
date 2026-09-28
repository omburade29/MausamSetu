import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { VARIABLE_META } from "@/content/copy"
import { useApp } from "@/context/AppContext"
import { formatValue } from "@/lib/format"

export default function CoarseForecastCard() {
  const { blockForecast, selection } = useApp()
  if (!blockForecast) return null
  const meta = VARIABLE_META[selection.variable]
  const value = blockForecast.values[selection.variable]
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coarse block forecast</p>
          <h2 className="mt-1 text-lg font-semibold text-navy-900">
            {blockForecast.block_name} · {blockForecast.date}
          </h2>
        </div>
        <span className="rounded-full bg-skybrand-100 px-2.5 py-1 text-[11px] font-semibold text-navy-800">
          demo_simulation
        </span>
      </div>
      <p className="mt-4 text-4xl font-semibold text-navy-900">{formatValue(selection.variable, value)}</p>
      <p className="mt-1 text-sm font-medium text-skybrand-600">Current resolution: Block level</p>
      <p className="mt-2 text-sm text-slate-600">{blockForecast.note}</p>
      <div className="mt-4 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={blockForecast.series}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value) => String(value).slice(5)} />
            <YAxis tick={{ fontSize: 11 }} width={36} />
            <Tooltip formatter={(item) => [item, meta.label]} />
            <Line type="monotone" dataKey={selection.variable} stroke="#1D7DDB" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500">Five-day block series for {meta.label}. Demo values, not a live feed.</p>
    </article>
  )
}
