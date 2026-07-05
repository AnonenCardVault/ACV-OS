import Image from "next/image";
import { Palette, Save, ShieldCheck, Store } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Branding, source-of-truth rules, workflow statuses, locations, team preferences, and future integration readiness."
        action={<ActionButton icon={<Save className="h-4 w-4" />}>Save settings</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[380px_1fr]">
        <SectionCard title="Brand Identity" eyebrow="AnonenCardVault">
          <div className="flex items-center gap-4">
            <Image
              src="/acv-logo.jpeg"
              alt="ACV AnonenCardVault logo"
              width={108}
              height={108}
              className="h-24 w-24 rounded-lg border border-acv-gold/40 object-cover"
            />
            <div>
              <p className="text-lg font-semibold text-acv-text">ACV OS</p>
              <p className="text-sm text-acv-muted">AnonenCardVault</p>
              <div className="mt-3 flex gap-2">
                <StatusPill tone="purple">Purple</StatusPill>
                <StatusPill tone="gold">Gold</StatusPill>
                <StatusPill tone="teal">Teal</StatusPill>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Source of Truth" eyebrow="Business rules">
            <div className="space-y-2 text-xs">
              {["SKU", "Inventory record", "Purchase cost", "Location", "Internal notes", "AI confidence", "Workflow status"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="text-acv-muted">{item}</span>
                  <StatusPill tone="teal">ACV owns</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Integration Readiness" eyebrow="Future layers">
            <div className="space-y-3">
              {[
                ["Supabase auth/database", "Planned"],
                ["Object storage for images", "Planned"],
                ["eBay sync", "Offline"],
                ["AI image recognition", "Offline"],
                ["Payment/domain work", "Offline"]
              ].map(([label, status]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                  <span className="text-acv-muted">{label}</span>
                  <StatusPill tone={status === "Offline" ? "pink" : "purple"}>{status}</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Workflow Statuses">
            <div className="flex flex-wrap gap-2">
              {["Needs Review", "Needs Pricing", "Ready for Draft", "Ready to Publish", "Listed", "Sold", "Completed", "Archived"].map((status) => (
                <StatusPill key={status} tone={status.startsWith("Needs") ? "pink" : status === "Listed" ? "teal" : "purple"}>
                  {status}
                </StatusPill>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Theme Controls">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <Palette className="h-5 w-5 text-acv-purple" />
                <div>
                  <p className="text-sm font-semibold text-acv-text">Dark command center</p>
                  <p className="text-xs text-acv-muted">Charcoal panels, thin borders, compact density.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <Store className="h-5 w-5 text-acv-gold" />
                <div>
                  <p className="text-sm font-semibold text-acv-text">Brand-forward shell</p>
                  <p className="text-xs text-acv-muted">ACV logo and AnonenCardVault naming stay visible.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <ShieldCheck className="h-5 w-5 text-acv-teal" />
                <div>
                  <p className="text-sm font-semibold text-acv-text">Confirmation gates</p>
                  <p className="text-xs text-acv-muted">Marketplace changes remain staged for approval.</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
