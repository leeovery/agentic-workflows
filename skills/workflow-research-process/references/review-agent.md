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

→ Proceed to **B. Check and Surface**.

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
   findings: []   # sub-agent populates with F1/F2/... IDs
   surfaced: []
   announced: false
   ---
   ```

The sub-agent writes finding entries with stable IDs (`F1`, `F2`, …) into the `findings:` list. See `agents/workflow-research-review.md` for the schema.

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

## B. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. This enforces the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `review`, cache_dir = `.workflows/.cache/{work_unit}/research/{topic}`, cache_glob = `review-*.md`, findings_key = `findings`.

**Offering deep dives during presentation**: When the user engages with a finding via `explore` and it's substantial enough for independent investigation, offer to dispatch a deep-dive agent for it. Follow the deep-dive agent instructions for the offer and dispatch.

**Skipped findings**: Items skipped during presentation are added to the Open Questions section of the research file.
