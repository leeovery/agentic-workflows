# Document Review

*Reference for **[workflow-roadmap](../SKILL.md)***

---

## A. Check for an Active Log

The session log is created lazily — if no Exploration write or map operation produced content, no file exists and there is nothing to reconcile.

Check whether the active log exists at `.workflows/.roadmap/sessions/session-{session_number}.md`.

#### If the file does not exist

Browse-only session — no log to review.

> *Output the next fenced block as a code block:*

```
Document review — no log file (browse only). Nothing to reconcile.
```

→ Return to caller.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Document Review`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session log against the conversation before closing — the Exploration narrative, the Edits entries, and the sorted item set.
```

→ Proceed to **B. Reconcile**.

## B. Reconcile

Read `.workflows/.roadmap/sessions/session-{session_number}.md` in full — don't rely on memory of what you wrote — then walk the conversation against it. Five checks:

1. **Exploration is a faithful running record** — the intent, the staging language, the soft decisions and rejected paths with why, the threads left open. Add substance the log missed; remove anything that didn't come up.
2. **Edits matches applied operations.** Each entry corresponds to an engine op that actually committed, and each committed op has an entry.
3. **No phantom content.** Items Sorted reflects the **confirmed** set, never a proposed-then-revised one.
4. **Conclusion is still `(none)`** — it is finalised at conclude, not here.
5. **No prose where structure is expected.** Freeform prose leaked into Edits or Items Sorted moves to Exploration.

Apply corrections directly to the file, then commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --roadmap -m "docs(roadmap): reconcile session log with conversation"
```

→ Proceed to **C. Brief the User**.

## C. Brief the User

#### If changes were made

> *Output the next fenced block as markdown (not a code block):*

```
> Document review complete. {N} correction(s) applied to the session log.
```

→ Return to caller.

#### If the log is accurate

> *Output the next fenced block as a code block:*

```
Document review — session log reflects the conversation. No changes needed.
```

→ Return to caller.
