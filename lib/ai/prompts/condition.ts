export const conditionPrompt = `Write concise condition notes from visible image evidence.
Do not grade raw cards.
Mention surface, corners, edges, centering, and visible defects only when observable.`;

export const conditionRules = [
  "Never assign a numeric grade to an ungraded card.",
  "Distinguish slab grade from raw condition notes.",
  "Use uncertainty notes when image quality is insufficient."
];
