import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiUrl } from "../api/client";

interface DoctorCheck {
  pass: boolean;
  label: string;
  fix?: string | string[];
}

interface DoctorResult {
  checks: DoctorCheck[];
  failures: number;
  passed: boolean;
}

interface CvSyncResult {
  errors: string[];
  warnings: string[];
  passed: boolean;
}

interface UpdateCheckResult {
  status: "update-available" | "up-to-date" | "dismissed" | "offline" | "no-remote-version";
  local?: string;
  remote?: string;
  changelog?: string;
}

async function fetchDoctor(): Promise<DoctorResult> {
  const res = await fetch(apiUrl("/api/v1/system/doctor"));
  return res.json();
}

async function fetchCvSync(): Promise<CvSyncResult> {
  const res = await fetch(apiUrl("/api/v1/system/cv-sync"));
  return res.json();
}

async function fetchUpdateCheck(): Promise<UpdateCheckResult> {
  const res = await fetch(apiUrl("/api/v1/system/update/check"));
  return res.json();
}

async function postUpdateAction(action: "apply" | "dismiss" | "rollback"): Promise<unknown> {
  const res = await fetch(apiUrl(`/api/v1/system/update/${action}`), { method: "POST" });
  return res.json();
}

function CheckRow({ check }: { check: DoctorCheck }) {
  const fixes = check.fix ? (Array.isArray(check.fix) ? check.fix : [check.fix]) : [];
  return (
    <div style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span style={{ fontSize: "1rem" }}>{check.pass ? "✅" : "❌"}</span>
        <span style={{ fontWeight: check.pass ? 400 : 600 }}>{check.label}</span>
      </div>
      {!check.pass && fixes.length > 0 && (
        <div style={{ marginLeft: "1.75rem", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
          {fixes.map((f, i) => <div key={i}>→ {f}</div>)}
        </div>
      )}
    </div>
  );
}

export function SystemPage() {
  const [tab, setTab] = useState<"doctor" | "cv-sync" | "updates">("doctor");
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const doctor = useQuery<DoctorResult>({ queryKey: ["doctor"], queryFn: fetchDoctor, enabled: tab === "doctor" });
  const cvSync = useQuery<CvSyncResult>({ queryKey: ["cv-sync"], queryFn: fetchCvSync, enabled: tab === "cv-sync" });
  const updateCheck = useQuery<UpdateCheckResult>({ queryKey: ["update-check"], queryFn: fetchUpdateCheck, enabled: tab === "updates" });

  const updateMutation = useMutation({
    mutationFn: (action: "apply" | "dismiss" | "rollback") => postUpdateAction(action),
    onSuccess: (data) => setUpdateResult(JSON.stringify(data, null, 2)),
  });

  const tabStyle = (active: boolean) => ({
    padding: "0.4rem 1rem",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    fontSize: "0.9rem",
  });

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>System</h1>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        <button style={tabStyle(tab === "doctor")} onClick={() => setTab("doctor")}>Doctor</button>
        <button style={tabStyle(tab === "cv-sync")} onClick={() => setTab("cv-sync")}>CV Sync</button>
        <button style={tabStyle(tab === "updates")} onClick={() => setTab("updates")}>Updates</button>
      </div>

      {/* Doctor */}
      {tab === "doctor" && (
        <div>
          {doctor.isLoading && <div className="spinner" />}
          {doctor.data && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span className={`badge ${doctor.data.passed ? "badge-active" : "badge-expired"}`}>
                  {doctor.data.passed ? "All checks pass" : `${doctor.data.failures} issue${doctor.data.failures !== 1 ? "s" : ""} found`}
                </span>
                <button className="btn" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }} onClick={() => doctor.refetch()}>Re-run</button>
              </div>
              <div className="card">
                {doctor.data.checks.map((c, i) => <CheckRow key={i} check={c} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* CV Sync */}
      {tab === "cv-sync" && (
        <div>
          {cvSync.isLoading && <div className="spinner" />}
          {cvSync.data && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span className={`badge ${cvSync.data.passed ? "badge-active" : "badge-expired"}`}>
                  {cvSync.data.passed ? "No errors" : `${cvSync.data.errors.length} error${cvSync.data.errors.length !== 1 ? "s" : ""}`}
                </span>
                <button className="btn" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }} onClick={() => cvSync.refetch()}>Re-run</button>
              </div>
              {cvSync.data.errors.length > 0 && (
                <div className="card" style={{ marginBottom: "1rem" }}>
                  <div style={{ fontWeight: 600, color: "#e55", marginBottom: "0.5rem" }}>Errors</div>
                  {cvSync.data.errors.map((e, i) => <div key={i} style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>❌ {e}</div>)}
                </div>
              )}
              {cvSync.data.warnings.length > 0 && (
                <div className="card">
                  <div style={{ fontWeight: 600, color: "#c90", marginBottom: "0.5rem" }}>Warnings ({cvSync.data.warnings.length})</div>
                  {cvSync.data.warnings.map((w, i) => <div key={i} style={{ fontSize: "0.85rem", marginBottom: "0.25rem", color: "var(--text-muted)" }}>⚠️ {w}</div>)}
                </div>
              )}
              {cvSync.data.errors.length === 0 && cvSync.data.warnings.length === 0 && (
                <div className="card" style={{ color: "var(--text-muted)" }}>All checks passed.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Updates */}
      {tab === "updates" && (
        <div>
          {updateCheck.isLoading && <div className="spinner" />}
          {updateCheck.data && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {updateCheck.data.status === "update-available" && `Update available: v${updateCheck.data.local} → v${updateCheck.data.remote}`}
                    {updateCheck.data.status === "up-to-date" && `Up to date (v${updateCheck.data.local})`}
                    {updateCheck.data.status === "dismissed" && `Update dismissed (v${updateCheck.data.local ?? "—"})`}
                    {updateCheck.data.status === "offline" && "Offline — could not check for updates"}
                    {updateCheck.data.status === "no-remote-version" && "No remote version found"}
                  </div>
                  {updateCheck.data.status === "update-available" && updateCheck.data.changelog && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.35rem", maxHeight: "6rem", overflow: "auto", whiteSpace: "pre-wrap" }}>
                      {updateCheck.data.changelog.slice(0, 600)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {updateCheck.data.status === "update-available" && (
                    <>
                      <button className="btn" onClick={() => updateMutation.mutate("apply")} disabled={updateMutation.isPending}>Apply</button>
                      <button className="btn" onClick={() => updateMutation.mutate("dismiss")} disabled={updateMutation.isPending}>Dismiss</button>
                    </>
                  )}
                  <button className="btn" onClick={() => updateMutation.mutate("rollback")} disabled={updateMutation.isPending}>Rollback</button>
                  <button className="btn" onClick={() => updateCheck.refetch()} style={{ marginLeft: "0.25rem" }}>Check again</button>
                </div>
              </div>
            </div>
          )}
          {updateResult && (
            <div className="card">
              <pre style={{ fontSize: "0.8rem", margin: 0, color: "var(--text-muted)", overflow: "auto" }}>{updateResult}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
