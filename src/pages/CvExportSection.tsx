import { useState } from "react";
import { apiUrl, readErrorMessage } from "../api/client";

interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface CompileResult {
  success: boolean;
  filename?: string;
  error?: string;
}

export function CvExportSection() {
  // PDF
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // LaTeX
  const [latexContent, setLatexContent] = useState("");
  const [latexFilename, setLatexFilename] = useState("cv.pdf");
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [latexLoading, setLatexLoading] = useState<"validate" | "compile" | null>(null);
  const [latexError, setLatexError] = useState<string | null>(null);

  async function handleGeneratePdf() {
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
      a.download = "cv.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleValidate() {
    setLatexLoading("validate");
    setLatexError(null);
    setValidateResult(null);
    setCompileResult(null);
    try {
      const res = await fetch(apiUrl("/api/v1/latex/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex: latexContent }),
      });
      if (!res.ok) {
        setLatexError(await readErrorMessage(res));
        return;
      }
      setValidateResult((await res.json()) as ValidateResult);
    } catch (e) {
      setLatexError((e as Error).message);
    } finally {
      setLatexLoading(null);
    }
  }

  async function handleCompile() {
    setLatexLoading("compile");
    setLatexError(null);
    setCompileResult(null);
    try {
      const res = await fetch(apiUrl("/api/v1/latex/compile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex: latexContent, filename: latexFilename }),
      });
      if (!res.ok) {
        setLatexError(await readErrorMessage(res));
        return;
      }
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = latexFilename || "cv.pdf";
        a.click();
        URL.revokeObjectURL(url);
        setCompileResult({ success: true, filename: latexFilename });
      } else {
        setCompileResult((await res.json()) as CompileResult);
      }
    } catch (e) {
      setLatexError((e as Error).message);
    } finally {
      setLatexLoading(null);
    }
  }

  return (
    <div className="card stack" style={{ gap: "1.25rem" }}>
      <h2>Export CV</h2>

      {/* PDF section */}
      <div
        style={{
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <strong>Generate PDF</strong>
          <p className="muted small" style={{ marginTop: "0.25rem" }}>
            Renders your active CV markdown into an ATS-optimised PDF using the
            HTML template and fonts.
          </p>
        </div>
        <div className="row" style={{ marginTop: 0 }}>
          <button onClick={() => void handleGeneratePdf()} disabled={pdfLoading}>
            {pdfLoading ? (
              <>
                <span className="spinner spinner-sm" /> Generating…
              </>
            ) : (
              "Download PDF"
            )}
          </button>
        </div>
        {pdfError && <p className="error">{pdfError}</p>}
      </div>

      {/* LaTeX section */}
      <div
        style={{
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <strong>LaTeX export</strong>
          <p className="muted small" style={{ marginTop: "0.25rem" }}>
            Paste your <code>.tex</code> source to validate its structure or
            compile it to PDF (requires <code>tectonic</code> or{" "}
            <code>pdflatex</code> on the server).
          </p>
        </div>

        <textarea
          className="code-area"
          rows={10}
          placeholder={"\\documentclass{article}\n% paste your LaTeX CV here…"}
          value={latexContent}
          onChange={(e) => setLatexContent(e.target.value)}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="latex-filename" style={{ fontSize: "0.875rem", flexShrink: 0 }}>
            Output filename:
          </label>
          <input
            id="latex-filename"
            type="text"
            value={latexFilename}
            onChange={(e) => setLatexFilename(e.target.value)}
            style={{
              padding: "0.35rem 0.6rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "0.875rem",
              width: "12rem",
            }}
          />
        </div>

        <div className="row" style={{ marginTop: 0 }}>
          <button
            onClick={() => void handleValidate()}
            disabled={!latexContent.trim() || latexLoading !== null}
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            {latexLoading === "validate" ? (
              <>
                <span className="spinner spinner-sm" /> Validating…
              </>
            ) : (
              "Validate"
            )}
          </button>
          <button
            onClick={() => void handleCompile()}
            disabled={!latexContent.trim() || latexLoading !== null}
          >
            {latexLoading === "compile" ? (
              <>
                <span className="spinner spinner-sm" /> Compiling…
              </>
            ) : (
              "Compile & download"
            )}
          </button>
        </div>

        {latexError && <p className="error">{latexError}</p>}

        {validateResult && (
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: `1px solid ${validateResult.valid ? "#166534" : "#991b1b"}`,
              background: validateResult.valid ? "#052e16" : "#2d0707",
            }}
          >
            <strong style={{ color: validateResult.valid ? "#4ade80" : "var(--danger)" }}>
              {validateResult.valid ? "✓ Valid LaTeX" : "✗ Validation failed"}
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

        {compileResult && (
          <p
            className={compileResult.success ? undefined : "error"}
            style={{ margin: 0, fontSize: "0.875rem" }}
          >
            {compileResult.success
              ? `✓ Compiled — ${compileResult.filename ?? "cv.pdf"} downloaded`
              : compileResult.error ?? "Compilation failed"}
          </p>
        )}
      </div>
    </div>
  );
}
