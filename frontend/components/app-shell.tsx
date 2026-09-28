"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudSun,
  Database,
  FileBarChart,
  GitCompare,
  LayoutDashboard,
  LineChart,
  Map,
  Settings,
  Sprout,
} from "lucide-react";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/types";
import type { MessageKey } from "@/lib/i18n";

const groups: {
  label: string;
  links: { href: string; key: MessageKey; roles: Role[]; icon: typeof LayoutDashboard }[];
}[] = [
  {
    label: "Operations",
    links: [
      { href: "/dashboard", key: "dashboard", roles: ["farmer", "officer", "admin"], icon: LayoutDashboard },
      { href: "/map", key: "map", roles: ["farmer", "officer", "admin"], icon: Map },
      { href: "/forecast", key: "forecast", roles: ["farmer", "officer", "admin"], icon: GitCompare },
      { href: "/advisories", key: "advisories", roles: ["farmer", "officer", "admin"], icon: Sprout },
    ],
  },
  {
    label: "Quality",
    links: [
      { href: "/performance", key: "performance", roles: ["officer", "admin"], icon: LineChart },
      { href: "/reports", key: "reports", roles: ["farmer", "officer", "admin"], icon: FileBarChart },
    ],
  },
  {
    label: "Control",
    links: [
      { href: "/data", key: "data", roles: ["admin"], icon: Database },
      { href: "/models", key: "models", roles: ["admin"], icon: CloudSun },
      { href: "/admin", key: "admin", roles: ["admin"], icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useRequireAuth();
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper text-sm text-muted">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="border-b border-white/10 bg-field text-slate-100 print:hidden md:fixed md:inset-y-0 md:flex md:w-[260px] md:flex-col md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <img src="/mausamsetu-banner.png" alt="MausamSetu" className="h-auto w-full rounded-lg" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:flex-1 md:space-y-5 md:overflow-visible md:px-3 md:pb-4">
          {groups.map((group) => {
            const visible = group.links.filter((link) => link.roles.includes(user.role));
            if (!visible.length) return null;
            return (
              <div key={group.label}>
                <p className="mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:block">
                  {group.label}
                </p>
                <div className="flex gap-1 md:block md:space-y-1">
                  {visible.map((link) => {
                    const Icon = link.icon;
                    const active = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                          active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {t(link.key)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="hidden border-t border-white/10 px-4 py-4 md:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs capitalize text-slate-400">{user.role}</p>
        </div>
      </aside>
      <div className="print:pl-0 md:pl-[260px]">
        <header className="sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur print:hidden md:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
              type="button"
              onClick={() => setLocale(locale === "en" ? "mr" : "en")}
            >
              {locale === "en" ? "मराठी" : "English"}
            </button>
            <button
              className="rounded-lg bg-field px-3 py-1.5 text-xs font-semibold text-white"
              type="button"
              onClick={logout}
            >
              {t("logout")}
            </button>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
