export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
}

export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function compass(degrees: number | null | undefined) {
  if (degrees === null || degrees === undefined) return "—";
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return `${labels[index]} ${Math.round(degrees)}°`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
