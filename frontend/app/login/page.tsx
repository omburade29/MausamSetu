"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button, Input, Label } from "@/components/ui";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

const accounts = [
  ["Farmer", "farmer@example.com", "Farmer@123"],
  ["Officer", "officer@example.com", "Officer@123"],
  ["Administrator", "admin@example.com", "Admin@123"],
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await login(parsed.data.email, parsed.data.password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-field p-10 text-white lg:flex">
        <img src="/mausamsetu-banner.png" alt="MausamSetu" className="h-auto w-[270px] max-w-full rounded-lg object-contain" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Operations desk</p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight">Village estimates, kept separate from the block forecast.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            Officers review skill scores before relying on a downscaled value. Farmers see confidence, warnings, and advisories marked as decision support.
          </p>
        </div>
        <p className="text-xs text-slate-400">Model-generated estimates. Not official IMD forecasts.</p>
      </section>
      <main className="flex items-center px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <p className="text-2xl font-semibold tracking-tight text-field">Sign in</p>
          <p className="mt-2 text-sm text-muted">Use a demo role to open the matching workspace.</p>
          <form className="mt-6 space-y-4 rounded-xl border border-line bg-card p-5 shadow-card" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required className="mt-1" />
            </div>
            {error ? <p className="text-sm text-severe">{error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in" : "Sign in"}</Button>
          </form>
          <ul className="mt-4 space-y-2 text-xs text-muted">
            {accounts.map(([role, email, password]) => (
              <li key={email} className="flex justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2">
                <span className="font-medium text-ink">{role}</span>
                <span>{email} · {password}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">No account? <Link className="font-semibold text-leaf underline" href="/register">Register as a farmer</Link></p>
        </div>
      </main>
    </div>
  );
}
