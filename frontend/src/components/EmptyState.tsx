import type { ReactNode } from "react"

export default function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="card border-dashed p-6 text-center">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
