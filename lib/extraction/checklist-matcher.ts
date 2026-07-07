import type { BrandDictionaryMatches, ChecklistCandidate } from "@/lib/extraction/types";

const mockChecklistCandidates: ChecklistCandidate[] = [
  {
    id: "mock-drake-maye-phoenix-154",
    cardTitle: "2024-25 Panini Phoenix Drake Maye Rookie #154 RC",
    playerOrCharacter: "Drake Maye",
    team: "New England Patriots",
    sportCategory: "Football",
    year: "2024-25",
    brand: "Panini",
    set: "Phoenix",
    cardNumber: "154",
    parallel: "Rookie",
    serialNumber: "-",
    rookie: true,
    score: 0,
    matchedFields: []
  },
  {
    id: "mock-cj-stroud-prizm-339",
    cardTitle: "2023 Panini Prizm CJ Stroud Silver Rookie #339 RC",
    playerOrCharacter: "CJ Stroud",
    team: "Houston Texans",
    sportCategory: "Football",
    year: "2023",
    brand: "Panini",
    set: "Prizm",
    cardNumber: "339",
    parallel: "Silver",
    serialNumber: "-",
    rookie: true,
    score: 0,
    matchedFields: []
  },
  {
    id: "mock-justin-herbert-panini",
    cardTitle: "2020 Panini Justin Herbert Rookie Card",
    playerOrCharacter: "Justin Herbert",
    team: "Los Angeles Chargers",
    sportCategory: "Football",
    year: "2020",
    brand: "Panini",
    set: "Pending",
    cardNumber: "-",
    parallel: "-",
    serialNumber: "-",
    rookie: true,
    score: 0,
    matchedFields: []
  },
  {
    id: "mock-shohei-ohtani-baseball",
    cardTitle: "2018 Topps Update Shohei Ohtani Rookie #US1 RC",
    playerOrCharacter: "Shohei Ohtani",
    team: "Los Angeles Angels",
    sportCategory: "Baseball",
    year: "2018",
    brand: "Topps",
    set: "Update",
    cardNumber: "US1",
    parallel: "-",
    serialNumber: "-",
    rookie: true,
    score: 0,
    matchedFields: []
  },
  {
    id: "mock-charizard-pokemon",
    cardTitle: "Pokemon Charizard Card - Set Pending",
    playerOrCharacter: "Charizard",
    team: "Pokemon",
    sportCategory: "Pokemon",
    year: "-",
    brand: "Pokemon",
    set: "Pending",
    cardNumber: "-",
    parallel: "-",
    serialNumber: "-",
    rookie: false,
    score: 0,
    matchedFields: []
  }
];

function includes(text: string, value: string) {
  const normalizedText = text.replace(/[^a-z0-9]+/gi, " ").toLowerCase();
  const normalized = value.replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  if (!normalized || normalized === "-" || normalized === "pending") return false;
  if (normalizedText.includes(normalized)) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => normalizedText.includes(token));
}

export function matchChecklist({
  detectedText,
  categoryHint,
  dictionaryMatches
}: {
  detectedText: string;
  categoryHint?: string;
  dictionaryMatches: BrandDictionaryMatches;
}): ChecklistCandidate[] {
  const text = detectedText.toLowerCase();

  return mockChecklistCandidates
    .map((candidate) => {
      const matchedFields: string[] = [];
      let score = 0;

      if (includes(text, candidate.playerOrCharacter)) {
        score += 60;
        matchedFields.push("playerOrCharacter");
      }
      if (includes(text, candidate.team)) {
        score += 10;
        matchedFields.push("team");
      }
      if (includes(text, candidate.year)) {
        score += 8;
        matchedFields.push("year");
      }
      if (includes(text, candidate.brand) || dictionaryMatches.matchedTerms.includes(candidate.brand)) {
        score += 10;
        matchedFields.push("brand");
      }
      if (includes(text, candidate.set) || dictionaryMatches.matchedTerms.includes(candidate.set)) {
        score += 8;
        matchedFields.push("set");
      }
      if (includes(text, candidate.cardNumber)) {
        score += 8;
        matchedFields.push("cardNumber");
      }
      if (categoryHint && candidate.sportCategory === categoryHint) {
        score += 12;
        matchedFields.push("sportCategory");
      }
      if (matchedFields.includes("playerOrCharacter") && matchedFields.includes("sportCategory")) {
        score = Math.max(score, 92);
      }

      return { ...candidate, score: Math.min(100, score), matchedFields };
    })
    .filter((candidate) => candidate.score >= 24)
    .sort((a, b) => b.score - a.score);
}
