import {
  History,
  Info,
  LayoutDashboard,
  Map,
  ShieldCheck,
  Spline,
  Sprout,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { cx } from "@/lib/format"

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workspace", label: "Downscaling", icon: Spline },
  { to: "/explorer", label: "Panchayat Explorer", icon: Map },
  { to: "/validation", label: "Validation", icon: ShieldCheck },
  { to: "/advisory", label: "Advisories", icon: Sprout },
  { to: "/history", label: "Run History", icon: History },
  { to: "/about", label: "About SIH26074", icon: Info },
]

export default function Sidebar() {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 text-white md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-serif text-2xl">MausamSetu</p>
          <p className="mt-1 text-xs text-sky-100/80">Panchayat-Level Weather Intelligence</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sky-50/80 transition hover:bg-white/10 hover:text-white",
                  isActive && "bg-white/10 text-white ring-1 ring-white/15",
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-sky-100/70">
          Uncertainty-Aware Forecast
          <br />
          Team Hexabyte
        </div>
      </aside>
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-navy-900 px-3 py-2 md:hidden">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cx(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-sky-50/80",
                isActive && "bg-white text-navy-900",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
