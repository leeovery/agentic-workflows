# Review Agent

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

Full lifecycle for the periodic review agent — when to fire, how to dispatch, and how to process results. This agent runs in the background during the discussion session. It reads the discussion file with a clean slate and identifies gaps, shallow coverage, and missing edge cases.

Cache directory: `.workflows/.cache/{work_unit}/discussion/{topic}/`
File pattern: `review-{NNN}.md`
Frontmatter status lifecycle: `pending` → `read` → `incorporated`

---

## A. Trigger Conditions

Fire a review agent if **all** of these conditions are met:

- The most recent commit added meaningful content (a decision documented, a question explored, options analysed — not a typo fix or reformatting)
- No review agent is currently in flight
- This is not the first commit (the discussion needs enough content to review)
- At least 2-3 conversational exchanges have passed since the last review dispatch

#### If conditions are not met

→ Return to caller.

#### If conditions are met

→ Proceed to **B. Dispatch**.

---

## B. Dispatch

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

→ Return to caller.

---

## C. Check for Results

Scan the cache directory for review files with `status: pending` in their frontmatter.

#### If no pending review files

→ Return to caller.

#### If a pending review file exists

→ Proceed to **D. Surface Findings**.

---

## D. Surface Findings

1. Read the review file
2. Update its frontmatter to `status: read`
3. Assess the findings — which gaps and questions are genuinely valuable?

**Do not dump the review output verbatim.** Digest it and derive questions. The review surfaces gaps — you turn them into productive discussion.

Example phrasing — adapt naturally:

> "A background review flagged a couple of gaps worth considering: we haven't touched on what happens when {X fails}, and the caching decision assumed {Y} but we haven't validated that. Want to explore either of those?"

If all findings are minor or already addressed:

> "A background review came back — nothing we haven't already covered."

**Deriving questions**: Extract the most impactful gaps and open questions. Reframe them as practical questions tied to the project's constraints. Add unresolved questions to the discussion file's Questions list (as unchecked items). Commit the update.

**Marking as incorporated**: After findings have been discussed and their questions explored (or deliberately set aside), update the file frontmatter to `status: incorporated`. No commit needed for cache file status changes.

→ Return to caller.
