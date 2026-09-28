import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import AdvisoryCard from "@/components/AdvisoryCard"
import Disclaimer from "@/components/Disclaimer"
import EmptyState from "@/components/EmptyState"
import SimulationModeBanner from "@/components/SimulationModeBanner"
import { useApp } from "@/context/AppContext"
import type { RiskLevel } from "@/types"

export default function Advisory() {
  const { run, staleRun } = useApp()
  const [priority, setPriority] = useState<"All" | RiskLevel>("All")
  const [query, setQuery] = useState("")
  const cards = useMemo(() => {
    if (!run || staleRun) return []
    return run.advisories.filter((item) => (priority === "All" || item.risk_level === priority) && item.panchayat.toLowerCase().includes(query.toLowerCase()))
  }, [priority, query, run, staleRun])

  if (!run || staleRun) {
    return (
      <EmptyState
        title="Advisories are generated from a downscaled run"
        message="Choose a block and run downscaling. Cards use prototype thresholds and must be checked against local guidance."
        action={<Link to="/workspace" className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Open workspace</Link>}
      />
    )
  }

  return (
    <div className="rise space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">Advisory center</p>
        <h2 className="text-2xl font-semibold text-navy-900">Localized farm actions for {run.geography.block_name}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Rules fire from the downscaled rainfall, temperature, wind, and uncertainty. They are prototype bands for the demonstration, not an alert product.
        </p>
      </div>
      <SimulationModeBanner />
      <div className="flex flex-wrap gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Panchayat" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as "All" | RiskLevel)}>
          <option value="All">All risk levels</option>
          <option value="High">High</option>
          <option value="Moderate">Moderate</option>
          <option value="Low">Low</option>
        </select>
      </div>
      {cards.length === 0 ? (
        <EmptyState title="No advisory cards match" message="Clear the search or choose another risk level." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <AdvisoryCard key={`${card.panchayat_id}-${card.weather_condition}`} advisory={card} />
          ))}
        </div>
      )}
      <Disclaimer />
    </div>
  )
}
