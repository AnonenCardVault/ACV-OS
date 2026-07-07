import type { AIImageInput, AIImageProcessingResult } from "@/lib/ai/types";

const closeupRoles = new Set(["Detail / Closeup", "Serial Closeup", "Holo / Surface", "Auto Closeup", "Patch / Relic Closeup"]);

export function isSendableImage(image: AIImageInput) {
  const value = image.url || image.dataUrl || "";
  return Boolean(value && !value.startsWith("blob:"));
}

export function prepareImagesForExtraction(images: AIImageInput[], options: { frontBackOnly?: boolean; maxImages?: number } = {}) {
  const ordered = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const selected: AIImageInput[] = [];
  const maxImages = options.frontBackOnly ? 2 : options.maxImages || 4;
  const add = (image: AIImageInput | undefined) => {
    if (!image || !isSendableImage(image) || selected.some((item) => item.id === image.id)) return;
    selected.push(image);
  };

  add(ordered.find((image) => image.role === "Front"));
  add(ordered.find((image) => image.role === "Back"));

  if (!options.frontBackOnly) {
    ordered.filter((image) => closeupRoles.has(String(image.role))).forEach(add);
  }

  ordered.forEach(add);
  return selected.slice(0, maxImages);
}

export function assessImageQuality(images: AIImageInput[]): AIImageProcessingResult {
  const reasons: string[] = [];
  const selectedImageIds = images.map((image) => image.id);
  const front = images.find((image) => image.role === "Front");
  const back = images.find((image) => image.role === "Back");
  let score = 92;

  if (!front) {
    score -= 55;
    reasons.push("Missing front image");
  }
  if (!back) {
    score -= 12;
    reasons.push("Back image missing");
  }
  if (images.some((image) => image.needsReupload)) {
    score -= 35;
    reasons.push("One or more images need re-upload");
  }
  if (images.length === 0 || images.every((image) => !isSendableImage(image))) {
    score = 0;
    reasons.push("No usable image data");
  }

  const qualityScore = Math.max(0, Math.min(100, score));
  const qualityStatus = qualityScore >= 80 ? "good" : qualityScore >= 45 ? "usable" : "poor";

  return {
    selectedImageIds,
    frontImageId: front?.id,
    backImageId: back?.id,
    qualityScore,
    qualityStatus,
    retakeRequired: qualityStatus === "poor",
    reasons: reasons.length > 0 ? reasons : ["Images pass mock quality gate"]
  };
}
