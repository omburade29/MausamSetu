"use client";

import type { Meta } from "@/lib/types";
import { leadLabel } from "@/lib/scales";

const LABELS: Record<string, string> = {
  rainfall: "Rainfall",
  temperature: "Temperature",
  wind: "Wind",
};

export function Controls({
  meta,
  variable,
  lead,
  date,
  onVariable,
  onLead,
  onDate,
  showVariable = true,
}: {
  meta: Meta;
  variable: string;
  lead: number;
  date: string;
  onVariable: (value: string) => void;
  onLead: (value: number) => void;
  onDate: (value: string) => void;
  showVariable?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/80 px-3 py-2">
      {showVariable && (
        <div className="flex rounded-lg bg-ink p-1">
          {meta.variables.map((item) => (
            <button
              key={item}
              className={item === variable ? "seg seg-on" : "seg"}
              onClick={() => onVariable(item)}
              type="button"
            >
              {LABELS[item] || item}
            </button>
          ))}
        </div>
      )}
      <div className="flex rounded-lg bg-ink p-1">
        {meta.leads.map((item) => (
          <button
            key={item}
            className={item === lead ? "seg seg-on" : "seg"}
            onClick={() => onLead(item)}
            type="button"
          >
            {leadLabel(item)}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-mist">
        Valid date
        <input
          type="date"
          min={meta.date_min}
          max={meta.date_max}
          value={date}
          onChange={(event) => onDate(event.target.value)}
          className="min-w-[11rem] shrink-0 rounded-md border border-line bg-ink px-2 py-1.5 font-mono text-sm text-foam"
        />
      </label>
    </div>
  );
}
