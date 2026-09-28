import { formatNumber } from "@/lib/format";

export function UncertaintyRange({
  lower,
  upper,
  unit,
  label = "Uncertainty interval",
}: {
  lower: number | null | undefined;
  upper: number | null | undefined;
  unit?: string;
  label?: string;
}) {
  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-ink">{label}: </span>
      {formatNumber(lower)} – {formatNumber(upper)} {unit}
    </p>
  );
}
