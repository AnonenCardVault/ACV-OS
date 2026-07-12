"use client";

import Image from "next/image";
import { useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { getSupabaseBrowserAuthClient } from "@/lib/supabase/browser-auth";

function nextUrl() {
  if (typeof window === "undefined") return "/dashboard";
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await getSupabaseBrowserAuthClient().auth.signInWithPassword({
        email: email.trim(),
        password
      });
      window.location.assign(nextUrl());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-acv-black text-acv-text">
      <div className="fixed inset-0 -z-10 command-grid bg-[radial-gradient(circle_at_18%_10%,rgba(139,63,252,0.24),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(242,184,75,0.15),transparent_30%),linear-gradient(180deg,#08080b,#050507)]" />
      <section className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-acv-border bg-acv-panel/95 p-5 shadow-glow">
          <div className="mb-5 flex items-center gap-3 border-b border-acv-border pb-5">
            <Image
              src="/acv-logo.jpeg"
              alt="ACV AnonenCardVault logo"
              width={62}
              height={62}
              className="h-14 w-14 rounded-md border border-acv-gold/40 object-cover"
              priority
            />
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-acv-gold">ACV OS</p>
              <h1 className="mt-1 text-xl font-bold text-acv-text">Secure Sign In</h1>
              <p className="mt-1 text-xs text-acv-muted">AnonenCardVault command center</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-acv-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-11 w-full rounded-md border border-acv-border bg-acv-panel2 px-3 text-sm font-semibold text-acv-text outline-none transition placeholder:text-acv-muted focus:border-acv-teal"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-acv-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-11 w-full rounded-md border border-acv-border bg-acv-panel2 px-3 text-sm font-semibold text-acv-text outline-none transition placeholder:text-acv-muted focus:border-acv-teal"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="rounded-md border border-acv-pink/40 bg-acv-pink/10 px-3 py-2 text-xs font-semibold leading-5 text-acv-pink">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-acv-teal/40 bg-acv-teal px-4 text-sm font-bold text-black transition hover:bg-acv-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LockKeyhole className="h-4 w-4 animate-pulse" /> : <LogIn className="h-4 w-4" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-4 rounded-md border border-acv-border bg-black/20 px-3 py-2 text-[11px] leading-5 text-acv-muted">
            Access is restricted to the configured ACV OS Supabase user. No public registration is available.
          </p>
        </div>
      </section>
    </main>
  );
}

