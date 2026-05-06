import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl, readErrorMessage } from "../api/client";

interface Portal {
  name: string;
  greenhouse?: string;
  ashby?: string;
  lever?: string;
}

interface ScanJob {
  title: string;
  company: string;
  url: string;
  source: string;
  postedAt?: string;
}

interface ScanResult {
  scanned: number;
  newJobs: number;
  jobs: ScanJob[];
  skipped: number;
  errors: string[];
  dryRun: boolean;
}

async function fetchPortals(): Promise<Portal[]> {
  const res = await fetch(apiUrl("/api/v1/scan/portals"));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<Portal[]>;
}

async function runScan(params: {
  company?: string;
  dryRun: boolean;
}): Promise<ScanResult> {
  const qs = new URLSearchParams();
  if (params.company) qs.set("company", params.company);
  if (params.dryRun) qs.set("dryRun", "true");
  const res = await fetch(apiUrl(`/api/v1/scan?${qs.toString()}`), {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<ScanResult>;
}

export function ScanPage() {
  const qc = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);

  const portals = useQuery({
    queryKey: ["scan-portals"],
    queryFn: fetchPortals,
  });

  const scan = useMutation({
    mutationFn: runScan,
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  function handleScan() {
    setResult(null);
    scan.mutate({ company: selectedCompany || undefined, dryRun });
  }

  const apiTypes = (p: Portal) =>
    [p.greenhouse && "Greenhouse", p.ashby && "Ashby", p.lever && "Lever"]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Portal scanner</h1>
      </div>
      <p className="muted">
        Hits Greenhouse, Ashby, and Lever APIs directly — zero LLM cost. New
        jobs are deduplicated against scan history.
      </p>

      {/* Controls */}
      <div className="card stack" style={{ gap: "1rem" }}>
        <h2>Run scan</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="company-select" style={{ fontSize: "0.9rem" }}>
            Company (leave blank to scan all)
          </label>
          {portals.isLoading && <p className="muted small">Loading portals…</p>}
          {portals.data && (
            <select
              id="company-select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{
                padding: "0.5rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: "0.9rem",
              }}
            >
              <option value="">— All companies ({portals.data.length}) —</option>
              {portals.data.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {apiTypes(p) ? ` (${apiTypes(p)})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry run (preview only, don't update scan history)
        </label>

        <div className="row" style={{ marginTop: 0 }}>
          <button onClick={handleScan} disabled={scan.isPending}>
            {scan.isPending ? (
              <>
                <span className="spinner spinner-sm" /> Scanning…
              </>
            ) : (
              "Run scan"
            )}
          </button>
          {dryRun && (
            <span className="muted small">Dry run — no changes will be saved</span>
          )}
        </div>

        {scan.error && (
          <p className="error">{(scan.error as Error).message}</p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="card stack" style={{ gap: "1rem" }}>
          <div className="row spread">
            <h2 style={{ margin: 0 }}>
              Scan results{" "}
              {result.dryRun && (
                <span className="tag muted small">dry run</span>
              )}
            </h2>
            <div className="row" style={{ gap: "1.5rem", marginTop: 0 }}>
              <span className="muted small">
                <strong style={{ color: "var(--text)" }}>{result.scanned}</strong> portals scanned
              </span>
              <span className="muted small">
                <strong style={{ color: "#4ade80" }}>{result.newJobs}</strong> new jobs
              </span>
              <span className="muted small">
                <strong style={{ color: "var(--text)" }}>{result.skipped}</strong> skipped (dupes)
              </span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="muted small" style={{ marginBottom: "0.4rem" }}>Errors:</p>
              <ul className="flat-list">
                {result.errors.map((e, i) => (
                  <li key={i} className="error small">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result.jobs.length === 0 ? (
            <p className="muted">No new jobs found.</p>
          ) : (
            <ul className="job-list">
              {result.jobs.map((j, i) => (
                <li key={i} className="card" style={{ padding: "1rem" }}>
                  <div className="row spread" style={{ marginTop: 0 }}>
                    <div>
                      <strong>{j.title}</strong>
                      <span className="muted"> — {j.company}</span>
                    </div>
                    <span className="tag small">{j.source}</span>
                  </div>
                  <div className="row" style={{ marginTop: "0.5rem" }}>
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="small"
                    >
                      View posting ↗
                    </a>
                    {j.postedAt && (
                      <span className="muted small">
                        Posted {new Date(j.postedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Portal list */}
      {portals.data && portals.data.length > 0 && (
        <div className="card stack" style={{ gap: "0.75rem" }}>
          <h2>Configured portals ({portals.data.length})</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
              gap: "0.5rem",
            }}
          >
            {portals.data.map((p) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              >
                <span>{p.name}</span>
                <span className="muted small">{apiTypes(p)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
