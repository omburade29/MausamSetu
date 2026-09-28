"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Meta } from "@/lib/types";

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.meta().then(setMeta).catch((err: Error) => setError(err.message));
  }, []);

  return { meta, error, reload: () => api.meta().then(setMeta) };
}

export function Blocked({ message }: { message: string }) {
  return (
    <div className="m-6 rounded-xl border border-alert/40 bg-panel p-6 text-sm leading-relaxed text-foam">
      <div className="font-mono text-xs uppercase tracking-widest text-alert">API unavailable</div>
      <p className="mt-2 text-mist">{message}</p>
      <p className="mt-3 font-mono text-xs text-mist">
        python generate_data.py && python train_blender.py
        <br />
        uvicorn api.main:app --port 8010
      </p>
    </div>
  );
}

export function PageHead({ kicker, title, aside }: { kicker: string; title: string; aside?: string }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">{kicker}</div>
        <h1 className="mt-1 text-2xl font-semibold text-foam">{title}</h1>
      </div>
      {aside && <p className="max-w-xl text-sm text-mist">{aside}</p>}
    </header>
  );
}
