import { runFullSync } from "@/lib/sync";

// Full 45-world sync can take several minutes (700+ tasks x ~10 Studio calls
// each). This is fine for `npm run sync` (no timeout) but will likely exceed
// Vercel's function limit for a full run — pass ?worldId= to sync just one
// domain from the UI, which comfortably fits.
export const maxDuration = 300;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId");

  try {
    const result = await runFullSync(worldId ? { worldIds: [worldId] } : undefined);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
