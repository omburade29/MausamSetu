export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button className="mt-3 rounded-full bg-field px-3 py-1.5 text-xs font-semibold text-paper" onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}
