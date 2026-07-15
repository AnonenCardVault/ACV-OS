import { NextResponse } from "next/server";
import { disconnectEbayConnection, getEbaySyncSummary } from "@/lib/ebay/integration/connection-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await disconnectEbayConnection("sandbox");
  const summary = await getEbaySyncSummary("sandbox");
  return NextResponse.json({ ok: true, summary });
}
