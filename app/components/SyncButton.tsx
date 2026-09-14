"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncButton({ worldId, label }: { worldId?: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setResult(null);
    try {
      const url = worldId ? `/api/sync?worldId=${encodeURIComponent(worldId)}` : "/api/sync";
      const res = await fetch(url, { method: "POST" });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        // A non-JSON body means the platform (not our route) produced this
        // response — almost always Vercel's own timeout page after hitting
        // maxDuration (300s), which an unscoped full sync can easily exceed.
        throw new Error(
          worldId
            ? "sync failed with a non-JSON response — check server logs"
            : "sync timed out (a full all-domain sync can exceed Vercel's 5-minute limit) — try syncing one domain at a time, or run `npm run sync` locally for a full run"
        );
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      setResult(`synced ${data.tasksSynced} tasks — ${JSON.stringify(data.statusCounts)}`);
      router.refresh();
    } catch (err) {
      setResult(`error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={busy}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {busy ? "Syncing…" : label}
      </button>
      {result && <span className="text-xs text-neutral-500">{result}</span>}
    </div>
  );
}
