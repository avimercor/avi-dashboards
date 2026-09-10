import { getPool } from "./db";

export interface DomainRow {
  world_id: string;
  world_name: string;
  phase: string | null;
  task_count: number;
  synced_task_count: number;
  avg_score: number | null;
  stale_count: number;
}

export async function listDomains(): Promise<DomainRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      d.world_id,
      d.world_name,
      d.phase,
      COUNT(t.task_id) AS task_count,
      COUNT(t.task_id) FILTER (WHERE t.status = 'ok') AS synced_task_count,
      AVG(t.highest_golden_score) FILTER (WHERE t.status = 'ok') AS avg_score,
      COUNT(t.task_id) FILTER (WHERE t.task_stale OR t.rubric_stale) AS stale_count
    FROM domains d
    LEFT JOIN tasks t ON t.world_id = d.world_id
    GROUP BY d.world_id, d.world_name, d.phase
    ORDER BY d.world_name ASC
  `);
  return rows as DomainRow[];
}

export interface TaskRow {
  task_id: string;
  task_name: string;
  world_id: string;
  status: string;
  highest_golden_score: number | null;
  criteria_failed: number | null;
  criteria_total: number | null;
  task_stale: boolean;
  rubric_stale: boolean;
  last_synced_at: string;
  reviewed_count: number;
}

export async function listTasksForDomain(worldId: string): Promise<TaskRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT
      t.task_id, t.task_name, t.world_id, t.status, t.highest_golden_score,
      t.criteria_failed, t.criteria_total, t.task_stale, t.rubric_stale, t.last_synced_at,
      COUNT(er.verifier_id) AS reviewed_count
    FROM tasks t
    LEFT JOIN expert_rationales er ON er.task_id = t.task_id
    WHERE t.world_id = $1
    GROUP BY t.task_id
    ORDER BY t.task_name ASC
    `,
    [worldId]
  );
  return rows as TaskRow[];
}

export interface CriterionRow {
  id: number;
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
  expert_email: string | null;
  verdict: string | null;
  rationale_text: string | null;
  rationale_updated_at: string | null;
}

export interface TaskDetail {
  task_id: string;
  task_name: string;
  world_id: string;
  world_name: string;
  status: string;
  highest_golden_score: number | null;
  winning_trajectory_id: string | null;
  winning_grading_run_id: string | null;
  chain_root_created_at: string | null;
  criteria_failed: number | null;
  criteria_total: number | null;
  task_stale: boolean;
  rubric_stale: boolean;
  notes: string | null;
  last_synced_at: string;
  criteria: CriterionRow[];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const pool = getPool();
  const { rows: taskRows } = await pool.query(
    `SELECT t.*, d.world_name FROM tasks t JOIN domains d ON d.world_id = t.world_id WHERE t.task_id = $1`,
    [taskId]
  );
  if (taskRows.length === 0) return null;
  const task = taskRows[0];

  const { rows: criteriaRows } = await pool.query(
    `
    SELECT c.*, er.expert_email, er.verdict, er.rationale_text, er.updated_at AS rationale_updated_at
    FROM criteria c
    LEFT JOIN expert_rationales er ON er.task_id = c.task_id AND er.verifier_id = c.verifier_id
    WHERE c.task_id = $1
    ORDER BY c.verifier_index ASC NULLS LAST
    `,
    [taskId]
  );

  return { ...task, criteria: criteriaRows } as TaskDetail;
}
