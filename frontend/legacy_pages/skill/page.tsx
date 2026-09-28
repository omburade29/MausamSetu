"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
import { api } from "@/lib/api";
import { SOURCE_COLOR, leadLabel } from "@/lib/scales";
import type { Metrics } from "@/lib/types";

const MODELS = ["NWP", "AI", "ENSEMBLE", "BLENDED"];

export default function SkillPage() {
  const { meta, error } = useMeta();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [variable, setVariable] = useState("rainfall");

  useEffect(() => {
    api.metrics().then(setMetrics).catch(() => setMetrics(null));
  }, []);

  const rmseBars = useMemo(() => {
    if (!metrics) return [];
    return ["rainfall", "temperature", "wind"].map((name) => {
      const row: Record<string, string | number> = { variable: name };
      for (const model of MODELS) {
        const match = metrics.by_variable.find((item) => item.variable === name && item.model === model);
        row[model] = match?.rmse ?? 0;
      }
      return row;
    });
  }, [metrics]);

  const leadLines = useMemo(() => {
    if (!metrics) return [];
    const leads = Array.from(new Set(metrics.by_lead.map((row) => row.lead_time_hours))).sort((a, b) => a - b);
    return leads.map((lead) => {
      const row: Record<string, string | number> = { lead: leadLabel(lead) };
      for (const model of MODELS) {
        const match = metrics.by_lead.find(
          (item) => item.variable === variable && item.lead_time_hours === lead && item.model === model,
        );
        row[model] = match?.rmse ?? 0;
      }
      return row;
    });
  }, [metrics, variable]);

  const csiBars = useMemo(() => {
    if (!metrics) return [];
    return metrics.extreme_scores
      .filter((row) => MODELS.includes(row.model))
      .reduce<Record<string, Record<string, string | number>>>((acc, row) => {
        acc[row.variable] = acc[row.variable] || { event: row.event.replaceAll("_", " ") };
        acc[row.variable][row.model] = row.csi ?? 0;
        return acc;
      }, {});
  }, [metrics]);

  if (error) return <Blocked message={error} />;
  if (!meta || !metrics) return <div className="p-8 text-sm text-mist">Loading skill scores…</div>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <PageHead
        kicker="Verification"
        title="Held-out skill"
        aside={metrics.note}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        {Object.entries(metrics.summary.variables).map(([name, info]) => (
          <article key={name} className="rounded-xl border border-line bg-panel p-4">
            <div className="text-xs uppercase tracking-widest text-mist">{name}</div>
            <div className="mt-1 font-mono text-2xl text-cyan">
              {info.improvement_pct > 0 ? "+" : ""}
              {info.improvement_pct}%
            </div>
            <p className="mt-1 text-xs text-mist">
              RMSE {info.blended_rmse} vs best individual {info.best_individual} ({info.best_individual_rmse}) {meta.units[name]}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="RMSE by variable">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rmseBars}>
              <CartesianGrid stroke="#1e3a4c" vertical={false} />
              <XAxis dataKey="variable" stroke="#93a8b8" fontSize={12} />
              <YAxis stroke="#93a8b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0e1c28", border: "1px solid #1e3a4c" }} />
              <Legend />
              {MODELS.map((model) => (
                <Bar key={model} dataKey={model} fill={SOURCE_COLOR[model]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title={`RMSE vs lead · ${variable}`}
          extra={
            <select
              value={variable}
              onChange={(event) => setVariable(event.target.value)}
              className="rounded-md border border-line bg-ink px-2 py-1 text-xs"
            >
              {meta.variables.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={leadLines}>
              <CartesianGrid stroke="#1e3a4c" vertical={false} />
              <XAxis dataKey="lead" stroke="#93a8b8" fontSize={12} />
              <YAxis stroke="#93a8b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0e1c28", border: "1px solid #1e3a4c" }} />
              <Legend />
              {MODELS.map((model) => (
                <Line key={model} type="monotone" dataKey={model} stroke={SOURCE_COLOR[model]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold">Extreme-event critical success index</h2>
        <p className="mt-1 text-xs text-mist">Higher is better. Hits, misses, and false alarms use the same thresholds as the guidance page.</p>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={Object.values(csiBars)}>
              <CartesianGrid stroke="#1e3a4c" vertical={false} />
              <XAxis dataKey="event" stroke="#93a8b8" fontSize={12} />
              <YAxis stroke="#93a8b8" fontSize={12} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: "#0e1c28", border: "1px solid #1e3a4c" }} />
              <Legend />
              {MODELS.map((model) => (
                <Bar key={model} dataKey={model} fill={SOURCE_COLOR[model]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 overflow-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wider text-mist">
            <tr>
              <th className="px-3 py-2">Variable</th>
              <th className="px-3 py-2">Terrain</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">RMSE</th>
              <th className="px-3 py-2">MAE</th>
              <th className="px-3 py-2">Corr</th>
            </tr>
          </thead>
          <tbody>
            {metrics.by_terrain
              .filter((row) => MODELS.includes(row.model))
              .map((row) => (
                <tr key={`${row.variable}-${row.terrain}-${row.model}`} className="border-t border-line">
                  <td className="px-3 py-2">{row.variable}</td>
                  <td className="px-3 py-2">{row.terrain}</td>
                  <td className="px-3 py-2" style={{ color: SOURCE_COLOR[row.model] }}>{row.model}</td>
                  <td className="px-3 py-2 font-mono">{row.rmse.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{row.mae.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{row.correlation?.toFixed(3) ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function ChartCard({
  title,
  children,
  extra,
}: {
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {extra}
      </div>
      <div className="h-64">{children}</div>
    </section>
  );
}
