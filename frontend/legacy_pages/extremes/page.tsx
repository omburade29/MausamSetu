"use client";

import { useEffect, useMemo, useState } from "react";
import { Blocked, PageHead, useMeta } from "@/components/ApiGate";
import { Controls } from "@/components/Controls";
import { StationMap } from "@/components/StationMap";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/scales";
import type { Alert, ExtremesResponse } from "@/lib/types";

const EVENT_META: Record<string, { title: string; tint: string }> = {
  heavy_rainfall: { title: "Heavy rainfall", tint: "#6aa6ff" },
  heatwave: { title: "Heatwave", tint: "#ff7a45" },
  high_wind: { title: "High wind", tint: "#d6e38a" },
};

const SEVERITY_COLOR: Record<string, string> = {
  high: "#ff4d6d",
  moderate: "#f5c542",
  low: "#7d8f9c",
};

export default function ExtremesPage() {
  const { meta, error } = useMeta();
  const [lead, setLead] = useState(24);
  const [date, setDate] = useState("");
  const [payload, setPayload] = useState<ExtremesResponse | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (meta && !date) setDate(meta.default_date);
  }, [meta, date]);

  useEffect(() => {
    if (!date) return;
    api.extremes(date, lead).then(setPayload).catch(() => setPayload(null));
  }, [date, lead]);

  const alerts = useMemo(() => {
    const rows = payload?.alerts || [];
    return filter === "all" ? rows : rows.filter((row) => row.event === filter);
  }, [payload, filter]);

  const stations = useMemo(() => {
    const worst = new Map<string, Alert>();
    for (const alert of alerts) {
      const current = worst.get(alert.station_id);
      if (!current || alert.probability > current.probability) worst.set(alert.station_id, alert);
    }
    return meta
      ? meta.stations.map((station) => {
          const alert = worst.get(station.station_id);
          return {
            station_id: station.station_id,
            name: station.name,
            lat: station.lat,
            lon: station.lon,
            fill: alert ? SEVERITY_COLOR[alert.severity] : "#1e3a4c",
            label: alert ? `${alert.event} ${(alert.probability * 100).toFixed(0)}%` : "no alert",
          };
        })
      : [];
  }, [alerts, meta]);

  if (error) return <Blocked message={error} />;
  if (!meta || !date) return <div className="p-8 text-sm text-mist">Loading guidance…</div>;

  return (
    <main className="px-6 py-6">
      <PageHead
        kicker="Tail guidance"
        title="Extreme weather"
        aside={`Heavy rain ≥ ${meta.thresholds.heavy_rainfall_mm} mm, heat ≥ terrain threshold, wind ≥ ${meta.thresholds.high_wind_ms} m/s. Probability is a Gaussian tail around the corrected blend.`}
      />
      <Controls
        meta={meta}
        variable="rainfall"
        lead={lead}
        date={date}
        onVariable={() => undefined}
        onLead={setLead}
        onDate={setDate}
        showVariable={false}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {["all", "heavy_rainfall", "heatwave", "high_wind"].map((event) => (
          <button
            key={event}
            type="button"
            className={event === filter ? "seg seg-on bg-ink" : "seg bg-ink"}
            onClick={() => setFilter(event)}
          >
            {event === "all" ? "All events" : EVENT_META[event].title}
          </button>
        ))}
        <span className="self-center font-mono text-xs text-mist">
          {payload ? `${payload.counts.high || 0} high · ${payload.counts.moderate || 0} moderate` : ""}
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="h-[680px] rounded-xl border border-line bg-panel p-3">
          <StationMap stations={stations} selectedId={selected} onSelect={setSelected} />
        </div>
        <div className="max-h-[680px] space-y-2 overflow-auto pr-1">
          {alerts.length === 0 && (
            <div className="rounded-xl border border-line bg-panel p-4 text-sm text-mist">No alerts at this threshold for the selected filter.</div>
          )}
          {alerts.map((alert) => (
            <button
              key={`${alert.station_id}-${alert.event}`}
              type="button"
              onClick={() => setSelected(alert.station_id)}
              className={`block w-full rounded-xl border bg-panel p-3 text-left ${
                selected === alert.station_id ? "border-cyan" : "border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{alert.name}</span>
                <span className="font-mono text-xs uppercase" style={{ color: SEVERITY_COLOR[alert.severity] }}>
                  {alert.severity} · {(alert.probability * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 text-xs text-mist">
                {EVENT_META[alert.event]?.title} · {formatNumber(alert.blended)} vs {formatNumber(alert.threshold)} · {alert.terrain}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
