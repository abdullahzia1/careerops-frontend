import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiUrl, readErrorMessage } from "../api/client";
import type { EvaluationJob } from "../types/evaluations";

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

export function JobsPage() {
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    refetchInterval: 4_000,
  });

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Evaluation jobs</h1>
        <Link to="/evaluate">+ New evaluation</Link>
      </div>
      <p className="muted">Auto-refreshes every few seconds.</p>

      {jobs.isLoading && <p>Loading…</p>}
      {jobs.error && <p className="error">{(jobs.error as Error).message}</p>}
      {jobs.data && jobs.data.items.length === 0 && (
        <p className="muted">No jobs yet — paste a JD on the Evaluate page.</p>
      )}

      {jobs.data && jobs.data.items.length > 0 && (
        <ul className="job-list">
          {jobs.data.items.map((j) => (
            <li key={j.id}>
              <Link to={`/jobs/${j.id}`} className="job-card card">
                <div className="row spread">
                  <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <span className={`status-badge status-${j.status}`}>
                      {j.status === "running" && <span className="spinner spinner-sm" />}
                      {j.status}
                    </span>
                    <ScoreBadge score={j.score} />
                    {j.archetype && <span className="tag">{j.archetype}</span>}
                  </div>
                  <span className="muted small">
                    {new Date(j.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="muted small" style={{ margin: "0.4rem 0 0" }}>
                  {j.company && j.role
                    ? `${j.company} — ${j.role}`
                    : j.jdPreview.slice(0, 100)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
