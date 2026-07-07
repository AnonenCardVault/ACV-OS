import type { ExtractedCardFields } from "@/lib/ai/types";
import { blankCardFields, cleanValue } from "@/lib/ai/utils/fields";

export type MockCardProfile = Partial<ExtractedCardFields> & {
  id: string;
  score: number;
  matchedSignals: string[];
  checklistValidations: Record<string, boolean>;
};

const mockProfiles: Array<Omit<MockCardProfile, "score" | "matchedSignals"> & { signals: string[] }> = [
  {
    id: "drake-maye-panini-phoenix",
    signals: ["drake", "maye", "patriots", "phoenix"],
    cardTitle: "2024-25 Panini Phoenix Drake Maye Rookie #154 RC",
    playerOrCharacter: "Drake Maye",
    team: "New England Patriots",
    sportCategory: "Football",
    year: "2024-25",
    brand: "Panini",
    set: "Phoenix",
    cardNumber: "154",
    parallel: "Rookie",
    rookie: true,
    checklistValidations: { parallel: true, cardNumber: true, rookie: true }
  },
  {
    id: "cj-stroud-panini-prizm",
    signals: ["cj", "stroud", "texans", "prizm"],
    cardTitle: "2023 Panini Prizm CJ Stroud Silver Rookie #339 RC",
    playerOrCharacter: "CJ Stroud",
    team: "Houston Texans",
    sportCategory: "Football",
    year: "2023",
    brand: "Panini",
    set: "Prizm",
    cardNumber: "339",
    parallel: "Silver",
    rookie: true,
    checklistValidations: { parallel: true, cardNumber: true, rookie: true }
  },
  {
    id: "justin-herbert-panini",
    signals: ["justin", "herbert", "chargers"],
    cardTitle: "2020 Panini Justin Herbert Rookie Card",
    playerOrCharacter: "Justin Herbert",
    team: "Los Angeles Chargers",
    sportCategory: "Football",
    year: "2020",
    brand: "Panini",
    set: "Pending",
    cardNumber: "",
    parallel: "",
    rookie: true,
    checklistValidations: { rookie: true }
  },
  {
    id: "shohei-ohtani-topps-update",
    signals: ["shohei", "ohtani", "angels", "topps"],
    cardTitle: "2018 Topps Update Shohei Ohtani Rookie #US1 RC",
    playerOrCharacter: "Shohei Ohtani",
    team: "Los Angeles Angels",
    sportCategory: "Baseball",
    year: "2018",
    brand: "Topps",
    set: "Update",
    cardNumber: "US1",
    parallel: "",
    rookie: true,
    checklistValidations: { cardNumber: true, rookie: true }
  },
  {
    id: "pokemon-charizard",
    signals: ["charizard", "pokemon"],
    cardTitle: "Pokemon Charizard Card - Set Pending",
    playerOrCharacter: "Charizard",
    team: "Pokemon",
    sportCategory: "Pokemon",
    year: "",
    brand: "Pokemon",
    set: "Pending",
    cardNumber: "",
    parallel: "",
    rookie: false,
    checklistValidations: {}
  }
];

function normalizedText(value: string) {
  return value.replace(/[^a-z0-9]+/gi, " ").toLowerCase();
}

export function matchMockCardProfile(textBlob: string, categoryHint?: string): MockCardProfile | null {
  const normalized = normalizedText(textBlob);
  const category = cleanValue(categoryHint).toLowerCase();
  const matches = mockProfiles
    .map((profile) => {
      const matchedSignals = profile.signals.filter((signal) => normalized.includes(signal));
      const categoryBonus = category && cleanValue(profile.sportCategory).toLowerCase() === category ? 18 : 0;
      const score = Math.min(99, matchedSignals.length * 28 + categoryBonus);
      return {
        ...profile,
        ...blankCardFields(),
        ...profile,
        score,
        matchedSignals
      };
    })
    .filter((profile) => profile.score >= 24)
    .sort((a, b) => b.score - a.score);

  return matches[0] || null;
}
