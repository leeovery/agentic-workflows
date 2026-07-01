# Document Review

*Reference for **[workflow-discovery](../SKILL.md)***

---

> *Output the next fenced block as a code block:*

```
·· Document Review ······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session log against the conversation before
> persisting. The audit covers the durable record — Exploration
> narrative, Edits structured entries, and the synthesised topic
> set held in conversation memory.
```

## A. Check for an Active Log

The session log is created lazily — if no Exploration write, edit, or topic synthesis produced content, no file exists and there is nothing to reconcile.

Check whether the active log exists at `.workflows/{work_unit}/discovery/sessions/session-{session_number:03d}.md`.

#### If the file does not exist

Browse-only session — no log to review.

> *Output the next fenced block as a code block:*

```
Document review — no log file (browse only). Nothing to reconcile.
```

→ Return to caller.

#### Otherwise

→ Proceed to **B. Re-Read the Session Log**.

## B. Re-Read the Session Log

Read `.workflows/{work_unit}/discovery/sessions/session-{session_number:03d}.md` in full. Don't rely on memory of what you wrote during the session.

→ Proceed to **C. Reconcile**.

## C. Reconcile

Walk the conversation against the log. Five checks:

1. **Exploration is a faithful running record.** The Exploration section should capture what was actually discussed — surfaces named, threads followed, the soft decisions reached, the false paths and why they were dropped, and the answers to any in-session research or investigation. If the conversation covered substance that isn't in the log (and the next session's resume or the downstream phase would want it), add it. If the log describes something that didn't come up, remove it. A running record, not verbatim — nothing of substance lost, but don't pad with detail that wasn't substantive.

2. **Edits section matches applied operations.** Each entry under **Edits** should correspond to a manifest operation that actually committed. Each committed operation should have a matching entry. Map-operations writes these as it goes — gaps here are rare but worth catching, especially if a commit happened without a session-log update.

3. **No phantom content.** If the log mentions a surface that was discussed and then dropped, that's fine — it stays as part of the exploration record. But if the log mentions a *topic synthesis decision* (Topics Identified or working-list content) that the user actually rejected at synthesis time, remove it. The Topics Identified section reflects the **confirmed** set, not the proposed-then-revised set.

4. **Conclusion is still `(none)`** at this point. The Conclusion gets finalised in Step 12 confirm-and-persist, not here.

5. **No prose where structure is expected.** Edits is structured (bulleted operation entries); Topics Identified is structured (per-topic subsections). If freeform prose has leaked into either, move it to Exploration.

Briefs (`discovery/briefs/`) are views — regenerated at each harvest, never records — and are **out of scope** here. Reconcile only the log's narrative sections.

Apply corrections directly to the file. Stage and commit the fixes:

```bash
git add .workflows/{work_unit}/discovery/sessions/session-{session_number:03d}.md
git commit -m "docs(discovery/{work_unit}): reconcile session log with conversation"
```

→ Proceed to **D. Brief the User**.

## D. Brief the User

#### If changes were made

> *Output the next fenced block as markdown (not a code block):*

```
> Document review complete. {N} correction(s) applied to the
> session log.
```

→ Return to caller.

#### If the log is accurate

> *Output the next fenced block as a code block:*

```
Document review — session log reflects the conversation. No changes needed.
```

→ Return to caller.
