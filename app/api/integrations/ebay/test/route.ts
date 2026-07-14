import { NextResponse, type NextRequest } from "next/server";
import { parseEbayEnvironment } from "@/lib/ebay/integration/config";
import { getEbayIntegrationSummaries, testEbayConnection } from "@/lib/ebay/integration/connection-test";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ environments: getEbayIntegrationSummaries() });
}

export async function POST(request: NextRequest) {
  let body: { environment?: string; forceRefresh?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const environment = parseEbayEnvironment(body.environment);
  const result = await testEbayConnection(environment, { forceRefresh: Boolean(body.forceRefresh) });
  const status = result.connectionStatus === "connected" ? 200 : result.errorCategory === "production_disabled" ? 409 : 502;

  return NextResponse.json(
    {
      result,
      environments: getEbayIntegrationSummaries()
    },
    { status }
  );
}

