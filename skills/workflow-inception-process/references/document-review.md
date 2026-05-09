# Document Review

*Reference for **[workflow-inception-process](../SKILL.md)***

---

> *Output the next fenced block as a code block:*

```
·· Document Review ·······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session conversation against the inception
> session log. The audit covers the rationale layer — log, not map.
```

## A. Re-Read the Session Log

Read `.workflows/{work_unit}/inception/session-001.md` in full. Don't rely on memory of what you wrote during the session.

→ Proceed to **B. Reconcile**.

## B. Reconcile

Walk the conversation against the draft log. Four checks:

1. **Every topic on the working list appears** under **Topics Identified** with the routing the user agreed to and a one-line "Why" that matches the cue actually used in conversation. Missing entries or wrong routing are gaps.
2. **No phantom topics in the log.** If a topic was added during the session but later dropped during refinement, remove it from **Topics Identified**. The log should reflect the current working list, not the history of drafts.
3. **Dropped items appear** under **Considered and Discarded** with the reason given at the time. If something was raised and dropped but isn't recorded, add it. If nothing was dropped, write `(none)` under the heading rather than removing the section.
4. **No drift in the "Why" lines.** The rationale should be one short clause naming the cue (*"clear shape and standard pattern"*, *"open feasibility question"*, *"user wasn't sure how protocol options compared"*). Reject embellishments that didn't come up in conversation.

Apply corrections directly to the file. Stage and commit the fixes:

```bash
git add .workflows/{work_unit}/inception/session-001.md
git commit -m "docs(inception/{work_unit}): reconcile session log with conversation"
```

→ Proceed to **C. Brief the User**.

## C. Brief the User

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
