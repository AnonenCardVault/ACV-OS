import type { AIProvider } from "@/lib/ai/types";
import { ACVMockProvider } from "@/lib/ai/providers/mock-provider";
import { MockCardSightProvider } from "@/lib/ai/providers/cardsight-provider";
import { MockChecklistProvider } from "@/lib/ai/providers/checklist-provider";
import { MockGPTVisionProvider } from "@/lib/ai/providers/gpt-vision-provider";
import { MockOCRProvider } from "@/lib/ai/providers/ocr-provider";

export type AIProviderEnvironment = {
  cardsightApiKey?: string;
  openAiApiKey?: string;
  ocrProvider?: string;
};

export function createDefaultAIProviders(_env: AIProviderEnvironment = {}): AIProvider[] {
  // Phase 3 prepares env-aware routing, but intentionally keeps every provider mocked.
  // Future phases can replace any class here without changing the orchestrator contract.
  return [new MockOCRProvider(), new MockCardSightProvider(), new MockChecklistProvider(), new MockGPTVisionProvider(), new ACVMockProvider()];
}

export function providerEnvironmentSummary(env: AIProviderEnvironment = {}) {
  return {
    cardsightConfigured: Boolean(env.cardsightApiKey),
    openAiConfigured: Boolean(env.openAiApiKey),
    ocrProvider: env.ocrProvider || "mock",
    mode: "mock-orchestrated"
  };
}
