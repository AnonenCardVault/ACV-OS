import type { AILearningCorrection, AILearningEvent } from "@/lib/ai/types";

export interface LearningStore {
  recordEvent(event: AILearningEvent): Promise<void>;
  recordCorrection(correction: AILearningCorrection): Promise<void>;
}

export class MemoryLearningStore implements LearningStore {
  private events: AILearningEvent[] = [];
  private corrections: AILearningCorrection[] = [];

  async recordEvent(event: AILearningEvent) {
    this.events.push(event);
  }

  async recordCorrection(correction: AILearningCorrection) {
    this.corrections.push(correction);
  }

  snapshot() {
    return {
      events: this.events,
      corrections: this.corrections
    };
  }
}
