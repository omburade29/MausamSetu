"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Blocked, PageHead, useMeta } from "@/components/ApiGate";
import { Controls } from "@/components/Controls";
import { StationMap } from "@/components/StationMap";
import { api } from "@/lib/api";
import { SOURCE_COLOR, colorForVariable, formatNumber, regimeLabel } from "@/lib/scales";
import type { ForecastPoint, TimeSeries } from "@/lib/types";

function WeightBar({ point }: { point: ForecastPoint }) {
  const parts = [
    { key: "NWP", value: point.w_nwp, color: SOURCE_COLOR.NWP },
    { key: "AI", value: point.w_ai, color: SOURCE_COLOR.AI },
    { key: "ENS", value: point.w_ensemble, color: SOURCE_COLOR.ENSEMBLE },
  ];
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-ink">
      {parts.map((part) => (
        <div key={part.key} style={{ width: `${part.value * 100}%`, background: part.color }} title={`${part.key} ${(part.value * 100).toFixed(0)}%`} />
      ))}
    </div>
  );
}

export default function ForecastPage() {
  const { meta, error } = useMeta();
  const [variable, setVariable] = useState("rainfall");
  const [lead, setLead] = useState(24);
  const [date, setDate] = useState("");
  const [points, setPoints] = useState<ForecastPoint[]>([]);
  const [units, setUnits] = useState("");
  const [selected, setSelected] = useState("DEL");
  const [series, setSeries] = useState<TimeSeries | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (meta && !date) setDate(meta.default_date);
  }, [meta, date]);

  useEffect(() => {
    if (!date) return;
    api
      .forecast(variable, lead, date)
      .then((payload) => {
        setPoints(payload.points);
        setUnits(payload.units);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, [variable, lead, date]);

  useEffect(() => {
    if (!selected) return;
    api.timeseries(selected, variable, lead).then(setSeries).catch(() => setSeries(null));
  }, [selected, variable, lead]);

  const active = useMemo(
    () => points.find((point) => point.station_id === selected) || points[0],
    [points, selected],
  );

  if (error) return <Blocked message={error} />;
  if (!meta || !date) return <div className="p-8 text-sm text-mist">Loading forecast field…</div>;

  return (
    <main className="px-6 py-6">
      <PageHead
        kicker="Blended field"
        title="Forecast map"
        aside="Colour is the quantile-mapped blend. Select a station to compare every member with synthetic truth."
      />
      <Controls
        meta={meta}
        variable={variable}
        lead={lead}
        date={date}
        onVariable={setVariable}
        onLead={setLead}
        onDate={setDate}
      />
      {loadError && <p className="mt-3 text-sm text-alert">{loadError}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-[720px] rounded-xl border border-line bg-panel p-3">
          <StationMap
            selectedId={active?.station_id}
            onSelect={setSelected}
            stations={points.map((point) => ({
              station_id: point.station_id,
              name: point.name,
              lat: point.lat,
              lon: point.lon,
              fill: colorForVariable(variable, point.blended),
              label: `${formatNumber(point.blended)} ${units}`,
            }))}
          />
        </div>
        <aside className="flex flex-col gap-3">
          {active && (
            <section className="rounded-xl border border-line bg-panel p-4">
              <div className="text-xs uppercase tracking-widest text-mist">{active.state}</div>
              <h2 className="text-xl font-semibold">{active.name}</h2>
              <p className="mt-1 text-xs text-mist">
                {active.terrain} · {regimeLabel(active.regime)} · {active.season.replaceAll("_", " ")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
                <Stat label="Blend" value={`${formatNumber(active.blended)} ${units}`} accent />
                <Stat label="Truth" value={`${formatNumber(active.truth)} ${units}`} />
                <Stat label="NWP" value={formatNumber(active.nwp)} />
                <Stat label="AI" value={formatNumber(active.ai)} />
                <Stat label="Ensemble" value={formatNumber(active.ensemble)} />
                <Stat label="Raw blend" value={formatNumber(active.blended_raw)} />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-mist">
                  <span>Weights</span>
                  <span className="font-mono normal-case tracking-normal text-foam">{active.dominant}</span>
                </div>
                <WeightBar point={active} />
                <div className="mt-1 flex justify-between font-mono text-[11px] text-mist">
                  <span>NWP {(active.w_nwp * 100).toFixed(0)}%</span>
                  <span>AI {(active.w_ai * 100).toFixed(0)}%</span>
                  <span>ENS {(active.w_ensemble * 100).toFixed(0)}%</span>
                </div>
              </div>
            </section>
          )}
          <section className="min-h-[240px] flex-1 rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase tracking-widest text-mist">
              {series ? `${series.name} · ${lead / 24} day lead` : "Time series"}
            </div>
            <div className="h-56">
              {series && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series.points}>
                    <CartesianGrid stroke="#1e3a4c" vertical={false} />
                    <XAxis dataKey="valid_time" hide />
                    <YAxis stroke="#93a8b8" fontSize={11} width={36} />
                    <Tooltip contentStyle={{ background: "#0e1c28", border: "1px solid #1e3a4c", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="truth" name="Truth" stroke="#e7f2f4" dot={false} strokeWidth={1.6} />
                    <Line type="monotone" dataKey="blended" name="Blend" stroke={SOURCE_COLOR.BLENDED} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="nwp" name="NWP" stroke={SOURCE_COLOR.NWP} dot={false} strokeWidth={1} />
                    <Line type="monotone" dataKey="ai" name="AI" stroke={SOURCE_COLOR.AI} dot={false} strokeWidth={1} />
                    <Line type="monotone" dataKey="ensemble" name="Ens" stroke={SOURCE_COLOR.ENSEMBLE} dot={false} strokeWidth={1} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-ink px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-mist">{label}</div>
      <div className={accent ? "text-cyan" : "text-foam"}>{value}</div>
    </div>
  );
}
