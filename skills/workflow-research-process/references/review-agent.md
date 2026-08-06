# Review Agent

*Reference for **[workflow-research-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the research session. A review agent reads the research files with a clean slate in the background, identifying coverage gaps, shallow areas, and unvalidated assumptions. The dispatch check is mandatory after every commit (session loop step 6) — not optional, not deferred.

**Trigger checklist** — evaluate after every commit as part of the session loop's dispatch check:

- □ Meaningful content committed? (new findings documented, threads explored, open questions captured — not a typo fix or reformatting; a commit whose subject carries a `review-` drain marker — e.g. `(review-003 F2)` — doesn't tick this box, though a `deep-dive-` fold does)
- □ All prior reviews drained? (`agent scan` shows no `review` row in flight, pending, or acknowledged — or no review row exists yet; an in-flight row an earlier session dispatched is dead, not running — incorporate it and count it drained)
- □ Not the first commit? (the research needs enough content to review)
- □ At least 2-3 conversational exchanges since the last review dispatch?
- □ Triage queue empty? (`topic queue` shows `count: 0` — the session loop's triage check reads it each iteration; a queued rerouted concern is a pending change to the research, so a review dispatched over it is stale on arrival; self-healing like the drain block — the first meaningful commit after the queue empties re-fires the check)

**Why block on undrained reviews**: two reasons, both important. First, dispatching a fresh review while the prior review's findings are still being explored produces stale analysis — the research will look different once those findings are incorporated, and the new review would be critiquing a version the user is already extending. Second, the block is self-healing: the next meaningful commit after the current review drains to `incorporated` will naturally re-fire the trigger check and dispatch a fresh review, so no trigger is lost. If the session ends before drainage completes, the final review at topic conclusion picks up the outstanding findings via the shared surfacing protocol.

**If all checked:**

→ Proceed to **A. Dispatch**.

**If any unchecked:**

No dispatch needed. Continue with the session loop.

At natural conversational breaks, check for completed results.

→ Proceed to **B. Check and Surface**.

---

## Lanes

The shared surfacing protocol reads this declaration when presenting this phase's findings.

- `explore` — the walked lane. Raises render under the heading `Needs Investigation`, and the raise's move is investigation: offer a deep-dive on the thread, never dispatched without the user's say.
- `apply` — approving lands each fix as a pure correction: amend the affected sites in place, each amendment a dated note naming the source or finding that determines it. The confirmation says amended, never removed.
- `route` — approving delivers each finding to its owning topic through the shared triage landing.

## A. Dispatch

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} research {topic} --kind review
```

**Agent path**: `../../../agents/workflow-research-review.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The review agent receives:

1. **Research file path(s)** — `.workflows/{work_unit}/research/{topic}.md` (for epic, include all research files in `.workflows/{work_unit}/research/` relevant to the current topic)
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `### {ID}: {label}` section per finding (`F1`, `F2`, …), never frontmatter.
3. **Maturity indication** — one line judging where the session stands, from the session itself: early exploration, threads deepening, or largely concluded.

> *Output the next fenced block as a code block:*

```
Background review dispatched. Results will be surfaced when available.
```

The review agent returns:

```
STATUS: gaps_found | clean
FINDINGS: {F1,F2,… — every id in the report; omit when clean}
GAPS_COUNT: {N}
ASSUMPTIONS_COUNT: {N}
SUMMARY: {1 sentence}
```

The research session continues — do not wait for the agent to return.

---

## B. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. This enforces the never-dump rules: two-phase surfacing, one finding at a time, mid-thread protection.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `review`, work_unit = `{work_unit}`, phase = `research`, topic = `{topic}`.

**Offering deep dives during presentation**: If the user engages with a raised finding and it's substantial enough for independent investigation, offer to dispatch a deep-dive agent for it. Follow the deep-dive agent instructions for the offer and dispatch.

**Findings the user deflects**: If the user doesn't want to engage with a finding you raised, note it in the Open Questions section of the research file.
