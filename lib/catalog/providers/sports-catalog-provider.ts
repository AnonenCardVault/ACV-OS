import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtractedCardFields } from "@/lib/ai/types";
import type { CatalogMatchedCard, CatalogProvider, CatalogValidationInput, CatalogValidationResult, CatalogValidationWarning } from "@/lib/catalog/types";

type SportsCatalogRow = {
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

type SportsCatalogFile = {
  rows?: SportsCatalogRow[];
};

type SportsCatalogIndexBucket = {
  records?: SportsCatalogRow[];
  indexes?: {
    exactCard?: Record<string, number[]>;
    productPlayer?: Record<string, number[]>;
    player?: Record<string, number[]>;
    product?: Record<string, number[]>;
    playerSearch?: Record<string, number[]>;
  };
};

type SportsCatalogIndexManifest = {
  generatedAt?: string;
  indexedRecordCount?: number;
  buckets?: Record<string, { file: string; rowCount: number }>;
};

type LoadedSportsCatalog = {
  rows: SportsCatalogRow[];
  bySportYear: Map<string, SportsCatalogRow[]>;
  loadError?: string;
};

type SportsSearchResult = {
  rows: SportsCatalogRow[];
  loadError?: string;
};

type ScoredSportsRow = {
  row: SportsCatalogRow;
  score: number;
  warnings: CatalogValidationWarning[];
  evidence: string[];
};

const sportsCategories = new Set(["baseball", "football", "basketball"]);
const maxCatalogCandidates = 5;
let catalogPromise: Promise<LoadedSportsCatalog> | undefined;
let indexManifestPromise: Promise<{ manifest?: SportsCatalogIndexManifest; loadError?: string }> | undefined;
const indexBucketPromises = new Map<string, Promise<SportsCatalogIndexBucket | undefined>>();

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCompact(value: unknown) {
  return normalize(value).replace(/\s+/g, "");
}

function normalizeNumber(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/^#/, "")
    .split("/")
    [0].replace(/[^a-z0-9]/g, "");
}

function hasValue(value: unknown) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "-");
}

function specificSport(value: unknown) {
  const sport = normalize(value);
  return sportsCategories.has(sport) ? sport : "";
}

function sportsCatalogPath() {
  return process.env.ACV_SPORTS_CATALOG_PATH || path.join(process.cwd(), "data", "imports", "sports-checklists", "normalized", "all-normalized.json");
}

function sportsCatalogIndexDir() {
  return process.env.ACV_SPORTS_CATALOG_INDEX_DIR || path.join(process.cwd(), "data", "imports", "sports-checklists", "index");
}

function sportsCatalogIndexManifestPath() {
  return path.join(sportsCatalogIndexDir(), "manifest.json");
}

function indexKey(...parts: unknown[]) {
  const normalizedParts = parts.map((part) => normalize(part));
  return normalizedParts.every(Boolean) ? normalizedParts.join("|") : "";
}

async function loadSportsCatalog(): Promise<LoadedSportsCatalog> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    try {
      const raw = await readFile(sportsCatalogPath(), "utf8");
      const parsed = JSON.parse(raw) as SportsCatalogFile;
      const rows = Array.isArray(parsed.rows) ? parsed.rows.filter((row) => row && row.sport && row.year && row.product) : [];
      const bySportYear = new Map<string, SportsCatalogRow[]>();

      for (const row of rows) {
        const key = sportYearKey(row.sport, row.year);
        bySportYear.set(key, [...(bySportYear.get(key) || []), row]);
      }

      return { rows, bySportYear };
    } catch (error) {
      return {
        rows: [],
        bySportYear: new Map(),
        loadError: error instanceof Error ? error.message : String(error)
      };
    }
  })();

  return catalogPromise;
}

async function loadSportsCatalogIndexManifest() {
  if (indexManifestPromise) return indexManifestPromise;
  indexManifestPromise = (async () => {
    try {
      const raw = await readFile(sportsCatalogIndexManifestPath(), "utf8");
      return { manifest: JSON.parse(raw) as SportsCatalogIndexManifest };
    } catch (error) {
      return { loadError: error instanceof Error ? error.message : String(error) };
    }
  })();

  return indexManifestPromise;
}

