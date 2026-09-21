The prose should have taken this path:

1. the plan gate renders empty and an implementation item exists, so the
   entry validates and hands off; resume detection reports the resumed
   mode and announces resuming from a previous session — never the
   created arm's start-implementation commit
2. environment setup finds the existing document and asks nothing; the
   plan adapter loads for local-markdown; project skills and linter
   discovery each ask only their skip-again question — the first two
   scripted answers skip both
3. the task loop reads work_type once at entry, and its crash-resume
   healing finds nothing to heal: pay-1-1 is already in the manifest's
   completed_tasks, so no engine completion runs before the first
   retrieval
4. pay-1-2 is retrieved, normalised, started through the engine and
   marked in-progress; the start response carries every gate as `gated`,
   and the task brief renders via `render task-brief` before any
   executor dispatch — same turn, no stop
5. the executor is dispatched fresh and returns **blocked**. Its report
   carries no BANK section, so nothing is deposited
6. **nothing is rendered for the block yet.** No result header is
   fetched and the executor's ISSUES are not echoed: the loop classifies
   first, loading the spec-gap reference in its `implementation` lane
   with the question retold upward. The record does not settle it —
   whether the session tests that through the correction route or reads
   the classification's otherwise arm directly, it comes out the same:
   neither the specification's logged-and-ignored rule nor anything in
   the discussion reaches a capture landing on an order the shopper
   cancelled, so it is a fork in what the product does and the reference
   goes to its exchange
7. only then does anything reach the user, and it arrives in three
   parts. The task's header renders first, via `render task-result …
   --result blocked`. Beneath it the session composes the block in the
   register's executor-block shape — **Blocked on** in a sentence,
   **What the executor found** as bullets naming what the record
   decides and where it runs out, **Options** as a numbered list with
   each side's technical shape, product consequence and cost side by
   side, and **Recommendation** with its grounds. It is the session's
   composition, not the executor's report read back
8. the sides are written to
   `.workflows/.cache/pay/implementation/pay/block-sides.json` in the
   composed order, the recommended one marked and first, and the gate is
   fetched over that payload: `render executor-block-gate
   pay.implementation.pay --result blocked --file …/block-sides.json`.
   Its MENU is emitted verbatim — the sides as numbered rows plus
   **Comment**, and nothing else: no retry row, no skip, no stop. The
   task gate is `gated`, so the engine heads the menu with no
   auto-override line. The walk **STOPS** and consumes the third
   scripted answer
9. the reply is the **Comment**, and it neither picks a side nor asks a
   question back: it says the question needs work the record never did,
   and names why — what cancelling an order means is not a call to make
   at a keyboard. The specification has a source, so the reference
   routes the gap rather than landing a decision, and the gate is not
   re-fetched. **Nothing is written into the discussion document and no
   corrigendum is composed**
10. the work type is `feature`, so there is no map to land a topic on and
    the epic branch is never entered: the concern is written straight to
    `.workflows/.cache/pay/implementation/pay/gap-concern.md` in the
    triage entry shape — a short title, a `*From: pay · implementation ·
    {date}*` line, then what the work needs, the evidence, what was
    explored, and the task it stopped — and delivered in one
    self-committing transaction:
    `topic triage pay discussion pay --concern … --slug … -m
    "impl(pay): gap routed to pay"`
11. the transaction is what moves the record, and the session writes none
    of it by hand: the discussion item reopens to `in-progress`, the
    concern lands as the first numbered file in that topic's triage
    queue, the specification's source row for the discussion flips to
    `stale` and the specification item takes `reconcile_needed:
    discussion`, and the whole thing commits itself as `impl(pay): gap
    routed to pay`
12. the session commits its own work — `commit pay -m "impl(pay): pause —
    gap routed to pay" --topic implementation/pay`. Everything the walk
    touched is either already committed by the transaction or sits in
    the gitignored cache, so the call answers that there was nothing to
    commit, and that is correct rather than a miss
13. one line says the concern is queued on the discussion and
    implementation resumes once it has decided, and the walk **STOPS
    THERE** — a terminal condition. Control never returns to the skill,
    Step 8 is never reached, and nothing further is fetched or rendered

Further claims:

- **the walk ends at the pause.** No conclude gate is rendered, no wait
  gate is fetched, implementation is never completed, and no bridge is
  invoked. A walk that carried on past the pause is a session still
  building against a record it has just reopened
- the block gate is rendered **once**, with `--result blocked` and the
  sides payload, and its rows are the numbered sides plus **Comment** —
  no retry row, no skip row, no stop row. A gate fetched with `--result
  failed` offers a retry, and a retry would carry the user's words into
  a re-dispatch instead of into the queue
- `block-sides.json` holds two to four options with exactly one marked
  recommended, listed first, each summary the bold label of its option
  in the block — the payload and the composed Options are the same list
  in the same order
- **only one result header renders in the whole walk, the blocked one.**
  Nothing renders with `--result approved` or `--result failed`, and the
  executor's ISSUES are never echoed: the header and the composed block
  are what the user meets, and the report reaching the screen verbatim
  means the retelling never happened
- the executor is dispatched exactly once and never continued: the
  answer went to the record, not back to the agent. No reviewer is
  dispatched, no fix round opens, and no fix-tracking or
  attempt-findings file exists
- the task is left exactly where the stop found it: `tasks/pay-1-2.md`
  still reads `status: in-progress`, the manifest's `current_task` is
  still pay-1-2, `completed_tasks` still holds pay-1-1 alone, and
  `completed_phases` and `consolidated_phases` are both still empty. The
  task is neither completed nor skipped, and no code or test file was
  written
- the discussion **document** is byte-identical to the fixture's — the
  gap was queued, not decided — and the specification is byte-identical
  too: no corrigendum, no edit, no re-index of either
- `.workflows/pay/discussion/.triage/pay/` holds exactly one concern
  file, numbered by the engine, and its text names the task the block
  stopped
- the discussion item reads `in-progress` and the specification item
  reads `completed` with `reconcile_needed: discussion` and its `pay`
  source row `stale`. A specification left unflagged is a way back that
  does not exist: nothing would tell the next session to reconcile
- every gate mode is still `gated` — nothing opted into auto or bounded
- the working tree is clean at the stop; the gap-concern scratch under
  `.workflows/.cache/` is expected residue and is gitignored
