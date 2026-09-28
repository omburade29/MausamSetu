import { PREDICTORS } from "@/content/copy"
import { useApp } from "@/context/AppContext"
import type { PredictorId } from "@/types"

export default function PredictorSelector() {
  const { selection, setSelection } = useApp()
  function toggle(id: PredictorId) {
    const next = selection.predictors.includes(id)
      ? selection.predictors.filter((item) => item !== id)
      : [...selection.predictors, id]
    setSelection({ predictors: next })
  }
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy-900">Spatial predictors</legend>
      <p className="mt-1 text-xs text-slate-500">Unchecked predictors are left out and the remaining weights are renormalized. Missing values are imputed and widen uncertainty.</p>
      <div className="mt-3 space-y-2">
        {PREDICTORS.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selection.predictors.includes(item.id)}
              onChange={() => toggle(item.id)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
