# Review Agent

*Reference for **[workflow-research-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the research session. A review agent reads the research files with a clean slate in the background, identifying coverage gaps, shallow areas, and unvalidated assumptions. The dispatch check is mandatory after every commit (session loop step 6) — not optional, not deferred.

**Trigger checklist** — evaluate after every commit as part of the session loop's dispatch check:

- □ Meaningful content committed? (new findings documented, threads explored, open questions captured — not a typo fix or reformatting)
- □ No review agent currently in flight?
- □ Not the first commit? (the research needs enough content to review)
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
mkdir -p .workflows/.cache/{work_unit}/research/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/research/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`).

**Agent path**: `../../../agents/workflow-research-review.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The review agent receives:

1. **Research file path(s)** — `.workflows/{work_unit}/research/{topic}.md` (for epic, include all research files in `.workflows/{work_unit}/research/` relevant to the current topic)
2. **Output file path** — `.workflows/.cache/{work_unit}/research/{topic}/review-{NNN}.md`
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
STATUS: gaps_found | thorough
GAPS_COUNT: {N}
ASSUMPTIONS_COUNT: {N}
SUMMARY: {1 sentence}
```

The research session continues — do not wait for the agent to return.

---

## B. Check for Results

Scan the cache directory for review files with `status: pending` in their frontmatter.

#### If no pending review files

Nothing to surface. Continue the research session.

→ Return to caller.

#### If a pending review file exists

→ Proceed to **C. Surface Findings**.

---

## C. Surface Findings

1. Read the review file
2. Update its frontmatter to `status: read`
3. Assess the findings — which gaps, shallow areas, and assumptions are genuinely worth exploring?

**Do not dump the review output verbatim.** Digest it and present it conversationally. The review surfaces gaps — you turn them into productive research threads.

Example phrasing — adapt naturally:

> "A background review flagged some areas we haven't touched yet: we haven't looked at the regulatory side of {X}, and the competitor analysis assumed {Y} without checking. There's also a shallow spot around {Z} — we mentioned it but never dug in. Worth exploring any of these?"

If all findings are minor or already addressed:

> "A background review came back — nothing significant beyond what we've already covered."

**Offering deep dives**: If a gap is substantial and independent enough for its own investigation, offer to dispatch a deep-dive agent for it. This is a natural transition — the review identifies what's missing, the deep dive goes and finds it. Follow the deep-dive agent instructions for the offer and dispatch.

**Marking as incorporated**: After findings have been discussed and either explored or deliberately set aside, update the file frontmatter to `status: incorporated`. No commit needed for cache file status changes.
