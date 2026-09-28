"use client";

import Link from "next/link";
import { CloudSun, GitCompare, LineChart, Map, ShieldCheck, Sprout } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const modules = [
  {
    icon: CloudSun,
    title: "Panchayat weather desk",
    text: "Rain, temperature, humidity, wind, and cloud cover for the selected village, with a confidence score and an uncertainty range.",
  },
  {
    icon: Map,
    title: "Spatial layers",
    text: "Switch the map between the block input, the downscaled estimate, observations, model error, and confidence.",
  },
  {
    icon: GitCompare,
    title: "Forecast comparison",
    text: "See the coarse block value beside the village estimate, the historical average, and the difference between them.",
  },
  {
    icon: LineChart,
    title: "Skill against baseline",
    text: "MAE, RMSE, bias, and R² show whether downscaling beats copying the block forecast onto every panchayat.",
  },
  {
    icon: Sprout,
    title: "Advisory workflow",
    text: "Rule-based crop advice stays a draft until an agriculture officer reviews it and chooses to publish.",
  },
  {
    icon: ShieldCheck,
    title: "Source control",
    text: "Every estimate carries a data-source label and a generation time. Official agency data is never invented.",
  },
];

const steps = ["Block forecast", "Features", "Downscaling model", "Village estimate", "Validation", "Advisory"];

export default function LandingPage() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src="/mausamsetu-banner.png" alt="MausamSetu" className="h-16 w-auto rounded-lg" />
          <div className="flex items-center gap-2 text-sm">
            <button className="rounded-lg px-3 py-2 font-medium" type="button" onClick={() => setLocale(locale === "en" ? "mr" : "en")}>
              {locale === "en" ? "मराठी" : "English"}
            </button>
            <Link href="/login" className="rounded-lg bg-field px-4 py-2 font-semibold text-white">{t("login")}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-field text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.3fr_0.7fr] md:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Block to panchayat</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{t("appTitle")}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Coarse block forecasts stay on screen. A separate model estimates rainfall, temperature, humidity, and wind
                for each panchayat, then shows whether that estimate is more accurate than the block value itself.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard" className="rounded-lg bg-leaf px-5 py-2.5 font-semibold text-white">Open operations desk</Link>
                <Link href="/register" className="rounded-lg border border-white/20 px-5 py-2.5 font-semibold text-white">Farmer registration</Link>
              </div>
            </div>
            <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">What stays separate</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                <li>1. Official or coarse block forecast</li>
                <li>2. Model-generated panchayat estimate</li>
                <li>3. Confidence and uncertainty range</li>
                <li>4. Validation against the block baseline</li>
              </ul>
              <p className="mt-5 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">{t("disclaimer")}</p>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Product modules</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            The desk is organised around field use, map review, forecast skill, and officer-controlled advisories.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-xl border border-line bg-card p-5 shadow-card">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-leaf">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="text-2xl font-semibold tracking-tight">Processing path</h2>
            <ol className="mt-6 grid gap-3 md:grid-cols-6">
              {steps.map((step, index) => (
                <li key={step} className="rounded-xl border border-line bg-paper p-4">
                  <span className="text-xs font-semibold text-leaf">0{index + 1}</span>
                  <p className="mt-2 text-sm font-medium">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 py-14 md:grid-cols-2">
          <article className="rounded-xl border border-line bg-card p-6 shadow-card">
            <h2 className="text-xl font-semibold">Field users</h2>
            <p className="mt-3 text-sm leading-6 text-muted">Farmers select a panchayat, read the coming days, and see crop notes that are marked as general decision support.</p>
            <p className="mt-3 text-sm leading-6 text-muted">Agriculture officers compare the block input with the village estimate, inspect low-confidence places, and publish advisories only after review.</p>
          </article>
          <article className="rounded-xl border border-line bg-card p-6 shadow-card">
            <h2 className="text-xl font-semibold">Demo access</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt>Farmer</dt><dd className="text-muted">farmer@example.com</dd></div>
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt>Officer</dt><dd className="text-muted">officer@example.com</dd></div>
              <div className="flex justify-between gap-4"><dt>Administrator</dt><dd className="text-muted">admin@example.com</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted">Passwords: Farmer@123, Officer@123, Admin@123. Boundaries in the demo are synthetic cells, not official village maps.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
