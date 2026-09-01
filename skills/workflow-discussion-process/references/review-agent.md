# Review Agent

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the discussion session. A review agent reads the discussion file with a clean slate in the background, identifying gaps, shallow coverage, and missing edge cases. The dispatch check is mandatory after every commit (session loop step 5) — not optional, not deferred.

**If the user explicitly asks for a review:** their request is the trigger — the movement backoff and the content conditions don't apply, and the dispatch carries `--final`. The safety boxes still hold — prior reviews drained, both queues empty, no wrap-up signal: a review is stale on arrival over any of them, whoever asked. Document and commit anything the conversation has settled first — the agent reads the file, not the room — and clear what blocks (drain the review, absorb the queue), then:

→ Proceed to **A. Dispatch**.

**Trigger checklist** — evaluate after every commit as part of the session loop's dispatch check:

- □ Meaningful content committed? (a decision documented, a question explored, options analysed — not a typo fix or reformatting; a commit whose subject carries a `review-` or `synthesis-` drain marker — e.g. `(review-003 F2)` — doesn't tick this box, nor does one carrying a `(deferral)` marker: the concluding flow's deferral write is bookkeeping, and a review dispatched on it would be in flight before the closing gates it delays)
- □ All prior reviews drained? (run `agent scan` now — no `review` row in flight, pending, or acknowledged, or no review row exists yet; an in-flight row an earlier session dispatched is dead, not running — incorporate it and count it drained)
- □ Not the first commit? (the discussion needs enough content to review)
- □ Review armed? (`review_arming.armed` is `true` on that scan — the engine's movement backoff: a review arms only once the Discussion Map has moved enough since the last one. Triage folds never count — each absorb settles its concern's ground into the anchor, so a sitting that only drained the queue stays quiet and its review duty falls to the closing gates. When quiet, `reason` names the moves owed, and the topic's next review comes from map movement, an explicit user request, or the concluding flow's `--final` pass)
- □ Triage queue empty? (`topic queue` shows `count: 0` — the session loop's triage check reads it each iteration; a queued rerouted concern is a pending change to this document, so a review dispatched over it is stale on arrival; self-healing like the drain block — the first meaningful commit after the queue empties re-fires the check)
- □ Calls queue empty? (`.workflows/.cache/{work_unit}/discussion/{topic}/calls-queue.json` absent or drained — a queued settled call is a pending change to this document, stale-on-arrival and self-healing the same way)
- □ The user hasn't signalled conclusion? (a wrap-up signal hands review duty to the closing gates — their final review covers the closing commit; a dispatch now lands `pending` at classification and forces a drain detour)

**Why block on undrained reviews**: two reasons, both important. First, dispatching a fresh review while the prior review's findings are still being discussed produces stale analysis — the document will look different once those findings land, and the new review would be critiquing a version the user is already fixing. Second, the block is self-healing: the next meaningful commit after the current review drains to `incorporated` will naturally re-fire the trigger check, so no trigger is lost — whether it dispatches is then the movement backoff's call. If the session ends before drainage completes, the final review in Step 6 picks up the outstanding findings via the shared surfacing protocol.

**If all checked:**

→ Proceed to **A. Dispatch**.

**If any unchecked:**

No dispatch needed. Continue with the session loop.

At natural conversational breaks, check for completed results.

→ Proceed to **B. Check and Surface**.

---

## Lanes

The shared surfacing protocol reads this declaration when presenting this phase's findings.

- `ask` — the walked lane. Raises render under the heading `Needs A Decision`.
- `apply` — approving lands each fix as a pure correction: amend the affected sites in place, each amendment a dated note naming the decision that determines it, striking or rewriting the stale text as each site needs — the shape in **D. Fold** in **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)**; never the template's revision shape. The confirmation says amended, never removed.
- `decide` — approving documents each call as a decision: write it into the subtopic that owns it — the template's full structure where the subtopic has no section yet, a dated revision entry where a decided block exists — with the Decision block carrying the template's derivation marker (**Settled by derivation** — what determined it, the finding id). When no subtopic on the Discussion Map owns the call, add one and set it `decided` in the same move (`discussion-map add`, then `discussion-map set … decided`).
- `route` — approving delivers each finding to its owning topic through the shared triage landing.

## A. Dispatch

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal). `--final` rides a user-requested dispatch only:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review [--final]
```

**If the response is `ok: false`:** a peer session moved the ground between the check and the dispatch — a concern landed in the triage queue, or its own review re-anchored the movement gate. Surface the engine's error verbatim — the refusal names what owns the close — and continue with the session loop; the next check re-evaluates.

**Otherwise:**

Read the topic's dismissed grounds — the user's standing rulings on what not to report. Empty output means none:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} dismissed_grounds
```

**Agent path**: `../../../agents/workflow-discussion-review.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The review agent receives:

1. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `### {ID}: {label}` section per finding (`F1`, `F2`, …), never frontmatter.
3. **Dismissed grounds** — the list read above, verbatim. Omit this input entirely when the list is empty.

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

**Findings the user rejects**: nothing lands in the discussion file either way — **Rejecting a raise** in **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** owns both exits, dropping a *not now* and recording a dismissal's ground on the topic.
