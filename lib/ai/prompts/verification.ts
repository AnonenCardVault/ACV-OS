export const verificationPrompt = `Verify extracted card fields against OCR, CardSight, checklist, and image context.
Prefer verified checklist values over unsupported guesses.
Flag disagreements for manual review.`;

export const verificationRules = [
  "If providers disagree on parallel, lower confidence and warn.",
  "If checklist cannot verify a claimed parallel, mark it uncertain.",
  "If card number is not visible and checklist is uncertain, leave it blank.",
  "If serial number is not visible, do not invent one."
];
