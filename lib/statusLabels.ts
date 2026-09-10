// Human explanations for tasks.status, shown as a tooltip (title attribute)
// wherever the status badge is rendered.
export const STATUS_INFO: Record<string, { label: string; description: string; className: string }> = {
  ok: {
    label: "ok",
    description: "Found a golden chain, picked its highest-scoring completed trajectory and grading run, and computed pass/fail per criterion.",
    className: "bg-green-100 text-green-800",
  },
  no_golden_chain: {
    label: "no golden chain",
    description: "This task has trajectories, but none form a golden (remixed) chain with a scored member — nothing to show yet.",
    className: "bg-neutral-100 text-neutral-600",
  },
  no_completed_grading_run: {
    label: "no grading run",
    description: "Found a winning trajectory, but it has no completed grading run yet — grading may still be in progress.",
    className: "bg-neutral-100 text-neutral-600",
  },
  error: {
    label: "error",
    description: "Studio API call failed for this task during sync — see the notes column/tooltip for the error. Re-sync to retry.",
    className: "bg-red-100 text-red-800",
  },
};

export function statusInfo(status: string) {
  return STATUS_INFO[status] ?? { label: status, description: status, className: "bg-neutral-100 text-neutral-600" };
}

export const TASK_STALE_TOOLTIP =
  "The task itself (prompt, description, or other fields) was edited after this winning trajectory was graded — what's shown here may not reflect the current task.";
export const RUBRIC_STALE_TOOLTIP =
  "At least one rubric criterion on this task was edited after this winning trajectory was graded — the criteria shown may not reflect the current rubric.";

// Explanations for the rubric's gate types (verifier_custom_field_values,
// field_c58fa22291de475781a7e9473f2ef0d7 — see lib/studio.ts). A gated
// criterion isn't just weighted like the others; failing it can cap or
// penalize the overall score independent of its own weight.
export const GATE_INFO: Record<string, string> = {
  "Gate: Critical Value": "A critical-value gate — failing this criterion can cap the entire task score, independent of its own weight and regardless of how other criteria score.",
  "Gate: Missing Scope": "A missing-scope gate — flags that the response didn't address a required area of the task, not just one weighted sub-point.",
  "Gate: Ethical / Safety Violation": "An ethical/safety gate — flags an ethics or safety violation in the output, treated as more severe than an ordinary failed criterion.",
};

export function gateDescription(gate: string): string {
  return GATE_INFO[gate] ?? "This criterion is a scoring gate — failing it can affect the overall score beyond its own weight.";
}
