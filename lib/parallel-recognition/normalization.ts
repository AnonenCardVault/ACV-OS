const canonicalAliasGroups: Record<string, string[]> = {
  Silver: ["silver", "silver prizm", "prizm silver"],
  Refractor: ["refractor", "chrome refractor"],
  "X-Fractor": ["xfractor", "x-fractor", "x fractor"],
  Mojo: ["mojo", "mojo refractor", "mojo prizm"],
  Wave: ["wave", "wave refractor", "wave prizm"],
  Shimmer: ["shimmer", "shimmer prizm", "shimmer refractor"],
  Ice: ["ice"],
  "Cracked Ice": ["cracked ice"],
  Pandora: ["pandora"],
  Checkerboard: ["checkerboard", "checker board"],
  "Tiger Stripe": ["tiger stripe"],
  Scope: ["scope"],
  Lava: ["lava"],
  Pulsar: ["pulsar"],
  Disco: ["disco", "fast break"],
  Toile: ["toile"],
  Diamond: ["diamond"],
  Holo: ["holo", "holographic"],
  "Reverse Holo": ["reverse holo", "reverse holographic"],
  "Full Art": ["full art"],
  Gold: ["gold"],
  Rainbow: ["rainbow", "rainbow rare"],
  "Printing Plate": ["printing plate", "plate"]
};

export function normalizeParallelText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeParallelLabel(value: unknown) {
  const normalized = normalizeParallelText(value);
  if (!normalized || normalized === "base" || normalized === "none" || normalized === "raw") return "";

  for (const [official, aliases] of Object.entries(canonicalAliasGroups)) {
    if (aliases.includes(normalized)) return official;
  }

  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function parallelLabelsMatch(a: unknown, b: unknown) {
  const normalizedA = normalizeParallelLabel(a);
  const normalizedB = normalizeParallelLabel(b);
  return Boolean(normalizedA && normalizedB && normalizeParallelText(normalizedA) === normalizeParallelText(normalizedB));
}

export function isPokemonFinishLabel(value: unknown) {
  const normalized = normalizeParallelText(value);
  return ["holo", "reverse holo", "full art", "rainbow", "gold"].some((label) => normalized === label || normalized.includes(label));
}

export function isUltraPokemonLabel(value: unknown) {
  const normalized = normalizeParallelText(value);
  return ["v", "vmax", "vstar", "ex", "gx"].some((label) => normalized === label || normalized.includes(` ${label} `));
}
