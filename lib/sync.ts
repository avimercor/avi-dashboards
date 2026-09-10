import { getPool } from "./db";
import {
  getTrajectoriesForTask,
  getGradingRunsForTrajectory,
  getJudgeGradesForGradingRun,
  getVerifiersForTask,
  querierUnstructured,
  type Trajectory,
  type GradingRun,
  type JudgeGrade,
} from "./studio";
import { WORLDS, PARENT_TASK_STATUS_ID } from "./constants";

interface Chain {
  root: string;
  members: string[];
}

// Union-find over generated_from_trajectory_id to group root + remix/hint legs
// into one golden chain. Ported from the atlas-golden-trajectory-pull-batched
// skill's analyze_trajectories.py, minus its fixed cutoff date: this dashboard
// always wants THE most-recently-rooted chain, not "most recent after a batch
// cutoff that will rot the moment someone forgets to bump it".
function findChains(trajectories: Trajectory[]): { chains: Chain[]; byId: Map<string, Trajectory> } {
  const byId = new Map(trajectories.map((t) => [t.trajectory_id, t]));
  const hasChild = new Set<string>();
  for (const t of trajectories) {
    if (t.generated_from_trajectory_id) hasChild.add(t.generated_from_trajectory_id);
  }
  const goldenIds = new Set<string>();
  for (const t of trajectories) {
    if (t.generated_from_trajectory_id || hasChild.has(t.trajectory_id)) goldenIds.add(t.trajectory_id);
  }

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while ((parent.get(r) ?? r) !== r) r = parent.get(r)!;
    let cur = x;
    while ((parent.get(cur) ?? cur) !== r) {
      const next = parent.get(cur) ?? cur;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const tid of goldenIds) if (!parent.has(tid)) parent.set(tid, tid);
  for (const tid of goldenIds) {
    const p = byId.get(tid)?.generated_from_trajectory_id;
    if (p && goldenIds.has(p)) union(tid, p);
  }

  const groups = new Map<string, string[]>();
  for (const tid of goldenIds) {
    const root = find(tid);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(tid);
  }

  const chains: Chain[] = [];
  for (const members of groups.values()) {
    let root = members.find((m) => !byId.get(m)?.generated_from_trajectory_id);
    if (!root) {
      root = members.reduce((a, b) => (byId.get(a)!.created_at <= byId.get(b)!.created_at ? a : b));
    }
    chains.push({ root, members });
  }
  return { chains, byId };
}

function pickWinningChain(chains: Chain[], byId: Map<string, Trajectory>): Chain | null {
  if (chains.length === 0) return null;
  return chains.reduce((a, b) => (byId.get(a.root)!.created_at >= byId.get(b.root)!.created_at ? a : b));
}

function pickWinner(members: string[], byId: Map<string, Trajectory>): string | null {
  const scored = members.filter((m) => byId.get(m)?.final_score != null);
  if (scored.length === 0) return null;
  return scored.reduce((a, b) => (byId.get(a)!.final_score! >= byId.get(b)!.final_score! ? a : b));
}

function pickWinningGradingRun(runs: GradingRun[]): GradingRun | null {
  const completed = runs.filter((r) => r.grading_run_status === "completed" && r.final_score != null);
  if (completed.length === 0) return null;
  return completed.reduce((a, b) => (a.final_score! >= b.final_score! ? a : b));
}

export interface TaskSyncResult {
  task_id: string;
  status: "ok" | "no_golden_chain" | "no_completed_grading_run" | "error";
  highest_golden_score: number | null;
  winning_trajectory_id: string | null;
  winning_grading_run_id: string | null;
  chain_root_created_at: string | null;
  criteria_failed: number | null;
  criteria_total: number | null;
  task_stale: boolean;
  rubric_stale: boolean;
  notes: string;
  criteria: {
    verifier_id: string;
    verifier_index: number | null;
    criterion_text: string | null;
    criteria_explanation: string | null;
    grade_rationale: string | null;
    is_primary_objective: boolean | null;
    verifier_updated_at: string | null;
    ever_passed_in_chain: boolean;
    passed_trajectory_ids: string[];
    passed_grading_run_count: number;
  }[];
}

async function collectOtherRunGrades(
  chainMembers: string[],
  excludeGradingRunId: string
): Promise<{ trajectoryId: string; gradingRunId: string; grades: JudgeGrade[] }[]> {
  const out: { trajectoryId: string; gradingRunId: string; grades: JudgeGrade[] }[] = [];
  for (const trajectoryId of chainMembers) {
    let runs: GradingRun[];
    try {
      runs = await getGradingRunsForTrajectory(trajectoryId);
    } catch {
      continue;
    }
    const completed = runs.filter((r) => r.grading_run_status === "completed" && r.grading_run_id !== excludeGradingRunId);
    for (const run of completed) {
      try {
        const grades = await getJudgeGradesForGradingRun(run.grading_run_id);
        out.push({ trajectoryId, gradingRunId: run.grading_run_id, grades });
      } catch {
        // one bad grading run shouldn't sink the cross-run check
      }
    }
  }
  return out;
}

