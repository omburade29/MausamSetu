const RAIN = [
  [0, "#16324a"],
  [8, "#1d6a8a"],
  [20, "#1aa6c9"],
  [40, "#2ee6c7"],
  [64.5, "#f5c542"],
  [100, "#ff7a45"],
  [160, "#ff4d6d"],
] as const;

const TEMP = [
  [8, "#7eb6ff"],
  [18, "#2ee6c7"],
  [26, "#d6e38a"],
  [32, "#f5c542"],
  [37, "#ff7a45"],
  [42, "#ff4d6d"],
  [46, "#c81e4a"],
] as const;

const WIND = [
  [0, "#16324a"],
  [3, "#1d6a8a"],
  [6, "#2ee6c7"],
  [10, "#d6e38a"],
  [14, "#f5c542"],
  [20, "#ff7a45"],
  [28, "#ff4d6d"],
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function scaleColor(stops: readonly (readonly [number, string])[], value: number): string {
  if (value <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    if (value <= stops[i][0]) {
      const span = stops[i][0] - stops[i - 1][0] || 1;
      return mix(stops[i - 1][1], stops[i][1], (value - stops[i - 1][0]) / span);
    }
  }
  return stops[stops.length - 1][1];
}

export function colorForVariable(variable: string, value: number): string {
  if (variable === "temperature") return scaleColor(TEMP, value);
  if (variable === "wind") return scaleColor(WIND, value);
  return scaleColor(RAIN, value);
}

export const SOURCE_COLOR: Record<string, string> = {
  NWP: "#6aa6ff",
  AI: "#d392ff",
  ENSEMBLE: "#ffc857",
  BLENDED: "#2ee6c7",
  BLENDED_RAW: "#7d8f9c",
};

export function formatNumber(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export function leadLabel(hours: number): string {
  return `${hours / 24}d`;
}

export function regimeLabel(regime: string): string {
  return regime.replaceAll("_", " ");
}
