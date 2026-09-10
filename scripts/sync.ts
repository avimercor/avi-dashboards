// Standalone CLI runner for the full sync, no Vercel timeout to worry about.
// Usage: npm run sync            (all 45 worlds)
//        npm run sync -- --world world_f95bbaac938d4a788844a2ae44da415f
import { config } from "dotenv";
config({ path: ".env.local" });
import { runFullSync } from "../lib/sync";

async function main() {
  const worldArgIndex = process.argv.indexOf("--world");
  const worldIds = worldArgIndex !== -1 ? [process.argv[worldArgIndex + 1]] : undefined;

  const start = Date.now();
  const { tasksSynced, statusCounts } = await runFullSync({
    concurrency: 10,
    worldIds,
    onProgress: (p) => {
      if (p.done % 10 === 0 || p.done === p.total) {
        process.stdout.write(`\rsynced ${p.done}/${p.total}`);
      }
    },
  });
  console.log(`\ndone in ${((Date.now() - start) / 1000).toFixed(1)}s — ${tasksSynced} tasks`);
  console.log("status breakdown:", statusCounts);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
