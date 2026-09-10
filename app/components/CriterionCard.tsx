"use client";

import { useState } from "react";
import type { CriterionRow } from "@/lib/queries";

const VERDICTS: { value: string; label: string }[] = [
  { value: "solvable_model_missed", label: "Solvable — model missed it" },
  { value: "not_solvable_impossible", label: "Not solvable — criterion is impossible" },
  { value: "grading_issue", label: "Grading issue — the grader was wrong" },
  { value: "needs_discussion", label: "Needs discussion" },
];

function getStoredName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("gtg_expert_name") ?? "";
}

export function CriterionCard({ taskId, criterion }: { taskId: string; criterion: CriterionRow }) {
  const [name, setName] = useState(getStoredName);
  const [verdict, setVerdict] = useState(criterion.verdict ?? "");
  const [rationale, setRationale] = useState(criterion.rationale_text ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(criterion.rationale_updated_at);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (!name || !verdict || !rationale.trim()) {
      setError("Name, verdict, and a why are all required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      window.localStorage.setItem("gtg_expert_name", name);
      const res = await fetch("/api/rationale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, verifier_id: criterion.verifier_id, expert_name: name, verdict, rationale_text: rationale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border p-4">
      <div className="mb-2 flex items-start justify-between gap-4">
        <p className="font-medium">{criterion.criterion_text ?? "(no criterion text)"}</p>
        {criterion.is_primary_objective && (
          <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800">primary objective</span>
        )}
      </div>

      {criterion.criteria_explanation && <p className="mb-2 text-sm text-neutral-500">{criterion.criteria_explanation}</p>}

      <details className="mb-3 text-sm">
        <summary className="cursor-pointer text-neutral-600">Grader&apos;s evidence for the fail</summary>
        <p className="mt-1 whitespace-pre-wrap text-neutral-600">{criterion.grade_rationale ?? "(none provided)"}</p>
      </details>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {criterion.ever_passed_in_chain ? (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
            passed in {criterion.passed_grading_run_count} other run(s) across {criterion.passed_trajectory_ids.length} trajectory(ies)
          </span>
        ) : (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">never passed elsewhere in this chain</span>
        )}
        {criterion.verifier_updated_at && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">
            criterion last edited {new Date(criterion.verifier_updated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="grid gap-2 border-t pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56 rounded border px-2 py-1 text-sm"
          />
          <select value={verdict} onChange={(e) => setVerdict(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="">Select verdict…</option>
            {VERDICTS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Why? (required)"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          rows={2}
          required
        />
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-fit rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save rationale"}
          </button>
          {savedAt && <span className="text-xs text-neutral-500">saved {new Date(savedAt).toLocaleString()}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
