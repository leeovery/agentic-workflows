# Final Gap Review

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

A final review ensures the discussion is thorough before moving to specification. Even if review agents ran during the session, the discussion may have progressed significantly since the last one.

This step runs once per "user signals done" entry. It dispatches a fresh review if needed, raises one finding via the shared protocol, then bounces back to the discussion session so the user can engage naturally. The next time the user signals done, Step 6 re-runs — eventually all findings are drained and the engine incorporates the review, at which point Step 6 returns to the backbone to proceed toward conclusion.

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

→ Proceed to **B. Review Row State**.

## B. Review Row State

Take the highest-numbered `review` row from the **A** scan and branch on its status.

#### If no review row exists

→ Proceed to **C. Dispatch Final Review**.

#### If it is `incorporated`

The prior review was fully drained. A fresh one is warranted only when the discussion moved since — otherwise each conclusion attempt mints a new gap set and the topic can never close. Check what landed after that review's dispatch (the row's `created` timestamp, on every scan row) — and discount commits the drain itself produced (same session, your memory of raising its findings; the engagement writes are not new work):

```bash
git log --format='%h %cI %s' -- .workflows/{work_unit}/discussion/{topic}.md
```

**If a meaningful discussion commit landed after the prior review was dispatched** (a decision documented, a subtopic explored — not typo fixes):

→ Proceed to **C. Dispatch Final Review**.

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

→ Proceed to **D. Surface via Final Review Menu**.

**Otherwise** (an interrupted earlier session — no agent can still be running):

Close the abandoned row, then dispatch fresh:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} discussion {topic} {id}
```

→ Proceed to **C. Dispatch Final Review**.

#### If it is `pending`

A review returned but hasn't been read.

→ Proceed to **D. Surface via Final Review Menu**.

#### If it is `acknowledged`

Findings from the current review are still being drained.

→ Proceed to **D. Surface via Final Review Menu**.

---

## C. Dispatch Final Review

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
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `### {ID}: {label}` section per finding (`F1`, `F2`, …), never frontmatter.

When the agent returns:

→ Proceed to **D. Surface via Final Review Menu**.

---

## D. Surface via Final Review Menu

→ Load **[final-review-menu.md](../../workflow-shared/references/final-review-menu.md)** with work_unit = `{work_unit}`, phase = `discussion`, topic = `{topic}`.

→ On return, proceed to **E. Route Next**.

---

## E. Route Next

#### If the menu raised a finding (the `review` choice)

Control belongs to the conversation — return the user to the discussion session so they can engage naturally, whether or not that was the last finding. When the user signals done again, Step 6 re-runs and either raises the next one or finds the row incorporated.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### If the row is still `in-flight` (the watched agent never returned)

Nothing landed to drain — the session's own in-flight gate owns the wait-or-proceed decision.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### Otherwise

No finding is awaiting engagement (the review was clean, fully drained, or skipped). The final-review gate is satisfied.

→ Return to caller.
