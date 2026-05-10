import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl, readErrorMessage } from "../api/client";
import { PdfViewer } from "../components/PdfViewer";

interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface CompileError {
  message: string;
  logSnippet?: string;
}

async function fetchTemplate(): Promise<string> {
  const res = await fetch(apiUrl("/api/v1/latex/template"));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const body = (await res.json()) as { tex: string };
  return body.tex;
}

const DEFAULT_FILENAME = "resume";

/**
 * Strip path separators and any user-supplied .pdf extension. Lets the user
 * type freely (including spaces) but always sends a safe slug + ".pdf" to the
 * server and uses it for the download attribute.
 */
function sanitizeFilenameStem(raw: string): string {
  const trimmed = raw.trim().replace(/\.pdf$/i, "");
  const cleaned = trimmed.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return cleaned || DEFAULT_FILENAME;
}

export function ResumeBuilderPage() {
  // `editedTex` is `null` until the user changes anything — `tex` is then
  // derived from the cached template, removing the need for an effect/ref to
  // copy the seed into state.
  const [editedTex, setEditedTex] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>(DEFAULT_FILENAME);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [compileLoading, setCompileLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<CompileError | null>(null);

  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [validateLoading, setValidateLoading] = useState<boolean>(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  const compileAbort = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const template = useQuery({
    queryKey: ["latex-template"],
    queryFn: fetchTemplate,
    staleTime: Infinity,
  });

  const tex = editedTex ?? template.data ?? "";

  // Keep ref in sync so the unmount cleanup revokes the latest URL.
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      compileAbort.current?.abort();
    };
  }, []);

  function swapPreviewUrl(next: string | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }

  async function handleCompile() {
    if (!tex.trim()) return;
    compileAbort.current?.abort();
    const ctrl = new AbortController();
    compileAbort.current = ctrl;

    setCompileLoading(true);
    setCompileError(null);
    try {
      const res = await fetch(apiUrl("/api/v1/latex/compile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tex,
          filename: `${sanitizeFilenameStem(filename)}.pdf`,
        }),
        signal: ctrl.signal,
      });

      const ct = res.headers.get("Content-Type") ?? "";
      if (res.ok && ct.includes("application/pdf")) {
        const buffer = await res.arrayBuffer();
        // Hand react-pdf its own copy — pdf.js may detach the buffer it parses.
        setPreviewBytes(new Uint8Array(buffer.slice(0)));
        const blob = new Blob([buffer], { type: "application/pdf" });
        swapPreviewUrl(URL.createObjectURL(blob));
        return;
      }

      // Backend returns { success: false, message, logSnippet? } on failure.
      let message = `HTTP ${res.status}`;
      let logSnippet: string | undefined;
      try {
        const body = (await res.json()) as { message?: string; logSnippet?: string };
        if (body.message) message = body.message;
        logSnippet = body.logSnippet;
      } catch {
        message = await readErrorMessage(res);
      }
      setCompileError({ message, logSnippet });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setCompileError({ message: (err as Error).message });
    } finally {
      if (!ctrl.signal.aborted) setCompileLoading(false);
    }
  }

  async function handleValidate() {
    if (!tex.trim()) return;
    setValidateLoading(true);
    setValidateError(null);
    setValidateResult(null);
    try {
      const res = await fetch(apiUrl("/api/v1/latex/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex }),
      });
      if (!res.ok) {
        setValidateError(await readErrorMessage(res));
        return;
      }
      setValidateResult((await res.json()) as ValidateResult);
    } catch (err) {
      setValidateError((err as Error).message);
    } finally {
      setValidateLoading(false);
    }
  }

  function handleDownload() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${sanitizeFilenameStem(filename)}.pdf`;
    a.click();
  }

  function handleResetToTemplate() {
    if (template.data) {
      setEditedTex(null);
      swapPreviewUrl(null);
      setPreviewBytes(null);
      setCompileError(null);
      setValidateResult(null);
    }
  }

  const seedError = template.error ? (template.error as Error).message : null;

  return (
    <section className="card stack full-bleed" style={{ gap: "1rem" }}>
      <div className="row spread" style={{ marginTop: 0 }}>
        <div>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Edit the LaTeX source on the left, hit{" "}
            <strong>Compile preview</strong> to render it on the right, then{" "}
            <strong>Download PDF</strong> when you are happy with the layout.
          </p>
        </div>
        <div className="row" style={{ marginTop: 0, gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--bg)",
              fontSize: "0.875rem",
            }}
            title="Filename used when you download the PDF (extension is added automatically)"
          >
            <input
              id="resume-filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={DEFAULT_FILENAME}
              spellCheck={false}
              aria-label="Resume filename"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "none",
                outline: "none",
                padding: "0.4rem 0.6rem",
                width: "10rem",
                fontSize: "0.875rem",
              }}
            />
            <span
              style={{
                padding: "0.4rem 0.6rem",
                background: "rgba(255,255,255,0.04)",
                color: "var(--muted, #94a3b8)",
                borderLeft: "1px solid var(--border)",
                userSelect: "none",
              }}
            >
              .pdf
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetToTemplate}
            disabled={!template.data}
            style={{
              background: "transparent",
              color: "var(--muted, #94a3b8)",
              border: "1px solid var(--border)",
            }}
          >
            Reset to template
          </button>
          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={!tex.trim() || validateLoading}
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            {validateLoading ? (
              <>
                <span className="spinner spinner-sm" /> Validating…
              </>
            ) : (
              "Validate"
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleCompile()}
            disabled={!tex.trim() || compileLoading}
          >
            {compileLoading ? (
              <>
                <span className="spinner spinner-sm" /> Compiling…
              </>
            ) : (
              "Compile preview"
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!previewUrl}
            title={previewUrl ? "Download the previewed PDF" : "Compile a preview first"}
          >
            Download PDF
          </button>
        </div>
      </div>

      {seedError && (
        <p className="error">Failed to load template: {seedError}</p>
      )}

      {validateError && <p className="error">Validate failed: {validateError}</p>}

      {validateResult && (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: 8,
            border: `1px solid ${validateResult.valid ? "#166534" : "#991b1b"}`,
            background: validateResult.valid ? "#052e16" : "#2d0707",
          }}
        >
          <strong style={{ color: validateResult.valid ? "#4ade80" : "var(--danger, #f87171)" }}>
            {validateResult.valid ? "Valid LaTeX" : "Validation failed"}
          </strong>
          {validateResult.errors.length > 0 && (
            <ul className="flat-list" style={{ marginTop: "0.5rem" }}>
              {validateResult.errors.map((e, i) => (
                <li key={i} className="error small">{e}</li>
              ))}
            </ul>
          )}
          {validateResult.warnings.length > 0 && (
            <ul className="flat-list" style={{ marginTop: "0.5rem" }}>
              {validateResult.warnings.map((w, i) => (
                <li key={i} className="muted small">⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        <textarea
          className="code-area"
          value={tex}
          onChange={(e) => setEditedTex(e.target.value)}
          spellCheck={false}
          placeholder={template.isLoading ? "Loading template…" : "% paste your LaTeX CV here…"}
          style={{ minHeight: "75vh", fontFamily: "monospace", fontSize: "0.85rem" }}
        />

        <div style={{ position: "relative", minHeight: "75vh", display: "flex" }}>
          {compileLoading && (
            <span
              className="spinner spinner-sm"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
              aria-label="Compiling preview"
            />
          )}
          <PdfViewer data={previewBytes} style={{ flex: 1, minHeight: "75vh" }} />
        </div>
      </div>

      {compileError && (
        <div
          style={{
            background: "#2d0707",
            border: "1px solid #991b1b",
            color: "#fecaca",
            padding: "0.75rem",
            borderRadius: 6,
          }}
        >
          <strong>Compile failed</strong>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>{compileError.message}</p>
          {compileError.logSnippet && (
            <pre
              className="code-area"
              style={{
                marginTop: "0.5rem",
                background: "#0b0b0b",
                color: "#fecaca",
                padding: "0.5rem",
                fontSize: "0.75rem",
                whiteSpace: "pre-wrap",
                maxHeight: "12rem",
                overflow: "auto",
              }}
            >
              {compileError.logSnippet}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
