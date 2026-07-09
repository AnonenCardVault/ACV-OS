import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
  generatedAt?: string;
  rowCount?: number;
  rows?: SportsCatalogRow[];
};

type BucketIndexes = {
  exactCard: Record<string, number[]>;
  productPlayer: Record<string, number[]>;
  player: Record<string, number[]>;
  product: Record<string, number[]>;
  playerSearch: Record<string, number[]>;
};

type BucketFile = {
  schemaVersion: 1;
  generatedAt: string;
  bucketKey: string;
  rowCount: number;
  records: SportsCatalogRow[];
  indexes: BucketIndexes;
};

const rootDir = process.cwd();
const baseDir = path.join(rootDir, "data", "imports", "sports-checklists");
const normalizedPath = process.env.ACV_SPORTS_CATALOG_PATH || path.join(baseDir, "normalized", "all-normalized.json");
const indexDir = path.join(baseDir, "index");
const bucketDir = path.join(indexDir, "buckets");

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

function slug(value: string) {
  return normalize(value).replace(/\s+/g, "-") || "unknown";
}

function indexKey(...parts: unknown[]) {
  const normalizedParts = parts.map((part) => normalize(part));
  return normalizedParts.every(Boolean) ? normalizedParts.join("|") : "";
}

function exactCardKey(row: SportsCatalogRow) {
  return indexKey(row.sport, row.year, row.brand, row.product, normalizeNumber(row.cardNumber));
}

function productPlayerKey(row: SportsCatalogRow) {
  return indexKey(row.sport, row.year, row.product, rowSubject(row));
}

function playerKey(row: SportsCatalogRow) {
  return indexKey(row.sport, row.year, rowSubject(row));
}

function productKey(row: SportsCatalogRow) {
  return indexKey(row.sport, row.year, row.brand, row.product);
}

function rowSubject(row: SportsCatalogRow) {
  const player = String(row.player || "").trim();
  return player.includes(",") ? player.split(",")[0].trim() : player;
}

function playerSearchKeys(row: SportsCatalogRow) {
  const subject = rowSubject(row);
  const normalized = normalize(subject);
  const compact = normalizeCompact(subject);
  const tokens = normalized.split(" ").filter((token) => token.length >= 3);
  const lastToken = tokens.at(-1);
  return [...new Set([normalized, compact, lastToken].filter((key): key is string => Boolean(key)))];
}

function addIndex(index: Record<string, number[]>, key: string, rowIndex: number) {
  if (!key) return;
  if (!index[key]) index[key] = [];
  index[key].push(rowIndex);
}

function buildBucket(bucketKey: string, records: SportsCatalogRow[], generatedAt: string): BucketFile {
  const indexes: BucketIndexes = {
    exactCard: {},
    productPlayer: {},
    player: {},
    product: {},
    playerSearch: {}
  };

  records.forEach((row, rowIndex) => {
    addIndex(indexes.exactCard, exactCardKey(row), rowIndex);
    addIndex(indexes.productPlayer, productPlayerKey(row), rowIndex);
    addIndex(indexes.player, playerKey(row), rowIndex);
    addIndex(indexes.product, productKey(row), rowIndex);
    for (const key of playerSearchKeys(row)) addIndex(indexes.playerSearch, key, rowIndex);
  });

  return {
    schemaVersion: 1,
    generatedAt,
    bucketKey,
    rowCount: records.length,
    records,
    indexes
  };
}

function indexCount(index: Record<string, number[]>) {
  return Object.keys(index).length;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const raw = await readFile(normalizedPath, "utf8");
  const catalog = JSON.parse(raw) as SportsCatalogFile;
  const rows = Array.isArray(catalog.rows) ? catalog.rows.filter((row) => row && row.sport && row.year && row.product) : [];

  await mkdir(bucketDir, { recursive: true });

  const buckets = new Map<string, SportsCatalogRow[]>();
  for (const row of rows) {
    const bucketKey = indexKey(row.sport, row.year);
    if (!bucketKey) continue;
    buckets.set(bucketKey, [...(buckets.get(bucketKey) || []), row]);
  }

  const manifestBuckets: Record<
    string,
    {
      file: string;
      rowCount: number;
      indexes: Record<keyof BucketIndexes, number>;
    }
  > = {};

  for (const [bucketKey, bucketRows] of buckets) {
    const bucket = buildBucket(bucketKey, bucketRows, generatedAt);
    const fileName = `${slug(bucketKey)}.json`;
    const filePath = path.join(bucketDir, fileName);
    await writeFile(filePath, `${JSON.stringify(bucket)}\n`);
    manifestBuckets[bucketKey] = {
      file: path.relative(indexDir, filePath),
      rowCount: bucket.rowCount,
      indexes: {
        exactCard: indexCount(bucket.indexes.exactCard),
        productPlayer: indexCount(bucket.indexes.productPlayer),
        player: indexCount(bucket.indexes.player),
        product: indexCount(bucket.indexes.product),
        playerSearch: indexCount(bucket.indexes.playerSearch)
      }
    };
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt,
    sourceGeneratedAt: catalog.generatedAt,
    sourcePath: path.relative(rootDir, normalizedPath),
    rowCount: catalog.rowCount || rows.length,
    indexedRecordCount: rows.length,
    bucketCount: buckets.size,
    indexes: [
      "sport|year|brand|product|cardNumber",
      "sport|year|product|player",
      "sport|year|player",
      "sport|year|brand|product",
      "player search normalized lowercase"
    ],
    buckets: manifestBuckets
  };

  await writeFile(path.join(indexDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Sports catalog index built: ${rows.length} record(s), ${buckets.size} sport/year bucket(s).`);
  console.log(`Saved index manifest: ${path.relative(rootDir, path.join(indexDir, "manifest.json"))}`);
}

main().catch((error) => {
  console.error("Sports catalog index build failed.");
  console.error(error);
  process.exitCode = 1;
});
