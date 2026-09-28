"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function AdminPage() {
  useRequireAuth(["admin"]);
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const data = status.data?.data;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">Administration</h1>
        <p className="mt-1 text-sm text-muted">System health, cache, and the audit trail for uploads, training, and advisory publication.</p>
      </header>
      {status.isLoading ? <LoadingSkeleton /> : null}
      {status.error ? <ErrorState message={(status.error as Error).message} onRetry={() => status.refetch()} /> : null}
      {data ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data)
            .filter(([key]) => key !== "recent_audit")
            .map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-line bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted">{key.replaceAll("_", " ")}</dt>
                <dd className="mt-1 text-sm">{String(value)}</dd>
              </div>
            ))}
        </dl>
      ) : null}
      <h2 className="font-serif text-2xl">Audit log</h2>
      <DataTable
        columns={["Action", "Entity", "Detail", "When"]}
        rows={((data?.recent_audit as { action: string; entity: string; detail: string; created_at: string }[]) || []).map((row) => [row.action, row.entity, row.detail, row.created_at])}
      />
    </div>
  );
}
