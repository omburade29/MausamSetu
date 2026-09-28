import { VARIABLE_META } from "@/content/copy"
import type { ModelId, VariableId } from "@/types"

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function formatValue(variable: VariableId, value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  const meta = VARIABLE_META[variable]
  return `${value.toFixed(meta.decimals)} ${meta.unit}`
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function modelLabel(model: string) {
  if (model === "random_forest") return "Random Forest Prototype"
  if (model === "contextual_baseline") return "Contextual Baseline"
  return model
}

export function variableLabel(variable: string) {
  if (variable in VARIABLE_META) return VARIABLE_META[variable as VariableId].label
  return variable
}

export function samePredictors(left: string[], right: string[]) {
  const a = [...left].sort().join("|")
  const b = [...right].sort().join("|")
  return a === b
}

export function isModelId(value: string): value is ModelId {
  return value === "contextual_baseline" || value === "random_forest"
}