async function loadSportsCatalogIndexBucket(bucketKey: string) {
  if (indexBucketPromises.has(bucketKey)) return indexBucketPromises.get(bucketKey);
  const promise = (async () => {
    const { manifest } = await loadSportsCatalogIndexManifest();
    const bucket = manifest?.buckets?.[bucketKey];
    if (!bucket?.file) return undefined;

    try {
      const raw = await readFile(path.join(sportsCatalogIndexDir(), bucket.file), "utf8");
      return JSON.parse(raw) as SportsCatalogIndexBucket;
    } catch {
      return undefined;
    }
  })();
  indexBucketPromises.set(bucketKey, promise);
  return promise;
}

function sportYearKey(sport: unknown, year: unknown) {
  return indexKey(sport, year);
}

function rowSubject(row: SportsCatalogRow) {
  const player = String(row.player || "").trim();
  return player.includes(",") ? player.split(",")[0].trim() : player;
}

function rowTeam(row: SportsCatalogRow) {
  if (hasValue(row.team)) return String(row.team).trim();
  const player = String(row.player || "");
  return player.includes(",") ? player.split(",").slice(1).join(",").trim() || null : null;
}

function includesNormalized(haystack: unknown, needle: unknown) {
  const source = normalize(haystack);
  const target = normalize(needle);
  return Boolean(source && target && (source === target || source.includes(target) || target.includes(source)));
}

function nameMatches(input: string, catalogName: string) {
  const a = normalize(input);
  const b = normalize(catalogName);
  if (!a || !b) return { exact: false, partial: false };
  return {
    exact: a === b,
    partial: a.includes(b) || b.includes(a)
  };
}

function productMatches(fields: ExtractedCardFields, row: SportsCatalogRow) {
  return [fields.set, fields.cardTitle].some((value) => includesNormalized(value, row.product));
}

function subsetMatches(fields: ExtractedCardFields, row: SportsCatalogRow) {
  return Boolean(row.subset && [fields.set, fields.cardTitle, fields.parallel].some((value) => includesNormalized(value, row.subset)));
}

