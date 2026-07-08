import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtractedCardFields } from "@/lib/ai/types";
import type { CatalogMatchedCard, CatalogProvider, CatalogValidationInput, CatalogValidationResult, CatalogValidationWarning } from "@/lib/catalog/types";

type PokemonSetRecord = {
  id: string;
  name: string;
  series?: string;
  ptcgoCode?: string;
  releaseDate?: string;
};

type PokemonCardRecord = {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  types?: string[];
  artist?: string;
  images?: {
    small?: string;
    large?: string;
  };
};

type PokemonCatalogEntry = {
  card: PokemonCardRecord;
  set?: PokemonSetRecord;
  setId: string;
};

type LoadedPokemonCatalog = {
  cards: PokemonCatalogEntry[];
  setsById: Map<string, PokemonSetRecord>;
};

type ScoredEntry = {
  entry: PokemonCatalogEntry;
  score: number;
  warnings: CatalogValidationWarning[];
  evidence: string[];
};

let catalogPromise: Promise<LoadedPokemonCatalog> | undefined;

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeNumber(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/^#/, "")
    .split("/")
    [0].replace(/[^a-z0-9]/g, "");
}

function hasValue(value: unknown) {
  return Boolean(String(value || "").trim().replace(/^-$/, ""));
}

function candidateRoots() {
  return [
    path.join(process.cwd(), "data", "knowledge", "pokemon"),
    path.join(process.cwd(), "data", "knowledge:", "pokemon:")
  ];
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function firstReadableRoot() {
  for (const root of candidateRoots()) {
    try {
      await readdir(root);
      return root;
    } catch {
      // Try the next supported local dataset layout.
    }
  }
  return undefined;
}

async function loadPokemonCatalog(): Promise<LoadedPokemonCatalog> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    const root = await firstReadableRoot();
    if (!root) return { cards: [], setsById: new Map() };

    const setsPath = path.join(root, "sets", "en.json");
    const setRecords = await readJson<PokemonSetRecord[]>(setsPath).catch(() => []);
    const setsById = new Map(setRecords.map((set) => [set.id, set]));
    const cardsDir = path.join(root, "cards", "en");
    const cardFiles = await readdir(cardsDir).catch(() => []);
    const cards: PokemonCatalogEntry[] = [];

    for (const fileName of cardFiles.filter((file) => file.endsWith(".json"))) {
      const filePath = path.join(cardsDir, fileName);
      const cardRecords = await readJson<PokemonCardRecord[]>(filePath).catch(() => []);
      for (const card of cardRecords) {
        const setId = String(card.id || "").split("-")[0] || fileName.replace(/\.json$/, "");
        cards.push({ card, setId, set: setsById.get(setId) });
      }
    }

    return { cards, setsById };
  })();

  return catalogPromise;
}

function setMatches(inputSet: string, entry: PokemonCatalogEntry) {
  const setNeedle = normalize(inputSet);
  if (!setNeedle) return { matched: false, mismatched: false };
  const aliases = [entry.setId, entry.set?.name, entry.set?.series, entry.set?.ptcgoCode].map(normalize).filter(Boolean);
  const matched = aliases.some((alias) => alias === setNeedle || alias.includes(setNeedle) || setNeedle.includes(alias));
  return { matched, mismatched: !matched };
}

