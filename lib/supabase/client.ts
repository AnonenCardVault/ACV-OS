import type { AcvSupabaseUser } from "@/lib/supabase/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabasePublicUrl() {
  return supabaseUrl.replace(/\/$/, "");
}

export function getSupabasePublishableKey() {
  return supabasePublishableKey;
}

function assertConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase env vars are missing. ACV is using local fallback.");
  }
}

function jsonHeaders(extra?: HeadersInit) {
  assertConfigured();
  return {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${supabasePublishableKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

export function tableUrl(table: string, query = "") {
  const separator = query ? `?${query}` : "";
  return `${getSupabasePublicUrl()}/rest/v1/${table}${separator}`;
}

export async function supabaseRest<T>(table: string, query = "", init?: RequestInit): Promise<T> {
  const response = await fetch(tableUrl(table, query), {
    ...init,
    headers: jsonHeaders(init?.headers)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${table} request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function selectRows<T>(table: string, query = "select=*") {
  return supabaseRest<T[]>(table, query);
}

export async function upsertRows<T>(table: string, rows: Array<Record<string, unknown>>, onConflict: string) {
  if (rows.length === 0) return [] as T[];
  const query = `on_conflict=${encodeURIComponent(onConflict)}&select=*`;

  return supabaseRest<T[]>(table, query, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows)
  });
}

export async function insertRows<T>(table: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return [] as T[];

  return supabaseRest<T[]>(table, "select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows)
  });
}

export async function patchRows<T>(table: string, query: string, values: Record<string, unknown>) {
  return supabaseRest<T[]>(table, `${query}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(values)
  });
}

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) return false;
  await selectRows("users", "select=id&limit=1");
  return true;
}

export async function getOrCreateAcvUser(): Promise<AcvSupabaseUser> {
  const email = "local@acv-os.mock";
  const existing = await selectRows<AcvSupabaseUser>("users", `select=*&email=eq.${encodeURIComponent(email)}&deleted_at=is.null&limit=1`);
  if (existing[0]) return existing[0];
  const [created] = await upsertRows<AcvSupabaseUser>(
    "users",
    [
      {
        email,
        display_name: "ACV Local Operator",
        metadata: { source: "acv-os-no-auth-local-user" }
      }
    ],
    "email"
  );
  return created;
}
