import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ChecklistTarget = {
  sport: string;
  year: string;
  brand: string;
  product: string;
  priority: string;
  enabled: boolean;
  preferredSources: string[];
};

type CandidateUrl = {
  url: string;
  sourceName: string;
  title: string;
  discoveredFromQuery: string;
  discoveredAt: string;
};

type DiscoveryResult = {
  targetId: string;
  target: ChecklistTarget;
  queries: string[];
  candidates: CandidateUrl[];
  status: "found" | "not_found" | "error";
  errors: string[];
};

const rootDir = process.cwd();
const baseDir = path.join(rootDir, "data", "imports", "sports-checklists");
const targetsPath = path.join(baseDir, "targets", "sports-checklist-targets.json");
const discoveredPath = path.join(baseDir, "discovered-urls", "checklist-urls.json");
const logsDir = path.join(baseDir, "logs");

const sourceDomains: Record<string, string[]> = {
  Beckett: ["beckett.com"],
  "Cardboard Connection": ["cardboardconnection.com"]
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function targetId(target: ChecklistTarget) {
  return [target.sport, target.year, target.brand, target.product].map(slug).join("-");
}

function buildQueries(target: ChecklistTarget) {
  return [
    `${target.year} ${target.brand} ${target.product} ${target.sport} checklist Beckett`,
    `${target.year} ${target.brand} ${target.product} ${target.sport} checklist Cardboard Connection`
  ];
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeSearchUrl(rawHref: string) {
  let href = decodeHtml(rawHref.trim());
  if (!href) return "";
  if (href.startsWith("//")) href = `https:${href}`;

  try {
    const parsed = new URL(href, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    const q = parsed.searchParams.get("q");
    const url = uddg || q || parsed.href;
    if (!/^https?:\/\//i.test(url)) return "";
    return url;
  } catch {
    return "";
  }
}

function sourceForUrl(url: string, preferredSources: string[]) {
  const normalized = url.toLowerCase();
  for (const source of preferredSources) {
    if ((sourceDomains[source] || []).some((domain) => normalized.includes(domain))) return source;
  }
  if (normalized.includes("beckett.com")) return "Beckett";
  if (normalized.includes("cardboardconnection.com")) return "Cardboard Connection";
  return "";
}

function looksLikeChecklistUrl(url: string) {
  const normalized = url.toLowerCase();
  if (!normalized.includes("checklist")) return false;
  if (normalized.includes("duckduckgo.com") || normalized.includes("bing.com") || normalized.includes("google.com")) return false;
  return true;
}

function extractSearchCandidates(html: string, query: string, target: ChecklistTarget) {
  const candidates: CandidateUrl[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html))) {
    const url = normalizeSearchUrl(match[1]);
    if (!url || !looksLikeChecklistUrl(url)) continue;
    const sourceName = sourceForUrl(url, target.preferredSources);
    if (!sourceName) continue;

    candidates.push({
      url,
      sourceName,
      title: stripTags(match[2]) || url,
      discoveredFromQuery: query,
      discoveredAt: new Date().toISOString()
    });
  }

  return candidates;
}

async function fetchSearch(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ACVOSCatalogBuilder/1.0 (standalone checklist URL discovery)",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) throw new Error(`Search failed ${response.status}: ${await response.text()}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueCandidates(candidates: CandidateUrl[]) {
  const byUrl = new Map<string, CandidateUrl>();
  candidates.forEach((candidate) => {
    if (!byUrl.has(candidate.url)) byUrl.set(candidate.url, candidate);
  });
  return Array.from(byUrl.values());
}

async function readTargets() {
  const raw = await readFile(targetsPath, "utf8");
  const parsed = JSON.parse(raw) as { targets?: ChecklistTarget[] };
  return (parsed.targets || []).filter((target) => target.enabled);
}

async function main() {
  await mkdir(path.dirname(discoveredPath), { recursive: true });
  await mkdir(logsDir, { recursive: true });

  const enabledTargets = await readTargets();
  const results: DiscoveryResult[] = [];

  for (const target of enabledTargets) {
    const queries = buildQueries(target);
    const errors: string[] = [];
    const candidates: CandidateUrl[] = [];

    for (const query of queries) {
      try {
        const html = await fetchSearch(query);
        candidates.push(...extractSearchCandidates(html, query, target));
      } catch (error) {
        errors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const unique = uniqueCandidates(candidates);
    results.push({
      targetId: targetId(target),
      target,
      queries,
      candidates: unique,
      status: unique.length > 0 ? "found" : errors.length > 0 ? "error" : "not_found",
      errors
    });
  }

  const discovered = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    results
  };
  const log = {
    runId: createHash("sha1").update(discovered.generatedAt).digest("hex").slice(0, 10),
    generatedAt: discovered.generatedAt,
    targets: results.length,
    found: results.filter((result) => result.candidates.length > 0).length,
    notFound: results.filter((result) => result.candidates.length === 0 && result.errors.length === 0).length,
    errors: results.flatMap((result) => result.errors.map((error) => ({ targetId: result.targetId, error })))
  };

  await writeFile(discoveredPath, `${JSON.stringify(discovered, null, 2)}\n`);
  await writeFile(path.join(logsDir, `discover-${log.runId}.json`), `${JSON.stringify(log, null, 2)}\n`);

  console.log(`Sports checklist discovery complete: ${log.found}/${log.targets} targets found.`);
  if (log.errors.length > 0) console.log(`Discovery logged ${log.errors.length} search error(s).`);
  console.log(`Saved candidates: ${path.relative(rootDir, discoveredPath)}`);
}

main().catch((error) => {
  console.error("Sports checklist discovery failed.");
  console.error(error);
  process.exitCode = 1;
});
