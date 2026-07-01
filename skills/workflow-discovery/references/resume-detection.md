# Resume Detection

*Reference for **[workflow-discovery](../SKILL.md)***

---

Detect an interrupted prior shaping session before re-shaping an existing epic's map. Read the active-session marker:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery active_session
```

The marker is set when a session writes its log (lazy creation) and deleted when the session concludes. Its presence is the authoritative in-progress signal.

#### If output is empty or the literal string `null`

No prior session is in progress. `session_number` will be set at Step 7 from discovery's `next_session_number`.

→ Return to caller.

#### Otherwise

The output is the in-progress session number string (e.g. `002`) — the prior session was interrupted before finalisation.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Found an in-progress discovery session for **{work_unit:(titlecase)}** at `session-{active_session}.md`.

- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the draft and start a new session
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

Set `session_number` = `active_session`. The existing file at `.workflows/{work_unit}/discovery/sessions/session-{session_number}.md` is the working state for the session loop, which briefs across the prior sessions on re-open (see [continuity-load.md](continuity-load.md)).

→ Return to caller.

#### If `restart`

Delete the in-progress log and clear the marker:

```bash
rm .workflows/{work_unit}/discovery/sessions/session-{active_session}.md
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery active_session
git add -- .workflows/{work_unit}/
git commit -m "discovery({work_unit}): restart interrupted session"
```

`session_number` will be set at Step 7 from discovery's `next_session_number`.

→ Return to caller.
