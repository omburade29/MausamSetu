import type { CompareVariable, Forecast } from "@/types";

export type CueTone = "severe" | "watch" | "ok" | "neutral";

export type FieldCue = {
  id: string;
  title: string;
  detail: string;
  tone: CueTone;
};

type Snapshot = Pick<
  Forecast,
  | "rainfall_mm"
  | "probability_of_rain"
  | "temperature_max_c"
  | "temperature_min_c"
  | "wind_speed_kmh"
  | "humidity_percent"
  | "confidence_score"
  | "low_confidence"
>;

const labels: Record<string, string> = {
  rainfall_mm: "Rainfall",
  temperature_min_c: "Minimum temperature",
  temperature_max_c: "Maximum temperature",
  humidity_percent: "Humidity",
  wind_speed_kmh: "Wind speed",
  cloud_cover_percent: "Cloud cover",
  probability_of_rain: "Rain probability",
};

export function fieldCue(row: Snapshot): FieldCue {
  const rain = row.rainfall_mm;
  const chance = Math.round(row.probability_of_rain * 100);
  const wind = row.wind_speed_kmh;

  if (row.probability_of_rain >= 0.7 && rain >= 50) {
    return {
      id: "heavy-rain",
      title: "Hold field work",
      detail: `Estimated rainfall is ${rain.toFixed(1)} mm, with a ${chance}% chance of rain. Clear drains and keep harvested produce covered.`,
      tone: "severe",
    };
  }
  if (row.probability_of_rain >= 0.7 && rain >= 20) {
    return {
      id: "skip-irrigation",
      title: "Skip irrigation",
      detail: `Estimated rainfall is ${rain.toFixed(1)} mm, with a ${chance}% chance of rain. Extra water today is unlikely to help.`,
      tone: "watch",
    };
  }
  if (wind >= 30) {
    return {
      id: "wind",
      title: "Do not spray",
      detail: `Wind is estimated at ${wind.toFixed(1)} km/h. Any spray already planned is likely to drift.`,
      tone: "watch",
    };
  }
  if (row.temperature_max_c >= 38) {
    return {
      id: "heat",
      title: "Heat watch",
      detail: `Maximum temperature is estimated at ${row.temperature_max_c.toFixed(1)} °C. Avoid midday field work.`,
      tone: "watch",
    };
  }
  if (row.temperature_min_c <= 10) {
    return {
      id: "cold",
      title: "Cold watch",
      detail: `Minimum temperature is estimated at ${row.temperature_min_c.toFixed(1)} °C. Protect nurseries overnight.`,
      tone: "watch",
    };
  }
  if (rain >= 5 && rain < 20) {
    return {
      id: "soil-check",
      title: "Check soil before irrigating",
      detail: `A lighter rain of ${rain.toFixed(1)} mm is estimated. Feel the topsoil before adding water.`,
      tone: "neutral",
    };
  }
  if (wind < 15 && row.probability_of_rain < 0.4 && rain < 2) {
    return {
      id: "spray-window",
      title: "Calmer spray window",
      detail: `Wind is ${wind.toFixed(1)} km/h and the rain chance is ${chance}%. Use only practices already advised by the local agriculture office.`,
      tone: "ok",
    };
  }
  return {
    id: "routine",
    title: "Routine monitoring",
    detail: `Rain ${rain.toFixed(1)} mm, maximum ${row.temperature_max_c.toFixed(1)} °C, humidity ${row.humidity_percent.toFixed(0)}%, wind ${wind.toFixed(1)} km/h. No alert threshold is crossed.`,
    tone: "neutral",
  };
}

export type BlockShift = {
  variable: string;
  label: string;
  unit: string;
  difference: number;
  percent: number | null;
  sentence: string;
};

export function rankShifts(variables: CompareVariable[]): BlockShift[] {
  return variables
    .filter((item) => item.variable !== "wind_direction_deg" && item.difference_downscaled_minus_block !== null)
    .map((item) => {
      const difference = item.difference_downscaled_minus_block as number;
      const block = item.block_forecast;
      const percent = block === null || block === 0 ? null : (difference / Math.abs(block)) * 100;
      const label = labels[item.variable] ?? item.variable;
      const direction = difference > 0.05 ? "above" : difference < -0.05 ? "below" : "in line with";
      const percentText = percent === null ? "" : ` (${Math.abs(percent).toFixed(0)}% ${difference < 0 ? "lower" : "higher"})`;
      const sentence =
        direction === "in line with"
          ? `${label} is in line with the block value.`
          : `${label} is ${Math.abs(difference).toFixed(1)} ${item.unit} ${direction} the block value${percentText}.`;
      return { variable: item.variable, label, unit: item.unit, difference, percent, sentence };
    })
    .sort((a, b) => Math.abs(b.percent ?? 0) - Math.abs(a.percent ?? 0));
}

export function briefText(place: string, date: string, row: Snapshot, shift?: BlockShift | null) {
  const cue = fieldCue(row);
  const confidence = row.low_confidence
    ? "Confidence is low. Check the village before acting."
    : `Confidence is ${Math.round(row.confidence_score * 100)}%.`;
  const lines = [
    `${place} · ${date}`,
    cue.title,
    cue.detail,
    confidence,
    "Model-generated estimate. Not an official IMD forecast or an official crop prescription.",
  ];
  if (shift) lines.splice(3, 0, shift.sentence);
  return lines.join("\n");
}
