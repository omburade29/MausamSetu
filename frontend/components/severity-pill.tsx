const tones: Record<string, string> = {
  normal: "bg-emerald-100 text-emerald-950",
  watch: "bg-amber-100 text-amber-950",
  warning: "bg-orange-100 text-orange-950",
  severe: "bg-red-100 text-red-950",
};

const marks: Record<string, string> = {
  normal: "●",
  watch: "▲",
  warning: "▲",
  severe: "■",
};

export function SeverityPill({ severity }: { severity: string }) {
  const key = severity in tones ? severity : "normal";
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[key]}`}>
      <span aria-hidden>{marks[key]}</span>
      {label}
    </span>
  );
}
