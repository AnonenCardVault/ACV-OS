import type { AIProvider } from "@/lib/ai/types";
import { ACVMockProvider } from "@/lib/ai/providers/mock-provider";
import { MockCardSightProvider } from "@/lib/ai/providers/cardsight-provider";
import { MockChecklistProvider } from "@/lib/ai/providers/checklist-provider";
import { MockGPTVisionProvider } from "@/lib/ai/providers/gpt-vision-provider";
import { MockOCRProvider } from "@/lib/ai/providers/ocr-provider";
import { OpenAIGPTVisionProvider } from "@/lib/ai/providers/openai-gpt-vision-provider";

export type AIProviderEnvironment = {
  cardsightApiKey?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  ocrProvider?: string;
};

export function createDefaultAIProviders(env: AIProviderEnvironment = {}): AIProvider[] {
  const gptProvider = env.openAiApiKey
    ? new OpenAIGPTVisionProvider({ apiKey: env.openAiApiKey, model: env.openAiModel || "gpt-5.5" })
    : new MockGPTVisionProvider();

  return [new MockOCRProvider(), new MockCardSightProvider(), new MockChecklistProvider(), gptProvider, new ACVMockProvider()];
}

export function providerEnvironmentSummary(env: AIProviderEnvironment = {}) {
  return {
    cardsightConfigured: Boolean(env.cardsightApiKey),
    openAiConfigured: Boolean(env.openAiApiKey),
    openAiModel: env.openAiApiKey ? env.openAiModel || "gpt-5.5" : "mock",
    ocrProvider: env.ocrProvider || "mock",
    mode: env.openAiApiKey ? "openai-gpt-orchestrated" : "mock-orchestrated"
  };
}
