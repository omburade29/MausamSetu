import {
  MODEL_LABELS,
  MODEL_LIMITATIONS,
  PREDICTORS,
  STATEMENTS,
  VARIABLE_META,
} from "@/content/copy"
import { buildAdvisories } from "@/engine/advisory"
import { localBlockForecast, localPanchayats, referenceFor } from "@/engine/demoData"
import { validationTable } from "@/engine/metrics"
import {
  activeWeights,
  applyAdjustment,
  clamp,
  effectSign,
  haversineKm,
  median,
  normalize,
  populationStd,
  uncertaintyCategory,
} from "@/engine/model"
import type {
  Contribution,
  DownscaleRun,
  PanchayatForecast,
  PredictorId,
  Selection,
  UncertaintyCategory,
  VariableId,
  WeatherValues,
} from "@/types"

const VARIABLES: VariableId[] = ["rainfall_mm", "temperature_c", "humidity_pct", "wind_kmh"]

function roundValue(value: number, variable: VariableId) {
  const factor = 10 ** VARIABLE_META[variable].decimals
  return Math.round(value * factor) / factor
}

function explain(
  category: string,
  score: number,
  completeness: number,
  distanceKm: number,
  imputed: PredictorId[],
  dataQuality: number,
) {
  const labels = Object.fromEntries(PREDICTORS.map((item) => [item.id, item.label]))
  const imputedText = imputed.length
    ? `Imputed predictors: ${imputed.map((key) => labels[key]).join(", ")}.`
    : "No selected predictors were imputed for this Panchayat."
  return (
    `${category} (${score.toFixed(2)} on a 0–1 prototype scale). ` +
    `Predictor completeness is ${Math.round(completeness * 100)}%. ` +
    `Distance from the block representative point is ${distanceKm.toFixed(1)} km. ` +
    `Data-quality flag is ${Math.round(dataQuality * 100)}%. ${imputedText} ` +
    "The score combines completeness, distance, predictor disagreement, model residual, and data quality. It is a transparency aid, not a measured forecast error."
  )
}

