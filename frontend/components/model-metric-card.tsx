import { MetricCard } from "@/components/metric-card";
import { formatNumber } from "@/lib/format";

export function ModelMetricCard({
  variable,
  mae,
  rmse,
  baselineRmse,
  improvement,
  statement,
}: {
  variable: string;
  mae: number | null;
  rmse: number | null;
  baselineRmse: number | null;
  improvement: number | null;
  statement: string;
}) {
  const improved = (improvement ?? 0) > 0.5;
  return (
    <div className="space-y-3">
      <MetricCard label={`${variable} RMSE`} value={formatNumber(rmse, 2)} hint={`Baseline RMSE ${formatNumber(baselineRmse, 2)} · MAE ${formatNumber(mae, 2)}`} />
      <p className={`rounded-xl px-3 py-2 text-sm ${improved ? "bg-emerald-50 text-emerald-950" : "bg-stone-100 text-stone-800"}`}>
        <span className="mr-2 font-semibold">{improved ? "Improved" : "No improvement"}</span>
        {statement}
      </p>
    </div>
  );
}
