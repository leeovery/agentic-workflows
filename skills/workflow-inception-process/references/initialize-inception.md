# Initialize Inception

*Reference for **[workflow-inception-process](../SKILL.md)***

---

1. Ensure the inception directory exists: `mkdir -p .workflows/{work_unit}/inception/` (safe to re-run).
2. Hold the following in conversation memory — they parameterise the session log when it is eventually written:
   - `session_number` — the next zero-padded session number, taken from `discovery.cjs` output (`next_session_number`).
   - `description` — the work-unit description from the entry skill's handoff.
   - `imports` — the handoff `imports` list (may be empty).
   - `map_state_at_start` — the `map_summary` line from `discovery.cjs` output. Write `(empty — first session)` when no map exists yet.

**Do not create the session log file here.** The file is conjured lazily — see [template.md](template.md) → *Lazy creation and finalisation*. The first state change in [session-loop.md](session-loop.md) writes the file using the metadata held above, populating the header sections and the relevant content section in one write.

No commit at this step — there is nothing on disk yet.

→ Return to caller.
