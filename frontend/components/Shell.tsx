"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/forecast", label: "Forecast" },
  { href: "/weights", label: "Weights" },
  { href: "/extremes", label: "Extremes" },
  { href: "/skill", label: "Skill" },
  { href: "/operational", label: "Operations" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-ink/80 px-4 py-5">
        <Link href="/" className="px-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan">SIH26081</div>
          <div className="mt-1 text-lg font-semibold leading-tight text-foam">HAB Blend</div>
          <div className="mt-1 text-xs leading-snug text-mist">Hybrid AI–NWP forecast blending</div>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {LINKS.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm ${
                  active ? "bg-cyan/15 text-cyan" : "text-mist hover:bg-panel hover:text-foam"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 text-[11px] leading-relaxed text-mist">
          Synthetic ERA5-style archive for development. Swap in real NWP and AI feeds through the same schema.
        </div>
      </aside>
      <div className="grid-fade min-w-0 flex-1">{children}</div>
    </div>
  );
}
