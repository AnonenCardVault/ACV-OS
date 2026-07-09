import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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
  status: string;
  errors: string[];
};

type NormalizedRow = {
  sport: string;
  year: string;
  brand: string;
  product: string;
  subset: string | null;
  cardNumber: string | null;
  player: string | null;
  team: string | null;
  rookie: boolean;
  auto: boolean;
  relic: boolean;
  parallel: string | null;
  sourceUrl: string;
  sourceName: string;
};

type ImportLogEntry = {
  targetId: string;
  sourceUrl: string;
  sourceName: string;
  rawPath?: string;
  normalizedPath?: string;
  fetched: boolean;
  rows: number;
  error?: string;
};

const rootDir = process.cwd();
const baseDir = path.join(rootDir, "data", "imports", "sports-checklists");
const discoveredPath = path.join(baseDir, "discovered-urls", "checklist-urls.json");
const rawDir = path.join(baseDir, "raw");
const normalizedDir = path.join(baseDir, "normalized");
const logsDir = path.join(baseDir, "logs");
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function randomDelayMs() {
  return 3_000 + Math.floor(Math.random() * 4_001);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: "\"",
    apos: "'",
    "#39": "'",
    lt: "<",
    gt: ">",
    nbsp: " "
  };

  return value
    .replace(/&([a-zA-Z0-9#]+);/g, (match, entity: string) => named[entity] || match)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function textFromHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<(br|p|div|li|tr|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
  );
}

function flagsFromText(text: string) {
  return {
    rookie: /\b(RC|rookie)\b/i.test(text),
    auto: /\b(auto|autograph|signature|signed)\b/i.test(text),
    relic: /\b(relic|patch|jersey|memorabilia|materials?)\b/i.test(text)
  };
}

function parallelFromText(text: string) {
  const match = text.match(/\b(Silver|Gold|Gold Wave|Blue|Red|Green|Orange|Purple|Black|Refractor|X-Fractor|Mosaic|Mojo|Scope|Hyper|Wave|Cracked Ice|Holo|Disco|Choice|Genesis|Zebra|Tie-Dye|Sepia|Pink|Aqua)\b/i);
  return match ? match[1] : null;
}

function cleanField(value?: string | null) {
  if (!value) return null;
  const cleaned = stripTags(value).replace(/^#/, "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function parseChecklistLine(line: string, context: { target: ChecklistTarget; sourceUrl: string; sourceName: string; subset?: string | null }): NormalizedRow | null {
  const text = stripTags(line).replace(/\s+/g, " ").trim();
  if (!text || text.length < 4 || text.length > 220) return null;
  if (/^(card\s*#|number|player|team|set|subset)$/i.test(text)) return null;

  const patterns = [
    /^#?([A-Za-z0-9./-]{1,18})\s+(.+?)\s+-\s+(.+)$/,
    /^#?([A-Za-z0-9./-]{1,18})\s*[-–]\s*(.+?)\s*[-–]\s*(.+)$/,
    /^#?([A-Za-z0-9./-]{1,18})\s+(.+)$/
  ];
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
  if (!match) return null;

  const cardNumber = cleanField(match[1]);
  const player = cleanField(match[2]);
  const team = cleanField(match[3]);
  if (!cardNumber || !player) return null;
  if (!/[0-9A-Za-z]/.test(cardNumber) || player.length < 2) return null;

  const flags = flagsFromText(text);

  return {
    sport: context.target.sport,
    year: context.target.year,
    brand: context.target.brand,
    product: context.target.product,
    subset: context.subset || null,
    cardNumber,
    player,
    team,
    rookie: flags.rookie,
    auto: flags.auto,
    relic: flags.relic,
    parallel: parallelFromText(text),
    sourceUrl: context.sourceUrl,
    sourceName: context.sourceName
  };
}

function extractCells(rowHtml: string) {
  const cells: string[] = [];
  const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;

  while ((match = cellPattern.exec(rowHtml))) {
    const value = cleanField(match[1]);
    if (value) cells.push(value);
  }

  return cells;
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.some((name) => header.toLowerCase().includes(name)));
}

function rowFromTableCells(cells: string[], headers: string[], context: { target: ChecklistTarget; sourceUrl: string; sourceName: string }): NormalizedRow | null {
  if (cells.length < 2) return null;
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const cardIndex = headerIndex(normalizedHeaders, ["card", "#", "no.", "number"]);
  const playerIndex = headerIndex(normalizedHeaders, ["player", "name", "subject"]);
  const teamIndex = headerIndex(normalizedHeaders, ["team"]);
  const subsetIndex = headerIndex(normalizedHeaders, ["subset", "insert", "set"]);

  const cardNumber = cleanField(cells[cardIndex >= 0 ? cardIndex : 0]);
  const player = cleanField(cells[playerIndex >= 0 ? playerIndex : 1]);
  const team = teamIndex >= 0 ? cleanField(cells[teamIndex]) : cells.length > 2 ? cleanField(cells[2]) : null;
  const subset = subsetIndex >= 0 ? cleanField(cells[subsetIndex]) : null;
  if (!cardNumber || !player || /card\s*#/i.test(cardNumber)) return null;

  const rowText = cells.join(" ");
  const flags = flagsFromText(rowText);

  return {
    sport: context.target.sport,
    year: context.target.year,
    brand: context.target.brand,
    product: context.target.product,
    subset,
    cardNumber,
    player,
    team,
    rookie: flags.rookie,
    auto: flags.auto,
    relic: flags.relic,
    parallel: parallelFromText(rowText),
    sourceUrl: context.sourceUrl,
    sourceName: context.sourceName
  };
}

function parseTables(html: string, context: { target: ChecklistTarget; sourceUrl: string; sourceName: string }) {
  const rows: NormalizedRow[] = [];
  const tablePattern = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(html))) {
    const tableHtml = tableMatch[1];
    const trPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let headers: string[] = [];
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = trPattern.exec(tableHtml))) {
      const rowHtml = rowMatch[1];
      const cells = extractCells(rowHtml);
      if (cells.length === 0) continue;
      const isHeader = /<th\b/i.test(rowHtml) || cells.some((cell) => /^(card|card #|#|player|team|name|subset)$/i.test(cell));
      if (isHeader) {
        headers = cells;
        continue;
      }

      const parsed = rowFromTableCells(cells, headers, context);
      if (parsed) rows.push(parsed);
    }
  }

  return rows;
}

function parseLists(html: string, context: { target: ChecklistTarget; sourceUrl: string; sourceName: string }) {
  const rows: NormalizedRow[] = [];
  const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liPattern.exec(html))) {
    const parsed = parseChecklistLine(match[1], context);
    if (parsed) rows.push(parsed);
  }

  return rows;
}

