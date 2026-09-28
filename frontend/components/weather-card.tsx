import { CloudRain, Thermometer, Droplets, Wind, Compass, Cloud, Umbrella } from "lucide-react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { formatNumber } from "@/lib/format";

const icons = {
  rainfall: CloudRain,
  temp: Thermometer,
  humidity: Droplets,
  wind: Wind,
  direction: Compass,
  cloud: Cloud,
  pop: Umbrella,
};

export function WeatherCard({
  label,
  value,
  unit,
  icon,
  source,
  generatedAt,
  lowConfidence,
  confidence,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  icon: keyof typeof icons;
  source?: string;
  generatedAt?: string | null;
  lowConfidence?: boolean;
  confidence?: number | null;
}) {
  const Icon = icons[icon];
  return (
    <article className="rounded-xl border border-line bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-leaf">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {formatNumber(value)} <span className="text-base font-medium text-muted">{unit}</span>
      </p>
      {confidence !== undefined ? <div className="mt-3"><ConfidenceBadge score={confidence ?? null} /></div> : null}
      {lowConfidence ? <p className="mt-2 text-sm font-medium text-muted">Low confidence — verify locally</p> : null}
      {source ? <p className="mt-3 text-xs leading-5 text-muted">{source}</p> : null}
      {generatedAt ? <p className="text-xs text-muted">Generated {generatedAt.slice(0, 16).replace("T", " ")} UTC</p> : null}
    </article>
  );
}
