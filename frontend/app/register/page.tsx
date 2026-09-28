"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button, Input, Label } from "@/components/ui";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  state: z.string().optional(),
  district: z.string().optional(),
});

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      state: form.get("state") || undefined,
      district: form.get("district") || undefined,
    });
    if (!parsed.success) {
      setError("Check the name, email, and password.");
      return;
    }
    try {
      await register(parsed.data);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Farmer access</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-field">Create a field account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Public registration opens the farmer workspace. Officer and administrator accounts are issued separately.</p>
        <form className="mt-6 space-y-4 rounded-xl border border-line bg-card p-5 shadow-card" onSubmit={onSubmit}>
          <Field id="name" label="Name" />
          <Field id="email" label="Email" type="email" />
          <Field id="password" label="Password" type="password" />
          <Field id="state" label="State" />
          <Field id="district" label="District" />
          {error ? <p className="text-sm text-severe">{error}</p> : null}
          <Button type="submit" className="w-full">Create account</Button>
        </form>
        <p className="mt-4 text-sm"><Link className="font-semibold text-leaf underline" href="/login">Back to sign in</Link></p>
      </div>
    </main>
  );
}

function Field({ id, label, type = "text" }: { id: string; label: string; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} className="mt-1" />
    </div>
  );
}
