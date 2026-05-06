export interface CvVersion {
  id: string;
  etag: string;
  content: string;
  createdAt: string;
}

export interface ProfileSnapshot {
  id: string;
  etag: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface MeResponse {
  userId: string;
  activeCvVersionId: string | null;
  activeProfileSnapshotId: string | null;
  cvVersions: CvVersion[];
  profileSnapshots: ProfileSnapshot[];
  activeCvMarkdown: string | null;
  activeProfile: Record<string, unknown> | null;
}
