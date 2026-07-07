export type ExtractionImageRole =
  | "Front"
  | "Back"
  | "Detail / Closeup"
  | "Serial Closeup"
  | "Holo / Surface"
  | "Auto Closeup"
  | "Patch / Relic Closeup"
  | "Other";

export type ExtractionImage = {
  id: string;
  role: ExtractionImageRole | string;
  fileName: string;
  label?: string;
  url?: string;
  dataUrl?: string;
  order?: number;
  needsReupload?: boolean;
};

export type ExtractedCardFields = {
  cardTitle: string;
  playerOrCharacter: string;
  team: string;
  sportCategory: string;
  year: string;
  brand: string;
  set: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  rookie: boolean;
  auto: boolean;
  relic: boolean;
  variation: boolean;
  grader: string;
  grade: string;
  conditionNotes: string;
  uncertaintyNotes: string;
};

export type ExtractionFieldKey = keyof ExtractedCardFields | "suggestedTitle";

export type FieldConfidenceMap = Partial<Record<ExtractionFieldKey, number>>;

export type ExtractionWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  field?: ExtractionFieldKey;
};

export type ExtractionStatus = "Ready to Approve" | "Needs Review" | "Needs Research" | "Blocked" | "Failed";

export type CardExtractionInput = {
  images: ExtractionImage[];
  categoryHint?: string;
  existingFields?: Partial<ExtractedCardFields>;
};

export type OcrResult = {
  detectedText: string[];
  textBlob: string;
  confidence: number;
  sources: string[];
};

export type BrandDictionaryMatches = {
  sportsBrands: string[];
  sportsCategories: string[];
  tcgBrands: string[];
  matchedTerms: string[];
};

export type ChecklistCandidate = {
  id: string;
  cardTitle: string;
  playerOrCharacter: string;
  team: string;
  sportCategory: string;
  year: string;
  brand: string;
  set: string;
  cardNumber: string;
  parallel: string;
  serialNumber?: string;
  rookie?: boolean;
  auto?: boolean;
  relic?: boolean;
  variation?: boolean;
  score: number;
  matchedFields: string[];
};

export type VisionProviderResult = {
  fields: Partial<ExtractedCardFields>;
  confidence: number;
  fieldConfidence: FieldConfidenceMap;
  warnings: ExtractionWarning[];
  sources: string[];
};

export type ExtractionResult = ExtractedCardFields & {
  confidence: number;
  fieldConfidence: FieldConfidenceMap;
  warnings: ExtractionWarning[];
  suggestedTitle: string;
  extractionStatus: ExtractionStatus;
  extractionSources: string[];
};
