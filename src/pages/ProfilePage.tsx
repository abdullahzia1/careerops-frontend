import { useQuery } from "@tanstack/react-query";
import { apiUrl, readErrorMessage } from "../api/client";
import type { MeResponse } from "../types/me";
import { CvEditorSection } from "./CvEditorSection";
import { CvExportSection } from "./CvExportSection";
import { ProfileSnapshotSection } from "./ProfileSnapshotSection";

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(apiUrl("/api/v1/me"));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<MeResponse>;
}

export function ProfilePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  let profileSeed = "";
  let profileEtag: string | undefined;

  const data = me.data;
  if (data) {
    const prof =
      data.activeProfileSnapshotId !== null
        ? data.profileSnapshots.find(
            (s) => s.id === data.activeProfileSnapshotId,
          )
        : undefined;
    if (prof) {
      profileSeed = JSON.stringify(prof.data, null, 2);
      profileEtag = prof.etag;
    } else {
      profileSeed = JSON.stringify(
        { note: "career-ops profile JSON" },
        null,
        2,
      );
    }
  }

  const activeCv = data?.cvVersions.find(
    (v) => v.id === data.activeCvVersionId,
  );

  return (
    <div className="stack">
      <h1>CV &amp; profile</h1>
      <p className="muted">
        Each block remounts when the active snapshot id changes. Versioned writes
        use <code>If-Match</code> after the first saved ETag.
      </p>
      {me.isLoading && <p>Loading…</p>}
      {me.error && <p className="error">{(me.error as Error).message}</p>}
      {data && (
        <>
          <CvEditorSection
            key={data.activeCvVersionId ?? "no-cv"}
            activeCvVersionId={data.activeCvVersionId}
            markdown={data.activeCvMarkdown ?? ""}
            etag={activeCv?.etag}
          />
          <ProfileSnapshotSection
            key={data.activeProfileSnapshotId ?? "no-profile"}
            activeProfileSnapshotId={data.activeProfileSnapshotId}
            seedJson={profileSeed}
            etag={profileEtag}
          />
          <CvExportSection />
        </>
      )}
    </div>
  );
}
