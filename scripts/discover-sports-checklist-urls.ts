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

type SearchQuery = {
  sourceName: string;
  query: string;
  searchUrl: string;
  fetchable: boolean;
  reason: string;
};

type CandidateStatus = "approved" | "candidate" | "rejected";
type DiscoveryMode = "known-pattern" | "source-search-url" | "search-result";

type CandidateUrl = {
  url: string;
  sourceName: string;
  title: string;
  discoveredFromQuery: string;
  discoveredAt: string;
  discoveryMode: DiscoveryMode;
  confidence: number;
  status: CandidateStatus;
  matchedTerms: string[];
  rejectedReasons: string[];
  verified?: {
    attempted: boolean;
    ok?: boolean;
    httpStatus?: number;
    contentType?: string | null;
    error?: string;
  };
};

type CandidateAuditResult = {
  targetId: string;
  target: ChecklistTarget;
  queries: SearchQuery[];
  candidates: CandidateUrl[];
  approvedCandidates: CandidateUrl[];
  rejectedCandidates: CandidateUrl[];
  status: "found" | "not_found" | "error";
  errors: string[];
  notFoundReason?: string;
};

const rootDir = process.cwd();
const baseDir = path.join(rootDir, "data", "imports", "sports-checklists");
const targetsPath = path.join(baseDir, "targets", "sports-checklist-targets.json");
const approvedPath = path.join(baseDir, "discovered-urls", "checklist-urls.json");
const candidatePath = path.join(baseDir, "discovered-urls", "checklist-url-candidates.json");
const logsDir = path.join(baseDir, "logs");
const fetchSearchResults = process.argv.includes("--fetch-search");
const verifyPatterns = process.argv.includes("--verify-patterns");

const sourceDomains: Record<string, string[]> = {
  Beckett: ["beckett.com"],
  "Cardboard Connection": ["cardboardconnection.com"]
};

const sourceSearchBase: Record<string, string> = {
  Beckett: "https://www.beckett.com/search/?term=",
  "Cardboard Connection": "https://www.cardboardconnection.com/?s="
};

const sportWords = new Set(["baseball", "football", "basketball"]);

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalize(value: string) {
  return slug(value).replace(/-/g, " ");
}

function tokenList(value: string) {
  return slug(value)
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean);
}

