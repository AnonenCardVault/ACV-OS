import { NextResponse, type NextRequest } from "next/server";
import { getEbaySyncSummary } from "@/lib/ebay/integration/connection-store";
import { parseEbayEnvironment } from "@/lib/ebay/integration/config";
import { runEbaySync } from "@/lib/ebay/sync/sync-manager";
import type { EbaySyncType } from "@/lib/ebay/sync/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const validTypes = new Set<EbaySyncType>(["inventory_items", "offers", "orders", "everything"]);

export async function GET() {
  const summary = await getEbaySyncSummary("sandbox");
  return NextResponse.json({ summary });
}

export async function POST(request: NextRequest) {
  let body: { environment?: string; type?: EbaySyncType } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const environment = parseEbayEnvironment(body.environment);
  const type = body.type || "everything";
  if (environment !== "sandbox") {
    return NextResponse.json({ ok: false, error: "Production seller sync is disabled for this phase." }, { status: 409 });
  }
  if (!validTypes.has(type)) {
    return NextResponse.json({ ok: false, error: "Unsupported eBay sync type." }, { status: 400 });
  }

  try {
    const result = await runEbaySync(type, environment);
    const summary = await getEbaySyncSummary(environment);
    const status = result.status === "failed" ? 502 : result.status === "partial_success" ? 207 : 200;
    return NextResponse.json({ result, summary }, { status });
  } catch (error) {
    const summary = await getEbaySyncSummary(environment);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sandbox sync failed.",
        summary
      },
      { status: 409 }
    );
  }
}
