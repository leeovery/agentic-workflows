# Initialize Discovery

*Reference for **[workflow-discovery-process](../SKILL.md)***

---

1. Ensure the discovery directory exists: `mkdir -p .workflows/{work_unit}/discovery/` (safe to re-run).
2. Hold the following in conversation memory — they parameterise the session log when it is eventually written:
   - `session_number` — set at Step 0.
   - `description` — work-unit description from the entry skill's handoff.
   - `imports` — handoff `imports` list (may be empty).
   - `map_state_at_start` — `map_summary` from the most recent discovery output. Write `(empty — first session)` when the map is empty.

**Do not create the session log file here.** The file is conjured lazily — see [template.md](template.md) → *Lazy creation and finalisation*. The first state change in [session-loop.md](session-loop.md) writes the file using the metadata held above.

No commit at this step — nothing is on disk yet.

→ Return to caller.
