import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiUrl, readErrorMessage } from "../api/client";
import type { EvaluationJob } from "../types/evaluations";
import type { MeResponse } from "../types/me";

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(apiUrl("/api/v1/me"));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<MeResponse>;
}

async function fetchJobs(): Promise<{ items: EvaluationJob[] }> {
  const res = await fetch(apiUrl("/api/v1/evaluations/jobs"));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<{ items: EvaluationJob[] }>;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const cls =
    score >= 4.0 ? "score-high" : score >= 3.0 ? "score-mid" : "score-low";
  return <span className={`score-badge ${cls}`}>{score.toFixed(1)}/5</span>;
}

export function DashboardPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    refetchInterval: 5_000,
  });

  return (
    <div className="stack">
      <h1>Dashboard</h1>

      <section className="card">
        <h2>Account</h2>
        {me.isLoading && <p>Loading…</p>}
        {me.error && <p className="error">{(me.error as Error).message}</p>}
        {me.data && (
          <ul className="flat-list">
            <li>
              <strong>CV versions</strong> {me.data.cvVersions.length} stored
              {me.data.activeCvVersionId && (
                <span className="muted small"> · active: {me.data.activeCvVersionId.slice(0, 8)}…</span>
              )}
            </li>
            <li>
              <strong>Profile snapshots</strong>{" "}
              {me.data.profileSnapshots.length} stored
            </li>
          </ul>
        )}
        <p>
          <Link to="/profile">Edit CV / profile →</Link>
        </p>
      </section>

      <section className="card">
        <h2>Recent evaluations</h2>
        {jobs.isLoading && <p>Loading…</p>}
        {jobs.error && <p className="error">{(jobs.error as Error).message}</p>}
        {jobs.data && jobs.data.items.length === 0 && (
          <p className="muted">No evaluations yet.</p>
        )}
        {jobs.data && jobs.data.items.length > 0 && (
          <ul className="job-list" style={{ marginBottom: "1rem" }}>
            {jobs.data.items.slice(0, 5).map((j) => (
              <li key={j.id}>
                <Link to={`/jobs/${j.id}`} className="job-card card">
                  <div className="row spread">
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                      <span className={`status-badge status-${j.status}`}>
                        {j.status}
                      </span>
                      <ScoreBadge score={j.score} />
                    </div>
                    <span className="muted small">
                      {new Date(j.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="muted small" style={{ margin: "0.4rem 0 0" }}>
                    {j.company && j.role
                      ? `${j.company} — ${j.role}`
                      : j.jdPreview.slice(0, 80)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <Link to="/evaluate">
            <button type="button">Evaluate a JD</button>
          </Link>
          <Link to="/jobs">All jobs →</Link>
        </div>
      </section>
    </div>
  );
}
