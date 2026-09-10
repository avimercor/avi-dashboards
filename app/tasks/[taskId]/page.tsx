import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskDetail } from "@/lib/queries";
import { CriterionCard } from "@/app/components/CriterionCard";
import { statusInfo, TASK_STALE_TOOLTIP, RUBRIC_STALE_TOOLTIP } from "@/lib/statusLabels";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = await getTaskDetail(taskId);
  if (!task) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href={`/domains/${task.world_id}`} className="text-sm text-blue-700 hover:underline">
        ← {task.world_name}
      </Link>

      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{task.task_name}</h1>
        <a
          href={`https://studio.mercor.com/admin/tasks/${task.task_id}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-700 hover:underline"
        >
          open in Studio ↗
        </a>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {task.task_phase && <span className="rounded bg-neutral-100 px-2 py-1">phase: <strong>{task.task_phase}</strong></span>}
        <span className="rounded bg-neutral-100 px-2 py-1" title={statusInfo(task.status).description}>
          status: <strong>{statusInfo(task.status).label}</strong>
        </span>
        <span className="rounded bg-neutral-100 px-2 py-1">
          score: <strong>{task.highest_golden_score != null ? `${(Number(task.highest_golden_score) * 100).toFixed(1)}%` : "—"}</strong>
        </span>
        <span className="rounded bg-neutral-100 px-2 py-1">total criteria: <strong>{task.criteria_total ?? "—"}</strong></span>
        <span className="rounded bg-neutral-100 px-2 py-1">failing criteria: <strong>{task.criteria_failed ?? "—"}</strong></span>
        {task.task_stale && (
          <span title={TASK_STALE_TOOLTIP} className="rounded bg-amber-100 px-2 py-1 text-amber-800">
            task edited since this grading run
          </span>
        )}
        {task.rubric_stale && (
          <span title={RUBRIC_STALE_TOOLTIP} className="rounded bg-amber-100 px-2 py-1 text-amber-800">
            rubric edited since this grading run
          </span>
        )}
      </div>

      {task.winning_trajectory_id && (
        <p className="mt-2 text-xs text-neutral-500">
          winning trajectory{" "}
          <a
            className="text-blue-700 hover:underline"
            href={`https://studio.mercor.com/admin/tasks/${task.task_id}/trajectory/${task.winning_trajectory_id}`}
            target="_blank"
            rel="noreferrer"
          >
            {task.winning_trajectory_id}
          </a>{" "}
          · chain rooted {task.chain_root_created_at ? new Date(task.chain_root_created_at).toLocaleDateString() : "—"} · last synced{" "}
          {new Date(task.last_synced_at).toLocaleString()}
        </p>
      )}

      {task.status !== "ok" && (
        <p className="mt-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">{task.notes}</p>
      )}

      <div className="mt-6 grid gap-4">
        {task.criteria.length === 0 && task.status === "ok" && (
          <p className="text-sm text-neutral-500">No failing criteria — this task&apos;s golden trajectory passed everything.</p>
        )}
        {task.criteria.map((c) => (
          <CriterionCard key={c.verifier_id} taskId={task.task_id} criterion={c} />
        ))}
      </div>
    </main>
  );
}
