import { getSupabaseConfig } from "@/lib/supabase/client";
import type { SupabaseHealthResult, SupabaseServiceHealth, SupabaseServiceStatus } from "@/lib/supabase/types";

const healthBuckets = ["temp-intake", "inventory-images", "listing-images"];
const healthTimeoutMs = 8000;

function healthDevLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV Supabase Health] ${message}`, payload || {});
  }
}

function nowIso() {
  return new Date().toISOString();
}

function missingConfigHealth(service: "database" | "storage", missing: string[]): SupabaseServiceHealth {
  return {
    status: "misconfigured",
    message: `Supabase ${service} configuration missing: ${missing.join(", ")}`,
    checkedAt: nowIso(),
    category: "missing-config"
  };
}

function classifyHttpFailure(service: "database" | "storage", status: number, detail: string, latencyMs: number): SupabaseServiceHealth {
  const checkedAt = nowIso();
  const safeDetail = detail.trim().slice(0, 220);

  if (status === 401 || status === 403) {
    return {
      status: "offline",
      message: `Supabase ${service} authorization/RLS error (${status}). ${safeDetail}`,
      checkedAt,
      latencyMs,
      category: "authorization"
    };
  }

  if (status === 404) {
    return {
      status: service === "storage" ? "misconfigured" : "offline",
      message: `Supabase ${service} resource not found (${status}). ${safeDetail}`,
      checkedAt,
      latencyMs,
      category: "query"
    };
  }

  if (status === 408 || status === 425 || status === 429 || status >= 500) {
    return {
      status: "degraded",
      message: `Supabase ${service} transient/service error (${status}). ${safeDetail}`,
      checkedAt,
      latencyMs,
      category: "service"
    };
  }

  return {
    status: "offline",
    message: `Supabase ${service} request failed (${status}). ${safeDetail}`,
    checkedAt,
    latencyMs,
    category: service === "database" ? "query" : "service"
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), healthTimeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    return {
      response,
      latencyMs: Math.round(performance.now() - startedAt)
    };
  } finally {
    window.clearTimeout(timer);
  }
}

function headers(key: string, extra?: HeadersInit) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

async function checkDatabaseHealth(): Promise<SupabaseServiceHealth> {
  const config = getSupabaseConfig();
  if (!config.configured) return missingConfigHealth("database", config.missing);

  healthDevLog("database check start");

  try {
    const { response, latencyMs } = await fetchWithTimeout(`${config.url}/rest/v1/users?select=id&limit=1`, {
      method: "GET",
      headers: headers(config.key)
    });

    if (!response.ok) {
      const detail = await response.text();
      const health = classifyHttpFailure("database", response.status, detail, latencyMs);
      healthDevLog("database check failed", { status: health.status, category: health.category, latencyMs });
      return health;
    }

    healthDevLog("database check success", { latencyMs });
    return {
      status: "connected",
      message: "Database health check succeeded.",
      checkedAt: nowIso(),
      latencyMs,
      category: "ok"
    };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    const status: SupabaseServiceStatus = isAbort ? "degraded" : "offline";
    const category = isAbort ? "timeout" : "network";
    healthDevLog("database check exception", { status, category, message: error instanceof Error ? error.message : String(error) });
    return {
      status,
      message: isAbort ? "Database health check timed out." : `Database network check failed: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt: nowIso(),
      category
    };
  }
}

async function checkStorageBucket(bucket: string) {
  const config = getSupabaseConfig();
  const { response, latencyMs } = await fetchWithTimeout(`${config.url}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: headers(config.key, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      prefix: "",
      limit: 1,
      offset: 0
    })
  });

  return { bucket, response, latencyMs };
}

async function checkStorageHealth(): Promise<SupabaseServiceHealth> {
  const config = getSupabaseConfig();
  if (!config.configured) return missingConfigHealth("storage", config.missing);

  healthDevLog("storage check start", { buckets: healthBuckets });

  try {
    const checks = await Promise.all(healthBuckets.map((bucket) => checkStorageBucket(bucket)));
    const successful = checks.filter(({ response }) => response.ok);
    const latencyMs = Math.max(...checks.map((check) => check.latencyMs));

    if (successful.length > 0) {
      healthDevLog("storage check success", { buckets: successful.map((check) => check.bucket), latencyMs });
      return {
        status: "connected",
        message: `Storage health check succeeded for ${successful.map((check) => check.bucket).join(", ")}.`,
        checkedAt: nowIso(),
        latencyMs,
        category: "ok"
      };
    }

    const first = checks[0];
    const detail = await first.response.text();
    const health = classifyHttpFailure("storage", first.response.status, detail, first.latencyMs);

    if (first.response.status === 400 || first.response.status === 401 || first.response.status === 403) {
      health.status = "degraded";
      health.message = `Storage object-list health check is not permitted or returned ${first.response.status}. Uploads may still work; local fallback is used only after upload failure.`;
    }

    healthDevLog("storage check failed", {
      method: "object-list",
      bucket: first.bucket,
      httpStatus: first.response.status,
      status: health.status,
      category: health.category,
      latencyMs: health.latencyMs
    });
    return health;
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    const status: SupabaseServiceStatus = isAbort ? "degraded" : "offline";
    const category = isAbort ? "timeout" : "network";
    healthDevLog("storage check exception", { status, category, message: error instanceof Error ? error.message : String(error) });
    return {
      status,
      message: isAbort ? "Storage health check timed out." : `Storage network check failed: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt: nowIso(),
      category
    };
  }
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  const startedAt = Date.now();
  healthDevLog("health check start");
  const [database, storage] = await Promise.all([checkDatabaseHealth(), checkStorageHealth()]);
  healthDevLog("health check complete", {
    database: database.status,
    storage: storage.status,
    elapsedMs: Date.now() - startedAt
  });
  return { database, storage };
}
