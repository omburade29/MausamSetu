export function MapFallbackTable({
  rows,
}: {
  rows: { name: string; value: number | null; unit: string; note?: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <p className="px-4 pt-4 text-sm text-muted">Map unavailable. Values are listed instead.</p>
      <table className="mt-2 min-w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="px-4 py-2">Panchayat</th>
            <th className="px-4 py-2">Value</th>
            <th className="px-4 py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-line">
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">{row.value === null ? "—" : `${row.value.toFixed(1)} ${row.unit}`}</td>
              <td className="px-4 py-2">{row.note || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
