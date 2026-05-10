import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleDownloadPdf() {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch(apiUrl("/api/v1/pdf"), { method: "POST" });
      if (!res.ok) {
        setPdfError(await readErrorMessage(res));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  }

  const saveError = saveCv.error ? (saveCv.error as Error).message : null;

  return (
    <section className="card stack" style={{ gap: "1rem" }}>
      <div className="row spread" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>CV editor</h2>
        <div className="row" style={{ marginTop: 0, gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => void saveCv.mutate()}
            disabled={saveCv.isPending}
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            {saveCv.isPending ? "Saving…" : "Save version"}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <>
                <span className="spinner spinner-sm" /> Generating…
              </>
            ) : (
              "Download PDF"
            )}
          </button>
        </div>
      </div>

      {saveError && <p className="error">{saveError}</p>}
      {pdfError && <p className="error">{pdfError}</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        <textarea
          className="code-area"
          rows={28}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          style={{ minHeight: "70vh" }}
        />
        <CvPreview markdown={markdown} />
      </div>

      {cvEtag && (
        <p className="muted small" style={{ margin: 0 }}>
          Version <code>{activeCvVersionId}</code> · ETag <code>{cvEtag}</code>
        </p>
      )}
    </section>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

interface CvPreviewProps {
  markdown: string;
}

function CvPreview({ markdown }: CvPreviewProps) {
  const debounced = useDebounced(markdown, 400);
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    fetch(apiUrl("/api/v1/pdf/preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: debounced }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.text();
      })
      .then((body) => setHtml(body))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [debounced]);

  return (
    <div
      style={{
        position: "relative",
        background: "#525659",
        padding: "1rem",
        borderRadius: 8,
        border: "1px solid var(--border)",
        height: "70vh",
        overflow: "auto",
      }}
    >
      {loading && (
        <span
          className="spinner spinner-sm"
          style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
          aria-label="Rendering preview"
        />
      )}
      {error ? (
        <div
          style={{
            background: "#2d0707",
            border: "1px solid #991b1b",
            color: "#fecaca",
            padding: "0.75rem",
            borderRadius: 6,
            fontSize: "0.85rem",
          }}
        >
          Preview failed: {error}
        </div>
      ) : (
        <iframe
          title="CV preview"
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{
            width: "210mm",
            minHeight: "297mm",
            margin: "0 auto",
            background: "#fff",
            border: "none",
            display: "block",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.45)",
          }}
        />
      )}
    </div>
  );
}
