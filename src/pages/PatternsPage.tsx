import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl, readErrorMessage } from "../api/client";

// ── Types matching backend PatternsService exactly ──────

interface ScoreStats {
  avg: number;
  min: number;
  max: number;
  count: number;
}

interface ArchetypeEntry {
  archetype: string;
  total: number;
  positive: number;
  negative: number;
  self_filtered: number;
  pending: number;
  conversionRate: number;
}

interface BlockerEntry {
  blocker: string;
  frequency: number;
  percentage: number;
}

interface RemotePolicyEntry {
  policy: string;
  total: number;
  positive: number;
  negative: number;
  self_filtered: number;
  pending: number;
  conversionRate: number;
}

interface CompanySizeEntry {
  size: string;
  total: number;
  positive: number;
  negative: number;
  self_filtered: number;
  pending: number;
  conversionRate: number;
}

interface TechGap {
  skill: string;
  frequency: number;
}

interface Recommendation {
  action: string;
  reasoning: string;
  impact: "high" | "medium" | "low";
}

interface PatternsResult {
  metadata: {
    total: number;
    dateRange: { from: string | undefined; to: string | undefined };
    analysisDate: string;
    byOutcome: {
      positive: number;
      negative: number;
      self_filtered: number;
      pending: number;
    };
  };
  funnel: Record<string, number>;
  scoreComparison: Record<string, ScoreStats>;
  archetypeBreakdown: ArchetypeEntry[];
  blockerAnalysis: BlockerEntry[];
  remotePolicy: RemotePolicyEntry[];
  companySizeBreakdown: CompanySizeEntry[];
  scoreThreshold: { recommended: number; reasoning: string; positiveRange: string };
  techStackGaps: TechGap[];
  recommendations: Recommendation[];
}

interface PatternsError {
  error: string;
  current?: number;
  threshold?: number;
}

type PatternsResponse = PatternsResult | PatternsError;

function isError(r: PatternsResponse): r is PatternsError {
  return "error" in r;
}

async function fetchPatterns(minThreshold: number): Promise<PatternsResponse> {
  const res = await fetch(apiUrl(`/api/v1/patterns?minThreshold=${minThreshold}`));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<PatternsResponse>;
}

// ── Small components────

function StatCard({
  label,
  value,
  sub,
  color = "var(--accent)",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.3rem" }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  sub,
  color = "var(--accent)",
}: {
  label: string;
  value: number;
  max: number;
  sub?: string;
  color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem" }}>
      <span style={{ width: "11rem", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "0.5rem", background: "var(--border)", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "99px", transition: "width 0.3s" }} />
      </div>
      <span style={{ width: "3rem", textAlign: "right", color: "var(--muted)", flexShrink: 0 }}>
        {value}{sub ?? ""}
      </span>
    </div>
  );
}

const impactColor: Record<string, string> = {
  high: "var(--danger)",
  medium: "#fbbf24",
  low: "var(--accent)",
};

// ── Main page────

