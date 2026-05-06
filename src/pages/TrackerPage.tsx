import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl, readErrorMessage } from "../api/client";

interface VerifyResult {
  entriesChecked: number;
  errors: string[];
  warnings: string[];
  passed: boolean;
}

interface MutationResult {
  changes?: number;
  removed?: number;
  added?: number;
  updated?: number;
  tsvsProcessed?: number;
  written: boolean;
  unknowns?: string[];
  promoted?: Array<{ num: number; from: string; to: string }>;
  [key: string]: unknown;
}

async function fetchVerify(): Promise<VerifyResult> {
  const res = await fetch(apiUrl("/api/v1/tracker/verify"));
  return res.json();
}

async function postAction(path: string, dryRun: boolean): Promise<MutationResult> {
  const res = await fetch(apiUrl(`${path}?dryRun=${dryRun}`), { method: "POST" });
  return res.json();
}

function StatusBadge({ passed }: { passed: boolean }) {
  return (
    <span className={`badge ${passed ? "badge-active" : "badge-expired"}`}>
      {passed ? "Healthy" : "Issues found"}
    </span>
  );
}

function ActionButton({
  label,
  path,
  description,
}: {
  label: string;
  path: string;
  description: string;
}) {
  const qc = useQueryClient();
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<MutationResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => postAction(path, dryRun),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["tracker-verify"] });
    },
  });

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{description}</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run
          </label>
          <button
            className="btn"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ minWidth: "6rem" }}
          >
            {mutation.isPending ? "Running…" : "Run"}
          </button>
        </div>
      </div>
      {result && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--surface-2)", borderRadius: "6px", fontSize: "0.85rem" }}>
          {Object.entries(result).map(([k, v]) => (
            <div key={k} style={{ marginBottom: "0.25rem" }}>
              <strong>{k}:</strong>{" "}
              {Array.isArray(v) ? (
                v.length === 0 ? (
                  <span style={{ color: "var(--text-muted)" }}>none</span>
                ) : (
                  <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
                    {(v as unknown[]).slice(0, 20).map((item, i) => (
                      <li key={i}>{typeof item === "object" ? JSON.stringify(item) : String(item)}</li>
                    ))}
                  </ul>
                )
              ) : (
                <span>{String(v)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrackerPage() {
  const { data, isLoading, error, refetch } = useQuery<VerifyResult>({
    queryKey: ["tracker-verify"],
    queryFn: fetchVerify,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Tracker Tools</h1>
        <button className="btn" onClick={() => refetch()}>Refresh</button>
      </div>

      {/* Pipeline Health */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Pipeline Health</h2>
        <div className="card">
          {isLoading && <div className="spinner" />}
          {error && <div style={{ color: "var(--text-muted)" }}>Failed to load verify results.</div>}
          {data && (
            <>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
                <StatusBadge passed={data.passed} />
                <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  {data.entriesChecked} entries checked
                </span>
              </div>
              {data.errors.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 600, color: "#e55" }}>Errors ({data.errors.length})</div>
                  <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.85rem" }}>
                    {data.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {data.warnings.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, color: "#c90" }}>Warnings ({data.warnings.length})</div>
                  <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.85rem" }}>
                    {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {data.errors.length === 0 && data.warnings.length === 0 && (
                <div style={{ color: "var(--text-muted)" }}>All checks passed.</div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Maintenance actions */}
      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Maintenance</h2>
        <ActionButton
          label="Merge TSV additions"
          path="/api/v1/tracker/merge"
          description="Merge pending TSV files from batch/tracker-additions/ into applications.md"
        />
        <ActionButton
          label="Normalize statuses"
          path="/api/v1/tracker/normalize"
          description="Convert all non-canonical statuses to English canonicals (Evaluated, Applied, etc.)"
        />
        <ActionButton
          label="Deduplicate entries"
          path="/api/v1/tracker/dedup"
          description="Remove duplicate company+role entries, keeping the highest-scoring row"
        />
      </section>

      {/* Liveness checker */}
      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Liveness checker
        </h2>
        <LivenessChecker />
      </section>
    </div>
  );
}

interface LivenessEntry {
  url: string;
  status: "active" | "expired" | "uncertain";
  reason?: string;
}

async function checkLiveness(urls: string[]): Promise<LivenessEntry[]> {
  const res = await fetch(apiUrl("/api/v1/liveness"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<LivenessEntry[]>;
}

function LivenessChecker() {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<LivenessEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const urls = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await checkLiveness(urls);
      setResults(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (s: LivenessEntry["status"]) => {
    if (s === "active") return "#4ade80";
    if (s === "expired") return "var(--danger)";
    return "#fbbf24";
  };

  return (
    <div className="card stack" style={{ gap: "1rem" }}>
      <p className="muted small" style={{ margin: 0 }}>
        Paste job posting URLs (one per line). Uses headless Chromium to check
        if each posting is still active. Requires Playwright installed on the
        server.
      </p>

      <textarea
        className="code-area"
        rows={5}
        placeholder={"https://jobs.lever.co/company/abc\nhttps://boards.greenhouse.io/company/jobs/123"}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />

      <div className="row" style={{ marginTop: 0 }}>
        <button onClick={() => void handleCheck()} disabled={urls.length === 0 || loading}>
          {loading ? (
            <>
              <span className="spinner spinner-sm" /> Checking {urls.length} URL
              {urls.length !== 1 ? "s" : ""}…
            </>
          ) : (
            `Check ${urls.length} URL${urls.length !== 1 ? "s" : ""}`
          )}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {results && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "0.875rem",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontWeight: 700,
                  color: statusColor(r.status),
                  width: "5rem",
                  textTransform: "capitalize",
                }}
              >
                {r.status}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.url}
                </a>
                {r.reason && (
                  <span className="muted small">{r.reason}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
