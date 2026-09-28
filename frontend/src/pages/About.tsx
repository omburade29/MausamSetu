import Disclaimer from "@/components/Disclaimer"

const FLOW = [
  "Block forecast",
  "Spatial predictors",
  "Bounded local adjustment",
  "Panchayat estimate",
  "Uncertainty",
  "Validation",
  "Advisory",
]

export default function About() {
  return (
    <div className="rise space-y-4">
      <section className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-skybrand-600">SIH26074 · Team Hexabyte</p>
        <h2 className="mt-1 font-serif text-3xl text-navy-900">About MausamSetu</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          Smart India Hackathon problem SIH26074 asks how block-level weather forecasts can support agro-meteorological advisories at Panchayat scale. MausamSetu is a working prototype of that decision-support path. It does not claim to be an operational forecast system.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-semibold text-navy-900">Problem statement</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Public weather guidance is often issued for a block. Farms inside that block do not share the same elevation, land cover, soil moisture, vegetation, or distance from water. A single number can therefore hide local differences that matter for irrigation, fertilizer timing, drainage, and harvest protection.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-semibold text-navy-900">Why block data is not enough</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The advisory last mile in India is closer to the Panchayat or village than to the block polygon. Downscaling is an attempt to carry the block signal onto that finer geography. The attempt is useful only when the added detail is paired with uncertainty and with reference data that can prove, or disprove, a gain.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-semibold text-navy-900">Proposed approach</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The contextual model normalizes predictors inside the block, applies signed physical sensitivities, and bounds the adjustment so values stay in a plausible range. Rainfall and wind are multiplicative. Temperature and humidity are additive. A second option trains a small Random Forest on deterministic synthetic samples and reports impurity-based importance.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-semibold text-navy-900">What this is not</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            This is not dynamical downscaling, not a claim of guaranteed skill, and not an official warning system. Schematic polygons are not cadastral maps. Demo values are tagged demo_simulation.
          </p>
        </article>
      </section>
      <section className="card p-5">
        <h3 className="font-semibold text-navy-900">Architecture</h3>
        <ol className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
          {FLOW.map((step, index) => (
            <li key={step} className="rounded-xl bg-navy-900 px-3 py-3 text-sm font-medium text-white">
              {index + 1}. {step}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          React calls FastAPI. The service reads JSON and GeoJSON from the data folder, runs the deterministic engine, scores uncertainty, compares both the baseline and the downscaled series with a frozen simulated reference, writes advisories, and stores the run in SQLite. If the API is down, the browser repeats the contextual calculation so the presentation can continue.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-semibold text-navy-900">Data sources in this build</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>regions.json — one demonstration state, district, and block</li>
            <li>block_forecasts.json — five coarse daily values</li>
            <li>panchayats.geojson — schematic block and eight Panchayat polygons</li>
            <li>predictors.json — elevation, land cover, moisture, water distance, vegetation, with intentional gaps</li>
            <li>reference_values.json — independent simulated reference field, not observations</li>
          </ul>
        </article>
        <article className="card p-5">
          <h3 className="font-semibold text-navy-900">Prototype limitations</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>One schematic block, not a national boundary service</li>
            <li>Predictors and references are simulated</li>
            <li>Advisory thresholds are demonstration bands, not IMD criteria</li>
            <li>Random Forest importance is not a physical explanation</li>
            <li>A positive validation result on this sample is not operational skill</li>
          </ul>
        </article>
      </section>
      <section className="card p-5">
        <h3 className="font-semibold text-navy-900">Future production integration</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          The same contract can later ingest IMD block or district guidance, SRTM elevation, Bhuvan or equivalent land cover, satellite soil-moisture proxies, and a hydrography layer. Raingauges, automatic weather stations, or quality-controlled gridded analyses would replace the simulated reference before any claim of improvement is made. Missing predictors should keep widening uncertainty rather than being silently treated as complete.
        </p>
      </section>
      <section className="card p-5">
        <h3 className="font-semibold text-navy-900">Technology stack</h3>
        <p className="mt-2 text-sm text-slate-700">
          React, Vite, TypeScript, Tailwind CSS, React Router, Leaflet, React-Leaflet, Recharts, and Lucide on the frontend. FastAPI, Pydantic, Pandas, NumPy, scikit-learn, and Shapely on the backend, with SQLite for run history.
        </p>
        <p className="mt-3 text-sm font-semibold text-navy-900">Team Hexabyte · SIH26074 Prototype · Demo Mode</p>
      </section>
      <Disclaimer />
    </div>
  )
}