function scoreRow(fields: ExtractedCardFields, row: SportsCatalogRow): ScoredSportsRow {
  const warnings: CatalogValidationWarning[] = [];
  const evidence: string[] = [];
  let score = 0;

  const inputSport = specificSport(fields.sportCategory);
  const inputYear = normalize(fields.year);
  const inputBrand = normalize(fields.brand);
  const inputNumber = normalizeNumber(fields.cardNumber);
  const catalogNumber = normalizeNumber(row.cardNumber);
  const inputPlayer = fields.playerOrCharacter || fields.cardTitle;
  const catalogPlayer = rowSubject(row);
  const catalogTeam = rowTeam(row);
  const numberMatch = Boolean(inputNumber && catalogNumber && inputNumber === catalogNumber);
  const playerMatch = nameMatches(inputPlayer, catalogPlayer);
  const teamMatch = nameMatches(fields.team, catalogTeam || "");
  const yearMatch = Boolean(inputYear && inputYear === normalize(row.year));
  const sportMatch = Boolean(inputSport && inputSport === normalize(row.sport));
  const brandMatch = Boolean(inputBrand && includesNormalized(fields.brand, row.brand));
  const productMatch = productMatches(fields, row);
  const subsetMatch = subsetMatches(fields, row);

  if (inputSport && !sportMatch) return { row, score: 0, warnings, evidence };
  if (inputYear && !yearMatch) return { row, score: 0, warnings, evidence };
  if (!numberMatch && !playerMatch.exact && !playerMatch.partial) return { row, score: 0, warnings, evidence };

  if (sportMatch) {
    score += 6;
    evidence.push("Sport matched catalog sport");
  }
  if (yearMatch) {
    score += 18;
    evidence.push("Year matched catalog year");
  }
  if (brandMatch) {
    score += 8;
    evidence.push("Brand matched catalog brand");
  }
  if (productMatch) {
    score += 24;
    evidence.push("Product/set matched catalog product");
  }
  if (subsetMatch) {
    score += 10;
    evidence.push("Subset/insert matched catalog subset");
  }
  if (numberMatch) {
    score += 34;
    evidence.push("Card number matched catalog card number");
  }
  if (playerMatch.exact) {
    score += 30;
    evidence.push("Player matched catalog subject");
  } else if (playerMatch.partial) {
    score += 18;
    evidence.push("Player partially matched catalog subject");
  }
  if (teamMatch.exact || teamMatch.partial) {
    score += 8;
    evidence.push("Team matched catalog team");
  }
  if (fields.rookie && row.rookie) score += 4;
  if (fields.auto && row.auto) score += 4;
  if (fields.relic && row.relic) score += 4;

  if (numberMatch && yearMatch && productMatch) {
    score += 12;
    evidence.push("Exact card number + year + product match");
  }

  if (hasValue(fields.playerOrCharacter) && numberMatch && productMatch && !playerMatch.exact && !playerMatch.partial) {
    score -= 35;
    warnings.push({
      code: "sports_catalog_player_disagreement",
      message: `Sports catalog player differs: AI="${fields.playerOrCharacter}", catalog="${catalogPlayer}"`,
      severity: "warning"
    });
  }

  if (hasValue(fields.cardNumber) && playerMatch.exact && productMatch && !numberMatch) {
    score -= 24;
    warnings.push({
      code: "sports_catalog_number_disagreement",
      message: `Sports catalog card number differs: AI="${fields.cardNumber}", catalog="${row.cardNumber || "unknown"}"`,
      severity: "warning"
    });
  }

  if (hasValue(fields.team) && catalogTeam && (numberMatch || playerMatch.exact) && !teamMatch.exact && !teamMatch.partial) {
    score -= 8;
    warnings.push({
      code: "sports_catalog_team_disagreement",
      message: `Sports catalog team differs: AI="${fields.team}", catalog="${catalogTeam}"`,
      severity: "warning"
    });
  }

  return { row, score: Math.max(0, score), warnings, evidence };
}

function addRowsFromIndex(target: Set<number>, index: Record<string, number[]> | undefined, key: string) {
  if (!index || !key) return;
  for (const rowIndex of index[key] || []) target.add(rowIndex);
}

function playerSearchKeys(value: unknown) {
  const normalized = normalize(value);
  const compact = normalizeCompact(value);
  const tokens = normalized.split(" ").filter((token) => token.length >= 3);
  const lastToken = tokens.at(-1);
  return [...new Set([normalized, compact, lastToken].filter((key): key is string => Boolean(key)))];
}

function productCandidates(fields: ExtractedCardFields) {
  const candidates = [fields.set, fields.cardTitle].filter(hasValue);
  const brand = normalize(fields.brand);
  return [
    ...candidates,
    ...candidates.map((candidate) => {
      const normalized = normalize(candidate);
      return brand && normalized.startsWith(`${brand} `) ? normalized.slice(brand.length + 1) : normalized;
    })
  ];
}

function playerCandidates(fields: ExtractedCardFields) {
  return [fields.playerOrCharacter, fields.cardTitle].filter(hasValue);
}

function rowsFromIndexBucket(bucket: SportsCatalogIndexBucket, fields: ExtractedCardFields) {
  const records = Array.isArray(bucket.records) ? bucket.records : [];
  const indexes = bucket.indexes || {};
  const rowIndexes = new Set<number>();
  const sport = specificSport(fields.sportCategory);
  const year = normalize(fields.year);
  const brand = fields.brand;
  const cardNumber = normalizeNumber(fields.cardNumber);
  const products = productCandidates(fields);
  const players = playerCandidates(fields);

  for (const product of products) {
    addRowsFromIndex(rowIndexes, indexes.product, indexKey(sport, year, brand, product));
    if (cardNumber) addRowsFromIndex(rowIndexes, indexes.exactCard, indexKey(sport, year, brand, product, cardNumber));
    for (const player of players) addRowsFromIndex(rowIndexes, indexes.productPlayer, indexKey(sport, year, product, player));
  }

  for (const player of players) {
    addRowsFromIndex(rowIndexes, indexes.player, indexKey(sport, year, player));
    for (const key of playerSearchKeys(player)) addRowsFromIndex(rowIndexes, indexes.playerSearch, key);
  }

  if (rowIndexes.size === 0) return records;

  return [...rowIndexes]
    .map((rowIndex) => records[rowIndex])
    .filter(Boolean);
}

