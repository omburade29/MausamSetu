import { describe, expect, it } from "vitest";
import { fieldCue, rankShifts } from "@/lib/field-brief";

const base = {
  rainfall_mm: 0.4,
  probability_of_rain: 0.2,
  temperature_max_c: 32,
  temperature_min_c: 21,
  wind_speed_kmh: 8,
  humidity_percent: 60,
  confidence_score: 0.7,
  low_confidence: false,
};

describe("field brief", () => {
  it("holds field work when heavy rain is likely", () => {
    const cue = fieldCue({ ...base, rainfall_mm: 62, probability_of_rain: 0.8 });
    expect(cue.id).toBe("heavy-rain");
    expect(cue.tone).toBe("severe");
  });

  it("opens a calmer spray window when wind and rain stay low", () => {
    expect(fieldCue(base).id).toBe("spray-window");
  });

  it("ranks the largest percentage departure from the block", () => {
    const ranked = rankShifts([
      {
        variable: "rainfall_mm",
        unit: "mm",
        block_forecast: 20,
        downscaled: 12,
        observed: null,
        historical_average: null,
        difference_downscaled_minus_block: -8,
        lower_bound: 0,
        upper_bound: 25,
        confidence_score: 0.6,
      },
      {
        variable: "humidity_percent",
        unit: "%",
        block_forecast: 80,
        downscaled: 82,
        observed: null,
        historical_average: null,
        difference_downscaled_minus_block: 2,
        lower_bound: null,
        upper_bound: null,
        confidence_score: 0.6,
      },
      {
        variable: "wind_direction_deg",
        unit: "deg",
        block_forecast: 10,
        downscaled: 200,
        observed: null,
        historical_average: null,
        difference_downscaled_minus_block: 190,
        lower_bound: null,
        upper_bound: null,
        confidence_score: null,
      },
    ]);
    expect(ranked[0].variable).toBe("rainfall_mm");
    expect(ranked[0].sentence).toContain("below");
    expect(ranked.some((item) => item.variable === "wind_direction_deg")).toBe(false);
  });
});