export async function syncOneTask(taskId: string): Promise<TaskSyncResult> {
  const base: Omit<TaskSyncResult, "status" | "notes" | "criteria"> = {
    task_id: taskId,
    highest_golden_score: null,
    winning_trajectory_id: null,
    winning_grading_run_id: null,
    chain_root_created_at: null,
    criteria_failed: null,
    criteria_total: null,
    task_stale: false,
    rubric_stale: false,
  };

  try {
    const trajectories = await getTrajectoriesForTask(taskId);
    if (trajectories.length === 0) {
      return { ...base, status: "no_golden_chain", notes: "no trajectories at all for this task", criteria: [] };
    }
    const { chains, byId } = findChains(trajectories);
    const chosen = pickWinningChain(chains, byId);
    if (!chosen) {
      return { ...base, status: "no_golden_chain", notes: `${trajectories.length} trajectories but no golden (remixed) chain`, criteria: [] };
    }
    const winner = pickWinner(chosen.members, byId);
    const chainRootCreatedAt = byId.get(chosen.root)!.created_at;
    if (!winner) {
      return { ...base, status: "no_golden_chain", chain_root_created_at: chainRootCreatedAt, notes: "chain found but no member has a final_score", criteria: [] };
    }

    const gradingRuns = await getGradingRunsForTrajectory(winner);
    const winningRun = pickWinningGradingRun(gradingRuns);
    if (!winningRun) {
      return {
        ...base,
        status: "no_completed_grading_run",
        highest_golden_score: byId.get(winner)!.final_score,
        winning_trajectory_id: winner,
        chain_root_created_at: chainRootCreatedAt,
        notes: "winning trajectory has no completed grading run",
        criteria: [],
      };
    }

    const judgeGrades = await getJudgeGradesForGradingRun(winningRun.grading_run_id);
    const failing = judgeGrades.filter((g) => g.verifier_result_values?.judge_grade === "fail");

    // Walk every chain member's OTHER completed grading runs (including re-grades
    // of the winner itself) looking for a pass on each verifier that failed here.
    const otherRunGrades = failing.length > 0 ? await collectOtherRunGrades(chosen.members, winningRun.grading_run_id) : [];

    const passInfo = new Map<string, { trajectoryIds: Set<string>; count: number }>();
    for (const f of failing) passInfo.set(f.verifier_id, { trajectoryIds: new Set(), count: 0 });
    for (const { trajectoryId, grades } of otherRunGrades) {
      for (const g of grades) {
        const info = passInfo.get(g.verifier_id);
        if (info && g.verifier_result_values?.judge_grade === "pass") {
          info.trajectoryIds.add(trajectoryId);
          info.count += 1;
        }
      }
    }

    let verifiers: { verifier_id: string; updated_at: string }[] = [];
    try {
      verifiers = await getVerifiersForTask(taskId);
    } catch {
      // staleness check degrades gracefully to "unknown = not stale" if verifiers can't be fetched
    }
    const verifierUpdatedAt = new Map(verifiers.map((v) => [v.verifier_id, v.updated_at]));
    const rubricStale = verifiers.some((v) => v.updated_at > winningRun.created_at);

    let taskUpdatedAt: string | null = null;
    try {
      const rows = await querierUnstructured(`SELECT updated_at FROM tasks WHERE task_id = '${taskId}' LIMIT 1`);
      taskUpdatedAt = (rows[0]?.updated_at as string) ?? null;
    } catch {
      // ditto
    }
    const taskStale = taskUpdatedAt != null && taskUpdatedAt > winningRun.created_at;

    return {
      ...base,
      status: "ok",
      highest_golden_score: byId.get(winner)!.final_score,
      winning_trajectory_id: winner,
      winning_grading_run_id: winningRun.grading_run_id,
      chain_root_created_at: chainRootCreatedAt,
      criteria_failed: failing.length,
      criteria_total: judgeGrades.length,
      task_stale: taskStale,
      rubric_stale: rubricStale,
      notes: `${chosen.members.length}-leg chain rooted ${chainRootCreatedAt}, winner scored ${byId.get(winner)!.final_score}, ${failing.length}/${judgeGrades.length} criteria failed`,
      criteria: failing.map((f) => {
        const info = passInfo.get(f.verifier_id);
        return {
          verifier_id: f.verifier_id,
          verifier_index: f.verifier_index,
          criterion_text: f.verifier_values?.criteria ?? null,
          criteria_explanation: f.verifier_values?.criteria_explanation ?? null,
          grade_rationale: f.verifier_result_values?.grade_rationale ?? null,
          is_primary_objective: f.verifier_values?.is_primary_objective ?? null,
          verifier_updated_at: verifierUpdatedAt.get(f.verifier_id) ?? null,
          ever_passed_in_chain: (info?.count ?? 0) > 0,
          passed_trajectory_ids: info ? Array.from(info.trajectoryIds) : [],
          passed_grading_run_count: info?.count ?? 0,
        };
      }),
    };
  } catch (err) {
    return { ...base, status: "error", notes: `error: ${(err as Error).message}`.slice(0, 500), criteria: [] };
  }
}

