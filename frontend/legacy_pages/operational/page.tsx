"use client";

import { useState } from "react";
import { Blocked, PageHead, useMeta } from "@/components/ApiGate";
import { api } from "@/lib/api";
import type { OperationalResult } from "@/lib/types";

export default function OperationalPage() {
  const { meta, error, reload } = useMeta();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OperationalResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function runCycle() {
    setRunning(true);
    setFailure(null);
    try {
      const summary = await api.runCycle();
      setResult(summary);
      await reload();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Cycle failed");
    } finally {
      setRunning(false);
    }
  }

  if (error) return <Blocked message={error} />;
  if (!meta) return <div className="p-8 text-sm text-mist">Loading operations desk…</div>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      <PageHead
        kicker="Routine cycle"
        title="Operations"
        aside="Appends the next synthetic valid day, then re-issues weights from the saved meta-learner. Retraining stays a separate step."
      />
      <section className="rounded-xl border border-line bg-panel p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact label="Archive" value={`${meta.date_min} → ${meta.date_max}`} />
          <Fact label="Rows" value={meta.n_rows.toLocaleString()} />
          <Fact label="Engine" value={meta.engine} />
        </div>
        <button
          type="button"
          onClick={runCycle}
          disabled={running}
          className="mt-5 rounded-md bg-cyan px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          {running ? "Blending cycle…" : "Run next blending cycle"}
        </button>
        {failure && <p className="mt-3 text-sm text-alert">{failure}</p>}
      </section>

      {result && (
        <section className="mt-4 rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">{result.message}</h2>
          <p className="mt-1 font-mono text-xs text-mist">New valid time {result.appended_valid_time}</p>
          <div className="mt-4 space-y-2">
            {result.alerts.length === 0 && <p className="text-sm text-mist">Day-1 guidance has no extreme alerts.</p>}
            {result.alerts.map((alert) => (
              <div key={`${alert.station_id}-${alert.event}`} className="flex items-center justify-between rounded-md bg-ink px-3 py-2 text-sm">
                <span>
                  {alert.name}
                  <span className="ml-2 text-mist">{alert.event.replaceAll("_", " ")}</span>
                </span>
                <span className="font-mono text-xs uppercase text-ens">
                  {alert.severity} {(alert.probability * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 rounded-xl border border-line bg-panel/70 p-5 text-sm leading-relaxed text-mist">
        The same cycle is available from the shell:
        <pre className="mt-2 overflow-auto rounded-md bg-ink p-3 font-mono text-xs text-foam">python run_operational.py</pre>
        Real-time operations would replace <span className="font-mono text-foam">append_next_day()</span> with a
        fetch from your NWP, AI, and ensemble archives, then call the same inference path.
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-mist">{label}</div>
      <div className="mt-1 font-mono text-sm text-foam">{value}</div>
    </div>
  );
}
