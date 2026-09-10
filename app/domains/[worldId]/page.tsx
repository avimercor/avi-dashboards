import Link from "next/link";
import { notFound } from "next/navigation";
import { listDomains, listTasksForDomain } from "@/lib/queries";
import { SyncButton } from "@/app/components/SyncButton";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ok: "bg-green-100 text-green-800",
    no_golden_chain: "bg-neutral-100 text-neutral-600",
    no_completed_grading_run: "bg-neutral-100 text-neutral-600",
    error: "bg-red-100 text-red-800",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}>{status}</span>;
}

export default async function DomainPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const domains = await listDomains();
  const domain = domains.find((d) => d.world_id === worldId);
  if (!domain) notFound();

  const tasks = await listTasksForDomain(worldId);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/" className="text-sm text-blue-700 hover:underline">
        ← All domains
      </Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{domain.world_name}</h1>
        <SyncButton worldId={worldId} label="Sync this domain" />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="py-2">Task</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Score</th>
            <th className="py-2 text-right">Failing criteria</th>
            <th className="py-2 text-right">Reviewed</th>
            <th className="py-2">Flags</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.task_id} className="border-b hover:bg-neutral-50">
              <td className="py-2">
                <Link href={`/tasks/${t.task_id}`} className="text-blue-700 hover:underline">
                  {t.task_name}
                </Link>
              </td>
              <td className="py-2">{statusBadge(t.status)}</td>
              <td className="py-2 text-right">{t.highest_golden_score != null ? Number(t.highest_golden_score).toFixed(2) : "—"}</td>
              <td className="py-2 text-right">
                {t.criteria_failed != null ? `${t.criteria_failed}/${t.criteria_total}` : "—"}
              </td>
              <td className="py-2 text-right">
                {Number(t.reviewed_count) > 0 && t.criteria_failed != null
                  ? `${t.reviewed_count}/${t.criteria_failed}`
                  : "—"}
              </td>
              <td className="py-2">
                {t.task_stale && <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">task stale</span>}
                {t.rubric_stale && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">rubric stale</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
