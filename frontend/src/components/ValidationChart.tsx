import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ValidationReport } from "@/types"

export default function ValidationChart({ report }: { report: ValidationReport }) {
  const data = report.rows.map((row) => ({
    name: row.panchayat,
    "Baseline error": row.baseline_error,
    "Downscaled error": row.downscaled_error,
    Baseline: row.baseline,
    Downscaled: row.downscaled,
    Reference: row.reference,
  }))
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <article className="card p-4">
        <h3 className="text-sm font-semibold text-navy-900">Absolute error by Panchayat</h3>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} height={60} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Baseline error" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Downscaled error" fill="#1D7DDB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="card p-4">
        <h3 className="text-sm font-semibold text-navy-900">Baseline, downscaled, and reference</h3>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} height={60} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Baseline" stroke="#94A3B8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Downscaled" stroke="#1D7DDB" strokeWidth={2.4} />
              <Line type="monotone" dataKey="Reference" stroke="#0F7A4A" strokeWidth={2.4} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  )
}
