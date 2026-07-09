import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseChecklistHtml } from "../lib/catalog/parsers/parser-registry.ts";
import { dedupeNormalizedRows, type ChecklistParserDiagnostics, type ChecklistTarget, type NormalizedChecklistRow } from "../lib/catalog/parsers/validation.ts";

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
  queries: string[] | unknown[];
  candidates: CandidateUrl[];
  status: string;
  errors: string[];
};

type ImportLogEntry = {
  targetId: string;
  sourceUrl: string;
  sourceName: string;
  rawPath?: string;
  normalizedPath?: string;
  fetched: boolean;
  rows: number;
  diagnostics?: ChecklistParserDiagnostics;
  error?: string;
};

const rootDir = process.cwd();
const baseDir = path.join(rootDir, "data", "imports", "sports-checklists");
const discoveredPath = path.join(baseDir, "discovered-urls", "checklist-urls.json");
const rawDir = path.join(baseDir, "raw");
const normalizedDir = path.join(baseDir, "normalized");
const logsDir = path.join(baseDir, "logs");
const force = process.argv.includes("--force");
const cachedOnly = process.argv.includes("--cached-only");
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

function diagnosticsForTarget(logEntries: ImportLogEntry[], targetId: string) {
  return logEntries
    .filter((entry) => entry.targetId === targetId && entry.diagnostics)
    .map((entry) => entry.diagnostics);
}

function summarizeDiagnostics(logEntries: ImportLogEntry[]) {
  return logEntries.reduce(
    (summary, entry) => {
      if (!entry.diagnostics) return summary;
      summary.rowsFound += entry.diagnostics.rowsFound;
      summary.rowsAccepted += entry.diagnostics.rowsAccepted;
      summary.rowsRejected += entry.diagnostics.rowsRejected;
      summary.duplicateCount += entry.diagnostics.duplicateCount;
      summary.navigationRowsRemoved += entry.diagnostics.navigationRowsRemoved;
      return summary;
    },
    {
      rowsFound: 0,
      rowsAccepted: 0,
      rowsRejected: 0,
      duplicateCount: 0,
      navigationRowsRemoved: 0
    }
  );
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
  const allRows: NormalizedChecklistRow[] = [];
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
      } else if (cachedOnly) {
        throw new Error("Raw HTML not cached; skipped by --cached-only.");
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

      const parsed = parseChecklistHtml(html, {
        target: item.target,
        sourceUrl: item.candidate.url,
        sourceName: item.candidate.sourceName
      });
      const rows = parsed.rows;
      allRows.push(...rows);
      logEntries.push({
        targetId: item.targetId,
        sourceUrl: item.candidate.url,
        sourceName: item.candidate.sourceName,
        rawPath: path.relative(rootDir, rawPath),
        fetched,
        rows: rows.length,
        diagnostics: parsed.diagnostics
      });
      console.log(
        `${item.targetId} / ${item.candidate.sourceName}: ${parsed.diagnostics.rowsAccepted}/${parsed.diagnostics.rowsFound} accepted, ${parsed.diagnostics.navigationRowsRemoved} navigation row(s) removed.`
      );
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

  const rowsByTarget = new Map<string, NormalizedChecklistRow[]>();
  for (const row of dedupeNormalizedRows(allRows)) {
    const target = [row.sport, row.year, row.brand, row.product].map(slug).join("-");
    rowsByTarget.set(target, [...(rowsByTarget.get(target) || []), row]);
  }

  for (const [targetId, rows] of rowsByTarget) {
    const normalizedPath = path.join(normalizedDir, `${targetId}.json`);
    await writeFile(
      normalizedPath,
      `${JSON.stringify(
        {
          schemaVersion: 2,
          generatedAt: new Date().toISOString(),
          targetId,
          diagnostics: diagnosticsForTarget(logEntries, targetId),
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
  const uniqueAllRows = dedupeNormalizedRows(allRows);
  await writeFile(
    allNormalizedPath,
    `${JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        diagnostics: logEntries.filter((entry) => entry.diagnostics).map((entry) => entry.diagnostics),
        diagnosticsSummary: summarizeDiagnostics(logEntries),
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
    cachedOnly,
    candidates: selectedCandidates.length,
    liveRequests: liveRequestCount,
    rawPages: logEntries.filter((entry) => entry.rawPath && !entry.error).length,
    normalizedRows: uniqueAllRows.length,
    diagnosticsSummary: summarizeDiagnostics(logEntries),
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
