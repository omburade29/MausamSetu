import { STATEMENTS } from "@/content/copy"

export default function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs leading-5 text-slate-500">
        {STATEMENTS.join(" ")}
      </p>
    )
  }
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700">Responsible use</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {STATEMENTS.map((statement) => (
          <li key={statement} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-skybrand-500" />
            <span>{statement}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
