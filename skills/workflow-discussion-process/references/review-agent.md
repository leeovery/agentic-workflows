# Review Agent

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the discussion session. A review agent reads the discussion file with a clean slate in the background, identifying gaps, shallow coverage, and missing edge cases. The dispatch check is mandatory after every commit (session loop step 5) — not optional, not deferred.

**Trigger checklist** — evaluate after every commit as part of the session loop's dispatch check:

- □ Meaningful content committed? (a decision documented, a question explored, options analysed — not a typo fix or reformatting)
- □ No review agent currently in flight?
- □ Not the first commit? (the discussion needs enough content to review)
- □ At least 2-3 conversational exchanges since the last review dispatch?

**If all checked:**

→ Proceed to **A. Dispatch**.

**If any unchecked:**

No dispatch needed. Continue with the session loop.

At natural conversational breaks, check for completed results.

→ Proceed to **B. Check and Surface**.

---

## A. Dispatch

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/discussion/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/discussion/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`).

**Agent path**: `../../../agents/workflow-discussion-review.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The review agent receives:

1. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
2. **Output file path** — `.workflows/.cache/{work_unit}/discussion/{topic}/review-{NNN}.md`
3. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: review
   status: pending
   created: {date}
   set: {NNN}
   findings: []   # sub-agent populates with F1/F2/... IDs
   surfaced: []
   announced: false
   ---
   ```

The sub-agent writes finding entries with stable IDs (`F1`, `F2`, …) into the `findings:` list. See `agents/workflow-discussion-review.md` for the schema.

> *Output the next fenced block as a code block:*

```
Background review dispatched. Results will be surfaced when available.
```

The review agent returns:

```
STATUS: gaps_found | clean
GAPS_COUNT: {N}
QUESTIONS_COUNT: {N}
SUMMARY: {1 sentence}
```

The discussion continues — do not wait for the agent to return.

---

## B. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. This enforces the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `review`, cache_dir = `.workflows/.cache/{work_unit}/discussion/{topic}`, cache_glob = `review-*.md`, findings_key = `findings`.

**Deriving subtopics during presentation**: When the user engages with a raised finding, reframe it as a practical concern tied to project constraints and add it to the Discussion Map as a `pending` subtopic. Commit the update.

**Findings the user deflects**: If the user doesn't want to engage with a finding you raised, note it in the Summary → Open Threads section of the discussion file.