export function PatternsPage() {
  const [minThreshold, setMinThreshold] = useState(3);

  const { data, isLoading, error } = useQuery({
    queryKey: ["patterns", minThreshold],
    queryFn: () => fetchPatterns(minThreshold),
  });

  // Funnel helpers — funnel is Record<string, number> from the backend
  const f = (data && !isError(data)) ? data.funnel : null;
  const funnelSteps = f
    ? [
        { label: "Evaluated", value: f["evaluated"] ?? 0, color: "var(--accent)" },
        { label: "Applied",   value: f["applied"]   ?? 0, color: "#38bdf8" },
        { label: "Responded", value: f["responded"] ?? 0, color: "#818cf8" },
        { label: "Interview", value: f["interview"] ?? 0, color: "#c084fc" },
        { label: "Offer",     value: f["offer"]     ?? 0, color: "#4ade80" },
        { label: "Rejected",  value: f["rejected"]  ?? 0, color: "var(--danger)" },
        { label: "Discarded", value: f["discarded"] ?? 0, color: "var(--muted)" },
      ]
    : [];
  const maxFunnel = Math.max(...funnelSteps.map((s) => s.value), 1);

  const conversionRate =
    f && (f["applied"] ?? 0) > 0
      ? (((f["interview"] ?? 0) / (f["applied"] ?? 0)) * 100).toFixed(0)
      : null;

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Pattern analysis</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
          <label htmlFor="threshold" className="muted">Min threshold:</label>
          <input
            id="threshold"
            type="number"
            min={1}
            max={20}
            value={minThreshold}
            onChange={(e) => setMinThreshold(Number(e.target.value))}
            style={{
              width: "4rem",
              padding: "0.3rem 0.5rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
        </div>
      </div>
      <p className="muted">
        Analyze rejection patterns, funnel drop-offs, and target archetypes across all your applications.
      </p>

      {isLoading && <p>Loading…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      {/* Not enough data */}
      {data && isError(data) && (
        <div className="card notice">
          <p style={{ margin: 0 }}>{data.error}</p>
          {data.current !== undefined && data.threshold !== undefined && (
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              {data.current} / {data.threshold} applications beyond "Evaluated" needed
            </p>
          )}
        </div>
      )}

      {data && !isError(data) && (
        <>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))", gap: "0.75rem" }}>
            <StatCard label="Total applications" value={data.metadata.total} />
            <StatCard
              label="Avg score (positive)"
              value={data.scoreComparison.positive?.count > 0 ? `${data.scoreComparison.positive.avg.toFixed(1)}/5` : "—"}
              color={data.scoreComparison.positive?.avg >= 4 ? "#4ade80" : data.scoreComparison.positive?.avg >= 3 ? "#fbbf24" : "var(--danger)"}
            />
            <StatCard label="Offers" value={f?.["offer"] ?? 0} color="#4ade80" />
            <StatCard
              label="Interview rate"
              value={conversionRate !== null ? `${conversionRate}%` : "—"}
              sub="of applied"
              color="#c084fc"
            />
            <StatCard label="Rejected" value={data.metadata.byOutcome.negative} color="var(--danger)" />
          </div>

          {/* Funnel */}
          <div className="card stack" style={{ gap: "0.75rem" }}>
            <h2>Application funnel</h2>
            {funnelSteps.filter((s) => s.value > 0).map((s) => (
              <BarRow key={s.label} label={s.label} value={s.value} max={maxFunnel} color={s.color} />
            ))}
          </div>

          {/* Score comparison */}
          {Object.keys(data.scoreComparison).some((k) => data.scoreComparison[k].count > 0) && (
            <div className="card stack" style={{ gap: "0.75rem" }}>
              <h2>Score by outcome</h2>
              {(["positive", "negative", "self_filtered", "pending"] as const).map((outcome) => {
                const s = data.scoreComparison[outcome];
                if (!s || s.count === 0) return null;
                return (
                  <div key={outcome} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ textTransform: "capitalize" }}>{outcome.replace("_", " ")}</span>
                    <span className="muted">
                      avg <strong style={{ color: "var(--text)" }}>{s.avg.toFixed(1)}</strong>
                      {" · "}range {s.min}–{s.max}
                      {" · "}{s.count} apps
                    </span>
                  </div>
                );
              })}
              <div className="muted small">
                Recommended threshold: <strong style={{ color: "var(--text)" }}>{data.scoreThreshold.recommended}/5</strong>
                {" — "}{data.scoreThreshold.reasoning}
              </div>
            </div>
          )}

          {/* Archetypes */}
          {data.archetypeBreakdown.length > 0 && (
            <div className="card stack" style={{ gap: "0.75rem" }}>
              <h2>Archetypes</h2>
              {data.archetypeBreakdown.map((a) => (
                <BarRow
                  key={a.archetype}
                  label={a.archetype}
                  value={a.total}
                  max={data.archetypeBreakdown[0].total}
                  sub={` · ${a.conversionRate}% conv`}
                  color="var(--accent)"
                />
              ))}
            </div>
          )}

          {/* Blockers */}
          {data.blockerAnalysis.length > 0 && (
            <div className="card stack" style={{ gap: "0.75rem" }}>
              <h2>Rejection blockers</h2>
              {data.blockerAnalysis.map((b) => (
                <BarRow
                  key={b.blocker}
                  label={b.blocker}
                  value={b.frequency}
                  max={data.blockerAnalysis[0].frequency}
                  sub={` (${b.percentage}%)`}
                  color="var(--danger)"
                />
              ))}
            </div>
          )}

          {/* Remote policy */}
          {data.remotePolicy.length > 0 && (
            <div className="card stack" style={{ gap: "0.75rem" }}>
              <h2>Remote policy</h2>
              {data.remotePolicy.map((r) => (
                <BarRow
                  key={r.policy}
                  label={r.policy}
                  value={r.total}
                  max={data.remotePolicy[0].total}
                  sub={` · ${r.conversionRate}% conv`}
                  color="#38bdf8"
                />
              ))}
            </div>
          )}

          {/* Company size */}
          {data.companySizeBreakdown.length > 0 && (
            <div className="card stack" style={{ gap: "0.75rem" }}>
              <h2>Company size</h2>
              {data.companySizeBreakdown.map((s) => (
                <BarRow
                  key={s.size}
                  label={s.size}
                  value={s.total}
                  max={data.companySizeBreakdown[0].total}
                  sub={` · ${s.conversionRate}% conv`}
                  color="#818cf8"
                />
              ))}
            </div>
          )}

          {/* Tech stack gaps */}
          {data.techStackGaps.length > 0 && (
            <div className="card">
              <h2>Tech stack gaps</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {data.techStackGaps.map((g) => (
                  <span key={g.skill} className="tag" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    {g.skill}
                    <span className="muted small">×{g.frequency}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="card stack" style={{ gap: "0.75rem" }}>
              <h2>Recommendations</h2>
              {data.recommendations.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${impactColor[r.impact]}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{r.action}</strong>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: impactColor[r.impact],
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        flexShrink: 0,
                      }}
                    >
                      {r.impact}
                    </span>
                  </div>
                  <p className="muted small" style={{ marginTop: "0.35rem" }}>
                    {r.reasoning}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
