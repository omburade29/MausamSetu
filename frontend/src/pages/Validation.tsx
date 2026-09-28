import { Link } from "react-router-dom"
import Disclaimer from "@/components/Disclaimer"
import EmptyState from "@/components/EmptyState"
import SimulationModeBanner from "@/components/SimulationModeBanner"
import ValidationChart from "@/components/ValidationChart"
import ValidationMetrics from "@/components/ValidationMetrics"
import { VALIDATION_WARNING } from "@/content/copy"
import { useApp } from "@/context/AppContext"

export default function Validation() {
  const { run, staleRun, selection } = useApp()
  if (!run || staleRun) {
    return (
      <EmptyState
        title="Validation needs a completed run"
        message="Downscale a block forecast first. Metrics compare the constant block baseline with the localized estimates against simulated reference values."
        action={<Link className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white" to="/workspace">Go to workspace</Link>}
      />
    )
  }
  const report = run.validations[selection.variable] ?? run.validation_metrics
  const improvement = report.improvement_percent
  return (
    <div className="rise space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Validation center</p>
          <h2 className="text-2xl font-semibold text-navy-900">{report.label} error against the simulated reference</h2>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">Simulation mode</span>
      </div>
      <SimulationModeBanner />
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{VALIDATION_WARNING}</p>
      <ValidationMetrics report={report} />
      <p className="text-sm text-slate-700">
        {improvement == null
          ? "Improvement could not be computed."
          : improvement > 0
            ? `On this simulated sample, downscaled MAE is ${improvement.toFixed(1)}% lower than the block baseline. That is not operational accuracy.`
            : improvement < 0
              ? `On this simulated sample, downscaled MAE is ${Math.abs(improvement).toFixed(1)}% higher than the block baseline. Finer detail did not help this run, and the result is shown as calculated.`
              : "On this simulated sample, downscaled MAE matches the block baseline."}
      </p>
      <p className="text-sm text-slate-600">
        Baseline error uses the same block value for every Panchayat. Downscaled error uses the localized value. Difference is baseline absolute error minus downscaled absolute error, so a positive difference means the local estimate was closer to the simulated reference.
      </p>
      <p className="text-xs text-slate-500">
        R² {report.downscaled_metrics.r2 == null ? "is not meaningful for this sample." : `for the downscaled series is ${report.downscaled_metrics.r2}. It is reported only as a sample statistic.`}
      </p>
      <ValidationChart report={report} />
      <div className="card overflow-x-auto p-4">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Panchayat", "Baseline", "Downscaled", "Reference", "Baseline error", "Downscaled error", "Difference", "Uncertainty"].map((label) => (
                <th key={label} className="px-3 py-2">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.panchayat_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{row.panchayat}</td>
                <td className="px-3 py-2">{row.baseline}</td>
                <td className="px-3 py-2">{row.downscaled}</td>
                <td className="px-3 py-2">{row.reference}</td>
                <td className="px-3 py-2">{row.baseline_error}</td>
                <td className="px-3 py-2">{row.downscaled_error}</td>
                <td className={`px-3 py-2 font-semibold ${row.difference < 0 ? "text-danger" : "text-safe"}`}>{row.difference}</td>
                <td className="px-3 py-2">{row.uncertainty_category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{report.reference_note}</p>
      <Disclaimer />
    </div>
  )
}
