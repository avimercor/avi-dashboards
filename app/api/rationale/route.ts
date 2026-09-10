import { getPool } from "@/lib/db";

const VALID_VERDICTS = ["solvable_model_missed", "not_solvable_impossible", "needs_discussion"];

export async function POST(request: Request) {
  const body = await request.json();
  const { task_id, verifier_id, expert_name, verdict, rationale_text } = body ?? {};

  if (!task_id || !verifier_id || !expert_name || !rationale_text?.trim() || !VALID_VERDICTS.includes(verdict)) {
    return Response.json({ error: "task_id, verifier_id, expert_name, rationale_text, and a valid verdict are all required" }, { status: 400 });
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO expert_rationales (task_id, verifier_id, expert_name, verdict, rationale_text, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (task_id, verifier_id)
     DO UPDATE SET expert_name = $3, verdict = $4, rationale_text = $5, updated_at = now()`,
    [task_id, verifier_id, expert_name, verdict, rationale_text]
  );

  return Response.json({ ok: true });
}
