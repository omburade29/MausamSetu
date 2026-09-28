"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadDropzone } from "@/components/upload-dropzone";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui";
import { ErrorState } from "@/components/error-state";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

const uploads = [
  { label: "Historical observations CSV", path: "/api/data/upload/observations", accept: ".csv", template: "observations" },
  { label: "Block forecast CSV", path: "/api/data/upload/block-forecasts", accept: ".csv", template: "block-forecasts" },
  { label: "Panchayat GeoJSON", path: "/api/data/upload/panchayat-boundaries", accept: ".json,.geojson", template: "" },
  { label: "Environment CSV, raster, or water GeoJSON", path: "/api/data/upload/environmental-data", accept: ".csv,.json,.geojson,.tif,.tiff", template: "environment" },
];

export default function DataPage() {
  useRequireAuth(["admin"]);
  const client = useQueryClient();
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: api.jobs });
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<object[]>([]);

  async function send(path: string, file: File) {
    setNote("");
    try {
      const result = await api.upload(path, file);
      setNote(result.data.message);
      setErrors((result.data.errors || []).map((item) => item.message));
      setPreview(result.data.preview || []);
      client.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function downloadTemplate(name: string) {
    const result = await api.template(name);
    const blob = new Blob([result.data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Data management</h1>
        <p className="mt-1 text-sm text-muted">Uploads are validated before rows are stored. Invalid rows are listed and are not silently dropped.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {uploads.map((item) => (
          <div key={item.path} className="space-y-2">
            <UploadDropzone label={item.label} accept={item.accept} onFile={(file) => send(item.path, file)} />
            {item.template ? <button className="text-sm underline" type="button" onClick={() => downloadTemplate(item.template)}>Download sample CSV</button> : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={async () => { const result = await api.features(); setNote(result.data.message); }}>Build features</Button>
        <Button type="button" variant="outline" onClick={async () => { const result = await api.train(); setNote(`Trained ${result.data.model_version}`); }}>Train model</Button>
      </div>
      {note ? <p className="text-sm">{note}</p> : null}
      {errors.length ? <ErrorState message={errors.join(" ")} /> : null}
      {preview.length ? <DataTable columns={Object.keys(preview[0])} rows={preview.slice(0, 8).map((row) => Object.values(row).map((value) => String(value)))} /> : null}
      {jobs.error ? <ErrorState message={(jobs.error as Error).message} /> : null}
      <h2 className="font-serif text-2xl">Recent jobs</h2>
      <DataTable
        columns={["Id", "Type", "Status", "Message"]}
        rows={(jobs.data?.data ?? []).map((job) => [job.id, job.job_type, job.status, job.message])}
      />
    </div>
  );
}
