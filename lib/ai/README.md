# ACV AI Orchestrator

ACV OS owns the intelligence. AI providers are tools.

CardSight, GPT, OCR, checklist data, future providers, and future internal models all plug into this orchestration layer through provider interfaces. The UI should receive one unified ACV extraction result and should never need to know which provider produced it.

Current Phase 3 behavior is intentionally mock-only:

- Mock OCR Quick Pass
- Mock CardSight
- Mock Checklist Validation
- Mock GPT Vision
- ACV Mock Provider

Future API integrations should replace providers, not the orchestrator.

## Cost-Aware Routing

The orchestrator is designed to avoid unnecessary paid calls:

1. Image processing checks quality and can return `Retake Image` before any paid provider is considered.
2. OCR quick pass collects routing context only.
3. Local checklist/rules can complete extraction when confidence exceeds configurable thresholds.
4. CardSight is modeled as a front-image-only provider.
5. GPT Vision is modeled as a verification/final-mapping provider and only runs when routing requires it.

Thresholds live in `lib/ai/orchestrator/decision-engine.ts`.

## Replay

Every extraction result contains provider metadata, provider outputs, decision trace, image-processing metadata, and a replay-ready log. Future UI can call `replayExtraction()` to rerun a card with newest providers and compare field-level differences before updating a Universal Card Profile.
