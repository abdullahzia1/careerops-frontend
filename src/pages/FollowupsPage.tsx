import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../api/client";

interface FollowupEntry {
  num: number;
  date: string;
  company: string;
  role: string;
  status: string;
  score: string;
  daysSinceApplication: number;
  daysSinceLastFollowup: number | null;
  followupCount: number;
  urgency: "urgent" | "overdue" | "waiting" | "cold";
  nextFollowupDate: string | null;
  daysUntilNext: number | null;
  contacts: Array<{ email: string; name: string | null }>;
}

interface FollowupsResult {
  metadata: {
    analysisDate: string;
    totalTracked: number;
    actionable: number;
    overdue: number;
    urgent: number;
    cold: number;
    waiting: number;
  };
  entries: FollowupEntry[];
}

interface FollowupsError { error: string }

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#e55",
  overdue: "#c90",
  waiting: "var(--text-muted)",
  cold: "#888",
};

const URGENCY_BG: Record<string, string> = {
  urgent: "#3a1a1a",
  overdue: "#2e2400",
  waiting: "transparent",
  cold: "transparent",
};

async function fetchFollowups(overdueOnly: boolean, appliedFirstDays: number): Promise<FollowupsResult | FollowupsError> {
  const params = new URLSearchParams({ appliedFirstDays: String(appliedFirstDays) });
  if (overdueOnly) params.set("overdueOnly", "true");
  const res = await fetch(apiUrl(`/api/v1/followups?${params}`));
  return res.json();
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <span
      style={{
        padding: "0.15rem 0.5rem",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        color: URGENCY_COLORS[urgency] ?? "inherit",
        background: URGENCY_BG[urgency] ?? "transparent",
        border: `1px solid ${URGENCY_COLORS[urgency] ?? "transparent"}`,
      }}
    >
      {urgency}
    </span>
  );
}

export function FollowupsPage() {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [appliedFirstDays, setAppliedFirstDays] = useState(7);

  const { data, isLoading, error } = useQuery<FollowupsResult | FollowupsError>({
    queryKey: ["followups", overdueOnly, appliedFirstDays],
    queryFn: () => fetchFollowups(overdueOnly, appliedFirstDays),
  });

  const result = data as FollowupsResult | FollowupsError | undefined;
  const isError = result && "error" in result;
  const followups = isError ? null : (result as FollowupsResult | undefined);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Follow-up Cadence</h1>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue only
          </label>
          <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            First follow-up after
            <input
              type="number"
              value={appliedFirstDays}
              onChange={(e) => setAppliedFirstDays(Number(e.target.value))}
              min={1}
              max={30}
              style={{ width: "3.5rem", padding: "0.2rem 0.4rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", color: "inherit" }}
            />
            days
          </label>
        </div>
      </div>

      {isLoading && <div className="spinner" />}
      {error && <div style={{ color: "var(--text-muted)" }}>Failed to load follow-ups.</div>}
      {isError && <div style={{ color: "var(--text-muted)" }}>{(result as FollowupsError).error}</div>}

      {followups && (
        <>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Actionable", value: followups.metadata.actionable, color: "inherit" },
              { label: "Urgent", value: followups.metadata.urgent, color: "#e55" },
              { label: "Overdue", value: followups.metadata.overdue, color: "#c90" },
              { label: "Waiting", value: followups.metadata.waiting, color: "var(--text-muted)" },
              { label: "Cold", value: followups.metadata.cold, color: "#888" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ textAlign: "center", padding: "0.75rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Entries */}
          {followups.entries.length === 0 ? (
            <div className="card" style={{ color: "var(--text-muted)", textAlign: "center" }}>
              No active applications to track. Apply to some roles first.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {followups.entries.map((e) => (
                <div
                  key={e.num}
                  className="card"
                  style={{ borderLeft: `3px solid ${URGENCY_COLORS[e.urgency] ?? "var(--border)"}` }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{e.company}</span>
                      <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.9rem" }}>{e.role}</span>
                    </div>
                    <UrgencyBadge urgency={e.urgency} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    <span>#{e.num} · {e.status} · {e.score}</span>
                    <span>Applied {e.date} ({e.daysSinceApplication}d ago)</span>
                    {e.followupCount > 0 && <span>{e.followupCount} follow-up{e.followupCount !== 1 ? "s" : ""} sent</span>}
                    {e.nextFollowupDate && (
                      <span style={{ color: e.daysUntilNext !== null && e.daysUntilNext < 0 ? "#e55" : "inherit" }}>
                        Next: {e.nextFollowupDate}
                        {e.daysUntilNext !== null && ` (${e.daysUntilNext < 0 ? Math.abs(e.daysUntilNext) + "d overdue" : e.daysUntilNext + "d"})`}
                      </span>
                    )}
                    {e.contacts.length > 0 && (
                      <span>
                        Contact: {e.contacts[0].name ? `${e.contacts[0].name} ` : ""}{e.contacts[0].email}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