function parsePlainText(html: string, context: { target: ChecklistTarget; sourceUrl: string; sourceName: string }) {
  const rows: NormalizedRow[] = [];
  let subset: string | null = null;
  const lines = textFromHtml(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/checklist$/i.test(line) && line.length < 90) {
      subset = line.replace(/\s*checklist$/i, "").trim() || null;
      continue;
    }

    const parsed = parseChecklistLine(line, { ...context, subset });
    if (parsed) rows.push(parsed);
  }

  return rows;
}

function uniqueRows(rows: NormalizedRow[]) {
  const byKey = new Map<string, NormalizedRow>();
  rows.forEach((row) => {
    const key = [row.sourceUrl, row.subset, row.cardNumber, row.player, row.team].map((value) => String(value || "").toLowerCase()).join("|");
    if (!byKey.has(key)) byKey.set(key, row);
  });
  return Array.from(byKey.values());
}

function parseRows(html: string, context: { target: ChecklistTarget; sourceUrl: string; sourceName: string }) {
  return uniqueRows([...parseTables(html, context), ...parseLists(html, context), ...parsePlainText(html, context)]);
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ACVOSCatalogBuilder/1.0 (standalone checklist import; respectful cache-first fetch)",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${await response.text()}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function readDiscovered() {
  if (!existsSync(discoveredPath)) {
    return { schemaVersion: 1, generatedAt: new Date().toISOString(), results: [] as DiscoveryResult[] };
  }
  const raw = await readFile(discoveredPath, "utf8");
  return JSON.parse(raw) as { results?: DiscoveryResult[] };
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(normalizedDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  const discovered = await readDiscovered();
  const targetCandidates = (discovered.results || []).flatMap((result) =>
    (result.candidates || []).map((candidate) => ({
      targetId: result.targetId,
      target: result.target,
      candidate
    }))
  );
  const selectedCandidates = limit > 0 ? targetCandidates.slice(0, limit) : targetCandidates;
  const allRows: NormalizedRow[] = [];
  const logEntries: ImportLogEntry[] = [];
  let liveRequestCount = 0;

  for (const item of selectedCandidates) {
    const targetRawDir = path.join(rawDir, item.targetId);
    await mkdir(targetRawDir, { recursive: true });
    const rawPath = path.join(targetRawDir, `${slug(item.candidate.sourceName)}-${hash(item.candidate.url)}.html`);
    let html = "";
    let fetched = false;

    try {
      if (!force && existsSync(rawPath)) {
        html = await readFile(rawPath, "utf8");
      } else {
        if (liveRequestCount > 0) {
          const delay = randomDelayMs();
          console.log(`Waiting ${(delay / 1000).toFixed(1)}s before next checklist request...`);
          await sleep(delay);
        }

        html = await fetchHtml(item.candidate.url);
        await writeFile(rawPath, html);
        fetched = true;
        liveRequestCount += 1;
      }

      const rows = parseRows(html, {
        target: item.target,
        sourceUrl: item.candidate.url,
        sourceName: item.candidate.sourceName
      });
      allRows.push(...rows);
      logEntries.push({
        targetId: item.targetId,
        sourceUrl: item.candidate.url,
        sourceName: item.candidate.sourceName,
        rawPath: path.relative(rootDir, rawPath),
        fetched,
        rows: rows.length
      });
    } catch (error) {
      logEntries.push({
        targetId: item.targetId,
        sourceUrl: item.candidate.url,
        sourceName: item.candidate.sourceName,
        rawPath: path.relative(rootDir, rawPath),
        fetched,
        rows: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const rowsByTarget = new Map<string, NormalizedRow[]>();
  for (const row of uniqueRows(allRows)) {
    const target = [row.sport, row.year, row.brand, row.product].map(slug).join("-");
    rowsByTarget.set(target, [...(rowsByTarget.get(target) || []), row]);
  }

  for (const [targetId, rows] of rowsByTarget) {
    const normalizedPath = path.join(normalizedDir, `${targetId}.json`);
    await writeFile(
      normalizedPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          targetId,
          rowCount: rows.length,
          rows
        },
        null,
        2
      )}\n`
    );
    logEntries
      .filter((entry) => entry.targetId === targetId)
      .forEach((entry) => {
        entry.normalizedPath = path.relative(rootDir, normalizedPath);
      });
  }

  const allNormalizedPath = path.join(normalizedDir, "all-normalized.json");
  const uniqueAllRows = uniqueRows(allRows);
  await writeFile(
    allNormalizedPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        rowCount: uniqueAllRows.length,
        rows: uniqueAllRows
      },
      null,
      2
    )}\n`
  );

  const runId = createHash("sha1").update(`${Date.now()}-${uniqueAllRows.length}`).digest("hex").slice(0, 10);
  const log = {
    runId,
    generatedAt: new Date().toISOString(),
    force,
    candidates: selectedCandidates.length,
    liveRequests: liveRequestCount,
    rawPages: logEntries.filter((entry) => entry.rawPath && !entry.error).length,
    normalizedRows: uniqueAllRows.length,
    errors: logEntries.filter((entry) => entry.error),
    entries: logEntries
  };
  await writeFile(path.join(logsDir, `import-${runId}.json`), `${JSON.stringify(log, null, 2)}\n`);

  console.log(`Sports checklist import complete: ${uniqueAllRows.length} normalized row(s) from ${selectedCandidates.length} candidate URL(s).`);
  if (log.errors.length > 0) console.log(`Import logged ${log.errors.length} error(s).`);
  if (selectedCandidates.length === 0) console.log("No discovered URLs found yet. Run pnpm discover:sports-checklists or add candidates to checklist-urls.json.");
  console.log(`Saved normalized aggregate: ${path.relative(rootDir, allNormalizedPath)}`);
}

main().catch((error) => {
  console.error("Sports checklist import failed.");
  console.error(error);
  process.exitCode = 1;
});
