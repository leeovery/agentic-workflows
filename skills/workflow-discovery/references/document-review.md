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

Check whether the active log exists at `.workflows/{work_unit}/discovery/session-{session_number:03d}.md`.

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

Read `.workflows/{work_unit}/discovery/session-{session_number:03d}.md` in full. Don't rely on memory of what you wrote during the session.

→ Proceed to **C. Reconcile**.

## C. Reconcile

Walk the conversation against the log. Five checks:

1. **Exploration narrative reflects the conversation.** The Exploration section should describe what was actually discussed — surfaces named, questions asked, what crystallised. If the conversation covered ground that isn't in the Exploration summary (and would be useful for the next session's resume or for synthesis), add a short entry. If the Exploration summary describes something that didn't actually come up, remove it. Strong summary, not verbatim — don't bloat with detail that wasn't substantive.

2. **Edits section matches applied operations.** Each entry under **Edits** should correspond to a manifest operation that actually committed. Each committed operation should have a matching entry. Map-operations writes these as it goes — gaps here are rare but worth catching, especially if a commit happened without a session-log update.

3. **No phantom content.** If the log mentions a surface that was discussed and then dropped, that's fine — it stays as part of the exploration record. But if the log mentions a *topic synthesis decision* (Topics Identified or working-list content) that the user actually rejected at synthesis time, remove it. The Topics Identified section reflects the **confirmed** set, not the proposed-then-revised set.

4. **Conclusion is still `(none)`** at this point. The Conclusion gets finalised in Step 12 confirm-and-persist, not here.

5. **No prose where structure is expected.** Edits is structured (bulleted operation entries); Topics Identified is structured (per-topic subsections). If freeform prose has leaked into either, move it to Exploration.

Apply corrections directly to the file. Stage and commit the fixes:

```bash
git add .workflows/{work_unit}/discovery/session-{session_number:03d}.md
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
