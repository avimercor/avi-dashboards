-- GTG expert-review dashboard schema.
--
-- domains / tasks / criteria are a full mirror of live Studio state: every sync
-- run drops and reloads them wholesale (see lib/sync.ts). expert_rationales is
-- the one hand-written table and is NEVER touched by sync.

DROP TABLE IF EXISTS criteria;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS domains;

CREATE TABLE domains (
  world_id    TEXT PRIMARY KEY,
  world_name  TEXT NOT NULL,
  phase       TEXT
);

CREATE TABLE tasks (
  task_id                  TEXT PRIMARY KEY,
  world_id                 TEXT NOT NULL REFERENCES domains(world_id),
  task_name                TEXT NOT NULL,
  status                   TEXT NOT NULL, -- ok | no_golden_chain | no_completed_grading_run | error
  highest_golden_score     DOUBLE PRECISION,
  winning_trajectory_id    TEXT,
  winning_grading_run_id   TEXT,
  chain_root_created_at    TIMESTAMPTZ,
  criteria_failed          INT,
  criteria_total           INT,
  task_updated_at          TIMESTAMPTZ,   -- tasks.updated_at from Studio, for staleness
  task_stale               BOOLEAN NOT NULL DEFAULT FALSE,   -- task edited after the winning grading run
  rubric_stale             BOOLEAN NOT NULL DEFAULT FALSE,   -- any verifier on this task edited after the winning grading run
  notes                    TEXT,
  last_synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE criteria (
  id                       SERIAL PRIMARY KEY,
  task_id                  TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  verifier_id              TEXT NOT NULL,
  verifier_index           INT,
  criterion_text           TEXT,
  criteria_explanation     TEXT,
  grade_rationale          TEXT,       -- the grader's own evidence for the fail (not an expert field)
  is_primary_objective     BOOLEAN,
  criteria_type            TEXT,       -- e.g. "Expert Assessment" | "Objective Compliance"
  gate                     TEXT,       -- e.g. "Gate: Critical Value" | "Gate: Missing Scope" | "Gate: Ethical / Safety Violation" | null
  weight                   NUMERIC,
  verifier_updated_at      TIMESTAMPTZ,        -- for rubric_stale, per-criterion
  ever_passed_in_chain     BOOLEAN NOT NULL DEFAULT FALSE,
  passed_trajectory_ids    TEXT[] NOT NULL DEFAULT '{}',
  passed_grading_run_count INT NOT NULL DEFAULT 0,
  UNIQUE (task_id, verifier_id)
);

CREATE INDEX idx_tasks_world_id ON tasks (world_id);
CREATE INDEX idx_criteria_task_id ON criteria (task_id);

-- Hand-written, never touched by sync.
CREATE TABLE IF NOT EXISTS expert_rationales (
  task_id         TEXT NOT NULL,
  verifier_id     TEXT NOT NULL,
  expert_name     TEXT NOT NULL,
  verdict         TEXT NOT NULL CHECK (verdict IN ('solvable_model_missed', 'not_solvable_impossible', 'grading_issue', 'needs_discussion')),
  rationale_text  TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, verifier_id)
);
