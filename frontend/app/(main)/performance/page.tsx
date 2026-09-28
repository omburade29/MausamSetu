"use client";

import { useQuery } from "@tanstack/react-query";
import { ForecastChart } from "@/components/forecast-chart";
import { ModelMetricCard } from "@/components/model-metric-card";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useRequireAuth } from "@/lib/auth";

export default function PerformancePage() {
  useRequireAuth(["officer", "admin"]);
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const runs = models.data?.data ?? [];
  const rainfall = runs.find((item) => item.variable === "rainfall_mm");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Does downscaling beat the block baseline?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          The baseline copies the block forecast onto every panchayat. The downscaled column is the trained model on a later time period that was not used for fitting. A positive improvement means the model reduced RMSE. A negative result is shown as no improvement.
        </p>
      </header>
      {models.isLoading ? <LoadingSkeleton /> : null}
      {models.error ? <ErrorState message={(models.error as Error).message} onRetry={() => models.refetch()} /> : null}
      {!models.isLoading && runs.length === 0 ? <EmptyState title="No trained model yet." hint="An administrator can train from the Models page." /> : null}
      {rainfall ? (
        <section className="rounded-3xl bg-field p-5 text-paper">
          <p className="text-sm uppercase tracking-wide text-emerald-100">Rainfall result</p>
          <p className="mt-2 font-serif text-2xl">{rainfall.statement}</p>
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {runs.map((run) => (
          <ModelMetricCard
            key={run.id}
            variable={run.variable}
            mae={run.mae}
            rmse={run.rmse}
            baselineRmse={run.baseline_rmse}
            improvement={run.improvement_percent}
            statement={run.statement}
          />
        ))}
      </div>
      {rainfall ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Bias" value={formatNumber(rainfall.bias, 2)} hint="Mean of estimate minus observation" />
            <MetricCard label="R²" value={formatNumber(rainfall.r2, 2)} />
            <MetricCard label="Correlation" value={formatNumber(rainfall.correlation, 2)} />
            <MetricCard label="CRPS" value={formatNumber(rainfall.crps, 2)} hint={`Interval coverage ${formatNumber((rainfall.interval_coverage ?? 0) * 100, 0)}%`} />
          </div>
          <ForecastChart
            title="Rainfall RMSE by forecast horizon"
            data={(rainfall.by_horizon ?? []).map((item) => ({ day: `${item.key} h`, model: item.rmse, baseline: item.baseline_rmse }))}
            lines={[
              { key: "model", name: "Downscaled RMSE", color: "#0e3b32" },
              { key: "baseline", name: "Block baseline RMSE", color: "#a16207" },
            ]}
          />
          <h2 className="font-serif text-2xl">By season</h2>
          <DataTable columns={["Season", "RMSE", "Baseline RMSE", "Improvement %"]} rows={(rainfall.by_season ?? []).map((item) => [item.key, formatNumber(item.rmse, 2), formatNumber(item.baseline_rmse, 2), formatNumber(item.improvement_percent, 1)])} />
          <h2 className="font-serif text-2xl">By panchayat</h2>
          <DataTable columns={["Panchayat", "RMSE", "Baseline RMSE", "Improvement %"]} rows={(rainfall.by_panchayat ?? []).map((item) => [item.key, formatNumber(item.rmse, 2), formatNumber(item.baseline_rmse, 2), formatNumber(item.improvement_percent, 1)])} />
          {rainfall.rain_classification ? (
            <p className="text-sm text-muted">
              Rain / no-rain at 1 mm: accuracy {formatNumber((rainfall.rain_classification.accuracy ?? 0) * 100, 0)}%, precision {formatNumber(rainfall.rain_classification.precision, 2)}, recall {formatNumber(rainfall.rain_classification.recall, 2)}, F1 {formatNumber(rainfall.rain_classification.f1, 2)}.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
