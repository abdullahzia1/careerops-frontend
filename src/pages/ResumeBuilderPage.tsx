import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl, readErrorMessage } from "../api/client";

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

export function ResumeBuilderPage() {
  const [tex, setTex] = useState<string>("");
  const [seeded, setSeeded] = useState<boolean>(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compileLoading, setCompileLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<CompileError | null>(null);

  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [validateLoading, setValidateLoading] = useState<boolean>(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  const compileAbort = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Seed editor with cv-template.tex on first visit only.
  const template = useQuery({
    queryKey: ["latex-template"],
    queryFn: fetchTemplate,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!seeded && template.data && tex === "") {
      setTex(template.data);
      setSeeded(true);
    }
  }, [seeded, template.data, tex]);

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
        body: JSON.stringify({ tex, filename: "cv.pdf" }),
        signal: ctrl.signal,
      });

      const ct = res.headers.get("Content-Type") ?? "";
      if (res.ok && ct.includes("application/pdf")) {
        const blob = await res.blob();
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
    a.download = `cv-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
  }

  function handleResetToTemplate() {
    if (template.data) {
      setTex(template.data);
      swapPreviewUrl(null);
      setCompileError(null);
      setValidateResult(null);
    }
  }

  const seedError = template.error ? (template.error as Error).message : null;

  return (
    <section className="card stack" style={{ gap: "1rem" }}>
      <div className="row spread" style={{ marginTop: 0 }}>
        <div>
          <h1 style={{ margin: 0 }}>Resume Builder</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Edit the LaTeX source on the left, hit{" "}
            <strong>Compile preview</strong> to render it on the right, then{" "}
            <strong>Download PDF</strong> when you are happy with the layout.
          </p>
        </div>
        <div className="row" style={{ marginTop: 0, gap: "0.5rem", flexWrap: "wrap" }}>
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
          onChange={(e) => setTex(e.target.value)}
          spellCheck={false}
          placeholder={template.isLoading ? "Loading template…" : "% paste your LaTeX CV here…"}
          style={{ minHeight: "75vh", fontFamily: "monospace", fontSize: "0.85rem" }}
        />

        <div
          style={{
            position: "relative",
            background: "#525659",
            padding: "1rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            minHeight: "75vh",
            display: "flex",
          }}
        >
          {compileLoading && (
            <span
              className="spinner spinner-sm"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
              aria-label="Compiling preview"
            />
          )}
          {previewUrl ? (
            <iframe
              title="Compiled CV"
              src={previewUrl}
              style={{
                flex: 1,
                width: "100%",
                border: "none",
                background: "#fff",
                borderRadius: 4,
                boxShadow: "0 6px 24px rgba(0, 0, 0, 0.45)",
              }}
            />
          ) : (
            <div
              style={{
                margin: "auto",
                color: "#cbd5e1",
                fontSize: "0.9rem",
                textAlign: "center",
                maxWidth: "20rem",
              }}
            >
              {compileLoading
                ? "Compiling…"
                : "Click \"Compile preview\" to render your LaTeX here."}
            </div>
          )}
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
