"use client";

import { useQuery } from "@tanstack/react-query";
import { WeatherCard } from "@/components/weather-card";
import { ForecastChart } from "@/components/forecast-chart";
import { AdvisoryCard } from "@/components/advisory-card";
import { UncertaintyRange } from "@/components/uncertainty-range";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { compass, formatDay } from "@/lib/format";
import { rankShifts } from "@/lib/field-brief";
import { FieldBrief } from "@/components/field-brief";
import type { CompareVariable, Forecast } from "@/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const location = useHierarchy();
  const id = Number(location.panchayatId);
  const forecast = useQuery({
    queryKey: ["forecast", id],
    queryFn: () => api.panchayatForecast(id),
    enabled: Number.isFinite(id) && id > 0,
  });
  const advisories = useQuery({
    queryKey: ["advisories", id],
    queryFn: () => api.advisories(id),
    enabled: Number.isFinite(id) && id > 0,
  });
  const compare = useQuery({
    queryKey: ["compare", id, location.date],
    queryFn: () => api.compare(id, location.date),
    enabled: Number.isFinite(id) && id > 0,
  });
  const rows = forecast.data?.data ?? [];
  const selected = rows.find((row) => formatDay(row.forecast_time) === location.date) || rows[0];
  const place = location.panchayats.find((item) => String(item.id) === location.panchayatId)?.name ?? "Panchayat";
  const state = location.states.find((item) => String(item.id) === location.stateId)?.name ?? "State";
  const district = location.districts.find((item) => String(item.id) === location.districtId)?.name ?? "District";
  const block = location.blocks.find((item) => String(item.id) === location.blockId)?.name ?? "Block";
  const horizonStart = selected ? Math.max(0, rows.findIndex((row) => formatDay(row.forecast_time) === formatDay(selected.forecast_time))) : 0;
  const horizon = rows.slice(horizonStart, horizonStart + 8);
  const warnings = (advisories.data?.data ?? []).filter((item) => item.severity === "warning" || item.severity === "severe");
  const variables = compare.data?.data.variables ?? [];

  return (
    <div className="space-y-6">
      <header className="relative min-h-56 overflow-hidden rounded-xl border border-line shadow-card md:min-h-64">
        <img src="/dashboard-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="relative flex min-h-56 items-center md:min-h-64">
          <div className="max-w-xl bg-gradient-to-r from-field/80 via-field/45 to-transparent p-6 text-white md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Field operations</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("dashboard")}</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-100">The cards are model estimates for one panchayat. The block forecast stays on the comparison page.</p>
          </div>
        </div>
      </header>
      {location.error ? <ErrorState message={(location.error as Error).message} onRetry={() => location.refetch()} /> : null}
      {forecast.isLoading ? <LoadingSkeleton /> : null}
      {forecast.error ? <ErrorState message={(forecast.error as Error).message} onRetry={() => forecast.refetch()} /> : null}
      {!forecast.isLoading && !selected ? <EmptyState title={t("empty")} hint="Generate forecasts from the models page after demo data is loaded." /> : null}
      {selected ? (
        <OperationalSummary
          place={place}
          state={state}
          district={district}
          block={block}
          row={selected}
          variables={variables}
          warnings={warnings.length}
          advisories={advisories.data?.data.length ?? 0}
        />
      ) : null}
      {selected ? (
        <FieldBrief
          place={place}
          date={formatDay(selected.forecast_time)}
          row={selected}
          days={rows}
          shifts={rankShifts(compare.data?.data.variables ?? [])}
          onPickDate={location.setDate}
        />
      ) : null}
      {selected ? <WeatherGrid row={selected} labels={t} /> : null}
      {horizon.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ForecastChart
            title="5-day rainfall"
            data={horizon.map((row) => ({ day: formatDay(row.forecast_time), rainfall: row.rainfall_mm, lower: row.lower_bound, upper: row.upper_bound }))}
            lines={[
              { key: "rainfall", name: "Estimate", color: "#0f766e" },
              { key: "lower", name: "Lower bound", color: "#a8a29e" },
              { key: "upper", name: "Upper bound", color: "#a8a29e" },
            ]}
          />
          <ForecastChart
            title="Temperature range"
            data={horizon.map((row) => ({ day: formatDay(row.forecast_time), min: row.temperature_min_c, max: row.temperature_max_c }))}
            lines={[
              { key: "min", name: "Minimum", color: "#0369a1" },
              { key: "max", name: "Maximum", color: "#c2410c" },
            ]}
          />
          <ForecastChart
            title="Humidity and confidence"
            data={horizon.map((row) => ({ day: formatDay(row.forecast_time), humidity: row.humidity_percent, confidence: Math.round(row.confidence_score * 100) }))}
            lines={[
              { key: "humidity", name: "Humidity %", color: "#0369a1" },
              { key: "confidence", name: "Confidence %", color: "#0f766e" },
            ]}
          />
        </div>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Active warnings</h2>
        {warnings.length === 0 ? <EmptyState title="No severe or warning advisories for this panchayat." /> : warnings.slice(0, 3).map((item) => (
          <AdvisoryCard key={item.id} {...cardProps(item)} />
        ))}
      </section>
    </div>
  );
}

