# Document Review

*Reference for **[workflow-inception-process](../SKILL.md)***

---

The session log is journey-focused and brief by design — the audit is small. This check catches the gap between what the conversation surfaced and what landed on disk: did every confirmed topic make it into **Topics Identified** with the right routing and a faithful one-line "Why"? Did anything dropped during the session land in **Considered and Discarded**?

The persisted manifest is already the authoritative record of structured state. This review covers the rationale layer — the *log*, not the *map*.

> *Output the next fenced block as a code block:*

```
·· Document Review ·······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session conversation against the inception
> session log. Brief check — the log is rationale-only.
```

## A. Re-Read the Session Log

Read `.workflows/{work_unit}/inception/session-001.md` in full. Pull the current state fresh into context — don't rely on memory of what you wrote during the session.

→ Proceed to **B. Reconcile**.

## B. Reconcile

Walk the conversation against the log. Three small checks:

1. **Every persisted topic appears** under **Topics Identified** with the routing the user agreed to and a one-line "Why" that matches the cue actually used in conversation. Missing entries or wrong routing are gaps.
2. **Dropped items appear** under **Considered and Discarded** with the reason given at the time. If something was raised and dropped but isn't recorded, add it. If the section is empty, drop it.
3. **No drift in the "Why" lines.** The rationale should be one short clause naming the cue (*"clear shape and standard pattern"*, *"open feasibility question"*, *"user wasn't sure how protocol options compared"*). Reject embellishments that didn't come up in conversation.

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
> session log. Proceeding to the final compliance check.
```

→ Return to caller.

#### If the log is accurate

> *Output the next fenced block as a code block:*

```
Document review — session log reflects the conversation. No changes needed.
```

→ Return to caller.
