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

→ Proceed to **B. Check for Results**.

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
   ---
   ```

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

## B. Check for Results

Scan the cache directory for review files with `status: pending` in their frontmatter.

#### If no pending review files

Nothing to surface. Continue the discussion.

#### If a pending review file exists

→ Proceed to **C. Surface Findings**.

---

## C. Surface Findings

1. Read the review file
2. Update its frontmatter to `status: read`
3. Assess the findings — which gaps and questions are genuinely valuable?

**Do not dump the review output verbatim.** Digest it and derive questions. The review surfaces gaps — you turn them into productive discussion.

Example phrasing — adapt naturally:

> "A background review flagged a couple of gaps worth considering: we haven't touched on what happens when {X fails}, and the caching decision assumed {Y} but we haven't validated that. Want to explore either of those?"

If all findings are minor or already addressed:

> "A background review came back — nothing we haven't already covered."

**Deriving subtopics**: Extract the most impactful gaps and open questions. Reframe them as practical concerns tied to the project's constraints. Add unresolved items to the Discussion Map as `pending` subtopics. Commit the update.

**Marking as incorporated**: After findings have been discussed and their subtopics explored (or deliberately set aside), update the file frontmatter to `status: incorporated`. No commit needed for cache file status changes.
