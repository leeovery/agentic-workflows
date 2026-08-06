# Topic Completion

*Reference for **[workflow-research-process](../SKILL.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

The current topic is converging — tradeoffs are clear, it's approaching decision territory.

First check the topic's triage queue — a queued concern is work the conclusion cannot pass, and a review dispatched over it would read a file the walk is about to move:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} research {topic}
```

**If `count` is non-zero:**

Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.research.{topic}
```

→ Return to caller.

**If `count` is `0`:**

→ Load **[final-review.md](final-review.md)** and follow its instructions as written.

→ Load **[document-review.md](document-review.md)** and follow its instructions as written.

→ Load **[compliance-check.md](../../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ This topic looks ready to conclude.`**

**`c/conclude`** → Mark this topic as complete, ready for discussion
**`k/keep`**     → Keep digging, there's more to understand
```

**STOP.** Wait for user response.

#### If `conclude`

→ Load **[conclude-research.md](conclude-research.md)** and follow its instructions as written.

#### If `keep`

Continue exploring. The convergence signal isn't a stop sign — it's an awareness check. The user might want to stress-test the emerging conclusion, explore edge cases, or understand the problem more deeply before moving on.

→ Return to caller.
