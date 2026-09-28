import { uncertaintyTone } from "@/lib/colors"

export default function UncertaintyBadge({ category }: { category: string }) {
  const tone = uncertaintyTone(category)
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}>
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
      {category}
    </span>
  )
}