async function searchableIndexedRows(fields: ExtractedCardFields): Promise<SportsSearchResult | undefined> {
  const sport = specificSport(fields.sportCategory);
  const year = normalize(fields.year);
  if (!sport || !year) return undefined;

  const bucket = await loadSportsCatalogIndexBucket(sportYearKey(sport, year));
  if (!bucket) return undefined;

  return { rows: rowsFromIndexBucket(bucket, fields) };
}

function searchableRowsFromCatalog(catalog: LoadedSportsCatalog, fields: ExtractedCardFields) {
  const bySportYear = catalog.bySportYear.get(sportYearKey(fields.sportCategory, fields.year));
  if (bySportYear) return bySportYear;

  const sport = specificSport(fields.sportCategory);
  if (sport) return catalog.rows.filter((row) => normalize(row.sport) === sport);

  return catalog.rows;
}

async function searchableRows(fields: ExtractedCardFields): Promise<SportsSearchResult> {
  const indexedRows = await searchableIndexedRows(fields);
  if (indexedRows) return indexedRows;

  const catalog = await loadSportsCatalog();
  return {
    rows: searchableRowsFromCatalog(catalog, fields),
    loadError: catalog.loadError
  };
}

function distinctCandidateKey(row: SportsCatalogRow) {
  return [row.sport, row.year, row.brand, row.product, row.subset, row.cardNumber, rowSubject(row), rowTeam(row)].map(normalizeCompact).join("|");
}

function matchedCard(row: SportsCatalogRow): CatalogMatchedCard {
  const team = rowTeam(row);
  return {
    name: rowSubject(row),
    sport: row.sport,
    year: row.year,
    brand: row.brand,
    product: row.product,
    set: row.subset ? `${row.product} ${row.subset}` : row.product,
    subset: row.subset,
    number: row.cardNumber || undefined,
    team,
    rookie: row.rookie,
    auto: row.auto,
    relic: row.relic,
    sourceUrl: row.sourceUrl,
    sourceName: row.sourceName
  };
}

function catalogSet(fields: ExtractedCardFields, row: SportsCatalogRow) {
  const current = fields.set;
  const product = row.product;
  const subset = row.subset;
  if (!subset) return product || current;
  if (!hasValue(current)) return `${product} ${subset}`.trim();

  const currentNorm = normalize(current);
  const productNorm = normalize(product);
  const subsetNorm = normalize(subset);
  if (currentNorm.includes(subsetNorm)) return current;
  if (currentNorm === productNorm || currentNorm.includes(productNorm)) return `${current} ${subset}`.trim();
  return current;
}

function normalizedFields(fields: ExtractedCardFields, row: SportsCatalogRow): Partial<ExtractedCardFields> {
  return {
    playerOrCharacter: rowSubject(row) || fields.playerOrCharacter,
    team: rowTeam(row) || fields.team,
    sportCategory: row.sport || fields.sportCategory,
    year: row.year || fields.year,
    brand: row.brand || fields.brand,
    set: catalogSet(fields, row),
    cardNumber: row.cardNumber || fields.cardNumber,
    rookie: row.rookie || fields.rookie,
    auto: row.auto || fields.auto,
    relic: row.relic || fields.relic
  };
}

function candidateNeedsCatalog(fields: ExtractedCardFields) {
  return [fields.playerOrCharacter, fields.cardTitle, fields.sportCategory, fields.year, fields.brand, fields.set, fields.cardNumber].some(hasValue);
}

