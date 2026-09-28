"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapLayerControl } from "@/components/map-layer-control";
import { MapFallbackTable } from "@/components/map-fallback-table";
import { PanchayatSelector } from "@/components/panchayat-selector";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { useHierarchy } from "@/hooks/use-hierarchy";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";

const WeatherMap = dynamic(() => import("@/components/weather-map"), {
  ssr: false,
  loading: () => <LoadingSkeleton lines={6} />,
});

export default function MapPage() {
  const { t } = useI18n();
  const location = useHierarchy();
  const [layer, setLayer] = useState("downscaled");
  const [variable, setVariable] = useState("rainfall_mm");
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (location.panchayatId) setSelected(Number(location.panchayatId));
  }, [location.panchayatId]);
  const [forceFallback, setForceFallback] = useState(false);
  const query = useQuery({
    queryKey: ["map", location.date, variable, layer, location.blockId],
    queryFn: () => api.map({ on: location.date, variable, layer, block_id: location.blockId ? Number(location.blockId) : undefined }),
  });
  const collection = query.data?.data;
  const rows = (collection?.features ?? []).map((feature) => ({
    name: feature.properties.name,
    value: feature.properties.value,
    unit: feature.properties.unit,
    note: feature.properties.note,
  }));
  const active = collection?.features.find((feature) => feature.properties.id === selected)?.properties;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Spatial layers</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Panchayat map</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">The map shows every panchayat in the selected block. Colored areas are demonstration cells. Dots are location-list coordinates. A value is a model estimate unless the note says it is a block forecast or an observation.</p>
      </header>
      <PanchayatSelector
        states={location.states}
        districts={location.districts}
        blocks={location.blocks}
        panchayats={location.panchayats}
        value={location}
        onChange={(next) => {
          if (next.stateId !== location.stateId) location.setStateId(next.stateId);
          else if (next.districtId !== location.districtId) location.setDistrictId(next.districtId);
          else if (next.blockId !== location.blockId) location.setBlockId(next.blockId);
          else location.setPanchayatId(next.panchayatId);
        }}
        labels={{ state: t("state"), district: t("district"), block: t("block"), panchayat: t("panchayat") }}
      />
      <MapLayerControl layer={layer} variable={variable} onLayer={setLayer} onVariable={setVariable} />
      <label className="block max-w-xs text-sm">
        Date
        <input className="mt-1 h-10 w-full rounded-xl border border-line px-3" type="date" value={location.date} onChange={(event) => location.setDate(event.target.value)} />
      </label>
      {query.isLoading ? <LoadingSkeleton lines={6} /> : null}
      {query.error ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : null}
      {collection && !forceFallback ? (
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_300px]">
          <MapBoundary rows={rows} onFail={() => setForceFallback(true)}>
            <WeatherMap
              collection={collection}
              selectedId={selected}
              onSelect={(id) => {
                setSelected(id);
                location.setPanchayatId(String(id));
              }}
            />
          </MapBoundary>
          <VillageRank
            features={collection.features}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      ) : null}
      {collection && forceFallback ? <MapFallbackTable rows={rows} /> : null}
      <Legend />
      {active ? (
        <aside className="rounded-2xl border border-line bg-card p-4">
          <h2 className="font-serif text-2xl">{active.name}</h2>
          <p className="mt-1 text-sm">Value {formatNumber(active.value)} {active.unit}</p>
          <div className="mt-2"><ConfidenceBadge score={active.confidence_score} /></div>
          <p className="mt-2 text-sm text-muted">{active.note}</p>
          <p className="mt-2 text-xs text-muted">{active.data_source_label}</p>
          {active.generated_at ? <p className="text-xs text-muted">Generated {active.generated_at}</p> : null}
          {active.model_version ? <p className="text-xs text-muted">Model {active.model_version}</p> : null}
        </aside>
      ) : null}
    </div>
  );
}

function VillageRank({
  features,
  selected,
  onSelect,
}: {
  features: { properties: { id: number; name: string; value: number | null; unit: string; low_confidence: boolean } }[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const ranked = [...features].sort((a, b) => (b.properties.value ?? -Infinity) - (a.properties.value ?? -Infinity));
  return (
    <aside className="rounded-xl border border-line bg-card p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Villages on this layer</p>
      <ol className="mt-3 max-h-[520px] space-y-1 overflow-auto">
        {ranked.map((feature, index) => {
          const active = feature.properties.id === selected;
          return (
            <li key={feature.properties.id}>
              <button
                type="button"
                onClick={() => onSelect(feature.properties.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                  active ? "bg-field text-white" : "hover:bg-paper"
                }`}
              >
                <span>
                  <span className={active ? "text-slate-300" : "text-muted"}>{index + 1}. </span>
                  {feature.properties.name}
                </span>
                <span className="shrink-0 font-medium">
                  {formatNumber(feature.properties.value)} {feature.properties.unit}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span className="inline-flex items-center gap-2"><i className="h-3 w-6 rounded bg-stone-300" /> Lower or missing</span>
      <span className="inline-flex items-center gap-2"><i className="h-3 w-6 rounded bg-teal-800" /> Higher value</span>
      <span>Gray means unavailable or low information, and the note says which.</span>
    </div>
  );
}

class MapBoundary extends Component<{ children: React.ReactNode; rows: { name: string; value: number | null; unit: string; note?: string }[]; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    if (this.state.failed) return <MapFallbackTable rows={this.props.rows} />;
    return this.props.children;
  }
}
