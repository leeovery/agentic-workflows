# Initialize Discovery

*Reference for **[workflow-discovery](../SKILL.md)***

---

1. Ensure the discovery directory exists: `mkdir -p .workflows/{work_unit}/discovery/` (safe to re-run).
2. Hold the following in conversation memory — they parameterise the session log when it is eventually written:
   - `session_number` — set before this step (Step 6 on resume, Step 7 for a fresh session, or the confirm-trigger for a new epic).
   - `description` — the work-unit `description` from the manifest.
   - `imports` — the manifest `imports` list (may be empty).
   - `map_state_at_start` — `map_summary` from the most recent discovery output. Write `(empty — first session)` when the map is empty.

**Do not create the session log file here.** For a new epic the confirm-trigger already wrote `session-001.md`; otherwise the file is conjured lazily on the first state change — see [template.md](template.md) → *Lazy creation and finalisation*.

No commit at this step.

→ Return to caller.