function uniqueTokens(values: string[]) {
  const seen = new Set<string>();
  const tokens: string[] = [];
  values.flatMap(tokenList).forEach((token) => {
    if (!seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
  });
  return tokens;
}

function targetId(target: ChecklistTarget) {
  return [target.sport, target.year, target.brand, target.product].map(slug).join("-");
}

function readableTitle(target: ChecklistTarget) {
  const terms = uniqueTokens([target.year, target.brand, target.product, target.sport]);
  return `${terms.map((term) => (term.length <= 3 ? term.toUpperCase() : term[0].toUpperCase() + term.slice(1))).join(" ")} Checklist`;
}

function buildQueries(target: ChecklistTarget): SearchQuery[] {
  const baseQueries = [
    {
      sourceName: "Beckett",
      query: `${target.year} ${target.brand} ${target.product} ${target.sport} checklist Beckett`
    },
    {
      sourceName: "Cardboard Connection",
      query: `${target.year} ${target.brand} ${target.product} ${target.sport} checklist Cardboard Connection`
    }
  ];
  const webQueries = [
    {
      sourceName: "Bing",
      query: `${target.year} ${target.brand} ${target.product} ${target.sport} checklist`
    },
    {
      sourceName: "Google",
      query: `${target.year} ${target.brand} ${target.product} ${target.sport} checklist`
    }
  ];

  return [
    ...baseQueries.map((query) => ({
      ...query,
      searchUrl: `${sourceSearchBase[query.sourceName]}${encodeURIComponent(query.query)}`,
      fetchable: false,
      reason: "Source search URL generated for manual/reference discovery; direct checklist URLs are preferred."
    })),
    {
      sourceName: "DuckDuckGo",
      query: webQueries[0].query,
      searchUrl: `https://duckduckgo.com/html/?q=${encodeURIComponent(webQueries[0].query)}`,
      fetchable: fetchSearchResults,
      reason: fetchSearchResults ? "Generic search fetch enabled by --fetch-search." : "Generic search fetch disabled by default to avoid relying on search-result pages."
    },
    {
      ...webQueries[0],
      searchUrl: `https://www.bing.com/search?q=${encodeURIComponent(webQueries[0].query)}`,
      fetchable: fetchSearchResults,
      reason: fetchSearchResults ? "Bing search fetch enabled by --fetch-search." : "Bing query URL generated but not fetched by default."
    },
    {
      ...webQueries[1],
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(webQueries[1].query)}`,
      fetchable: false,
      reason: "Google query URL generated for reference only; not fetched to avoid CAPTCHA/bot-protection flows."
    }
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
  const normalizedUrl = url.toLowerCase();
  for (const source of preferredSources) {
    if ((sourceDomains[source] || []).some((domain) => normalizedUrl.includes(domain))) return source;
  }
  if (normalizedUrl.includes("beckett.com")) return "Beckett";
  if (normalizedUrl.includes("cardboardconnection.com")) return "Cardboard Connection";
  return "";
}

function productTerms(target: ChecklistTarget) {
  const terms = uniqueTokens([target.product]).filter((term) => !sportWords.has(term));
  return terms.length > 0 ? terms : tokenList(target.product);
}

function matchCandidate({
  target,
  url,
  title,
  sourceName,
  discoveryMode
}: {
  target: ChecklistTarget;
  url: string;
  title: string;
  sourceName: string;
  discoveryMode: DiscoveryMode;
}) {
  const haystack = normalize(`${url} ${title}`);
  const matchedTerms: string[] = [];
  const rejectedReasons: string[] = [];
  let confidence = 0;

  const yearTerm = normalize(target.year);
  if (haystack.includes(yearTerm)) {
    confidence += 25;
    matchedTerms.push(target.year);
  } else {
    rejectedReasons.push(`missing year ${target.year}`);
  }

  const requiredProductTerms = productTerms(target);
  const matchedProductTerms = requiredProductTerms.filter((term) => haystack.includes(term));
  if (matchedProductTerms.length > 0) {
    confidence += Math.round(35 * (matchedProductTerms.length / requiredProductTerms.length));
    matchedTerms.push(...matchedProductTerms);
  } else {
    rejectedReasons.push(`missing product keyword(s): ${requiredProductTerms.join(", ")}`);
  }

  const sportTerm = normalize(target.sport);
  if (haystack.includes(sportTerm)) {
    confidence += 10;
    matchedTerms.push(target.sport);
  }

  const brandTerm = normalize(target.brand);
  if (haystack.includes(brandTerm)) {
    confidence += 10;
    matchedTerms.push(target.brand);
  }

  if (haystack.includes("checklist")) {
    confidence += 15;
    matchedTerms.push("checklist");
  } else if (haystack.includes("cards")) {
    confidence += 10;
    matchedTerms.push("cards");
  } else {
    rejectedReasons.push("missing checklist/cards signal");
  }

  if (sourceName && sourceDomains[sourceName]) {
    confidence += 5;
    matchedTerms.push(sourceName);
  }

  if (discoveryMode === "known-pattern") confidence += 10;
  if (discoveryMode === "source-search-url") rejectedReasons.push("search page URL, not a direct checklist candidate");
  if (url.includes("google.com/search")) rejectedReasons.push("Google search URL is reference-only and not fetched");

  confidence = Math.min(100, confidence);
  const directPage = discoveryMode !== "source-search-url";
  const highConfidence = directPage && confidence >= 70 && rejectedReasons.filter((reason) => reason.startsWith("missing year") || reason.startsWith("missing product")).length === 0;
  const status: CandidateStatus = highConfidence ? "approved" : confidence >= 45 && directPage ? "candidate" : "rejected";

  return {
    confidence,
    matchedTerms: Array.from(new Set(matchedTerms)),
    rejectedReasons,
  status
  };
}

function candidateFromUrl({
  target,
  url,
  title,
  sourceName,
  discoveredFromQuery,
  discoveryMode
}: {
  target: ChecklistTarget;
  url: string;
  title: string;
  sourceName: string;
  discoveredFromQuery: string;
  discoveryMode: DiscoveryMode;
}): CandidateUrl {
  const match = matchCandidate({ target, url, title, sourceName, discoveryMode });
  return {
    url,
    sourceName,
    title,
    discoveredFromQuery,
    discoveredAt: new Date().toISOString(),
    discoveryMode,
    ...match
  };
}

function pageSlugVariants(target: ChecklistTarget) {
  const withBrand = uniqueTokens([target.year, target.brand, target.product, target.sport]).join("-");
  const withoutBrand = uniqueTokens([target.year, target.product, target.sport]).join("-");
  return Array.from(new Set([withBrand, withoutBrand].filter(Boolean)));
}

function knownPatternCandidates(target: ChecklistTarget) {
  const candidates: CandidateUrl[] = [];
  const title = readableTitle(target);
  const slugs = pageSlugVariants(target);
  const query = `${target.year} ${target.brand} ${target.product} ${target.sport} checklist`;

  for (const pageSlug of slugs) {
    candidates.push(
      candidateFromUrl({
        target,
        url: `https://www.beckett.com/news/${pageSlug}-cards/`,
        sourceName: "Beckett",
        title,
        discoveredFromQuery: query,
        discoveryMode: "known-pattern"
      }),
      candidateFromUrl({
        target,
        url: `https://www.beckett.com/news/${pageSlug}-checklist/`,
        sourceName: "Beckett",
        title,
        discoveredFromQuery: query,
        discoveryMode: "known-pattern"
      }),
      candidateFromUrl({
        target,
        url: `https://www.cardboardconnection.com/${pageSlug}-cards`,
        sourceName: "Cardboard Connection",
        title,
        discoveredFromQuery: query,
        discoveryMode: "known-pattern"
      }),
      candidateFromUrl({
        target,
        url: `https://www.cardboardconnection.com/${pageSlug}-checklist`,
        sourceName: "Cardboard Connection",
        title,
        discoveredFromQuery: query,
        discoveryMode: "known-pattern"
      })
    );
  }

  return candidates;
}

