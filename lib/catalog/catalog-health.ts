import "server-only";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type SportsCatalogRow = {
  sport?: string | null;
  year?: string | number | null;
  brand?: string | null;
  product?: string | null;
};

type SportsDiagnostic = {
  provider?: string;
  rowsFound?: number;
  rowsAccepted?: number;
  rowsRejected?: number;
  duplicateCount?: number;
  navigationRowsRemoved?: number;
  validationFailures?: Record<string, number>;
  acceptanceRate?: number;
};

type SportsCatalogFile = {
  generatedAt?: string;
  diagnostics?: SportsDiagnostic[];
  diagnosticsSummary?: CatalogDiagnosticsSummary;
  rowCount?: number;
  rows?: SportsCatalogRow[];
};

type ImportLogError = {
  targetId?: string;
  sourceName?: string;
  sourceUrl?: string;
  error?: string;
};

type ImportLogFile = {
  generatedAt?: string;
  normalizedRows?: number;
  diagnosticsSummary?: CatalogDiagnosticsSummary;
  errors?: ImportLogError[];
};

type DiscoveryManifest = {
  generatedAt?: string;
  results?: Array<{
    status?: string;
    candidates?: unknown[];
  }>;
};

type TargetManifest = Array<{
  enabled?: boolean;
}>;

export type CatalogHealthStatus = "available" | "missing" | "error";

export type CatalogCount = {
  label: string;
  count: number;
  detail?: string;
};

export type CatalogDiagnosticsSummary = {
  rowsFound?: number;
  rowsAccepted?: number;
  rowsRejected?: number;
  duplicateCount?: number;
  navigationRowsRemoved?: number;
  acceptanceRate?: number;
  providers?: CatalogCount[];
  validationFailures?: CatalogCount[];
};

export type CatalogHealthSummary = {
  checkedAt: string;
  pokemon: {
    status: CatalogHealthStatus;
    cardCount: number;
    setCount: number;
    rootPath?: string;
    lastUpdated?: string;
    message?: string;
  };
  sports: {
    status: CatalogHealthStatus;
    totalRows: number;
    generatedAt?: string;
    artifactPath: string;
    message?: string;
    countsBySport: CatalogCount[];
    countsByYear: CatalogCount[];
    countsByBrandProduct: CatalogCount[];
    diagnostics?: CatalogDiagnosticsSummary;
    targetCount?: number;
    enabledTargetCount?: number;
    approvedUrlCount?: number;
    discoveredTargetCount?: number;
    missingTargetCount?: number;
    latestImportLogAt?: string;
    failedTargets: Array<{
      targetId?: string;
      sourceName?: string;
      sourceUrl?: string;
      error: string;
    }>;
  };
};

const sportsCatalogPath = path.join(process.cwd(), "data", "imports", "sports-checklists", "normalized", "all-normalized.json");
const sportsTargetsPath = path.join(process.cwd(), "data", "imports", "sports-checklists", "targets", "sports-checklist-targets.json");
const sportsUrlManifestPath = path.join(process.cwd(), "data", "imports", "sports-checklists", "discovered-urls", "checklist-urls.json");
const sportsLogsDir = path.join(process.cwd(), "data", "imports", "sports-checklists", "logs");

