import { VARIABLE_META } from "@/content/copy"
import { VALIDATION_WARNING } from "@/content/copy"
import type { PanchayatForecast, ValidationReport, VariableId } from "@/types"

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

export function regressionMetrics(predicted: number[], reference: number[]) {
  const count = predicted.length
  const errors = predicted.map((value, index) => value - reference[index])
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / count
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / count)
  const bias = errors.reduce((sum, value) => sum + value, 0) / count
  const mean = reference.reduce((sum, value) => sum + value, 0) / count
  const ssTot = reference.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  const ssRes = predicted.reduce((sum, value, index) => sum + (reference[index] - value) ** 2, 0)
  const r2 = count < 3 || ssTot < 1e-9 ? null : 1 - ssRes / ssTot
  return {
    mae: round3(mae),
    rmse: round3(rmse),
    bias: round3(bias),
    r2: r2 == null ? null : round3(r2),
  }
}

export function validationTable(panchayats: PanchayatForecast[], variable: VariableId): ValidationReport {
  const rows = panchayats
    .filter((item) => item.reference)
    .map((item) => {
      const baseline = item.baseline[variable]
      const downscaled = item.forecasts[variable]
      const reference = item.reference?.[variable] ?? 0
      const baselineError = Math.abs(baseline - reference)
      const downscaledError = Math.abs(downscaled - reference)
      return {
        panchayat_id: item.panchayat_id,
        panchayat: item.name,
        baseline,
        downscaled,
        reference,
        baseline_error: round3(baselineError),
        downscaled_error: round3(downscaledError),
        difference: round3(baselineError - downscaledError),
        uncertainty_category: item.uncertainty_by_variable[variable].category,
        confidence: item.uncertainty_by_variable[variable].confidence,
      }
    })
  if (!rows.length) throw new Error("No reference values are available for validation.")
  const baselineMetrics = regressionMetrics(
    rows.map((row) => row.baseline),
    rows.map((row) => row.reference),
  )
  const downscaledMetrics = regressionMetrics(
    rows.map((row) => row.downscaled),
    rows.map((row) => row.reference),
  )
  const improvement =
    baselineMetrics.mae < 1e-9
      ? null
      : Math.round(((baselineMetrics.mae - downscaledMetrics.mae) / baselineMetrics.mae) * 1000) / 10
  const meta = VARIABLE_META[variable]
  return {
    variable,
    label: meta.label,
    unit: meta.unit,
    baseline_metrics: baselineMetrics,
    downscaled_metrics: downscaledMetrics,
    improvement_percent: improvement,
    rows,
    warning: VALIDATION_WARNING,
    reference_note:
      "Reference values in this prototype are simulated. They are not field observations. A lower error on this sample is not operational accuracy.",
    labels: {
      baseline_error: "Baseline error",
      downscaled_error: "Downscaled error",
      difference: "Difference",
      improvement: "Improvement",
    },
    simulation_mode: true,
    source: "demo_simulation",
    is_simulated: true,
  }
}
