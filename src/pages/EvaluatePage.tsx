import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl, readErrorMessage } from "../api/client";
import type { EvaluationJob } from "../types/evaluations";

export function EvaluatePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [jdText, setJdText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/v1/evaluations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return res.json() as Promise<EvaluationJob>;
    },
    onSuccess: (job) => {
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      navigate(`/jobs/${job.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="stack">
      <h1>New evaluation</h1>
      <p className="muted">
        Paste a full job description and hit <strong>Evaluate</strong>. The
        worker calls Gemini (30–60 s) and you will see the live result as it
        arrives.
      </p>

      {error && <p className="error">{error}</p>}

      <textarea
        className="code-area"
        rows={18}
        placeholder="Paste the full job description here — title, responsibilities, requirements, company info…"
        value={jdText}
        onChange={(e) => {
          setError(null);
          setJdText(e.target.value);
        }}
      />

      <div className="row">
        <button
          type="button"
          onClick={() => void submit.mutate()}
          disabled={submit.isPending || !jdText.trim()}
        >
          {submit.isPending ? "Queueing…" : "Evaluate"}
        </button>
        <span className="muted small">
          Uses your saved CV version and Gemini model from the API.
        </span>
      </div>
    </div>
  );
}