export function runLocalDownscale(selection: Selection, options?: { fallbackNote?: string }): DownscaleRun {
  const forecast = localBlockForecast(selection.blockId, selection.date)
  if (forecast.date !== selection.date) {
    throw new Error(`No demo block forecast is available for ${selection.blockId} on ${selection.date}.`)
  }
  const places = localPanchayats(selection.blockId)
  const origin = forecast.representative_point
  const weights = activeWeights(selection.predictors)
  const weightKeys = Object.keys(weights) as PredictorId[]

  const rawColumns: Record<PredictorId, Array<number | null>> = {
    elevation: [],
    location: [],
    land_cover: [],
    soil_moisture: [],
    distance_water: [],
    vegetation: [],
  }
  for (const place of places) {
    rawColumns.elevation.push(place.elevation_m)
    rawColumns.location.push((place.longitude - origin.longitude) * 6 + (place.latitude - origin.latitude) * 1.5)
    rawColumns.land_cover.push(place.land_cover)
    rawColumns.soil_moisture.push(place.soil_moisture)
    rawColumns.distance_water.push(place.distance_to_water_km)
    rawColumns.vegetation.push(place.vegetation)
  }

  const frame = {} as Record<
    PredictorId,
    { raw: number[]; imputed: boolean[]; available: boolean[]; normalized: number[] }
  >
  for (const key of Object.keys(rawColumns) as PredictorId[]) {
    const values = rawColumns[key]
    const present = values.filter((value): value is number => value != null)
    const fill = median(present)
    const imputed = values.map((value) => value == null)
    const filled = values.map((value) => (value == null ? fill : value))
    frame[key] = { raw: filled, imputed, available: imputed.map((flag) => !flag), normalized: normalize(filled) }
  }

  const distances = places.map((place) =>
    haversineKm(place.latitude, place.longitude, origin.latitude, origin.longitude),
  )
  const maxDistance = Math.max(...distances, 1e-6)
  const importanceAcc = Object.fromEntries(
    VARIABLES.map((variable) => [variable, Object.fromEntries(weightKeys.map((key) => [key, 0]))]),
  ) as Record<VariableId, Record<string, number>>

  const panchayats: PanchayatForecast[] = places.map((place, index) => {
    const reference = referenceFor(place.id, selection.date)
    const forecasts = {} as WeatherValues
    const baseline = {} as WeatherValues
    const adjustments = {} as Record<VariableId, number>
    const uncertainty = {} as PanchayatForecast["uncertainty_by_variable"]
    const contributions = {} as PanchayatForecast["predictor_contributions"]

    for (const variable of VARIABLES) {
      const blockValue = forecast.values[variable]
      baseline[variable] = roundValue(blockValue, variable)
      let raw = 0
      const effects: Partial<Record<PredictorId, number>> = {}
      for (const key of weightKeys) {
        const effect = effectSign(variable, key) * frame[key].normalized[index]
        effects[key] = effect
        raw += (weights[key] ?? 0) * effect
      }
      const applied = weightKeys.length
        ? applyAdjustment(blockValue, raw, variable)
        : { value: blockValue, adjustment: 0 }
      const modelResidual = weightKeys.length ? clamp(Math.abs(raw) * 0.65 + 0.1, 0, 1) : 0.85
      forecasts[variable] = roundValue(applied.value, variable)
      adjustments[variable] = Math.round(applied.adjustment * 10000) / 10000

      const components = weightKeys.map((key) => (weights[key] ?? 0) * (effects[key] ?? 0))
      const disagreement = components.length
        ? clamp(
            populationStd(components) /
              (components.reduce((sum, value) => sum + Math.abs(value), 0) / components.length + 0.05),
            0,
            1,
          )
        : 1
      const available = weightKeys.filter((key) => frame[key].available[index])
      const completeness = weightKeys.length ? available.length / weightKeys.length : 0
      const quality = place.data_quality ?? 0.7
      let score =
        0.28 * (1 - completeness) +
        0.22 * (distances[index] / maxDistance) +
        0.18 * disagreement +
        0.18 * modelResidual +
        0.14 * (1 - quality)
      if (!reference) score += 0.08
      score += 0.12 * weightKeys.filter((key) => frame[key].imputed[index]).length
      score = clamp(score, 0.05, 0.92)
      const category = uncertaintyCategory(score)
      const imputed = weightKeys.filter((key) => frame[key].imputed[index])
      uncertainty[variable] = {
        value: Math.round(score * 1000) / 1000,
        category,
        confidence: Math.round((1 - score) * 100),
        explanation: explain(category, score, completeness, distances[index], imputed, quality),
        completeness: Math.round(completeness * 1000) / 1000,
        distance_km: Math.round(distances[index] * 100) / 100,
        model_residual: Math.round(modelResidual * 1000) / 1000,
      }
      contributions[variable] = weightKeys.map((key) => {
        const weighted = (weights[key] ?? 0) * (effects[key] ?? 0)
        importanceAcc[variable][key] += Math.abs(weighted)
        return {
          id: key,
          label: PREDICTORS.find((item) => item.id === key)?.label ?? key,
          normalized: Math.round(frame[key].normalized[index] * 1000) / 1000,
          weighted_effect: Math.round(weighted * 10000) / 10000,
          weight: Math.round((weights[key] ?? 0) * 10000) / 10000,
          available: frame[key].available[index],
          imputed: frame[key].imputed[index],
        } satisfies Contribution
      })
    }

    return {
      panchayat_id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      geometry: place.geometry,
      forecasts,
      baseline,
      reference,
      adjustments,
      uncertainty_by_variable: uncertainty,
      predictor_contributions: contributions,
      predictors: {
        elevation_m: place.elevation_m,
        land_cover: place.land_cover,
        soil_moisture: place.soil_moisture,
        distance_to_water_km: place.distance_to_water_km,
        vegetation: place.vegetation,
        data_quality: place.data_quality,
      },
      data_quality: place.data_quality ?? 0.7,
      advisory_priority: "Low",
      source: "demo_simulation",
      is_simulated: true,
    }
  })

  if (panchayats.some((item) => !item.reference)) {
    throw new Error("Simulated reference values are missing. Regenerate data/reference_values.json before the demo.")
  }

  const advisories = buildAdvisories(panchayats, selection.date, selection.variable)
  const validations = Object.fromEntries(
    VARIABLES.map((variable) => [variable, validationTable(panchayats, variable)]),
  ) as DownscaleRun["validations"]
  const scores = panchayats.map((item) => item.uncertainty_by_variable[selection.variable])
  const counts: Record<UncertaintyCategory, number> = {
    "Low uncertainty": 0,
    "Moderate uncertainty": 0,
    "High uncertainty": 0,
  }
  for (const score of scores) counts[score.category] += 1
  const rank = { High: 2, Moderate: 1, Low: 0 }
  const highest = [...panchayats].sort(
    (a, b) =>
      rank[b.advisory_priority] - rank[a.advisory_priority] ||
      a.uncertainty_by_variable[selection.variable].confidence -
        b.uncertainty_by_variable[selection.variable].confidence ||
      a.name.localeCompare(b.name),
  )[0]
  const values = panchayats.map((item) => item.forecasts[selection.variable])
  const featureImportance = Object.fromEntries(
    VARIABLES.map((variable) => {
      const total = weightKeys.reduce((sum, key) => sum + importanceAcc[variable][key], 0) || 1
      return [
        variable,
        weightKeys
          .map((key) => ({
            id: key,
            label: PREDICTORS.find((item) => item.id === key)?.label ?? key,
            value: Math.round((importanceAcc[variable][key] / total) * 10000) / 10000,
            kind: "mean_absolute_weight_share",
          }))
          .sort((a, b) => b.value - a.value),
      ]
    }),
  ) as DownscaleRun["feature_importance"]

  const model: DownscaleRun["model"] =
    options?.fallbackNote && selection.model === "random_forest" ? "contextual_baseline" : selection.model

  return {
    run_id: `MS-L${Date.now().toString(36).toUpperCase()}`,
    status: "completed",
    created_at: new Date().toISOString(),
    model,
    model_label: MODEL_LABELS[model],
    geography: {
      state_id: selection.stateId,
      state_name: forecast.state_name,
      district_id: selection.districtId,
      district_name: forecast.district_name,
      block_id: selection.blockId,
      block_name: forecast.block_name,
      date: selection.date,
    },
    variable: selection.variable,
    variable_label: VARIABLE_META[selection.variable].label,
    unit: VARIABLE_META[selection.variable].unit,
    predictors: selection.predictors,
    predictor_labels: Object.fromEntries(PREDICTORS.map((item) => [item.id, item.label])),
    block_forecast: {
      date: forecast.date,
      values: forecast.values,
      primary_value: forecast.values[selection.variable],
      resolution: "Block level",
      resolution_text: "Current resolution: Block level",
      series: forecast.series,
      source: "demo_simulation",
      is_simulated: true,
    },
    block_geometry: forecast.geometry,
    panchayat_forecasts: panchayats,
    uncertainty_summary: {
      mean_uncertainty: Math.round((scores.reduce((sum, score) => sum + score.value, 0) / scores.length) * 1000) / 1000,
      mean_confidence: Math.round((scores.reduce((sum, score) => sum + score.confidence, 0) / scores.length) * 10) / 10,
      counts,
      average_forecast: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100,
      highest_risk_panchayat: {
        id: highest.panchayat_id,
        name: highest.name,
        priority: highest.advisory_priority,
        confidence: highest.uncertainty_by_variable[selection.variable].confidence,
      },
      explanation:
        "Uncertainty reflects predictor completeness, distance from the block representative point, predictor disagreement, model residual, and the data-quality flag. It is not a guarantee of forecast error.",
    },
    validation_metrics: validations[selection.variable],
    validations,
    advisories,
    feature_importance: featureImportance,
    weights: Object.fromEntries(weightKeys.map((key) => [key, Math.round((weights[key] ?? 0) * 10000) / 10000])),
    simulation_metadata: {
      source: "demo_simulation",
      is_simulated: true,
      seed: 42,
      model_limitation: MODEL_LIMITATIONS[model],
      reference_note:
        "Reference values are an independent simulated field frozen in data/reference_values.json. They are not observations.",
      resolution_before: "Current resolution: Block level",
      resolution_after: "Output resolution: Panchayat level",
      statements: STATEMENTS,
      fallback_note: options?.fallbackNote,
    },
  }
}