function searchUrlCandidates(target: ChecklistTarget, queries: SearchQuery[]) {
  return queries.map((query) =>
    candidateFromUrl({
      target,
      url: query.searchUrl,
      sourceName: query.sourceName,
      title: `${query.sourceName} search: ${query.query}`,
      discoveredFromQuery: query.query,
      discoveryMode: "source-search-url"
    })
  );
}

function extractSearchCandidates(html: string, query: SearchQuery, target: ChecklistTarget) {
  const candidates: CandidateUrl[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html))) {
    const url = normalizeSearchUrl(match[1]);
    const sourceName = sourceForUrl(url, target.preferredSources);
    if (!url || !sourceName) {
      if (url) {
        candidates.push(
          candidateFromUrl({
            target,
            url,
            sourceName: sourceName || "Unknown",
            title: stripTags(match[2]) || url,
            discoveredFromQuery: query.query,
            discoveryMode: "search-result"
          })
        );
      }
      continue;
    }

    candidates.push(
      candidateFromUrl({
        target,
        url,
        sourceName,
        title: stripTags(match[2]) || url,
        discoveredFromQuery: query.query,
        discoveryMode: "search-result"
      })
    );
  }

  return candidates;
}

async function fetchSearch(query: SearchQuery) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(query.searchUrl, {
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

async function verifyCandidate(candidate: CandidateUrl) {
  if (!verifyPatterns || candidate.discoveryMode !== "known-pattern" || candidate.status !== "approved") return candidate;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(candidate.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "ACVOSCatalogBuilder/1.0 (standalone checklist URL verification)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    const contentType = response.headers.get("content-type");
    return {
      ...candidate,
      verified: {
        attempted: true,
        ok: response.ok,
        httpStatus: response.status,
        contentType
      },
      status: response.ok ? candidate.status : "candidate",
      rejectedReasons: response.ok ? candidate.rejectedReasons : [...candidate.rejectedReasons, `verification returned HTTP ${response.status}`]
    } satisfies CandidateUrl;
  } catch (error) {
    return {
      ...candidate,
      verified: {
        attempted: true,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      status: "candidate",
      rejectedReasons: [...candidate.rejectedReasons, `verification failed: ${error instanceof Error ? error.message : String(error)}`]
    } satisfies CandidateUrl;
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueCandidates(candidates: CandidateUrl[]) {
  const byUrl = new Map<string, CandidateUrl>();
  candidates.forEach((candidate) => {
    const current = byUrl.get(candidate.url);
    if (!current || candidate.confidence > current.confidence) byUrl.set(candidate.url, candidate);
  });
  return Array.from(byUrl.values());
}

function approvedBySource(candidates: CandidateUrl[]) {
  const approved = candidates.filter((candidate) => candidate.status === "approved");
  const bySource = new Map<string, CandidateUrl>();

  approved.forEach((candidate) => {
    const current = bySource.get(candidate.sourceName);
    const candidateCardsBonus = candidate.url.includes("-cards") ? 1 : 0;
    const currentCardsBonus = current?.url.includes("-cards") ? 1 : 0;
    if (!current || candidate.confidence + candidateCardsBonus > current.confidence + currentCardsBonus) {
      bySource.set(candidate.sourceName, candidate);
    }
  });

  return Array.from(bySource.values());
}

async function readTargets() {
  const raw = await readFile(targetsPath, "utf8");
  const parsed = JSON.parse(raw) as { targets?: ChecklistTarget[] };
  return (parsed.targets || []).filter((target) => target.enabled);
}

async function discoverForTarget(target: ChecklistTarget): Promise<CandidateAuditResult> {
  const queries = buildQueries(target);
  const errors: string[] = [];
  let candidates = [...knownPatternCandidates(target), ...searchUrlCandidates(target, queries)];

  for (const query of queries.filter((item) => item.fetchable)) {
    try {
      const html = await fetchSearch(query);
      candidates.push(...extractSearchCandidates(html, query, target));
    } catch (error) {
      errors.push(`${query.sourceName} / ${query.query}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  candidates = await Promise.all(uniqueCandidates(candidates).map(verifyCandidate));
  const approvedCandidates = approvedBySource(candidates);
  const rejectedCandidates = candidates.filter((candidate) => candidate.status === "rejected" || (candidate.status === "candidate" && !approvedCandidates.some((approved) => approved.url === candidate.url)));
  const status = approvedCandidates.length > 0 ? "found" : errors.length > 0 ? "error" : "not_found";
  const notFoundReason = approvedCandidates.length === 0 ? [...new Set([...rejectedCandidates.flatMap((candidate) => candidate.rejectedReasons), ...errors])].slice(0, 5).join("; ") || "No high-confidence checklist URL candidates found." : undefined;

  return {
    targetId: targetId(target),
    target,
    queries,
    candidates,
    approvedCandidates,
    rejectedCandidates,
    status,
    errors,
    notFoundReason
  };
}

async function main() {
  await mkdir(path.dirname(approvedPath), { recursive: true });
  await mkdir(logsDir, { recursive: true });

  const enabledTargets = await readTargets();
  const results: CandidateAuditResult[] = [];

  for (const target of enabledTargets) {
    const result = await discoverForTarget(target);
    results.push(result);
    console.log(
      `[${result.targetId}] queries=${result.queries.length} candidates=${result.candidates.length} approved=${result.approvedCandidates.length} rejected=${result.rejectedCandidates.length}${result.notFoundReason ? ` reason=${result.notFoundReason}` : ""}`
    );
  }

  const generatedAt = new Date().toISOString();
  const candidatesOutput = {
    schemaVersion: 2,
    generatedAt,
    discoveryMode: {
      knownPatterns: true,
      fetchSearchResults,
      verifyPatterns
    },
    results
  };
  const approvedOutput = {
    schemaVersion: 2,
    generatedAt,
    results: results.map((result) => ({
      targetId: result.targetId,
      target: result.target,
      queries: result.queries.map((query) => query.query),
      candidates: result.approvedCandidates,
      status: result.status,
      errors: result.errors,
      notFoundReason: result.notFoundReason
    }))
  };
  const log = {
    runId: createHash("sha1").update(generatedAt).digest("hex").slice(0, 10),
    generatedAt,
    targets: results.length,
    found: results.filter((result) => result.approvedCandidates.length > 0).length,
    notFound: results.filter((result) => result.approvedCandidates.length === 0 && result.errors.length === 0).length,
    approvedCandidates: results.reduce((total, result) => total + result.approvedCandidates.length, 0),
    rejectedCandidates: results.reduce((total, result) => total + result.rejectedCandidates.length, 0),
    errors: results.flatMap((result) => result.errors.map((error) => ({ targetId: result.targetId, error }))),
    rejectedSamples: results.flatMap((result) =>
      result.rejectedCandidates.slice(0, 3).map((candidate) => ({
        targetId: result.targetId,
        url: candidate.url,
        confidence: candidate.confidence,
        reasons: candidate.rejectedReasons
      }))
    )
  };

  await writeFile(candidatePath, `${JSON.stringify(candidatesOutput, null, 2)}\n`);
  await writeFile(approvedPath, `${JSON.stringify(approvedOutput, null, 2)}\n`);
  await writeFile(path.join(logsDir, `discover-${log.runId}.json`), `${JSON.stringify(log, null, 2)}\n`);

  console.log(`Sports checklist discovery complete: ${log.found}/${log.targets} targets found.`);
  console.log(`Approved candidates: ${log.approvedCandidates}. Rejected/candidate audit entries: ${log.rejectedCandidates}.`);
  if (log.errors.length > 0) console.log(`Discovery logged ${log.errors.length} search error(s).`);
  console.log(`Saved all candidates: ${path.relative(rootDir, candidatePath)}`);
  console.log(`Saved approved URLs: ${path.relative(rootDir, approvedPath)}`);
}

main().catch((error) => {
  console.error("Sports checklist discovery failed.");
  console.error(error);
  process.exitCode = 1;
});
