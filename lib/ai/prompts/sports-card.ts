export const sportsCardExtractionPrompt = `Extract sports card or trading card details for ACV OS.
Return structured fields only.
Never approve inventory.
Never guess uncertain card details.
Use null or an uncertainty warning when details are not visible.`;

export const sportsCardFieldRules = [
  "Identify player or character only when visible or strongly supported by provider context.",
  "Read card number and serial number from visible text only.",
  "Treat autograph, relic, and variation flags as false unless visibly supported.",
  "Use checklist context to normalize set names, parallels, and rookie status."
];
