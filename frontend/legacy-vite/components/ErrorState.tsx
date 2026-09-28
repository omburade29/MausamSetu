import { AlertTriangle } from "lucide-react"

export default function ErrorState({
  title = "Something needs attention",
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="card border-red-200 p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 text-danger" size={20} />
        <div>
          <h2 className="font-semibold text-navy-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
