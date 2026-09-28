import { SeverityPill } from "@/components/severity-pill";
import { ConfidenceBadge } from "@/components/confidence-badge";

export function AdvisoryCard({
  title,
  message,
  reason,
  action,
  severity,
  confidence,
  disclaimer,
  status,
  validOn,
}: {
  title: string;
  message: string;
  reason?: string;
  action?: string;
  severity: string;
  confidence?: number | null;
  disclaimer: string;
  status?: string;
  validOn?: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityPill severity={severity} />
        {status ? <span className="text-xs uppercase tracking-wide text-muted">{status}</span> : null}
        <ConfidenceBadge score={confidence ?? null} />
      </div>
      <h3 className="mt-3 font-serif text-xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink">{message}</p>
      {reason ? <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">Reason. </span>{reason}</p> : null}
      {action ? <p className="mt-1 text-sm text-muted"><span className="font-semibold text-ink">Action. </span>{action}</p> : null}
      {validOn ? <p className="mt-2 text-xs text-muted">Valid for {validOn.slice(0, 10)}</p> : null}
      <p className="mt-3 text-xs leading-5 text-muted">{disclaimer}</p>
    </article>
  );
}
