export { recognizeParallel } from "@/lib/parallel-recognition/parallel-engine";
export { normalizeParallelLabel, normalizeParallelText, parallelLabelsMatch } from "@/lib/parallel-recognition/normalization";
export type {
  LearnedParallelCorrection,
  ParallelCandidate,
  ParallelEvidence,
  ParallelEvidenceSource,
  ParallelProvider,
  ParallelProviderResult,
  ParallelRecognitionInput,
  ParallelRecognitionResult,
  ParallelRecognitionStatus,
  SerialParallelEvidence
} from "@/lib/parallel-recognition/types";
