# Review Agent

*Reference for **[workflow-research-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the research session. A review agent reads the research files with a clean slate in the background, identifying coverage gaps, shallow areas, and unvalidated assumptions. The dispatch check is mandatory after every commit (session loop step 6) — not optional, not deferred.

**Trigger checklist** — evaluate after every commit as part of the session loop's dispatch check:

- □ Meaningful content committed? (new findings documented, threads explored, open questions captured — not a typo fix or reformatting)
- □ All prior reviews drained? (any `review-*.md` file in the cache directory must be in `status: incorporated`, or no review files exist yet)
- □ Not the first commit? (the research needs enough content to review)
- □ At least 2-3 conversational exchanges since the last review dispatch?

**Why block on undrained reviews**: two reasons, both important. First, dispatching a fresh review while the prior review's findings are still being explored produces stale analysis — the research will look different once those findings are incorporated, and the new review would be critiquing a version the user is already extending. Second, the block is self-healing: the next meaningful commit after the current review drains to `incorporated` will naturally re-fire the trigger check and dispatch a fresh review, so no trigger is lost. If the session ends before drainage completes, the final review at topic conclusion picks up the outstanding findings via the shared surfacing protocol.

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

Write the skeleton cache file at `.workflows/.cache/{work_unit}/research/{topic}/review-{NNN}.md` — frontmatter only, no body. `status: in-flight` is the dispatch record: it makes the running agent visible to the in-flight scans and the concurrency count until the agent's rewrite flips it to `pending`:

```yaml
---
type: review
status: in-flight
created: {date}
set: {NNN}
findings: []
surfaced: []
announced: false
---
```

**Agent path**: `../../../agents/workflow-research-review.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The review agent receives:

1. **Research file path(s)** — `.workflows/{work_unit}/research/{topic}.md` (for epic, include all research files in `.workflows/{work_unit}/research/` relevant to the current topic)
2. **Output file path** — `.workflows/.cache/{work_unit}/research/{topic}/review-{NNN}.md` (the skeleton above is already on disk there)

The sub-agent rewrites the file at completion — populating `findings:` with stable IDs (`F1`, `F2`, …) and flipping `status` to `pending`. See `agents/workflow-research-review.md` for the schema.

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

**Offering deep dives during presentation**: If the user engages with a raised finding and it's substantial enough for independent investigation, offer to dispatch a deep-dive agent for it. Follow the deep-dive agent instructions for the offer and dispatch.

**Findings the user deflects**: If the user doesn't want to engage with a finding you raised, note it in the Open Questions section of the research file.
