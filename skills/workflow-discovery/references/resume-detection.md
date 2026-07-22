# Resume Detection

*Reference for **[workflow-discovery](../SKILL.md)***

---

Detect an interrupted prior shaping session before re-shaping an existing epic's map. Read the active-session marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery active_session
```

The marker is set when a session writes its log (lazy creation) and deleted when the session concludes. Its presence is the authoritative in-progress signal.

#### If output is empty or the literal string `null`

No prior session is in progress. `session_number` will be set at Step 7 from discovery's `next_session_number`.

→ Return to caller.

#### Otherwise

The output is the in-progress session number string (e.g. `002`) — the prior session was interrupted before finalisation.

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> An earlier discovery session for this epic was left unfinished —
> choose whether to pick it up or start fresh.
```

Render the resume menu and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render resume-gate {work_unit} --variant session
```

**STOP.** Wait for user response.

#### If `continue`

Set `session_number` = `active_session`. The existing file at `.workflows/{work_unit}/discovery/sessions/session-{session_number}.md` is the working state for the session loop, which briefs across the prior sessions on re-open (see [continuity-load.md](continuity-load.md)).

→ Return to caller.

#### If `restart`

Delete the in-progress log, clear the marker, and commit:

```bash
rm .workflows/{work_unit}/discovery/sessions/session-{active_session}.md
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery active_session
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): restart interrupted session"
```

`session_number` will be set at Step 7 from discovery's `next_session_number`.

→ Return to caller.
