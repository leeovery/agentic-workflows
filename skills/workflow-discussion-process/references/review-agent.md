# Review Agent

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the discussion session. A review agent reads the discussion file with a clean slate in the background, identifying gaps, shallow coverage, and missing edge cases. The dispatch check is mandatory after every commit (session loop step 5) — not optional, not deferred.

**Trigger checklist** — evaluate after every commit as part of the session loop's dispatch check:

- □ Meaningful content committed? (a decision documented, a question explored, options analysed — not a typo fix or reformatting)
- □ All prior reviews drained? (`agent scan` shows no `review` row in flight, pending, or acknowledged — or no review row exists yet; an in-flight row an earlier session dispatched is dead, not running — incorporate it and count it drained)
- □ Not the first commit? (the discussion needs enough content to review)
- □ At least 2-3 conversational exchanges since the last review dispatch?

**Why block on undrained reviews**: two reasons, both important. First, dispatching a fresh review while the prior review's findings are still being discussed produces stale analysis — the document will look different once those findings land, and the new review would be critiquing a version the user is already fixing. Second, the block is self-healing: the next meaningful commit after the current review drains to `incorporated` will naturally re-fire the trigger check and dispatch a fresh review, so no trigger is lost. If the session ends before drainage completes, the final review in Step 6 picks up the outstanding findings via the shared surfacing protocol.

**If all checked:**

→ Proceed to **A. Dispatch**.

**If any unchecked:**

No dispatch needed. Continue with the session loop.

At natural conversational breaks, check for completed results.

→ Proceed to **B. Check and Surface**.

---

## A. Dispatch

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review
```

**Agent path**: `../../../agents/workflow-discussion-review.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The review agent receives:

1. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `### {ID}: {label}` section per finding (`F1`, `F2`, …), never frontmatter.

> *Output the next fenced block as a code block:*

```
Background review dispatched. Results will be surfaced when available.
```

The review agent returns:

```
STATUS: gaps_found | clean
FINDINGS: {F1,F2,… — every id in the report; omit when clean}
GAPS_COUNT: {N}
QUESTIONS_COUNT: {N}
SUMMARY: {1 sentence}
```

The discussion continues — do not wait for the agent to return.

---

## B. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. This enforces the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `review`, work_unit = `{work_unit}`, phase = `discussion`, topic = `{topic}`.

**Deriving subtopics during presentation**: When the user engages with a raised finding, reframe it as a practical concern tied to project constraints and record it on the Discussion Map as a `pending` subtopic (`node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic}`). Commit the update.

**Findings the user deflects**: If the user doesn't want to engage with a finding you raised, note it in the Summary → Open Threads section of the discussion file.
