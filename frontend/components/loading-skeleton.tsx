export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-2xl bg-stone-200/80" />
      ))}
    </div>
  );
}
