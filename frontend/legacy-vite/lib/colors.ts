import type { RiskLevel, UncertaintyCategory, VariableId } from "@/types"

function channel(hex: string) {
  const clean = hex.replace("#", "")
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ] as const
}

function mix(from: string, to: string, t: number) {
  const [ar, ag, ab] = channel(from)
  const [br, bg, bb] = channel(to)
  const blend = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${blend(ar, br)} ${blend(ag, bg)} ${blend(ab, bb)})`
}

const SCALES: Record<VariableId, [string, string, string]> = {
  rainfall_mm: ["#E0F2FE", "#0284C7", "#0B1F3A"],
  temperature_c: ["#FEF3C7", "#F59E0B", "#B91C1C"],
  humidity_pct: ["#CCFBF1", "#0D9488", "#134E4A"],
  wind_kmh: ["#EDE9FE", "#7C3AED", "#4C1D95"],
}

export function choropleth(variable: VariableId, t: number) {
  const clamped = Math.min(1, Math.max(0, t))
  const [low, mid, high] = SCALES[variable]
  if (clamped < 0.5) return mix(low, mid, clamped / 0.5)
  return mix(mid, high, (clamped - 0.5) / 0.5)
}

export function uncertaintyTone(category: UncertaintyCategory | string) {
  if (category.startsWith("Low")) return { bg: "bg-emerald-50", text: "text-safe", dot: "bg-safe", hex: "#0F7A4A" }
  if (category.startsWith("High")) return { bg: "bg-red-50", text: "text-danger", dot: "bg-danger", hex: "#C0392B" }
  return { bg: "bg-amber-50", text: "text-caution", dot: "bg-amber-500", hex: "#B7791F" }
}

export function riskTone(level: RiskLevel | string) {
  if (level === "High") return { bg: "bg-red-50", text: "text-danger", border: "border-red-200", hex: "#C0392B" }
  if (level === "Moderate") {
    return { bg: "bg-amber-50", text: "text-caution", border: "border-amber-200", hex: "#B7791F" }
  }
  return { bg: "bg-emerald-50", text: "text-safe", border: "border-emerald-200", hex: "#0F7A4A" }
}

export function scaleStops(variable: VariableId) {
  return SCALES[variable]
}
