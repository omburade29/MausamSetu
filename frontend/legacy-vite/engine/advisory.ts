import { ADVISORY_DISCLAIMER } from "@/content/copy"
import type { Advisory, PanchayatForecast, RiskLevel, VariableId } from "@/types"

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2 }

interface Draft {
  risk_level: RiskLevel
  weather_condition: string
  actions: string[]
  reason: string
}

export function buildAdvisories(panchayats: PanchayatForecast[], date: string, variable: VariableId) {
  const cards: Advisory[] = []
  for (const item of panchayats) {
    const rain = item.forecasts.rainfall_mm
    const temp = item.forecasts.temperature_c
    const wind = item.forecasts.wind_kmh
    const humidity = item.forecasts.humidity_pct
    const uncertainty = item.uncertainty_by_variable[variable]
    const drafts: Draft[] = []

    if (rain >= 50) {
      drafts.push({
        risk_level: "High",
        weather_condition: `Heavy rainfall signal (${rain.toFixed(1)} mm)`,
        actions: [
          "Avoid irrigation.",
          "Delay fertilizer application.",
          "Check drainage.",
          "Protect harvested produce.",
        ],
        reason:
          "The downscaled rainfall estimate is in the heavy-rain prototype band for this date. Thresholds here are demonstration bands, not IMD criteria.",
      })
    } else if (rain >= 35) {
      drafts.push({
        risk_level: "Moderate",
        weather_condition: `Elevated rainfall signal (${rain.toFixed(1)} mm)`,
        actions: [
          "Avoid irrigation.",
          "Delay fertilizer application.",
          "Check drainage.",
          "Protect harvested produce.",
        ],
        reason:
          "Rainfall is below the heavy-rain prototype band but high enough that extra irrigation and fertilizer application are poor fits for this demo rule set.",
      })
    } else if (rain < 15) {
      drafts.push({
        risk_level: "Moderate",
        weather_condition: `Low rainfall signal (${rain.toFixed(1)} mm)`,
        actions: [
          "Conserve soil moisture.",
          "Review irrigation planning.",
          "Consider mulching where appropriate.",
        ],
        reason: "The downscaled rainfall estimate is in the low-rain prototype band.",
      })
    }

    if (temp >= 34) {
      drafts.push({
        risk_level: temp >= 37 ? "High" : "Moderate",
        weather_condition: `High temperature signal (${temp.toFixed(1)} °C)`,
        actions: [
          "Irrigate during cooler hours.",
          "Monitor crop heat stress.",
          "Avoid unnecessary field operations at midday.",
        ],
        reason: "The downscaled temperature estimate is in the heat-stress prototype band.",
      })
    }

    if (wind >= 25) {
      drafts.push({
        risk_level: wind >= 38 ? "High" : "Moderate",
        weather_condition: `High wind signal (${wind.toFixed(1)} km/h)`,
        actions: [
          "Secure temporary structures.",
          "Inspect crops and support systems.",
          "Avoid spraying during strong winds.",
        ],
        reason: "The downscaled wind estimate is in the strong-wind prototype band.",
      })
    }

    if (uncertainty.category === "High uncertainty") {
      drafts.push({
        risk_level: "Moderate",
        weather_condition: "High uncertainty",
        actions: ["Verify with local observations.", "Treat the recommendation as indicative."],
        reason:
          "Missing predictors, distance from the block representative point, or a weak data-quality flag widened the uncertainty band.",
      })
    }

    if (!drafts.length) {
      drafts.push({
        risk_level: "Low",
        weather_condition: `No prototype caution band crossed (rain ${rain.toFixed(1)} mm, ${temp.toFixed(1)} °C, humidity ${humidity.toFixed(0)}%, wind ${wind.toFixed(1)} km/h)`,
        actions: ["Continue routine field monitoring.", "Compare with the block guidance before changing plans."],
        reason: "Downscaled estimates sit outside the prototype caution bands for this date.",
      })
    }

    const priority = drafts.reduce((best, draft) => (RANK[draft.risk_level] > RANK[best] ? draft.risk_level : best), "Low" as RiskLevel)
    item.advisory_priority = priority
    for (const draft of drafts) {
      cards.push({
        panchayat_id: item.panchayat_id,
        panchayat: item.name,
        risk_level: draft.risk_level,
        weather_condition: draft.weather_condition,
        recommended_farm_action: draft.actions.join(" "),
        recommended_actions: draft.actions,
        reason: draft.reason,
        validity: `Prototype validity: selected forecast date ${date}. Re-check if the block guidance changes.`,
        data_confidence: uncertainty.confidence,
        uncertainty_category: uncertainty.category,
        advisory_priority: priority,
        crop_context: "Illustrative kharif paddy setting for the demo. Not a farm survey.",
        disclaimer: ADVISORY_DISCLAIMER,
        source: "demo_simulation",
        is_simulated: true,
      })
    }
  }
  return cards
}
