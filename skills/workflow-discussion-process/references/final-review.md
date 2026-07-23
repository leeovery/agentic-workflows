# Final Gap Review

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

A final review ensures the discussion is thorough before moving to specification. Even if review agents ran during the session, the discussion may have progressed significantly since the last one.

This step runs once per "user signals done" entry. It dispatches a fresh review if needed, raises one finding via the shared protocol, then bounces back to the discussion session so the user can engage naturally. The next time the user signals done, Step 6 re-runs — eventually all findings are drained and the file transitions to `incorporated`, at which point Step 6 returns to the backbone to proceed toward conclusion.

The **never-dump rules apply in full**. Findings are raised one at a time via the shared surfacing protocol.

## A. Check Review State

Read the store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}
```

Synthesis findings drain first — perspective-council tensions that never finished surfacing during the session would otherwise be dropped at conclusion.

#### If any `synthesis` row is `pending` or `acknowledged`

Surface one tension via **D. Check and Surface** in **[perspective-agents.md](perspective-agents.md)**, then bounce back to the session so the user can engage.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### Otherwise

Take the highest-numbered `review` row and branch on its status below.

#### If no review row exists

→ Proceed to **B. Dispatch Final Review**.

#### If it is `incorporated`

The prior review was fully drained. A fresh one is warranted only when the discussion moved since — otherwise each conclusion attempt mints a new gap set and the topic can never close. Check what landed after that review's dispatch:

```bash
git log --oneline -- .workflows/{work_unit}/discussion/{topic}.md
```

**If a meaningful discussion commit landed after the prior review was dispatched** (a decision documented, a subtopic explored — not typo fixes):

→ Proceed to **B. Dispatch Final Review**.

**Otherwise:**

Nothing new for a fresh review to see — the final-review gate is satisfied.

→ Return to caller.

#### If it is `in-flight`

The dispatched agent hasn't returned.

**If it was dispatched this session and the user chose `p`/`proceed` at the session's in-flight gate:**

The wait was already declined for this row — do not watch it. Its results persist for a later session; the final-review gate proceeds without it.

→ Return to caller.

**If it was dispatched this session and the wait was not declined** (the agent may still be running):

Watch for `agent scan` to promote the row to `pending`.

→ Proceed to **C. Surface via Final Review Menu**.

**Otherwise** (an interrupted earlier session — no agent can still be running):

Close the abandoned row, then dispatch fresh:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} discussion {topic} {id}
```

→ Proceed to **B. Dispatch Final Review**.

#### If it is `pending`

A review returned but hasn't been read.

→ Proceed to **C. Surface via Final Review Menu**.

#### If it is `acknowledged`

Findings from the current review are still being drained.

→ Proceed to **C. Surface via Final Review Menu**.

---

## B. Dispatch Final Review

> *Output the next fenced block as a code block:*

```
·· Dispatch Final Review ························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Dispatching a final review to catch any gaps before concluding.
> This ensures the discussion is thorough for specification.
```

Record the dispatch — the engine allocates the id and answers with the content-file path:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review
```

**Agent path**: `../../../agents/workflow-discussion-review.md`

Dispatch **one agent** as a foreground task (omit `run_in_background` — results are needed before continuing).

The review agent receives:

1. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `## {ID}` section per finding (`F1`, `F2`, …), never frontmatter.

When the agent returns:

→ Proceed to **C. Surface via Final Review Menu**.

---

## C. Surface via Final Review Menu

→ Load **[final-review-menu.md](../../workflow-shared/references/final-review-menu.md)** with work_unit = `{work_unit}`, phase = `discussion`, topic = `{topic}`.

→ On return, proceed to **D. Route Next**.

---

## D. Route Next

Re-run `agent scan` and take the highest-numbered `review` row's status.

#### If `incorporated`

All findings have been raised (or the review came back with zero gaps). The final-review gate is satisfied.

→ Return to caller.

#### If `acknowledged`

A finding was just raised. Control belongs to the conversation — return the user to the discussion session so they can engage naturally. When the user signals done again, Step 6 re-runs and either raises the next finding or the engine incorporates the row.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
