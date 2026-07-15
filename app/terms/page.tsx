import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { StatusPill } from "@/components/status-pill";

export const metadata: Metadata = {
  title: "Terms | ACV OS",
  description: "Terms for ACV OS by AnonenCardVault."
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

export default function TermsPage() {
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
                <h1 className="mt-1 text-2xl font-bold text-acv-text">Terms</h1>
                <p className="mt-1 text-xs text-acv-muted">AnonenCardVault command center</p>
              </div>
            </div>
            <StatusPill tone="teal">Public</StatusPill>
          </div>
          <p className="mt-4 text-sm leading-6 text-acv-muted">Last updated: {lastUpdated}</p>
        </header>

        <div className="space-y-4">
          <Section title="Personal-Use Software">
            <p>
              ACV OS is personal-use software built for AnonenCardVault operations. Access is restricted to authorized users and is not
              offered as a public commercial service at this time.
            </p>
          </Section>

          <Section title="No Warranty">
            <p>
              ACV OS is provided as-is and without warranty. The software may contain errors, incomplete features, mock workflows,
              third-party service interruptions, or inaccurate generated suggestions.
            </p>
          </Section>

          <Section title="User Responsibility">
            <p>
              The user is responsible for reviewing all inventory records, pricing decisions, listings, AI suggestions, marketplace
              actions, and operational outputs before relying on them. ACV OS does not guarantee marketplace performance or data accuracy.
            </p>
          </Section>

          <Section title="eBay API Usage Disclaimer">
            <p>
              eBay-related features use or may use eBay APIs subject to eBay policies, scopes, rate limits, sandbox restrictions, and
              marketplace terms. ACV OS is not endorsed by or affiliated with eBay. Read-only and write-capable eBay workflows should be
              reviewed carefully before use.
            </p>
          </Section>

          <Section title="Intellectual Property">
            <p>
              ACV OS, the AnonenCardVault branding, and related application structure are owned by their respective owner. Third-party
              trademarks, marketplace names, product names, and card brands remain the property of their respective owners.
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
