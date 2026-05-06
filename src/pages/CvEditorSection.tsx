import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiUrl, readErrorMessage } from "../api/client";

interface Props {
  activeCvVersionId: string | null;
  markdown: string;
  etag: string | undefined;
}

export function CvEditorSection({
  activeCvVersionId,
  markdown: seedMarkdown,
  etag: seedEtag,
}: Props) {
  const qc = useQueryClient();
  const [markdown, setMarkdown] = useState(seedMarkdown);
  const [cvEtag, setCvEtag] = useState<string | undefined>(seedEtag);

  const saveCv = useMutation({
    mutationFn: async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (cvEtag) headers["If-Match"] = cvEtag;
      const res = await fetch(apiUrl("/api/v1/me/cv"), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ content: markdown }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const etag = res.headers.get("Etag");
      if (etag) setCvEtag(etag);
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const error = saveCv.error ? (saveCv.error as Error).message : null;

  return (
    <section className="card">
      <h2>CV (markdown)</h2>
      {error && <p className="error">{error}</p>}
      <textarea
        className="code-area"
        rows={16}
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
      />
      <div className="row">
        <button type="button" onClick={() => void saveCv.mutate()} disabled={saveCv.isPending}>
          Save CV version
        </button>
        {cvEtag && (
          <span className="muted">
            Version <code>{activeCvVersionId}</code> · ETag{" "}
            <code>{cvEtag}</code>
          </span>
        )}
      </div>
    </section>
  );
}
