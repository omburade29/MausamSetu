"use client";

import { useQuery } from "@tanstack/react-query";
import { AdvisoryCard } from "@/components/advisory-card";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PanchayatSelector } from "@/components/panchayat-selector";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { compass, formatDay, formatNumber } from "@/lib/format";

export default function ReportsPage() {
  const { t } = useI18n();
  const location = useHierarchy();
  const id = Number(location.panchayatId);
  const forecast = useQuery({
    queryKey: ["forecast", id],
    queryFn: () => api.panchayatForecast(id),
    enabled: id > 0,
  });
  const advisories = useQuery({
    queryKey: ["advisories", id],
    queryFn: () => api.advisories(id),
    enabled: id > 0,
  });
  const rows = forecast.data?.data ?? [];
  const start = Math.max(0, rows.findIndex((row) => formatDay(row.forecast_time) === location.date));
  const horizon = rows.slice(start >= 0 && rows.length ? start : 0, (start >= 0 ? start : 0) + 5);
  const selected = horizon[0];
  const place = location.panchayats.find((item) => String(item.id) === location.panchayatId);
  const state = location.states.find((item) => String(item.id) === location.stateId);
  const district = location.districts.find((item) => String(item.id) === location.districtId);
  const block = location.blocks.find((item) => String(item.id) === location.blockId);
  const notes = advisories.data?.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Reports</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Field report</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">The forecast, location, and advisories for the selected panchayat are on this page. Print them from the browser.</p>
        </div>
        <button className="no-print rounded-lg bg-field px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => window.print()}>
          Print report
        </button>
      </header>
      <div className="no-print rounded-xl border border-line bg-card p-4 shadow-card">
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
        <label className="mt-3 block max-w-xs text-sm">
          <span className="font-medium">{t("date")}</span>
          <input className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3" type="date" value={location.date} onChange={(event) => location.setDate(event.target.value)} />
        </label>
      </div>
      {forecast.isLoading ? <LoadingSkeleton /> : null}
      {forecast.error ? <ErrorState message={(forecast.error as Error).message} onRetry={() => forecast.refetch()} /> : null}
      <article className="space-y-6 rounded-xl border border-line bg-white p-5 shadow-card print:border-0 print:shadow-none">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Panchayat weather report</p>
          <h2 className="mt-1 text-2xl font-semibold">{place?.name ?? "Panchayat"}</h2>
          <p className="mt-2 text-sm text-muted">{t("disclaimer")}</p>
        </header>
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Location</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="State" value={state?.name} />
            <Fact label="District" value={district?.name} />
            <Fact label="Block" value={block?.name} />
            <Fact label="Panchayat" value={place?.name} />
            <Fact label="Latitude" value={place?.latitude != null ? formatNumber(place.latitude, 5) : undefined} />
            <Fact label="Longitude" value={place?.longitude != null ? formatNumber(place.longitude, 5) : undefined} />
          </dl>
        </section>
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Forecast</h3>
          {!forecast.isLoading && horizon.length === 0 ? <EmptyState title="No model estimate is stored for this panchayat." /> : null}
          {selected ? (
            <p className="mt-3 text-sm">
              {formatDay(selected.forecast_time)}: rain {formatNumber(selected.rainfall_mm)} mm, {formatNumber(selected.temperature_min_c)}–{formatNumber(selected.temperature_max_c)} °C, humidity {formatNumber(selected.humidity_percent, 0)}%, wind {formatNumber(selected.wind_speed_kmh)} km/h {compass(selected.wind_direction_deg)}, rain chance {formatNumber(selected.probability_of_rain * 100, 0)}%. Confidence {formatNumber(selected.confidence_score * 100, 0)}%. Model {selected.model_version}.
            </p>
          ) : null}
          {horizon.length ? (
            <div className="mt-3">
              <DataTable
                columns={["Date", "Rain mm", "Min °C", "Max °C", "Humidity %", "Wind km/h", "Rain chance %", "Confidence %"]}
                rows={horizon.map((row) => [
                  formatDay(row.forecast_time),
                  formatNumber(row.rainfall_mm),
                  formatNumber(row.temperature_min_c),
                  formatNumber(row.temperature_max_c),
                  formatNumber(row.humidity_percent, 0),
                  formatNumber(row.wind_speed_kmh),
                  formatNumber(row.probability_of_rain * 100, 0),
                  formatNumber(row.confidence_score * 100, 0),
                ])}
              />
            </div>
          ) : null}
        </section>
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Advisories</h3>
          {advisories.isLoading ? <LoadingSkeleton lines={3} /> : null}
          {!advisories.isLoading && notes.length === 0 ? <EmptyState title="No advisories for this panchayat." /> : null}
          <div className="mt-3 space-y-3">
            {notes.map((item) => (
              <AdvisoryCard
                key={item.id}
                title={item.title}
                message={item.message}
                reason={item.reason}
                action={item.action}
                severity={item.severity}
                confidence={item.confidence_score}
                disclaimer={item.disclaimer}
                status={item.status}
                validOn={item.forecast_date}
              />
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