function scoreEntry(fields: ExtractedCardFields, entry: PokemonCatalogEntry): ScoredEntry {
  const warnings: CatalogValidationWarning[] = [];
  const evidence: string[] = [];
  const cardName = normalize(entry.card.name);
  const playerName = normalize(fields.playerOrCharacter);
  const title = normalize(fields.cardTitle);
  const inputSet = fields.set;
  const inputNumber = normalizeNumber(fields.cardNumber);
  let score = 0;

  if (playerName && playerName === cardName) {
    score += 48;
    evidence.push("Exact card name match");
  } else if (title && (title === cardName || title.includes(cardName))) {
    score += 38;
    evidence.push("Card title contains catalog card name");
  } else if (playerName && cardName.includes(playerName)) {
    score += 30;
    evidence.push("Partial card name match");
  }

  const setMatch = setMatches(inputSet, entry);
  if (setMatch.matched) {
    score += 34;
    evidence.push("Set matched catalog set");
  } else if (setMatch.mismatched && score > 0) {
    score -= 18;
    warnings.push({
      code: "pokemon_set_disagreement",
      message: `Pokémon catalog set differs: AI="${inputSet}", catalog="${entry.set?.name || entry.setId}"`,
      severity: "warning"
    });
  }

  const catalogNumber = normalizeNumber(entry.card.number);
  if (inputNumber && catalogNumber && inputNumber === catalogNumber) {
    score += 36;
    evidence.push("Card number matched catalog number");
  } else if (inputNumber && catalogNumber && score > 0) {
    score -= 28;
    warnings.push({
      code: "pokemon_number_disagreement",
      message: `Pokémon catalog number differs: AI="${fields.cardNumber}", catalog="${entry.card.number}"`,
      severity: "warning"
    });
  }

  return { entry, score, warnings, evidence };
}

function matchedCard(entry: PokemonCatalogEntry): CatalogMatchedCard {
  return {
    name: entry.card.name,
    set: entry.set?.name,
    setId: entry.setId,
    number: entry.card.number,
    rarity: entry.card.rarity,
    supertype: entry.card.supertype,
    subtypes: entry.card.subtypes,
    types: entry.card.types,
    artist: entry.card.artist,
    officialImages: entry.card.images
  };
}

function normalizedFields(fields: ExtractedCardFields, entry: PokemonCatalogEntry): Partial<ExtractedCardFields> {
  return {
    cardTitle: entry.card.name,
    playerOrCharacter: entry.card.name,
    sportCategory: "Pokemon",
    brand: "Pokemon",
    set: entry.set?.name || fields.set,
    cardNumber: entry.card.number || fields.cardNumber
  };
}

export class PokemonCatalogProvider implements CatalogProvider {
  id = "pokemon-catalog-provider";
  name = "Pokémon Catalog Provider";

  supports(category: string) {
    return ["pokemon", "pokémon", "tcg pokemon", "tcg pokémon"].includes(normalize(category));
  }

  async validate(input: CatalogValidationInput): Promise<CatalogValidationResult> {
    const catalog = await loadPokemonCatalog();
    if (catalog.cards.length === 0) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: input.fields.sportCategory || "Pokemon",
        status: "unavailable",
        confidence: 0,
        warnings: [
          {
            code: "pokemon_catalog_unavailable",
            message: "Pokémon catalog dataset was not found on the server.",
            severity: "warning"
          }
        ],
        evidence: []
      };
    }

    const needsCatalog = [input.fields.cardTitle, input.fields.playerOrCharacter, input.fields.set, input.fields.cardNumber].some(hasValue);
    if (!needsCatalog) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: input.fields.sportCategory || "Pokemon",
        status: "not_found",
        confidence: 0,
        warnings: [
          {
            code: "pokemon_catalog_match_not_found",
            message: "Pokémon catalog match not found.",
            severity: "warning"
          }
        ],
        evidence: ["No card name, set, or card number was available for catalog matching."]
      };
    }

    const best = catalog.cards.reduce<ScoredEntry | undefined>((memo, entry) => {
      const scored = scoreEntry(input.fields, entry);
      if (!memo || scored.score > memo.score) return scored;
      return memo;
    }, undefined);

    if (!best || best.score < 45) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: input.fields.sportCategory || "Pokemon",
        status: "not_found",
        confidence: 0,
        warnings: [
          {
            code: "pokemon_catalog_match_not_found",
            message: "Pokémon catalog match not found.",
            severity: "warning"
          }
        ],
        evidence: []
      };
    }

    const status = best.warnings.length > 0 ? "disagreement" : "matched";
    const confidence = Math.max(0, Math.min(99, Math.round(best.score)));

    return {
      providerId: this.id,
      providerName: this.name,
      category: "Pokemon",
      status,
      confidence,
      matchedCard: matchedCard(best.entry),
      normalizedFields: status === "matched" ? normalizedFields(input.fields, best.entry) : undefined,
      warnings: best.warnings,
      evidence: best.evidence
    };
  }
}
