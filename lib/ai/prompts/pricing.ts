export const pricingPrompt = `Summarize pricing context for ACV OS without making marketplace changes.
Use sold comps, active listings, grade, condition, and confidence to produce a suggested price range.`;

export const pricingRules = [
  "Separate sold comps from active listings.",
  "Respect grade/grader filters.",
  "Flag thin comp sets and stale market data."
];