function OperationalSummary({
  place,
  state,
  district,
  block,
  row,
  variables,
  warnings,
  advisories,
}: {
  place: string;
  state: string;
  district: string;
  block: string;
  row: Forecast;
  variables: CompareVariable[];
  warnings: number;
  advisories: number;
}) {
  const rainfallShift = variables.find((item) => item.variable === "rainfall_mm" || item.variable.toLowerCase().includes("rain"));
  const rainfallDifference = rainfallShift?.difference_downscaled_minus_block;
  const confidence = Math.round(row.confidence_score * 100);
  const rainWindow = `${row.lower_bound.toFixed(1)}-${row.upper_bound.toFixed(1)} mm`;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Active panchayat"
        value={place}
        detail={`${block}, ${district}, ${state}`}
      />
      <SummaryCard
        label="Downscaled rainfall"
        value={`${row.rainfall_mm.toFixed(1)} mm`}
        detail={`Panchayat estimate for ${formatDay(row.forecast_time)}`}
      />
      <SummaryCard
        label="Block comparison"
        value={formatRainfallDifference(rainfallDifference)}
        detail="Shows how the panchayat estimate differs from the block forecast."
      />
      <SummaryCard
        label="Decision readiness"
        value={`${confidence}% confidence`}
        detail={`${rainWindow} uncertainty window. ${warnings} warning alerts, ${advisories} advisory notes.`}
      />
    </section>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-line bg-card p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </article>
  );
}

function formatRainfallDifference(value: number | null | undefined) {
  if (value === null || value === undefined) return "Pending";
  if (Math.abs(value) < 0.05) return "Near block value";
  return `${Math.abs(value).toFixed(1)} mm ${value > 0 ? "above" : "below"} block`;
}

function WeatherGrid({ row, labels }: { row: Forecast; labels: (key: "rainfall" | "tempMin" | "tempMax" | "humidity" | "wind" | "windDir" | "cloud" | "pop" | "uncertainty") => string }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-teal-50 px-3 py-1 font-semibold text-leaf">Model estimate</span>
        <span className="rounded-full bg-white px-3 py-1 font-medium text-muted ring-1 ring-line">{row.model_version}</span>
        <span className="rounded-full bg-white px-3 py-1 font-medium text-muted ring-1 ring-line">Generated {row.generated_at.slice(0, 16).replace("T", " ")} UTC</span>
      </div>
      <UncertaintyRange lower={row.lower_bound} upper={row.upper_bound} unit="mm" label={`${labels("uncertainty")} (rainfall)`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WeatherCard label={labels("rainfall")} value={row.rainfall_mm} unit="mm" icon="rainfall" source={row.data_source_label} generatedAt={row.generated_at} lowConfidence={row.low_confidence} confidence={row.confidence_score} />
        <WeatherCard label={labels("tempMin")} value={row.temperature_min_c} unit="°C" icon="temp" confidence={row.confidence_by_variable.temperature_min_c} />
        <WeatherCard label={labels("tempMax")} value={row.temperature_max_c} unit="°C" icon="temp" confidence={row.confidence_by_variable.temperature_max_c} />
        <WeatherCard label={labels("humidity")} value={row.humidity_percent} unit="%" icon="humidity" confidence={row.confidence_by_variable.humidity_percent} />
        <WeatherCard label={labels("wind")} value={row.wind_speed_kmh} unit="km/h" icon="wind" />
        <WeatherCard label={labels("windDir")} value={row.wind_direction_deg} unit={compass(row.wind_direction_deg)} icon="direction" />
        <WeatherCard label={labels("cloud")} value={row.cloud_cover_percent} unit="%" icon="cloud" />
        <WeatherCard label={labels("pop")} value={row.probability_of_rain * 100} unit="%" icon="pop" />
      </div>
    </section>
  );
}

function cardProps(item: { title: string; message: string; reason: string; action: string; severity: string; confidence_score: number | null; disclaimer: string; status: string; forecast_date: string }) {
  return {
    title: item.title,
    message: item.message,
    reason: item.reason,
    action: item.action,
    severity: item.severity,
    confidence: item.confidence_score,
    disclaimer: item.disclaimer,
    status: item.status,
    validOn: item.forecast_date,
  };
}
