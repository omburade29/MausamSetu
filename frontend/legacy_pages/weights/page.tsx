"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Blocked, PageHead, useMeta } from "@/components/ApiGate";
import { Controls } from "@/components/Controls";
import { StationMap } from "@/components/StationMap";
import { api } from "@/lib/api";
import { SOURCE_COLOR, leadLabel } from "@/lib/scales";
import type { ForecastPoint, WeightProfile } from "@/lib/types";

export default function WeightsPage() {
  const { meta, error } = useMeta();
  const [variable, setVariable] = useState("temperature");
  const [lead, setLead] = useState(24);
  const [date, setDate] = useState("");
  const [points, setPoints] = useState<ForecastPoint[]>([]);
  const [profile, setProfile] = useState<WeightProfile | null>(null);
  const [selected, setSelected] = useState("MUM");

  useEffect(() => {
    if (meta && !date) setDate(meta.default_date);
  }, [meta, date]);

  useEffect(() => {
    if (!date) return;
    api.weights(variable, lead, date).then((payload) => setPoints(payload.points)).catch(() => setPoints([]));
    api.weightProfile(variable, date).then(setProfile).catch(() => setProfile(null));
  }, [variable, lead, date]);

  const active = points.find((point) => point.station_id === selected) || points[0];
  const chartData = useMemo(
    () =>
      (profile?.by_lead || []).map((row) => ({
        lead: leadLabel(row.lead_time_hours),
        NWP: row.w_nwp,
        AI: row.w_ai,
        Ensemble: row.w_ensemble,
      })),
    [profile],
  );

  if (error) return <Blocked message={error} />;
  if (!meta || !date) return <div className="p-8 text-sm text-mist">Loading weights…</div>;

  return (
    <main className="px-6 py-6">
      <PageHead
        kicker="Meta-learner"
        title="Who the blend trusts"
        aside="Station colour is the source with the highest weight. Bars are the domain-mean weight at each lead for this valid date."
      />
      <Controls meta={meta} variable={variable} lead={lead} date={date} onVariable={setVariable} onLead={setLead} onDate={setDate} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="h-[680px] rounded-xl border border-line bg-panel p-3">
          <StationMap
            selectedId={active?.station_id}
            onSelect={setSelected}
            stations={points.map((point) => ({
              station_id: point.station_id,
              name: point.name,
              lat: point.lat,
              lon: point.lon,
              fill: SOURCE_COLOR[point.dominant],
              label: `${point.dominant} ${(Math.max(point.w_nwp, point.w_ai, point.w_ensemble) * 100).toFixed(0)}%`,
            }))}
          />
          <div className="mt-2 flex gap-4 px-2 text-xs text-mist">
            {["NWP", "AI", "ENSEMBLE"].map((source) => (
              <span key={source} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLOR[source] }} />
                {source}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold">Mean weight by lead</h2>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#1e3a4c" vertical={false} />
                  <XAxis dataKey="lead" stroke="#93a8b8" fontSize={12} />
                  <YAxis
                    stroke="#93a8b8"
                    fontSize={12}
                    domain={[0, 1]}
                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                    allowDataOverflow
                  />
                  <Tooltip contentStyle={{ background: "#0e1c28", border: "1px solid #1e3a4c" }} />
                  <Legend />
                  <Bar dataKey="NWP" stackId="w" fill={SOURCE_COLOR.NWP} />
                  <Bar dataKey="AI" stackId="w" fill={SOURCE_COLOR.AI} />
                  <Bar dataKey="Ensemble" stackId="w" fill={SOURCE_COLOR.ENSEMBLE} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold">{active ? active.name : "Station"}</h2>
            {active && (
              <ul className="mt-3 space-y-2 font-mono text-sm">
                <li className="flex justify-between"><span className="text-nwp">NWP</span><span>{(active.w_nwp * 100).toFixed(1)}%</span></li>
                <li className="flex justify-between"><span className="text-ai">AI</span><span>{(active.w_ai * 100).toFixed(1)}%</span></li>
                <li className="flex justify-between"><span className="text-ens">Ensemble</span><span>{(active.w_ensemble * 100).toFixed(1)}%</span></li>
              </ul>
            )}
            <p className="mt-3 text-xs leading-relaxed text-mist">
              Weights depend on terrain, season, lagged regime, and lead. They do not peek at today’s observation.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
