"use client";

import { useState } from "react";
import { briefText, fieldCue, rankShifts, type BlockShift, type CueTone } from "@/lib/field-brief";
import { formatDay } from "@/lib/format";
import type { CompareVariable, Forecast } from "@/types";

const toneClass: Record<CueTone, string> = {
  severe: "border-red-200 bg-red-50 text-severe",
  watch: "border-amber-200 bg-amber-50 text-watch",
  ok: "border-emerald-200 bg-emerald-50 text-ok",
  neutral: "border-line bg-white text-ink",
};

export function FieldBrief({
  place,
  date,
  row,
  days,
  shifts,
  onPickDate,
}: {
  place: string;
  date: string;
  row: Forecast;
  days: Forecast[];
  shifts: BlockShift[];
  onPickDate: (day: string) => void;
}) {
  const cue = fieldCue(row);
  const lead = shifts[0] ?? null;
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");
  const start = Math.max(0, days.findIndex((day) => formatDay(day.forecast_time) === date));
  const windowDays = days.slice(start, start + 5);

  async function copy() {
    const text = briefText(place, date, row, lead);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFallback("");
    } catch {
      setCopied(false);
      setFallback(text);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <article className={`rounded-xl border p-5 shadow-card ${toneClass[cue.tone]}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">Today&apos;s field brief</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{cue.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6">{cue.detail}</p>
        {lead ? <p className="mt-3 text-sm font-medium">{lead.sentence}</p> : null}
        <p className="mt-3 text-xs">
          {row.low_confidence
            ? "Low confidence — verify locally before field work."
            : `Model confidence ${Math.round(row.confidence_score * 100)}%.`}{" "}
          Desk cue from the panchayat estimate. Not an official IMD forecast.
        </p>
        <button className="mt-4 rounded-lg bg-field px-3 py-2 text-xs font-semibold text-white" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy brief"}
        </button>
        {fallback ? (
          <textarea className="mt-3 h-28 w-full rounded-lg border border-line bg-white p-2 text-xs text-ink" readOnly value={fallback} />
        ) : null}
      </article>
      <div className="rounded-xl border border-line bg-card p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Five-day windows</p>
        <ul className="mt-3 space-y-2">
          {windowDays.map((day) => {
            const next = fieldCue(day);
            const iso = formatDay(day.forecast_time);
            const active = iso === date;
            return (
              <li key={iso}>
                <button
                  type="button"
                  onClick={() => onPickDate(iso)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    active ? "bg-field text-white" : "bg-paper text-ink hover:bg-slate-100"
                  }`}
                >
                  <span className="font-medium">{iso.slice(5)}</span>
                  <span className={active ? "text-slate-100" : "text-muted"}>{next.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function BlockShiftBoard({ variables }: { variables: CompareVariable[] }) {
  const shifts = rankShifts(variables).slice(0, 6);
  if (!shifts.length) return null;
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Village versus block</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{shifts[0].sentence}</h2>
      <p className="mt-1 text-sm text-muted">Each bar is the panchayat estimate relative to the coarse block input for this day.</p>
      <ul className="mt-4 space-y-3">
        {shifts.map((item) => {
          const width = Math.min(100, Math.abs(item.percent ?? 0));
          const higher = item.difference > 0;
          return (
            <li key={item.variable}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted">
                  {item.difference > 0 ? "+" : ""}
                  {item.difference.toFixed(1)} {item.unit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper">
                <div
                  className={`h-full rounded-full ${higher ? "bg-warn" : "bg-leaf"}`}
                  style={{ width: `${Math.max(width, item.difference === 0 ? 0 : 4)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
