// Thin REST client for Mercor Studio (RL Studio), used by the sync job.
// Auth: an RLS_API_KEY (studio.mercor.com -> API Keys tab) as a bearer token,
// plus the fixed campaign/company/account scoping headers for Project Atlas.

const BASE_URL = "https://api.studio.mercor.com";

function headers(): Record<string, string> {
  const apiKey = process.env.RLS_API_KEY;
  if (!apiKey) throw new Error("RLS_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Campaign-Id": process.env.STUDIO_CAMPAIGN_ID ?? "camp_24640825e6594435920769ee6e62c6a6",
    "X-Company-Id": process.env.STUDIO_COMPANY_ID ?? "comp_2fa4115109d741cd94a3c409ed89e61f",
    "X-Account-Id": process.env.STUDIO_ACCOUNT_ID ?? "acct_88760e214ef347648b58bc2639d788e1",
    "Content-Type": "application/json",
  };
}

async function studioFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Studio ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

export interface Trajectory {
  trajectory_id: string;
  trajectory_status: string;
  task_id: string;
  generated_from_trajectory_id: string | null;
  final_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface GradingRun {
  grading_run_id: string;
  trajectory_id: string;
  final_score: number | null;
  grading_run_status: string;
  created_at: string;
  updated_at: string;
}

export interface JudgeGrade {
  judge_grade_id: string;
  grading_run_id: string;
  verifier_id: string;
  verifier_index: number | null;
  verifier_values: {
    criteria?: string;
    criteria_explanation?: string;
    is_primary_objective?: boolean;
    [k: string]: unknown;
  } | null;
  verifier_result_values: {
    judge_grade?: "pass" | "fail" | string;
    grade_rationale?: string;
    [k: string]: unknown;
  };
}

// Custom field ids are stable across worlds (confirmed 2026-09-10 on two
// different domains) — they come from one shared SSOT rubric template, not
// per-world config. If a future world uses a different template these will
// just come back null rather than throw.
export const VERIFIER_CUSTOM_FIELD_TYPE = "field_c1241558f8194176a42ea850ade0ea81"; // "Expert Assessment" | "Objective Compliance"
export const VERIFIER_CUSTOM_FIELD_GATE = "field_c58fa22291de475781a7e9473f2ef0d7"; // "Gate: Critical Value" | "Gate: Missing Scope" | "Gate: Ethical / Safety Violation" | absent

export interface Verifier {
  verifier_id: string;
  task_id: string | null;
  verifier_values: Record<string, unknown>;
  verifier_custom_field_values: Record<string, unknown>;
  updated_at: string;
  archived_at: string | null;
}

export async function getTrajectoriesForTask(taskId: string): Promise<Trajectory[]> {
  const data = (await studioFetch(`/trajectories/task/${taskId}`)) as { trajectories: Trajectory[] };
  return data.trajectories;
}

export async function getGradingRunsForTrajectory(trajectoryId: string): Promise<GradingRun[]> {
  const data = (await studioFetch(`/grading-runs/trajectory/${trajectoryId}`)) as { grading_runs: GradingRun[] };
  return data.grading_runs;
}

export async function getJudgeGradesForGradingRun(gradingRunId: string): Promise<JudgeGrade[]> {
  const data = (await studioFetch(`/judge-grades/grading-run/${gradingRunId}`)) as { judge_grades: JudgeGrade[] };
  return data.judge_grades;
}

export async function getVerifiersForTask(taskId: string): Promise<Verifier[]> {
  const data = (await studioFetch(`/verifiers/task/${taskId}`)) as { verifiers: Verifier[] };
  return data.verifiers;
}

export interface QuerierRow {
  [column: string]: unknown;
}

export async function querierUnstructured(query: string): Promise<QuerierRow[]> {
  const data = (await studioFetch(`/querier/unstructured`, {
    method: "POST",
    body: JSON.stringify({ query }),
  })) as { rows: QuerierRow[] };
  return data.rows;
}
