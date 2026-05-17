# First-Session Resume Detection

*Reference for **[workflow-inception-process](../SKILL.md)***

---

The entry skill has already verified that no inception items exist in the manifest, so this is a first-session entry. This reference recovers from a context refresh that may have interrupted a prior first-session draft by checking the inception directory for session log files.

## A. Detect Prior Session

Check whether any file matching `.workflows/{work_unit}/inception/session-*.md` exists.

#### If no file matches

No prior draft on disk — start fresh.

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

#### If `session-001.md` is the only matching file

A prior in-session draft is on disk and the session was interrupted (likely a context refresh). Read the file, then offer continue or restart:

> *Output the next fenced block as markdown (not a code block):*

```
Found an in-progress inception session log for **{work_unit:(titlecase)}**.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the draft session log and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `continue`:**

The draft session log is your working list — `session-loop.md` will brief the user on resume.

Before handing back, surface any prior knowledge-base context that might inform the resumed session. This is a non-first session entry (the user is returning to an interrupted draft), so KB retrieval applies per the design's "all other sessions" rule.

Construct the query as a single descriptive sentence using the work unit name: `Resuming inception for {work_unit}.` No map exists yet — only the interrupted draft — so topic names are not available.

→ Load **[../../workflow-knowledge/references/contextual-query.md](../../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written, passing the constructed query and `--boost:work-unit {work_unit}`.

When it returns:

→ Return to **[the skill](../SKILL.md)** for **Step 2**.

**If `restart`:**

Delete the draft session log and commit:

```bash
rm .workflows/{work_unit}/inception/session-001.md
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): restart inception session"
```

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

#### If any `session-NNN.md` for N > 1 exists

Defensive guard. The entry skill should have routed `source = refinement` when prior session logs and inception items both exist, but the handoff said `first-session`. State is inconsistent — likely the inception items were removed from the manifest while the session logs were retained.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Inception — Inconsistent State
●───────────────────────────────────────────────●

Prior inception session logs exist but the manifest reports no
inception items for "{work_unit}".
```

> *Output the next fenced block as markdown (not a code block):*

```
> Stopping here so you can reconcile. Either restore the
> manifest items (refinement re-entry) or archive the session
> logs out of the way (fresh first session).
```

**STOP.** Do not proceed — terminal condition.
