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
