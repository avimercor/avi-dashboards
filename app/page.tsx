import Link from "next/link";
import { listDomains } from "@/lib/queries";
import { SyncButton } from "@/app/components/SyncButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const domains = await listDomains();
  const hasAnyData = domains.some((d) => Number(d.task_count) > 0);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Atlas — GTG Expert Review</h1>
          <p className="text-sm text-neutral-500">
            Highest-scoring golden trajectory per task, computed live from Studio. Pick a domain to review failing criteria.
          </p>
        </div>
        <SyncButton label="Sync all domains" />
      </div>

      {!hasAnyData && (
        <p className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          No data yet — run <code>npm run sync</code> or click &quot;Sync all domains&quot; above. A full sync across all 45
          domains can take several minutes.
        </p>
      )}

      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="w-[55%] py-2 text-left">Domain</th>
            <th className="w-[15%] py-2 text-right">Tasks synced</th>
            <th className="w-[15%] py-2 text-right">Avg score</th>
            <th className="w-[15%] py-2 text-right">Stale</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.world_id} className="border-b hover:bg-neutral-50">
              <td className="truncate py-2 text-left">
                <Link href={`/domains/${d.world_id}`} className="text-blue-700 hover:underline">
                  {d.world_name}
                </Link>
                {d.phase === "Phase 2" && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">Phase 2</span>}
              </td>
              <td className="py-2 text-right">
                {d.synced_task_count}/{d.task_count}
              </td>
              <td className="py-2 text-right">{d.avg_score != null ? `${(Number(d.avg_score) * 100).toFixed(1)}%` : "—"}</td>
              <td className="py-2 text-right">{Number(d.stale_count) > 0 ? <span className="text-amber-600">{d.stale_count}</span> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
