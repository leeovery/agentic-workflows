# Resume Detection

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Inception sessions create their log file lazily — see [template.md](template.md) → *Lazy creation and finalisation*. A log file on disk therefore means meaningful work happened in some session. This reference detects whether the most recent session was interrupted (Conclusion still `(none)`) and offers continue/restart.

## A. Read Latest Session State

Run discovery for the work unit:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Read `latest_session` and `next_session_number` from the output.

#### If `latest_session` is `null`

No session logs on disk. This is either the first-ever entry, or all prior sessions concluded with browse-only behaviour (no state changes, no file). Fresh entry.

Set `session_number` = `next_session_number`. No active file yet.

→ Return to caller.

#### If `latest_session.is_in_progress` is `false`

The most recent session concluded normally. Fresh entry for a new session number.

Set `session_number` = `next_session_number`. No active file yet.

→ Return to caller.

#### If `latest_session.is_in_progress` is `true`

The prior session was interrupted before finalisation (Conclusion is `(none)`).

→ Proceed to **B. Offer Continue or Restart**.

## B. Offer Continue or Restart

> *Output the next fenced block as markdown (not a code block):*

```
Found an in-progress inception session log for **{work_unit:(titlecase)}**: `{latest_session.filename}`.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the draft and start a new session
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

The active session log is `{latest_session.filename}`. Set `session_number` = `latest_session.number`. The existing file's contents become the working state for the session loop.

→ Return to caller.

#### If `restart`

Delete the in-progress log and commit:

```bash
rm {latest_session.relative_path}
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): restart interrupted session"
```

Set `session_number` = `latest_session.number` (the number is reused since the file was just deleted). No active file yet — the next state change in the session loop will create it.

→ Return to caller.
