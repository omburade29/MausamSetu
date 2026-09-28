import UncertaintyBadge from "@/components/UncertaintyBadge"
import { riskTone } from "@/lib/colors"
import type { Advisory } from "@/types"

export default function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const tone = riskTone(advisory.risk_level)
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-card ${tone.border}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-navy-900">{advisory.panchayat}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}>
          {advisory.risk_level} risk
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Prototype Advisory</p>
      <p className="mt-3 text-sm font-medium text-navy-800">{advisory.weather_condition}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {advisory.recommended_actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-slate-600">
        <span className="font-semibold text-navy-900">Reason. </span>
        {advisory.reason}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <UncertaintyBadge category={advisory.uncertainty_category} />
        <span>Data confidence {advisory.data_confidence}%</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{advisory.validity}</p>
      <p className="mt-1 text-xs text-slate-500">{advisory.crop_context}</p>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-700">{advisory.disclaimer}</p>
    </article>
  )
}
