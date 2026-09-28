"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdvisoryCard } from "@/components/advisory-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function AdvisoriesPage() {
  const { user } = useAuth();
  const location = useHierarchy();
  const client = useQueryClient();
  const id = Number(location.panchayatId);
  const advisories = useQuery({ queryKey: ["advisories", id], queryFn: () => api.advisories(id), enabled: id > 0 });
  const crops = useQuery({ queryKey: ["crops"], queryFn: api.crops });
  const [cropId, setCropId] = useState("");
  const [stageId, setStageId] = useState("");
  const [soil, setSoil] = useState("loam");
  const [message, setMessage] = useState("");
  const crop = crops.data?.data.find((item) => String(item.id) === cropId);

  async function generate() {
    setMessage("");
    try {
      await api.generateAdvisory({
        panchayat_id: id,
        crop_id: Number(cropId),
        crop_stage_id: stageId ? Number(stageId) : null,
        soil_type: soil,
        forecast_date: location.date,
      });
      setMessage("Draft advisories created. An officer should review them before publication.");
      client.invalidateQueries({ queryKey: ["advisories", id] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate advisories");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Crop advisories</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">Rules are transparent and configurable. Output is general decision support, not an official prescription.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">Panchayat
          <select className="mt-1 h-10 w-full rounded-xl border border-line px-3" value={location.panchayatId} onChange={(event) => location.setPanchayatId(event.target.value)}>
            {location.panchayats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Crop
          <select className="mt-1 h-10 w-full rounded-xl border border-line px-3" value={cropId} onChange={(event) => { setCropId(event.target.value); setStageId(""); }}>
            <option value="">Select</option>
            {(crops.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Growth stage
          <select className="mt-1 h-10 w-full rounded-xl border border-line px-3" value={stageId} onChange={(event) => setStageId(event.target.value)}>
            <option value="">Select</option>
            {(crop?.stages ?? []).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Soil
          <select className="mt-1 h-10 w-full rounded-xl border border-line px-3" value={soil} onChange={(event) => setSoil(event.target.value)}>
            {["loam", "clay loam", "sandy loam", "black cotton soil"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <Button type="button" onClick={generate} disabled={!cropId || !id}>Generate draft advisory</Button>
      {message ? <p className="text-sm">{message}</p> : null}
      {advisories.isLoading ? <LoadingSkeleton /> : null}
      {advisories.error ? <ErrorState message={(advisories.error as Error).message} onRetry={() => advisories.refetch()} /> : null}
      {!advisories.isLoading && (advisories.data?.data.length ?? 0) === 0 ? <EmptyState title="No advisories for this panchayat." /> : null}
      <div className="space-y-3">
        {(advisories.data?.data ?? []).map((item) => (
          <div key={item.id} className="space-y-2">
            <AdvisoryCard title={item.title} message={item.message} reason={item.reason} action={item.action} severity={item.severity} confidence={item.confidence_score} disclaimer={item.disclaimer} status={item.status} validOn={item.forecast_date} />
            {user && user.role !== "farmer" && item.status === "draft" ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={async () => { await api.reviewAdvisory(item.id, "approve", "Reviewed in the advisory screen."); client.invalidateQueries({ queryKey: ["advisories", id] }); }}>Mark reviewed</Button>
              </div>
            ) : null}
            {user && user.role !== "farmer" && item.status === "reviewed" ? (
              <Button type="button" size="sm" onClick={async () => { await api.publishAdvisory(item.id); client.invalidateQueries({ queryKey: ["advisories", id] }); }}>Publish</Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
