import type { ValidationReport } from "@/types"

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  )
}

export default function ValidationMetrics({ report }: { report: ValidationReport }) {
  const improvement = report.improvement_percent
  const improvementText =
    improvement == null ? "—" : `${improvement > 0 ? "+" : ""}${improvement.toFixed(1)}%`
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Baseline error (MAE)" value={report.baseline_metrics.mae.toFixed(3)} hint={`${report.unit} · same block value everywhere`} />
      <Metric label="Downscaled error (MAE)" value={report.downscaled_metrics.mae.toFixed(3)} hint={`${report.unit} · localized estimates`} />
      <Metric label="RMSE · bias" value={`${report.downscaled_metrics.rmse.toFixed(2)} · ${report.downscaled_metrics.bias.toFixed(2)}`} hint="Bias is forecast minus reference" />
      <Metric
        label="Improvement"
        value={improvementText}
        hint={improvement != null && improvement < 0 ? "Downscaled error is higher on this sample" : "Versus baseline MAE on this sample"}
      />
    </div>
  )
}
