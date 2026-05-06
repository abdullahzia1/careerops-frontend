export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface EvaluationJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  jdPreview: string;
  jdFull: string;
  cvVersionId: string | null;
  profileSnapshotId: string | null;
  // populated by worker
  reportMarkdown: string | null;
  score: number | null;
  company: string | null;
  role: string | null;
  archetype: string | null;
  legitimacy: string | null;
  errorMessage: string | null;
}
