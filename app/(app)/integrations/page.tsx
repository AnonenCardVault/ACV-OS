import { BrainCircuit, Database, KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getEbaySyncSummary } from "@/lib/ebay/integration/connection-store";
import { getEbayIntegrationSummaries } from "@/lib/ebay/integration/connection-test";
import { getSupabaseConfig } from "@/lib/supabase/client";
import { IntegrationsClient } from "@/app/(app)/integrations/integrations-client";

export const dynamic = "force-dynamic";

function secretConfigured(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function ServiceCard({
  title,
  description,
  status,
  tone,
  icon
}: {
  title: string;
  description: string;
  status: string;
  tone: "teal" | "gold" | "pink" | "purple" | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-acv-teal">{icon}</span>
          <p className="truncate text-sm font-semibold text-acv-text">{title}</p>
        </div>
        <StatusPill tone={tone} className="shrink-0">
          {status}
        </StatusPill>
      </div>
      <p className="mt-2 text-xs leading-5 text-acv-muted">{description}</p>
    </div>
  );
}

export default async function IntegrationsPage() {
  const supabaseConfig = getSupabaseConfig();
  const ebayEnvironments = getEbayIntegrationSummaries();
  const ebaySyncSummary = await getEbaySyncSummary("sandbox");
  const openAiConfigured = secretConfigured("OPENAI_API_KEY");
  const cardSightConfigured = secretConfigured("CARDSIGHT_API_KEY");

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connection control center for marketplace, data, and AI providers. eBay testing is Sandbox-first; production calls stay guarded."
        status="Sandbox foundation"
      />

      <div className="space-y-4 p-4 md:p-6">
        <IntegrationsClient initialEbayEnvironments={ebayEnvironments} initialEbaySyncSummary={ebaySyncSummary} />

        <SectionCard title="Provider Status" eyebrow="Integration registry" action={<StatusPill tone="purple">Read only</StatusPill>}>
          <div className="grid min-w-0 gap-3 lg:grid-cols-3">
            <ServiceCard
              title="Supabase"
              status={supabaseConfig.configured ? "Configured" : "Missing"}
              tone={supabaseConfig.configured ? "teal" : "pink"}
              icon={<Database className="h-4 w-4" />}
              description={
                supabaseConfig.configured
                  ? `Database and Storage use ${supabaseConfig.keySource}.`
                  : `Missing ${supabaseConfig.missing.join(", ")}.`
              }
            />
            <ServiceCard
              title="OpenAI"
              status={openAiConfigured ? "Configured" : "Missing"}
              tone={openAiConfigured ? "teal" : "gold"}
              icon={<BrainCircuit className="h-4 w-4" />}
              description={openAiConfigured ? "Server-side extraction provider is available." : "AI extraction falls back where configured until OPENAI_API_KEY exists."}
            />
            <ServiceCard
              title="CardSight"
              status={cardSightConfigured ? "Configured" : "Missing"}
              tone={cardSightConfigured ? "teal" : "gold"}
              icon={<ShieldCheck className="h-4 w-4" />}
              description={cardSightConfigured ? "Server-side card identity provider is available." : "CardSight provider falls back when CARDSIGHT_API_KEY is absent."}
            />
          </div>
        </SectionCard>

        <SectionCard title="Integration Rules" eyebrow="Safety rails" action={<StatusPill tone="teal">No live sync</StatusPill>}>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Sandbox first", "Connection testing uses eBay Sandbox credentials and Sandbox Browse APIs by default."],
              ["No listing sync", "Inventory, draft, active listing, sold listing, and bulk listing sync are intentionally not implemented here."],
              ["Secrets stay server-side", "Client ID and client secret values are read only on the server and never sent to the browser."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-acv-gold" />
                  <p className="text-sm font-semibold text-acv-text">{title}</p>
                </div>
                <p className="text-xs leading-5 text-acv-muted">{copy}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
