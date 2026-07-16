import { NextResponse } from "next/server";
import { getEbaySandboxEnvPresence } from "@/lib/ebay/integration/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getEbaySandboxEnvPresence());
}