export class SportsCatalogProvider implements CatalogProvider {
  id = "sports-catalog-provider";
  name = "Sports Catalog Provider";

  supports(category: string) {
    return sportsCategories.has(category.trim().toLowerCase());
  }

  async validate(input: CatalogValidationInput): Promise<CatalogValidationResult> {
    const search = await searchableRows(input.fields);
    const category = input.fields.sportCategory || "Sports";

    if (search.rows.length === 0) {
      return {
        providerId: this.id,
        providerName: this.name,
        category,
        status: "unavailable",
        confidence: 0,
        candidateCount: 0,
        warnings: [
          {
            code: "sports_catalog_unavailable",
            message: search.loadError ? `Sports catalog unavailable: ${search.loadError}` : "Sports catalog dataset was not found on the server.",
            severity: "warning"
          }
        ],
        evidence: []
      };
    }

    if (!candidateNeedsCatalog(input.fields)) {
      return {
        providerId: this.id,
        providerName: this.name,
        category,
        status: "not_found",
        confidence: 0,
        candidateCount: 0,
        warnings: [
          {
            code: "sports_catalog_match_not_found",
            message: "Sports catalog match not found.",
            severity: "warning"
          }
        ],
        evidence: ["No player, year, product, or card number was available for sports catalog matching."]
      };
    }

    const scored = search.rows
      .map((row) => scoreRow(input.fields, row))
      .filter((candidate) => candidate.score >= 45)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const bCompleteness = Number(Boolean(rowTeam(b.row))) + Number(Boolean(b.row.subset));
        const aCompleteness = Number(Boolean(rowTeam(a.row))) + Number(Boolean(a.row.subset));
        return bCompleteness - aCompleteness;
      });

    const topCandidates = scored.slice(0, maxCatalogCandidates);
    const best = topCandidates[0];

    if (!best) {
      return {
        providerId: this.id,
        providerName: this.name,
        category,
        status: "not_found",
        confidence: 0,
        candidateCount: 0,
        warnings: [
          {
            code: "sports_catalog_match_not_found",
            message: "Sports catalog match not found.",
            severity: "warning"
          }
        ],
        evidence: []
      };
    }

    const closeDistinctKeys = new Set(topCandidates.filter((candidate) => best.score - candidate.score <= 8).map((candidate) => distinctCandidateKey(candidate.row)));
    const candidateCount = scored.length;
    const confidence = Math.max(0, Math.min(99, Math.round(best.score)));
    const candidates = topCandidates.map((candidate) => matchedCard(candidate.row));

    if (closeDistinctKeys.size > 1) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: best.row.sport,
        status: "ambiguous",
        confidence,
        matchedCard: matchedCard(best.row),
        candidates,
        candidateCount,
        warnings: [
          {
            code: "sports_catalog_ambiguous",
            message: `Sports catalog found ${closeDistinctKeys.size} close checklist matches. Manual review required.`,
            severity: "warning"
          }
        ],
        evidence: best.evidence
      };
    }

    if (best.warnings.length > 0) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: best.row.sport,
        status: "disagreement",
        confidence,
        matchedCard: matchedCard(best.row),
        candidates,
        candidateCount,
        warnings: best.warnings,
        evidence: best.evidence
      };
    }

    if (best.score < 74) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: best.row.sport,
        status: "not_found",
        confidence,
        matchedCard: matchedCard(best.row),
        candidates,
        candidateCount,
        warnings: [
          {
            code: "sports_catalog_match_not_found",
            message: "Sports catalog match not found with enough confidence.",
            severity: "warning"
          }
        ],
        evidence: best.evidence
      };
    }

    return {
      providerId: this.id,
      providerName: this.name,
      category: best.row.sport,
      status: "matched",
      confidence,
      matchedCard: matchedCard(best.row),
      candidates,
      candidateCount,
      normalizedFields: normalizedFields(input.fields, best.row),
      warnings: [],
      evidence: best.evidence
    };
  }
}
