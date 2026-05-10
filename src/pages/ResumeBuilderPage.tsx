import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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

interface JdResult {
  company: string | null;
  role: string | null;
  jdText: string;
  sourceUrl: string | null;
}

interface KeywordBundle {
  hardSkills: string[];
  softSkills: string[];
  tools: string[];
  certifications: string[];
  acronyms: string[];
  missingFromCv: string[];
}

interface InjectionResult {
  tex: string;
  added: string[];
  skipped: string[];
  error?: string;
}

type InjectStrategy = "skills" | "ai";

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

  // JD keyword extraction state.
  const [jdUrl, setJdUrl] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [showPaste, setShowPaste] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<KeywordBundle | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [injectionFeedback, setInjectionFeedback] = useState<InjectionResult | null>(null);

  const compileAbort = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fetchKeywordsAbort = useRef<AbortController | null>(null);

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
      setKeywords(null);
      setPicked(new Set());
      setInjectionFeedback(null);
    }
  }

  // ── JD keyword pipeline ────────────────────────────────────────────────

  const fetchKeywords = useMutation<
    { jd: JdResult; keywords: KeywordBundle },
    Error,
    { url?: string; text?: string }
  >({
    mutationFn: async (input) => {
      fetchKeywordsAbort.current?.abort();
      const ctrl = new AbortController();
      fetchKeywordsAbort.current = ctrl;

      const jdRes = await fetch(apiUrl("/api/v1/jd/extract"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!jdRes.ok) throw new Error(await readErrorMessage(jdRes));
      const jd = (await jdRes.json()) as JdResult;

      const kwRes = await fetch(apiUrl("/api/v1/jd/keywords"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: jd.jdText, cv: tex }),
        signal: ctrl.signal,
      });
      if (!kwRes.ok) throw new Error(await readErrorMessage(kwRes));
      const keywordsBody = (await kwRes.json()) as KeywordBundle;
      return { jd, keywords: keywordsBody };
    },
    onSuccess: ({ keywords: kw }) => {
      setKeywords(kw);
      setPicked(new Set(kw.missingFromCv));
      setInjectionFeedback(null);
    },
  });

  const inject = useMutation<InjectionResult, Error, InjectStrategy>({
    mutationFn: async (strategy) => {
      const res = await fetch(apiUrl("/api/v1/latex/inject-keywords"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tex,
          keywords: Array.from(picked),
          strategy,
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return (await res.json()) as InjectionResult;
    },
    onSuccess: (result) => {
      setInjectionFeedback(result);
      if (result.added.length > 0) {
        setEditedTex(result.tex);
        // Drop the previously-rendered PDF so the user knows the new compile
        // hasn't happened yet, then auto-trigger a recompile.
        swapPreviewUrl(null);
        setPreviewBytes(null);
        void handleCompile();
      }
    },
  });

  function togglePicked(keyword: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  function selectAllMissing() {
    if (keywords) setPicked(new Set(keywords.missingFromCv));
  }

  function clearPicked() {
    setPicked(new Set());
  }

  function handleFetchKeywords() {
    setInjectionFeedback(null);
    if (showPaste) {
      const t = jdText.trim();
      if (t.length < 40) {
        fetchKeywords.reset();
        return;
      }
      fetchKeywords.mutate({ text: t });
    } else {
      const u = jdUrl.trim();
      if (!u) return;
      fetchKeywords.mutate({ url: u });
    }
  }

  const seedError = template.error ? (template.error as Error).message : null;

  const missingSet = useMemo(
    () => new Set((keywords?.missingFromCv ?? []).map((k) => k.toLowerCase())),
    [keywords],
  );
  const fetchKeywordsError = fetchKeywords.error ? fetchKeywords.error.message : null;
  const injectError =
    inject.error?.message ??
    (injectionFeedback?.error && injectionFeedback.added.length === 0
      ? injectionFeedback.error
      : null);

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

      {/* JD keyword extraction & injection */}
      <JdKeywordsPanel
        jdUrl={jdUrl}
        setJdUrl={setJdUrl}
        jdText={jdText}
        setJdText={setJdText}
        showPaste={showPaste}
        setShowPaste={setShowPaste}
        keywords={keywords}
        picked={picked}
        togglePicked={togglePicked}
        selectAllMissing={selectAllMissing}
        clearPicked={clearPicked}
        missingSet={missingSet}
        onFetch={handleFetchKeywords}
        fetchLoading={fetchKeywords.isPending}
        fetchError={fetchKeywordsError}
        onInject={(strategy) => inject.mutate(strategy)}
        injectLoading={inject.isPending}
        injectError={injectError}
        injectionFeedback={injectionFeedback}
      />

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

// ── JD keyword sub-component ─────────────────────────────────────────────

interface JdKeywordsPanelProps {
  jdUrl: string;
  setJdUrl: (v: string) => void;
  jdText: string;
  setJdText: (v: string) => void;
  showPaste: boolean;
  setShowPaste: (v: boolean) => void;
  keywords: KeywordBundle | null;
  picked: Set<string>;
  togglePicked: (kw: string) => void;
  selectAllMissing: () => void;
  clearPicked: () => void;
  missingSet: Set<string>;
  onFetch: () => void;
  fetchLoading: boolean;
  fetchError: string | null;
  onInject: (strategy: InjectStrategy) => void;
  injectLoading: boolean;
  injectError: string | null;
  injectionFeedback: InjectionResult | null;
}

function JdKeywordsPanel({
  jdUrl,
  setJdUrl,
  jdText,
  setJdText,
  showPaste,
  setShowPaste,
  keywords,
  picked,
  togglePicked,
  selectAllMissing,
  clearPicked,
  missingSet,
  onFetch,
  fetchLoading,
  fetchError,
  onInject,
  injectLoading,
  injectError,
  injectionFeedback,
}: JdKeywordsPanelProps) {
  const groups: Array<{ label: string; items: string[] }> = keywords
    ? [
        { label: "Hard skills", items: keywords.hardSkills },
        { label: "Tools", items: keywords.tools },
        { label: "Soft skills", items: keywords.softSkills },
        { label: "Certifications", items: keywords.certifications },
        { label: "Acronyms", items: keywords.acronyms },
      ].filter((g) => g.items.length > 0)
    : [];

  const showAddedBanner =
    injectionFeedback && injectionFeedback.added.length > 0;
  const showRejectedBanner =
    injectionFeedback &&
    injectionFeedback.added.length === 0 &&
    !!injectionFeedback.error;

  return (
    <div
      className="stack"
      style={{
        gap: "0.75rem",
        padding: "0.85rem",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="row spread" style={{ marginTop: 0, alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ fontSize: "0.95rem" }}>Tailor to a job description</strong>
          <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
            Paste a Greenhouse / Ashby / Lever job URL — we&apos;ll fetch it and ask Gemini to extract ATS keywords.
            Pick the ones you want and inject them into your LaTeX.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPaste(!showPaste)}
          style={{
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--border)",
            fontSize: "0.85rem",
          }}
        >
          {showPaste ? "Use URL instead" : "Paste JD instead"}
        </button>
      </div>

      {!showPaste ? (
        <div className="row" style={{ marginTop: 0, gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="url"
            value={jdUrl}
            onChange={(e) => setJdUrl(e.target.value)}
            placeholder="https://job-boards.greenhouse.io/anthropic/jobs/5161980008"
            spellCheck={false}
            style={{
              flex: "1 1 24rem",
              minWidth: 0,
              padding: "0.45rem 0.6rem",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "0.9rem",
            }}
          />
          <button
            type="button"
            onClick={onFetch}
            disabled={fetchLoading || !jdUrl.trim()}
          >
            {fetchLoading ? (
              <>
                <span className="spinner spinner-sm" /> Fetching…
              </>
            ) : (
              "Fetch keywords"
            )}
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: "0.5rem" }}>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the job description here…"
            rows={8}
            spellCheck={false}
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          <div className="row" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onFetch}
              disabled={fetchLoading || jdText.trim().length < 40}
              title={jdText.trim().length < 40 ? "Paste at least 40 characters" : undefined}
            >
              {fetchLoading ? (
                <>
                  <span className="spinner spinner-sm" /> Fetching…
                </>
              ) : (
                "Fetch keywords"
              )}
            </button>
          </div>
        </div>
      )}

      {fetchError && <p className="error small">{fetchError}</p>}

      {keywords && groups.length === 0 && (
        <p className="muted small" style={{ margin: 0 }}>
          No keywords extracted from this JD. Try a different URL or paste the
          description directly.
        </p>
      )}

      {groups.length > 0 && (
        <div className="stack" style={{ gap: "0.6rem" }}>
          <div className="row" style={{ marginTop: 0, gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted small">
              {picked.size} selected · {keywords?.missingFromCv.length ?? 0} missing from CV
            </span>
            <button
              type="button"
              onClick={selectAllMissing}
              disabled={(keywords?.missingFromCv.length ?? 0) === 0}
              style={{
                background: "transparent",
                color: "var(--accent)",
                border: "1px solid var(--border)",
                fontSize: "0.8rem",
                padding: "0.25rem 0.55rem",
              }}
            >
              Select all missing
            </button>
            <button
              type="button"
              onClick={clearPicked}
              disabled={picked.size === 0}
              style={{
                background: "transparent",
                color: "var(--muted, #94a3b8)",
                border: "1px solid var(--border)",
                fontSize: "0.8rem",
                padding: "0.25rem 0.55rem",
              }}
            >
              Clear
            </button>
          </div>

          {groups.map((group) => (
            <div key={group.label}>
              <div className="muted small" style={{ marginBottom: "0.25rem" }}>
                {group.label}
              </div>
              <div className="row" style={{ marginTop: 0, gap: "0.35rem", flexWrap: "wrap" }}>
                {group.items.map((kw) => {
                  const selected = picked.has(kw);
                  const missing = missingSet.has(kw.toLowerCase());
                  return (
                    <button
                      key={`${group.label}-${kw}`}
                      type="button"
                      onClick={() => togglePicked(kw)}
                      title={missing ? "Not in your CV yet" : "Already present in your CV"}
                      style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: 999,
                        fontSize: "0.78rem",
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected
                          ? "rgba(56, 189, 248, 0.18)"
                          : missing
                            ? "rgba(248, 113, 113, 0.08)"
                            : "transparent",
                        color: selected ? "var(--accent)" : "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      {kw}
                      {missing && (
                        <span
                          style={{
                            marginLeft: "0.3rem",
                            fontSize: "0.65rem",
                            color: "var(--danger, #f87171)",
                          }}
                        >
                          missing
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            className="row"
            style={{
              marginTop: "0.25rem",
              gap: "0.5rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => onInject("skills")}
              disabled={picked.size === 0 || injectLoading}
              title="Deterministic merge into the Technical Skills section. Cannot break compilation."
            >
              {injectLoading ? (
                <>
                  <span className="spinner spinner-sm" /> Injecting…
                </>
              ) : (
                `Add ${picked.size || ""} keyword${picked.size === 1 ? "" : "s"} (Skills only)`
              )}
            </button>
            <button
              type="button"
              onClick={() => onInject("ai")}
              disabled={picked.size === 0 || injectLoading}
              title="Ask Gemini to weave keywords into bullets across the resume. Validated and rolled back on failure."
              style={{
                background: "transparent",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              AI rewrite
            </button>
          </div>

          {showAddedBanner && injectionFeedback && (
            <div
              style={{
                padding: "0.55rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #166534",
                background: "#052e16",
                color: "#86efac",
                fontSize: "0.85rem",
              }}
            >
              Added {injectionFeedback.added.length} keyword{injectionFeedback.added.length === 1 ? "" : "s"}
              {injectionFeedback.skipped.length > 0 && (
                <>, skipped {injectionFeedback.skipped.length}</>
              )}
              . Recompiling preview…
            </div>
          )}

          {showRejectedBanner && injectionFeedback?.error && (
            <div
              style={{
                padding: "0.55rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #991b1b",
                background: "#2d0707",
                color: "#fecaca",
                fontSize: "0.85rem",
              }}
            >
              {injectionFeedback.error.includes("AI") || injectionFeedback.error.toLowerCase().includes("invalid")
                ? "AI rewrite was rejected (would have broken compilation). Try Skills-only."
                : injectionFeedback.error}
            </div>
          )}

          {injectError && !injectionFeedback?.error && (
            <p className="error small">{injectError}</p>
          )}
        </div>
      )}
    </div>
  );
}
