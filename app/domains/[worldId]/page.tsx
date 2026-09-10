import Link from "next/link";
import { notFound } from "next/navigation";
import { listDomains, listTasksForDomain } from "@/lib/queries";
import { SyncButton } from "@/app/components/SyncButton";
import { statusInfo } from "@/lib/statusLabels";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const info = statusInfo(status);
  return (
    <span title={info.description} className={`rounded px-1.5 py-0.5 text-xs ${info.className}`}>
      {info.label}
    </span>
  );
}

function scorePct(score: number | null): string {
  return score != null ? `${(Number(score) * 100).toFixed(1)}%` : "—";
}

export default async function DomainPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const domains = await listDomains();
  const domain = domains.find((d) => d.world_id === worldId);
  if (!domain) notFound();

  const tasks = await listTasksForDomain(worldId);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/" className="text-sm text-blue-700 hover:underline">
        ← All domains
      </Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{domain.world_name}</h1>
        <SyncButton label="Sync all domains" />
      </div>

      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="w-[30%] py-2 text-left">Task</th>
            <th className="w-[12%] py-2 text-left">Status</th>
            <th className="w-[10%] py-2 text-right">Score</th>
            <th className="w-[10%] py-2 text-right">Total criteria</th>
            <th className="w-[10%] py-2 text-right">Failing criteria</th>
            <th className="w-[10%] py-2 text-right">Reviewed</th>
            <th className="w-[18%] py-2 text-left">Flags</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.task_id} className="border-b hover:bg-neutral-50">
              <td className="truncate py-2 text-left">
                <Link href={`/tasks/${t.task_id}`} className="text-blue-700 hover:underline">
                  {t.task_name}
                </Link>
              </td>
              <td className="py-2 text-left">{statusBadge(t.status)}</td>
              <td className="py-2 text-right">{scorePct(t.highest_golden_score)}</td>
              <td className="py-2 text-right">{t.criteria_total ?? "—"}</td>
              <td className="py-2 text-right">{t.criteria_failed ?? "—"}</td>
              <td className="py-2 text-right">
                {Number(t.reviewed_count) > 0 && t.criteria_failed != null ? `${t.reviewed_count}/${t.criteria_failed}` : "—"}
              </td>
              <td className="py-2 text-left">
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
