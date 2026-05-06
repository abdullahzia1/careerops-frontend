import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiUrl, readErrorMessage } from "../api/client";
import { MarkdownView } from "../components/MarkdownView";
import type { EvaluationJob } from "../types/evaluations";

async function fetchJob(id: string): Promise<EvaluationJob> {
  const res = await fetch(apiUrl(`/api/v1/evaluations/jobs/${id}`));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<EvaluationJob>;
}

function scoreClass(score: number | null): string {
  if (score === null) return "";
  if (score >= 4.0) return "score-high";
  if (score >= 3.0) return "score-mid";
  return "score-low";
}

function legitimacyClass(leg: string | null): string {
  if (!leg) return "";
  if (leg.toLowerCase().includes("high")) return "score-high";
  if (leg.toLowerCase().includes("caution")) return "score-mid";
  return "score-low";
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();

  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJob(id!),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (!s || s === "queued" || s === "running") return 2_000;
      return false;
    },
    enabled: !!id,
  });

  const data = job.data;

  return (
    <div className="stack">
      <div className="row">
        <Link to="/jobs" className="muted small">← All jobs</Link>
      </div>

      <h1>Evaluation report</h1>

      {job.isLoading && <p>Loading…</p>}
      {job.error && <p className="error">{(job.error as Error).message}</p>}

      {data && (
        <>
          {/* Status bar */}
          <div className="card row spread" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <span className={`status-badge status-${data.status}`}>
                {data.status === "running" && <span className="spinner" />}
                {data.status}
              </span>

              {data.score !== null && (
                <span className={`score-badge ${scoreClass(data.score)}`}>
                  {data.score.toFixed(1)} / 5
                </span>
              )}

              {data.archetype && (
                <span className="tag">{data.archetype}</span>
              )}

              {data.legitimacy && (
                <span className={`tag ${legitimacyClass(data.legitimacy)}`}>
                  {data.legitimacy}
                </span>
              )}
            </div>

            <span className="muted small">
              {new Date(data.createdAt).toLocaleString()}
            </span>
          </div>

          {/* Company / role */}
          {(data.company ?? data.role) && (
            <div className="card">
              {data.company && (
                <p style={{ margin: 0 }}>
                  <strong>Company</strong>{" "}
                  {data.company === "Unknown" ? (
                    <span className="muted">(unknown)</span>
                  ) : (
                    data.company
                  )}
                </p>
              )}
              {data.role && (
                <p style={{ margin: "0.4rem 0 0" }}>
                  <strong>Role</strong> {data.role}
                </p>
              )}
            </div>
          )}

          {/* Waiting / running */}
          {(data.status === "queued" || data.status === "running") && (
            <div className="card">
              <div className="row">
                <span className="spinner" />
                <span className="muted">
                  {data.status === "queued"
                    ? "Waiting in queue…"
                    : "Evaluating with Gemini — this takes 30–60 seconds…"}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {data.status === "failed" && data.errorMessage && (
            <div className="card">
              <p className="error" style={{ margin: 0 }}>
                {data.errorMessage}
              </p>
            </div>
          )}

          {/* Report */}
          {data.reportMarkdown && (
            <section className="card report-card">
              <h2>Full report</h2>
              <MarkdownView markdown={data.reportMarkdown} />
            </section>
          )}

          {/* Original JD (collapsible) */}
          <details className="card">
            <summary className="muted" style={{ cursor: "pointer" }}>
              Original job description
            </summary>
            <pre className="jd-pre">{data.jdFull}</pre>
          </details>
        </>
      )}
    </div>
  );
}
