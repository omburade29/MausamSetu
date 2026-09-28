"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useRequireAuth } from "@/lib/auth";

export default function ModelsPage() {
  useRequireAuth(["admin"]);
  const client = useQueryClient();
  const models = useQuery({ queryKey: ["models"], queryFn: api.models });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function train() {
    setBusy(true);
    setNote("Training on the chronological split. This can take a minute.");
    try {
      const result = await api.train();
      setNote(`Saved ${result.data.model_version}. ${Object.values(result.data.statements).join(" ")}`);
      client.invalidateQueries({ queryKey: ["models"] });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Training failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">Model training</h1>
        <p className="mt-1 text-sm text-muted">Separate models are fit for rainfall, temperature, humidity, wind, and cloud cover. Rainfall uses a rain occurrence stage and an amount stage.</p>
      </header>
      <div className="flex gap-2">
        <Button type="button" disabled={busy} onClick={train}>{busy ? "Training" : "Train models"}</Button>
        <Button type="button" variant="outline" onClick={async () => { const result = await api.generateForecasts(); setNote(`Stored ${result.data.stored} panchayat estimates.`); }}>Generate estimates</Button>
      </div>
      {note ? <p className="text-sm">{note}</p> : null}
      {models.isLoading ? <LoadingSkeleton /> : null}
      {models.error ? <ErrorState message={(models.error as Error).message} onRetry={() => models.refetch()} /> : null}
      <DataTable
        columns={["Variable", "Version", "RMSE", "Baseline RMSE", "Improvement %", "Statement"]}
        rows={(models.data?.data ?? []).map((row) => [row.variable, row.model_version, formatNumber(row.rmse, 2), formatNumber(row.baseline_rmse, 2), formatNumber(row.improvement_percent, 1), row.statement])}
      />
    </div>
  );
}
