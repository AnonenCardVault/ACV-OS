import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { StatusPill } from "@/components/status-pill";

export const metadata: Metadata = {
  title: "Privacy Policy | ACV OS",
  description: "Privacy Policy for ACV OS by AnonenCardVault."
};

const lastUpdated = "July 15, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-acv-border bg-acv-panel2 p-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-acv-gold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-acv-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-acv-black text-acv-text">
      <div className="fixed inset-0 -z-10 command-grid bg-[radial-gradient(circle_at_18%_10%,rgba(139,63,252,0.24),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(242,184,75,0.15),transparent_30%),linear-gradient(180deg,#08080b,#050507)]" />
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 md:py-12">
        <header className="mb-6 rounded-lg border border-acv-border bg-acv-panel/95 p-5 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
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
                <h1 className="mt-1 text-2xl font-bold text-acv-text">Privacy Policy</h1>
                <p className="mt-1 text-xs text-acv-muted">AnonenCardVault command center</p>
              </div>
            </div>
            <StatusPill tone="teal">Public</StatusPill>
          </div>
          <p className="mt-4 text-sm leading-6 text-acv-muted">Last updated: {lastUpdated}</p>
        </header>

        <div className="space-y-4">
          <Section title="What ACV OS Is">
            <p>
              ACV OS is personal-use operational software for AnonenCardVault. It helps manage trading card intake,
              inventory, pricing research, listings workflow, sales evidence, shipping workflow, and related internal records.
            </p>
          </Section>

          <Section title="Information Collected">
            <p>
              ACV OS may collect account sign-in information, card and inventory records, uploaded card images, pricing notes,
              listing metadata, workflow status, audit history, and integration status information needed to operate the software.
            </p>
          </Section>

          <Section title="How Data Is Used">
            <p>
              Data is used to provide the ACV OS workflow: storing card profiles, showing inventory, reviewing photo intake,
              preparing listing data, tracking pricing evidence, and maintaining operational history. ACV OS does not sell personal data.
            </p>
          </Section>

          <Section title="eBay OAuth Data Usage">
            <p>
              If eBay Sandbox or future eBay production access is connected, ACV OS uses eBay OAuth tokens only to access authorized
              eBay account data for the connected account and requested scopes. Tokens are handled server-side and are not intentionally
              exposed to the browser. Imported eBay records are stored separately from ACV source-of-truth inventory unless a user action
              links them later.
            </p>
          </Section>

          <Section title="Supabase Authentication">
            <p>
              ACV OS uses Supabase Auth for email and password sign-in. Authentication sessions are used to protect application pages
              from unauthenticated access and to preserve access across refreshes until logout or session expiration.
            </p>
          </Section>

          <Section title="AI Processing">
            <p>
              ACV OS may use AI providers to analyze uploaded card images and suggest editable extraction fields. AI results are not
              automatically approved into inventory. A user review step remains required before creating or updating inventory records.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              ACV OS retains records while they are useful for operating AnonenCardVault, unless deleted, archived, or removed under an
              applicable integration requirement. Some records may be retained as audit or operational history where appropriate.
            </p>
          </Section>

          <Section title="Contact">
            <p>Contact information placeholder: add the preferred ACV OS support or owner contact here.</p>
          </Section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-acv-border bg-black/20 px-4 py-3">
          <Link href="/sign-in" className="text-xs font-semibold text-acv-teal transition hover:text-cyan-200">
            Return to sign in
          </Link>
          <LegalLinks />
        </footer>
      </div>
    </main>
  );
}
