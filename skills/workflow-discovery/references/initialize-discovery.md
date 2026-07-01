# Initialize Discovery

*Reference for **[workflow-discovery](../SKILL.md)***

---

1. Ensure the session-log and briefs directories exist: `mkdir -p .workflows/{work_unit}/discovery/sessions/ .workflows/{work_unit}/discovery/briefs/` (safe to re-run).
2. Read the work-unit `description`, `seeds` list, and `imports` list from the manifest — they are not carried in the discovery output, and the session loop's opener and seed/import-launchpad branch read them:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} seeds
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} imports
   ```

   `get` returns empty on an absent field — treat an empty `seeds`/`imports` as "none".
3. Hold the following in conversation memory — they parameterise the session log when it is eventually written:
   - `session_number` — set before this step (Step 6 on resume, Step 7 for a fresh session, or the confirm-trigger for a new epic).
   - `description` — the value read above.
   - `seeds` — the value read above (may be empty). The work unit's origin when it was promoted from the inbox.
   - `imports` — the value read above (may be empty).
   - `map_state_at_start` — `map_summary` from the most recent discovery output. Write `(empty — first session)` when the map is empty.

**Do not create the session log file here.** For a new epic the confirm-trigger already wrote `session-001.md`; otherwise the file is conjured lazily on the first state change — see [template.md](template.md) → *Lazy creation and finalisation*.

No commit at this step.

→ Return to caller.
