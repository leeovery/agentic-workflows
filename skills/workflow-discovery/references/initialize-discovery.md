# Initialize Discovery

*Reference for **[workflow-discovery](../SKILL.md)***

---

1. Ensure the session-log and briefs directories exist: `mkdir -p .workflows/{work_unit}/discovery/sessions/ .workflows/{work_unit}/discovery/briefs/` (safe to re-run).
2. Hold the following in conversation memory — they parameterise the session log when it is eventually written; the session loop's opener and seed/import-launchpad branch read them:
   - `session_number` — set before this step (Step 6 on resume, Step 7 for a fresh session, or the confirm-trigger for a new epic).
   - `description` — from the most recent discovery output.
   - `seeds` — from the most recent discovery output (may be empty — treat as "none"). The work unit's origin when it was promoted from the inbox.
   - `imports` — from the most recent discovery output (may be empty — treat as "none").
   - `map_state_at_start` — `map_summary` from the most recent discovery output. Write `(empty — first session)` when the map is empty.

**Do not create the session log file here.** For a new epic the confirm-trigger already wrote `session-001.md`; otherwise the file is conjured lazily on the first state change — see [template.md](template.md) → *Lazy creation and finalisation*.

No commit at this step.

→ Return to caller.
