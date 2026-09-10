"use client";

import { useState } from "react";
import type { CriterionRow } from "@/lib/queries";
import { gateDescription } from "@/lib/statusLabels";

const VERDICTS: { value: string; label: string }[] = [
  { value: "solvable_model_missed", label: "Solvable — model missed it" },
  { value: "not_solvable_impossible", label: "Not solvable — criterion is impossible" },
  { value: "grading_issue", label: "Grading issue — the grader was wrong" },
  { value: "needs_discussion", label: "Needs discussion" },
];

export function CriterionCard({ taskId, criterion }: { taskId: string; criterion: CriterionRow }) {
  const [name, setName] = useState("");
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
        <div>
          {criterion.verifier_index != null && (
            <p className="mb-1 text-xs font-medium text-neutral-400">Rubric index: {criterion.verifier_index}</p>
          )}
          <p>
            <span className="font-bold">Criteria Text: </span>
            {criterion.criterion_text ?? "(no criterion text)"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs">
          {criterion.is_primary_objective && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">primary objective</span>
          )}
          {criterion.gate && (
            <span title={gateDescription(criterion.gate)} className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">
              {criterion.gate}
            </span>
          )}
          {criterion.criteria_type && (
            <span className="text-neutral-500">
              <span className="font-bold">Criteria Type: </span>
              {criterion.criteria_type}
            </span>
          )}
          {criterion.weight != null && <span className="text-neutral-500">Weight: {criterion.weight}</span>}
        </div>
      </div>

      {criterion.criteria_explanation && (
        <p className="mb-2 text-sm text-neutral-500">
          <span className="font-medium">Criteria Description: </span>
          {criterion.criteria_explanation}
        </p>
      )}

      <details className="mb-3 text-sm">
        <summary className="cursor-pointer text-neutral-600">Grader&apos;s evidence for the fail</summary>
        <p className="mt-1 whitespace-pre-wrap text-neutral-600">{criterion.grade_rationale ?? "(none provided)"}</p>
      </details>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {criterion.ever_passed_in_chain ? (
          <span className="flex flex-wrap items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
            passed in {criterion.passed_grading_run_count} other run(s) within this golden trajectory chain, across:
            {criterion.passed_trajectory_ids.map((tid, i) => (
              <span key={tid}>
                {i > 0 && ", "}
                <a
                  href={`https://studio.mercor.com/admin/tasks/${taskId}/trajectory/${tid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-blue-900"
                >
                  {tid}
                </a>
              </span>
            ))}
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
