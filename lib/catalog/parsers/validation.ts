export type ChecklistTarget = {
  sport: string;
  year: string;
  brand: string;
  product: string;
  priority: string;
  enabled: boolean;
  preferredSources: string[];
};

export type NormalizedChecklistRow = {
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

export type ChecklistParserContext = {
  target: ChecklistTarget;
  sourceUrl: string;
  sourceName: string;
};

export type ChecklistCandidateRow = {
  rawText: string;
  subset?: string | null;
  cardNumber?: string | null;
  player?: string | null;
  team?: string | null;
};

export type ChecklistParserDiagnostics = {
  provider: string;
  rowsFound: number;
  rowsAccepted: number;
  rowsRejected: number;
  duplicateCount: number;
  navigationRowsRemoved: number;
  validationFailures: Record<string, number>;
  acceptanceRate: number;
};

export type ParsedChecklistResult = {
  rows: NormalizedChecklistRow[];
  diagnostics: ChecklistParserDiagnostics;
};

type ValidationResult =
  | { accepted: true; row: NormalizedChecklistRow }
  | { accepted: false; reason: string; navigation: boolean };

const navigationRejectTerms = [
  "Home",
  "Price Guide",
  "Subscribe",
  "Shop",
  "Facebook",
  "Instagram",
  "Twitter",
  "YouTube",
  "TikTok",
  "Podcast",
  "Baseball Cards",
  "Football Cards",
  "Basketball Cards",
  "Pokemon",
  "Articles",
  "Latest News",
  "Gallery",
  "Contact",
  "About",
  "Privacy",
  "Terms",
  "Beckett",
  "Cardboard Connection",
  "Newsletter",
  "Advertise",
  "Related Products",
  "Related Posts",
  "Non-Sport Cards",
  "Sports Card Calendar",
  "Release Calendar"
];

const headingRejectTerms = [
  "checklist top",
  "view the",
  "buy on ebay",
  "shop boxes",
  "box break",
  "odds breakdown",
  "release date",
  "product configuration",
  "making purchases",
  "affiliate links",
  "leave a reply",
  "comments",
  "print runs",
  "serial numbered",
  "parallels:",
  "refractor parallels",
  "hobby box",
  "jumbo box",
  "blaster box"
];

const commonNonNames = new Set([
  "guide",
  "cards",
  "grading",
  "authentication",
  "collection",
  "calendar",
  "checklists",
  "news",
  "gallery",
  "privacy",
  "policy",
  "terms",
  "service",
  "subscribe"
]);

export function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: "\"",
    apos: "'",
    "#39": "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
    hellip: "...",
    rsquo: "'",
    lsquo: "'",
    rdquo: "\"",
    ldquo: "\""
  };

  return value
    .replace(/&([a-zA-Z0-9#]+);/g, (match, entity: string) => named[entity] || match)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function textFromHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<(br|p|div|li|tr|h[1-6]|section|article)\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
  );
}

export function removeSiteChrome(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ");
}

export function narrowToMainContent(html: string) {
  const articles = Array.from(html.matchAll(/<article\b[\s\S]*?<\/article>/gi)).map((match) => match[0]);
  const largestArticle = articles.sort((a, b) => b.length - a.length)[0];
  if (largestArticle && largestArticle.length > 5_000) return largestArticle;

  const mains = Array.from(html.matchAll(/<main\b[\s\S]*?<\/main>/gi)).map((match) => match[0]);
  const largestMain = mains.sort((a, b) => b.length - a.length)[0];
  if (largestMain && largestMain.length > 5_000) return largestMain;

  return html;
}

export function cleanField(value?: string | null) {
  if (!value) return null;
  const cleaned = stripTags(value)
    .replace(/^#/, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function flagsFromText(text: string) {
  return {
    rookie: /\b(RC|rookie)\b/i.test(text),
    auto: /\b(auto|autograph|signature|signed)\b/i.test(text),
    relic: /\b(relic|patch|jersey|memorabilia|materials?)\b/i.test(text)
  };
}

export function parallelFromText(text: string) {
  const match = text.match(
    /\b(Silver|Gold|Gold Wave|Blue|Red|Green|Orange|Purple|Black|Refractor|X-Fractor|Mosaic|Mojo|Scope|Hyper|Wave|Cracked Ice|Holo|Disco|Choice|Genesis|Zebra|Tie-Dye|Sepia|Pink|Aqua|Atomic|Lava|Speckle|Platinum)\b/i
  );
  return match ? match[1] : null;
}

export function parseChecklistLineToCandidate(line: string, subset?: string | null): ChecklistCandidateRow | null {
  const text = stripTags(line)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  const patterns = [
    /^#?([A-Za-z0-9./-]{1,20})\s+(.+?)\s+-\s+(.+)$/,
    /^#?([A-Za-z0-9./-]{1,20})\s*-\s*(.+?)\s*-\s*(.+)$/,
    /^#?([A-Za-z0-9./-]{1,20})\s+(.+)$/
  ];
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
  if (!match) return null;

  return {
    rawText: text,
    subset,
    cardNumber: cleanField(match[1]),
    player: cleanField(match[2]),
    team: cleanField(match[3])
  };
}

export function teamFromChecklistHeading(line: string) {
  const text = stripTags(line).replace(/\s+/g, " ").trim();
  const match = text.match(/\bChecklist\s+-\s+(.+)$/i);
  return cleanField(match?.[1] || null);
}

export function rowKey(row: NormalizedChecklistRow) {
  return [row.sourceUrl, row.subset, row.cardNumber, row.player, row.team]
    .map((value) => String(value || "").toLowerCase())
    .join("|");
}

export function dedupeNormalizedRows(rows: NormalizedChecklistRow[]) {
  const byKey = new Map<string, NormalizedChecklistRow>();
  rows.forEach((row) => {
    const key = rowKey(row);
    if (!byKey.has(key)) byKey.set(key, row);
  });
  return Array.from(byKey.values());
}

export function normalizeCandidateRows(provider: string, context: ChecklistParserContext, candidates: ChecklistCandidateRow[]): ParsedChecklistResult {
  const diagnostics: ChecklistParserDiagnostics = {
    provider,
    rowsFound: candidates.length,
    rowsAccepted: 0,
    rowsRejected: 0,
    duplicateCount: 0,
    navigationRowsRemoved: 0,
    validationFailures: {},
    acceptanceRate: 0
  };
  const rows: NormalizedChecklistRow[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const validation = validateCandidateRow(candidate, context);

    if (!validation.accepted) {
      diagnostics.rowsRejected += 1;
      if (validation.navigation) diagnostics.navigationRowsRemoved += 1;
      diagnostics.validationFailures[validation.reason] = (diagnostics.validationFailures[validation.reason] || 0) + 1;
      continue;
    }

    const key = rowKey(validation.row);
    if (seen.has(key)) {
      diagnostics.duplicateCount += 1;
      diagnostics.rowsRejected += 1;
      diagnostics.validationFailures.duplicate = (diagnostics.validationFailures.duplicate || 0) + 1;
      continue;
    }

    seen.add(key);
    rows.push(validation.row);
    diagnostics.rowsAccepted += 1;
  }

  diagnostics.acceptanceRate = diagnostics.rowsFound > 0 ? Number((diagnostics.rowsAccepted / diagnostics.rowsFound).toFixed(4)) : 0;
  return { rows, diagnostics };
}

function validateCandidateRow(candidate: ChecklistCandidateRow, context: ChecklistParserContext): ValidationResult {
  const rawText = cleanField(candidate.rawText) || "";
  const cardNumber = cleanField(candidate.cardNumber);
  const player = cleanPlayer(candidate.player);
  const team = cleanTeam(candidate.team);

  if (rawText.length < 7) return reject("row_too_short", rawText);
  if (rawText.length > 260) return reject("row_too_long", rawText);
  if (containsNavigationTerm(rawText)) return reject("navigation_term", rawText, true);
  if (headingRejectTerms.some((term) => rawText.toLowerCase().includes(term))) return reject("non_checklist_content", rawText, true);
  if (!cardNumber) return reject("missing_card_number", rawText);
  if (cardNumber === context.target.year) return reject("year_heading", rawText, true);
  if (/^(19|20)\d{2}$/.test(cardNumber)) return reject("year_like_card_number", rawText, true);
  if (!looksLikeChecklistNumber(cardNumber)) return reject("invalid_card_number", rawText);
  if (!player) return reject("missing_player", rawText);
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(player)) return reject("player_without_letters", rawText);
  if (player.length < 2) return reject("player_too_short", rawText);
  if (commonNonNames.has(player.toLowerCase())) return reject("navigation_player", rawText, true);
  if (/\b(checklists?|cards?|calendar|details|odds|xlsx|file)\b/i.test(player)) return reject("heading_player", rawText, true);
  if (!team && /\b(pack|packs|box|boxes|autograph or relic|autograph and|relics?)\b/i.test(player)) return reject("configuration_row", rawText, true);
  if (team && /^\d{1,2}$/.test(team)) return reject("numeric_team", rawText, true);
  if (/^(card\s*#|number|player|team|set|subset|name)$/i.test(player)) return reject("header_row", rawText, true);
  if (/^(card\s*#|number|player|team|set|subset|name)$/i.test(cardNumber)) return reject("header_row", rawText, true);

  const flags = flagsFromText(rawText);

  return {
    accepted: true,
    row: {
      sport: context.target.sport,
      year: context.target.year,
      brand: context.target.brand,
      product: context.target.product,
      subset: cleanField(candidate.subset || null),
      cardNumber,
      player,
      team,
      rookie: flags.rookie,
      auto: flags.auto,
      relic: flags.relic,
      parallel: parallelFromText(rawText),
      sourceUrl: context.sourceUrl,
      sourceName: context.sourceName
    }
  };
}

function reject(reason: string, rawText: string, navigation = false): ValidationResult {
  return {
    accepted: false,
    reason,
    navigation: navigation || containsNavigationTerm(rawText)
  };
}

function containsNavigationTerm(value: string) {
  const text = value.toLowerCase();
  return navigationRejectTerms.some((term) => text.includes(term.toLowerCase()));
}

function looksLikeChecklistNumber(value: string) {
  const cardNumber = value.replace(/^#/, "").trim();
  if (cardNumber.length < 1 || cardNumber.length > 20) return false;
  if (!/[0-9]/.test(cardNumber)) return /^[A-Z]{1,6}-[A-Z]{1,5}$/i.test(cardNumber);

  return /^(?:\d{1,4}[A-Z]?|[A-Z]{1,8}-[A-Z0-9]{1,10}|[A-Z]{1,6}\d{1,4}[A-Z]?|[A-Z]{1,4}-?\d{1,4}[A-Z]?|[A-Z0-9]{1,8}\/\d{1,4})$/i.test(cardNumber);
}

function cleanPlayer(value?: string | null) {
  const cleaned = cleanField(value)
    ?.replace(/\bRC\b/gi, "")
    .replace(/\bRookie\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function cleanTeam(value?: string | null) {
  const cleaned = cleanField(value)?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}
