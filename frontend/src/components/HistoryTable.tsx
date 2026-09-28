import { formatWhen, modelLabel, variableLabel } from "@/lib/format"
import type { HistoryItem } from "@/types"

export default function HistoryTable({
  rows,
  onView,
  compact = false,
}: {
  rows: HistoryItem[]
  onView: (runId: string) => void
  compact?: boolean
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No downscaling runs yet. Run the workspace once and they will appear here.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Run ID</th>
            <th className="px-3 py-2">Date and time</th>
            <th className="px-3 py-2">Geography</th>
            {!compact && <th className="px-3 py-2">Variable</th>}
            {!compact && <th className="px-3 py-2">Model</th>}
            <th className="px-3 py-2">Panchayats</th>
            {!compact && <th className="px-3 py-2">Validation status</th>}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.run_id} className="border-t border-slate-100">
              <td className="px-3 py-3 font-mono text-xs">{row.run_id}</td>
              <td className="px-3 py-3">{formatWhen(row.created_at)}</td>
              <td className="px-3 py-3">
                {row.state_name} / {row.district_name} / {row.block_name}
              </td>
              {!compact && <td className="px-3 py-3">{variableLabel(row.variable)}</td>}
              {!compact && <td className="px-3 py-3">{modelLabel(row.model)}</td>}
              <td className="px-3 py-3">{row.panchayat_count}</td>
              {!compact && <td className="px-3 py-3">{row.validation_status}</td>}
              <td className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onView(row.run_id)}
                  className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  View result
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