function pokemonCandidateRoots() {
  return [
    path.join(process.cwd(), "data", "knowledge", "pokemon"),
    path.join(process.cwd(), "data", "knowledge:", "pokemon:")
  ];
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function normalizeLabel(value: unknown) {
  const text = String(value || "").trim();
  return text || "Unknown";
}

function addCount(map: Map<string, number>, key: unknown) {
  const label = normalizeLabel(key);
  map.set(label, (map.get(label) || 0) + 1);
}

function mapToCounts(map: Map<string, number>, limit?: number): CatalogCount[] {
  const counts = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return typeof limit === "number" ? counts.slice(0, limit) : counts;
}

function sumDiagnostics(diagnostics: SportsDiagnostic[]): CatalogDiagnosticsSummary {
  const providers = new Map<string, number>();
  const validationFailures = new Map<string, number>();
  const summary: CatalogDiagnosticsSummary = {
    rowsFound: 0,
    rowsAccepted: 0,
    rowsRejected: 0,
    duplicateCount: 0,
    navigationRowsRemoved: 0
  };

  for (const diagnostic of diagnostics) {
    summary.rowsFound = (summary.rowsFound || 0) + (diagnostic.rowsFound || 0);
    summary.rowsAccepted = (summary.rowsAccepted || 0) + (diagnostic.rowsAccepted || 0);
    summary.rowsRejected = (summary.rowsRejected || 0) + (diagnostic.rowsRejected || 0);
    summary.duplicateCount = (summary.duplicateCount || 0) + (diagnostic.duplicateCount || 0);
    summary.navigationRowsRemoved = (summary.navigationRowsRemoved || 0) + (diagnostic.navigationRowsRemoved || 0);
    if (diagnostic.provider) providers.set(diagnostic.provider, (providers.get(diagnostic.provider) || 0) + (diagnostic.rowsAccepted || 0));

    for (const [reason, count] of Object.entries(diagnostic.validationFailures || {})) {
      validationFailures.set(reason, (validationFailures.get(reason) || 0) + count);
    }
  }

  summary.acceptanceRate = summary.rowsFound ? (summary.rowsAccepted || 0) / summary.rowsFound : undefined;
  summary.providers = mapToCounts(providers);
  summary.validationFailures = mapToCounts(validationFailures, 8);
  return summary;
}

async function getPokemonCatalogHealth(): Promise<CatalogHealthSummary["pokemon"]> {
  for (const rootPath of pokemonCandidateRoots()) {
    try {
      await stat(rootPath);
      const setsPath = path.join(rootPath, "sets", "en.json");
      const sets = (await readJson<unknown[]>(setsPath)) || [];
      const cardsDir = path.join(rootPath, "cards", "en");
      const cardFiles = (await readdir(cardsDir).catch(() => [])).filter((fileName) => fileName.endsWith(".json"));
      let cardCount = 0;
      let latestMtime = 0;

      const setsStat = await stat(setsPath).catch(() => undefined);
      if (setsStat) latestMtime = Math.max(latestMtime, setsStat.mtimeMs);

      for (const fileName of cardFiles) {
        const filePath = path.join(cardsDir, fileName);
        const cards = await readJson<unknown[]>(filePath);
        cardCount += Array.isArray(cards) ? cards.length : 0;
        const fileStat = await stat(filePath).catch(() => undefined);
        if (fileStat) latestMtime = Math.max(latestMtime, fileStat.mtimeMs);
      }

      return {
        status: cardCount > 0 ? "available" : "missing",
        cardCount,
        setCount: Array.isArray(sets) ? sets.length : 0,
        rootPath,
        lastUpdated: latestMtime ? new Date(latestMtime).toISOString() : undefined,
        message: cardCount > 0 ? undefined : "Pokémon catalog folder exists, but no card records were found."
      };
    } catch {
      // Try the next supported local dataset layout.
    }
  }

  return {
    status: "missing",
    cardCount: 0,
    setCount: 0,
    message: "Pokémon catalog files were not found in data/knowledge/pokemon."
  };
}

async function getSportsManifestCounts() {
  const targets = await readJson<TargetManifest>(sportsTargetsPath);
  const discovery = await readJson<DiscoveryManifest>(sportsUrlManifestPath);
  const results = Array.isArray(discovery?.results) ? discovery.results : [];

  return {
    targetCount: Array.isArray(targets) ? targets.length : undefined,
    enabledTargetCount: Array.isArray(targets) ? targets.filter((target) => target.enabled).length : undefined,
    approvedUrlCount: results.reduce((count, result) => count + (Array.isArray(result.candidates) ? result.candidates.length : 0), 0),
    discoveredTargetCount: results.filter((result) => result.status === "found").length,
    missingTargetCount: results.filter((result) => result.status && result.status !== "found").length
  };
}

async function getLatestImportLog() {
  try {
    const entries = await readdir(sportsLogsDir);
    const logs = await Promise.all(
      entries
        .filter((fileName) => fileName.startsWith("import-") && fileName.endsWith(".json"))
        .map(async (fileName) => {
          const filePath = path.join(sportsLogsDir, fileName);
          const fileStat = await stat(filePath);
          return { filePath, mtimeMs: fileStat.mtimeMs };
        })
    );
    const latest = logs.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    return latest ? readJson<ImportLogFile>(latest.filePath) : undefined;
  } catch {
    return undefined;
  }
}

async function getSportsCatalogHealth(): Promise<CatalogHealthSummary["sports"]> {
  const manifestCounts = await getSportsManifestCounts();
  const latestLog = await getLatestImportLog();

  try {
    const fileStat = await stat(sportsCatalogPath);
    const catalog = await readJson<SportsCatalogFile>(sportsCatalogPath);
    const rows = Array.isArray(catalog?.rows) ? catalog.rows : [];
    const countsBySport = new Map<string, number>();
    const countsByYear = new Map<string, number>();
    const countsByBrandProduct = new Map<string, number>();

    for (const row of rows) {
      addCount(countsBySport, row.sport);
      addCount(countsByYear, row.year);
      addCount(countsByBrandProduct, `${normalizeLabel(row.brand)} ${normalizeLabel(row.product)}`);
    }

    const diagnostics =
      catalog?.diagnosticsSummary ||
      latestLog?.diagnosticsSummary ||
      (Array.isArray(catalog?.diagnostics) ? sumDiagnostics(catalog.diagnostics) : undefined);

    return {
      status: "available",
      totalRows: catalog?.rowCount || rows.length || latestLog?.normalizedRows || 0,
      generatedAt: catalog?.generatedAt || new Date(fileStat.mtimeMs).toISOString(),
      artifactPath: sportsCatalogPath,
      countsBySport: mapToCounts(countsBySport),
      countsByYear: mapToCounts(countsByYear),
      countsByBrandProduct: mapToCounts(countsByBrandProduct, 18),
      diagnostics,
      latestImportLogAt: latestLog?.generatedAt,
      failedTargets: (latestLog?.errors || []).slice(0, 10).map((error) => ({
        targetId: error.targetId,
        sourceName: error.sourceName,
        sourceUrl: error.sourceUrl,
        error: error.error || "Unknown import error"
      })),
      ...manifestCounts
    };
  } catch (error) {
    return {
      status: "missing",
      totalRows: latestLog?.normalizedRows || 0,
      generatedAt: latestLog?.generatedAt,
      artifactPath: sportsCatalogPath,
      message: error instanceof Error ? error.message : "Sports normalized catalog file was not found.",
      countsBySport: [],
      countsByYear: [],
      countsByBrandProduct: [],
      diagnostics: latestLog?.diagnosticsSummary,
      latestImportLogAt: latestLog?.generatedAt,
      failedTargets: (latestLog?.errors || []).slice(0, 10).map((logError) => ({
        targetId: logError.targetId,
        sourceName: logError.sourceName,
        sourceUrl: logError.sourceUrl,
        error: logError.error || "Unknown import error"
      })),
      ...manifestCounts
    };
  }
}

export async function getCatalogHealthSummary(): Promise<CatalogHealthSummary> {
  const [pokemon, sports] = await Promise.all([getPokemonCatalogHealth(), getSportsCatalogHealth()]);

  return {
    checkedAt: new Date().toISOString(),
    pokemon,
    sports
  };
}
