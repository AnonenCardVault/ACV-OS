import {
  narrowToMainContent,
  normalizeCandidateRows,
  parseChecklistLineToCandidate,
  removeSiteChrome,
  stripTags,
  textFromHtml,
  type ChecklistCandidateRow,
  type ChecklistParserContext,
  type ParsedChecklistResult
} from "./validation.ts";

export const cardboardConnectionParser = {
  provider: "Cardboard Connection",
  matches(sourceUrl: string, sourceName?: string) {
    return /cardboardconnection\.com/i.test(sourceUrl) || /cardboard connection|cardboard/i.test(sourceName || "");
  },
  parse(html: string, context: ChecklistParserContext): ParsedChecklistResult {
    const content = removeSiteChrome(narrowToMainContent(html));
    const candidates = [
      ...parseTables(content),
      ...parseLists(content),
      ...parseChecklistBlocks(content),
      ...parsePlainChecklistText(content)
    ];

    return normalizeCandidateRows("Cardboard Connection", context, candidates);
  }
};

function parseTables(html: string): ChecklistCandidateRow[] {
  const candidates: ChecklistCandidateRow[] = [];
  const tablePattern = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(html))) {
    const tableHtml = tableMatch[1];
    if (/\b(rowprice|shop|ebay|sidebar)\b/i.test(tableHtml)) continue;

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

      const candidate = candidateFromTableCells(cells, headers);
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates;
}

function parseLists(html: string): ChecklistCandidateRow[] {
  const candidates: ChecklistCandidateRow[] = [];
  const listPattern = /<(ol|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let listMatch: RegExpExecArray | null;

  while ((listMatch = listPattern.exec(html))) {
    const listHtml = listMatch[2];
    if (/\b(menu|nav|footer|social|related|important links|blogroll|shop boxes)\b/i.test(listHtml)) continue;

    const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;

    while ((match = liPattern.exec(listHtml))) {
      const candidate = parseChecklistLineToCandidate(match[1]);
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates;
}

function parseChecklistBlocks(html: string): ChecklistCandidateRow[] {
  const candidates: ChecklistCandidateRow[] = [];
  const blockPattern = /<div\b[^>]*(?:class|id)=["'][^"']*(?:tablechecklist|checklist)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(html))) {
    candidates.push(...parseTextBlock(match[1]));
  }

  return candidates;
}

function parsePlainChecklistText(html: string): ChecklistCandidateRow[] {
  return parseTextBlock(html);
}

function parseTextBlock(html: string): ChecklistCandidateRow[] {
  const candidates: ChecklistCandidateRow[] = [];
  let subset: string | null = null;
  const lines = textFromHtml(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (isLikelySubsetHeading(line)) {
      subset = stripTags(line).replace(/\s*checklist$/i, "").trim() || null;
      continue;
    }

    const candidate = parseChecklistLineToCandidate(line, subset);
    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

function extractCells(rowHtml: string) {
  const cells: string[] = [];
  const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;

  while ((match = cellPattern.exec(rowHtml))) {
    const value = stripTags(match[1]);
    if (value) cells.push(value);
  }

  return cells;
}

function candidateFromTableCells(cells: string[], headers: string[]): ChecklistCandidateRow | null {
  if (cells.length < 2) return null;
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const cardIndex = headerIndex(normalizedHeaders, ["card", "#", "no.", "number"]);
  const playerIndex = headerIndex(normalizedHeaders, ["player", "name", "subject"]);
  const teamIndex = headerIndex(normalizedHeaders, ["team"]);
  const subsetIndex = headerIndex(normalizedHeaders, ["subset", "insert", "set"]);

  return {
    rawText: cells.join(" "),
    cardNumber: cells[cardIndex >= 0 ? cardIndex : 0],
    player: cells[playerIndex >= 0 ? playerIndex : 1],
    team: teamIndex >= 0 ? cells[teamIndex] : cells.length > 2 ? cells[2] : null,
    subset: subsetIndex >= 0 ? cells[subsetIndex] : null
  };
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.some((name) => header.includes(name)));
}

function isLikelySubsetHeading(line: string) {
  const text = stripTags(line).replace(/\s+/g, " ").trim();
  if (!text || text.length > 90) return false;
  if (parseChecklistLineToCandidate(text)) return false;
  if (/\b(checklist top|view the|buy on ebay|shop|comment|reply|privacy|terms|parallels:|odds)\b/i.test(text)) return false;
  return /(?:set checklist|base checklist|insert checklist|autographs?|rookies?|prospects?|favorites?|spotlights?|chrome|bowman|scouts|ultimate|modern|sights|invicta|contenders?|prizm|optic|mosaic|phoenix|select|certified|illusions|elite|zenith|chronicles|legacy|score|absolute|finest|heritage|update|series)\b/i.test(text);
}
