# Project Atlas — GTG Expert Review Dashboard

For each Project Atlas parent task (status "Original Task - No User Sim") across the
45 domain worlds, shows the highest-scoring golden trajectory, which rubric criteria
it failed, whether that criterion ever passed elsewhere in the same golden chain, and
whether the task/rubric has been edited since that grading run (staleness). Experts
record a verdict per failing criterion — solvable (model missed it), not solvable
(criterion is impossible), or needs discussion.

Everything except `expert_rationales` is computed **live from Studio** on sync, not
cached from a spreadsheet — see `lib/sync.ts` for the chain-reconstruction algorithm
(ported and extended from the `atlas-golden-trajectory-pull-batched` Claude Code skill).

No login for now (per explicit decision) — anyone with the URL can view and leave a
rationale, identified only by a self-reported email typed into the form.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and RLS_API_KEY
npm run db:init              # loads db/schema.sql
npm run sync -- --world world_3ed01e9681ec4a6593af424a20de419d   # small domain, ~1 min
npm run dev
```

`RLS_API_KEY`: studio.mercor.com → API Keys tab → create a new key. Never commit it.

Full sync (all 45 domains, ~700 tasks): `npm run sync` with no `--world` flag. This
takes several minutes — each task costs ~10-20 Studio API calls (trajectory chain
walk + cross-run pass check + verifier staleness check). Run it from a machine/CI job
with no timeout; the in-app "Sync all domains" button also works but is capped at
Vercel's `maxDuration` (300s) and may not finish a full run — prefer the CLI for that,
and the per-domain "Sync this domain" button for smaller refreshes.

## Data model

- `domains`, `tasks`, `criteria`: full mirror of live Studio state. **Dropped and
  reloaded wholesale on every sync** (scoped to whichever domains were synced this
  run) — never hand-edit these.
- `expert_rationales`: the only hand-written table, latest verdict per
  `(task_id, verifier_id)`, never touched by sync.

## Deploying (personal GitHub + Vercel, per current hosting decision)

1. `gh repo create <name> --private --source=. --push` (or push to a repo created in
   the GitHub UI).
2. Import the repo in Vercel, add a Postgres integration (or point `DATABASE_URL` at
   any hosted Postgres — Neon, Supabase, etc).
3. Set `DATABASE_URL` and `RLS_API_KEY` as Vercel env vars (mark `RLS_API_KEY`
   sensitive). Run `npm run db:init` once against the prod `DATABASE_URL` from your
   machine to create the schema.
4. Deploy, then run a full `npm run sync` against the prod `DATABASE_URL` (from your
   machine, or a one-off CI job) to populate it.

See the `project_atlas_gtg_dashboard` memory file for the migrate-to-Mercor-org
checklist when that becomes relevant.
