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
