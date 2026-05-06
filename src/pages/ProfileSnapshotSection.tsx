import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiUrl, readErrorMessage } from "../api/client";

interface Props {
  activeProfileSnapshotId: string | null;
  seedJson: string;
  etag: string | undefined;
}

export function ProfileSnapshotSection({
  activeProfileSnapshotId,
  seedJson,
  etag: seedEtag,
}: Props) {
  const qc = useQueryClient();
  const [profileJson, setProfileJson] = useState(seedJson);
  const [profileEtag, setProfileEtag] = useState<string | undefined>(seedEtag);

  const saveProfile = useMutation({
    mutationFn: async () => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(profileJson) as Record<string, unknown>;
      } catch {
        throw new Error("Profile must be valid JSON.");
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (profileEtag) headers["If-Match"] = profileEtag;
      const res = await fetch(apiUrl("/api/v1/me/profile"), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const etag = res.headers.get("Etag");
      if (etag) setProfileEtag(etag);
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const error = saveProfile.error
    ? (saveProfile.error as Error).message
    : null;

  return (
    <section className="card">
      <h2>Profile (JSON)</h2>
      {error && <p className="error">{error}</p>}
      <textarea
        className="code-area"
        rows={12}
        value={profileJson}
        onChange={(e) => setProfileJson(e.target.value)}
      />
      <div className="row">
        <button
          type="button"
          onClick={() => void saveProfile.mutate()}
          disabled={saveProfile.isPending}
        >
          Save profile snapshot
        </button>
        {profileEtag && (
          <span className="muted">
            Snapshot <code>{activeProfileSnapshotId}</code> · ETag{" "}
            <code>{profileEtag}</code>
          </span>
        )}
      </div>
    </section>
  );
}