async function pMap<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function fetchParentTaskIds(worldIds: string[]): Promise<{ task_id: string; task_name: string; world_id: string }[]> {
  const inList = worldIds.map((w) => `'${w}'`).join(",");
  const out: { task_id: string; task_name: string; world_id: string }[] = [];
  let cursor = "";
  for (;;) {
    const query = `SELECT task_id, task_name, world_id FROM tasks WHERE world_id IN (${inList}) AND task_status_id = '${PARENT_TASK_STATUS_ID}' AND task_id > '${cursor}' ORDER BY task_id ASC LIMIT 500`;
    const rows = await querierUnstructured(query);
    if (rows.length === 0) break;
    for (const r of rows) out.push(r as { task_id: string; task_name: string; world_id: string });
    cursor = rows[rows.length - 1].task_id as string;
    if (rows.length < 500) break;
  }
  return out;
}

export interface SyncProgress {
  total: number;
  done: number;
}

export async function runFullSync(opts?: { concurrency?: number; worldIds?: string[]; onProgress?: (p: SyncProgress) => void }): Promise<{ tasksSynced: number; statusCounts: Record<string, number> }> {
  const worldIds = opts?.worldIds ?? WORLDS.map((w) => w.world_id);
  const parentTasks = await fetchParentTaskIds(worldIds);

  let done = 0;
  const results = await pMap(parentTasks, opts?.concurrency ?? 10, async (t) => {
    const r = await syncOneTask(t.task_id);
    done += 1;
    opts?.onProgress?.({ total: parentTasks.length, done });
    return { ...t, ...r };
  });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Scoped to the worlds being (re)synced this run, so a single-domain sync
    // (e.g. from the "Sync this domain" button) doesn't wipe every other
    // domain's data — only a full, no-worldIds run touches everything.
    await client.query("DELETE FROM criteria WHERE task_id IN (SELECT task_id FROM tasks WHERE world_id = ANY($1))", [worldIds]);
    await client.query("DELETE FROM tasks WHERE world_id = ANY($1)", [worldIds]);
    await client.query("DELETE FROM domains WHERE world_id = ANY($1)", [worldIds]);

    for (const w of WORLDS.filter((w) => worldIds.includes(w.world_id))) {
      await client.query("INSERT INTO domains (world_id, world_name, phase) VALUES ($1, $2, $3)", [w.world_id, w.world_name, w.phase]);
    }

    const statusCounts: Record<string, number> = {};
    for (const r of results) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      await client.query(
        `INSERT INTO tasks (task_id, world_id, task_name, status, highest_golden_score, winning_trajectory_id, winning_grading_run_id, chain_root_created_at, criteria_failed, criteria_total, task_stale, rubric_stale, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          r.task_id,
          r.world_id,
          r.task_name,
          r.status,
          r.highest_golden_score,
          r.winning_trajectory_id,
          r.winning_grading_run_id,
          r.chain_root_created_at,
          r.criteria_failed,
          r.criteria_total,
          r.task_stale,
          r.rubric_stale,
          r.notes,
        ]
      );
      for (const c of r.criteria) {
        await client.query(
          `INSERT INTO criteria (task_id, verifier_id, verifier_index, criterion_text, criteria_explanation, grade_rationale, is_primary_objective, verifier_updated_at, ever_passed_in_chain, passed_trajectory_ids, passed_grading_run_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (task_id, verifier_id) DO NOTHING`,
          [
            r.task_id,
            c.verifier_id,
            c.verifier_index,
            c.criterion_text,
            c.criteria_explanation,
            c.grade_rationale,
            c.is_primary_objective,
            c.verifier_updated_at,
            c.ever_passed_in_chain,
            c.passed_trajectory_ids,
            c.passed_grading_run_count,
          ]
        );
      }
    }

    await client.query("COMMIT");
    return { tasksSynced: results.length, statusCounts };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
