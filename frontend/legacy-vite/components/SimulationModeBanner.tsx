export default function SimulationModeBanner({ note }: { note?: string | null }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Demo Mode · Simulated data · SIH26074 Prototype · Team Hexabyte</p>
      <p className="mt-1 text-amber-900">
        Demo values may be simulated. Source tag: demo_simulation. Finer spatial detail does not automatically imply
        higher forecast accuracy.
      </p>
      {note && <p className="mt-2 font-medium text-amber-950">{note}</p>}
    </div>
  )
}
