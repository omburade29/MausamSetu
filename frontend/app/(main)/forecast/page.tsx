"use client";

import { useQuery } from "@tanstack/react-query";
import { PanchayatSelector } from "@/components/panchayat-selector";
import { ForecastChart } from "@/components/forecast-chart";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { UncertaintyRange } from "@/components/uncertainty-range";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { BlockShiftBoard } from "@/components/field-brief";

export default function ForecastPage() {
  const { t } = useI18n();
  const location = useHierarchy();
  const id = Number(location.panchayatId);
  const compare = useQuery({
    queryKey: ["compare", id, location.date],
    queryFn: () => api.compare(id, location.date),
    enabled: id > 0,
  });
  const series = useQuery({
    queryKey: ["forecast", id],
    queryFn: () => api.panchayatForecast(id),
    enabled: id > 0,
  });
  const payload = compare.data?.data;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Forecast quality</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Block and panchayat comparison</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">The block column is the coarse input. The downscaled column is a model estimate. Neither column is an official IMD forecast.</p>
      </header>
      <PanchayatSelector
        states={location.states}
        districts={location.districts}
        blocks={location.blocks}
        panchayats={location.panchayats}
        value={location}
        onChange={(next) => {
          if (next.stateId !== location.stateId) location.setStateId(next.stateId);
          else if (next.districtId !== location.districtId) location.setDistrictId(next.districtId);
          else if (next.blockId !== location.blockId) location.setBlockId(next.blockId);
          else location.setPanchayatId(next.panchayatId);
        }}
        labels={{ state: t("state"), district: t("district"), block: t("block"), panchayat: t("panchayat") }}
      />
      <input className="h-10 rounded-xl border border-line px-3" type="date" value={location.date} onChange={(event) => location.setDate(event.target.value)} aria-label="Date" />
      {compare.isLoading ? <LoadingSkeleton /> : null}
      {compare.error ? <ErrorState message={(compare.error as Error).message} onRetry={() => compare.refetch()} /> : null}
      {!compare.isLoading && !payload ? <EmptyState title="No comparison for this date." /> : null}
      {payload ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Block source" value="Coarse input" hint={payload.block_source_label} />
            <MetricCard label="Panchayat source" value={payload.model_version} hint={payload.data_source_label} />
            <MetricCard label="Observation" value={payload.observation ? "Available" : "Not available"} hint={payload.observed_source_label} />
          </div>
          <BlockShiftBoard variables={payload.variables} />
          <div className="flex flex-wrap items-center gap-3">
            <ConfidenceBadge score={payload.downscaled.confidence_score} />
            <UncertaintyRange lower={payload.downscaled.lower_bound} upper={payload.downscaled.upper_bound} unit="mm rainfall" />
          </div>
          <DataTable
            columns={["Variable", "Block", "Downscaled", "Observed", "Historical avg", "Difference", "Interval"]}
            rows={payload.variables.map((item) => [
              item.variable,
              formatNumber(item.block_forecast),
              formatNumber(item.downscaled),
              formatNumber(item.observed),
              formatNumber(item.historical_average),
              formatNumber(item.difference_downscaled_minus_block),
              `${formatNumber(item.lower_bound)} – ${formatNumber(item.upper_bound)}`,
            ])}
          />
          <ForecastChart
            title="Rainfall: block input and downscaled estimate"
            data={(series.data?.data ?? []).map((row) => ({
              day: row.forecast_time.slice(0, 10),
              downscaled: row.rainfall_mm,
            }))}
            lines={[{ key: "downscaled", name: "Downscaled rainfall", color: "#164e63" }]}
          />
          <ForecastChart
            title="Selected day, all compared variables"
            data={payload.variables.filter((item) => item.variable !== "wind_direction_deg").map((item) => ({
              day: item.variable.replaceAll("_", " "),
              block: item.block_forecast,
              downscaled: item.downscaled,
              observed: item.observed,
            }))}
            lines={[
              { key: "block", name: "Block", color: "#a16207" },
              { key: "downscaled", name: "Downscaled", color: "#0e3b32" },
              { key: "observed", name: "Observed", color: "#164e63" },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}
