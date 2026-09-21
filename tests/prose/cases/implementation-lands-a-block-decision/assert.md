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
   marked in-progress; the start response carries both gates as `gated`,
   and the task brief renders via `render task-brief` before any
   executor dispatch — same turn, no stop
5. the executor is dispatched fresh and returns **blocked**. Its report
   carries no BANK section, so nothing is deposited
6. **nothing is rendered for the block yet.** No result header is
   fetched and the executor's ISSUES are not echoed: the loop
   classifies first, loading the spec-gap reference in its
   `implementation` lane with the question retold upward. The
   correction route is consulted first and the record does not settle
   it: no landed change supersedes the point, no measurement against the
   tree yields it, and neither the specification's logged-and-ignored
   rule nor anything in the discussion reaches a capture landing on a
   cancelled order. It is a fork in what the product does, so the
   reference goes to its exchange
7. only then does anything reach the user, and it arrives in three
   parts. The task's header renders first, via `render task-result …
   --result blocked`. Beneath it the session composes the block in the
   register's executor-block shape — **Blocked on** in a sentence,
   **What the executor found** as bullets naming what the record
   decides and where it runs out, **Options** as a numbered list with
   each side's technical shape, product consequence and cost side by
   side, and **Recommendation** with its grounds. It is the session's
   composition, not the executor's report read back
8. the recommendation is to keep the cancellation and return the
   payment, so that side is written first into
   `.workflows/.cache/pay/implementation/pay/block-sides.json` and
   marked recommended, and the gate is fetched over that payload:
   `render executor-block-gate pay.implementation.pay --result blocked
   --file …/block-sides.json`. Its MENU is emitted verbatim — the two
   sides as numbered rows in the composed order, plus **Comment**, and
   nothing else: no retry row, no skip, no stop. The task gate is
   `gated`, so the engine heads the menu with no auto-override line. The
   walk **STOPS** and consumes the third scripted answer, `1`
9. side 1 settles it — the order stays cancelled and the payment is
   returned. The decision's home is the discussion, so presence is
   scanned and no session holds it
10. the decision is written into `.workflows/pay/discussion/pay.md` as a
    **new subtopic section** in the template's subtopic shape — Context,
    Options Considered carrying the alternative weighed, Journey, and a
    Decision naming what the shopper meets — with no dated timeline
    entry and no `#### Initial` wrapper, because there is no prior block
    to revise. The section speaks in the document's own voice: nothing
    in it names implementation, an executor, a task or this session
11. the edited discussion is re-indexed through the knowledge CLI; the
    sources-stale step is **skipped** — single-topic work has no sibling
    specifications — and the resolution commits scoped to the discussion
    with the sweep shape (`--topic discussion/pay --kb --sweep`)
12. the discussion now carries the decision, and that is the record that
    settles the specification: the correction route runs over this work
    unit's own specification from a downstream phase — status completed,
    presence scan clean — and lands under the record-settled arm. The
    rule is added to the Capture Webhooks section that owns the ground,
    a dated corrigendum attributed to `implementation/pay` is appended
    citing the decision, the specification is re-indexed, and one scoped
    commit lands carrying `--topic specification/pay`, `--kb` and
    `--sweep`
13. the reference answers `landed`, so the loop lands the answer on the
    task in flight as an addition from the user: appended to the task's
    normalised content in session, with no plan write and no second gate
14. the executor is continued — the same agent, by its recorded id,
    carrying the addition alone — never a second fresh dispatch, and it
    returns complete with the capture consumer's source and test files
    written
15. the reviewer is dispatched fresh and approves, so the fix machinery
    is never touched — no findings cache, no fix-attempt, no fix gate.
    The result header renders via `render task-result … --result
    approved`, the summary follows, and the task gate is fetched via
    `render task-gate`; it is `gated`, so its MENU is emitted and the
    walk **STOPS**. The fourth scripted answer approves
16. progress lands for pay-1-2: frontmatter flips to completed, pay-1-3
    still remains in the phase so the disposition is `continuing` — no
    `--phase-complete`, no consolidation detour — the engine records
    completion naming pay-1-3 as next, and the task's commits land: the
    state through `--plan`, the code through `--paths` as
    `impl(pay): Tpay-1-2`
17. the loop returns to retrieval and the walk stops there — pay-1-3 is
    never started, no phase completion is recorded, and implementation
    is never marked complete

Further claims:

- the block gate is rendered **once**, with `--result blocked` and the
  sides payload, and its rows are the two sides numbered with the
  recommendation first and **Comment** — no retry row, no skip row, no
  stop row anywhere. A gate fetched with `--result failed` offers a
  retry, and a retry carries an answer into the re-dispatch without it
  reaching any document
- `block-sides.json` holds exactly two options, the recommended one an
  object marked `recommended` and listed first, each summary the bold
  label of its option in the block. A payload whose recommended side is
  not the first means the menu's numbering and the composed Options
  disagree, and the scripted `1` picked something the user never read
- **the executor's ISSUES are never echoed.** The header and the block
  are what the user meets, and the block is composed — the report
  reaching the screen verbatim means the retelling never happened
- the third answer is the bare number `1`, so what settles the fork is
  the side the session recommended. A walk whose Recommendation was the
  other side has landed the opposite decision in the record under the
  same keystroke
- the order is the whole point and it holds: the gate before the
  discussion is written, the discussion before the specification's
  corrigendum, and the corrigendum before the executor runs again. An
  executor continued ahead of either write has been told something the
  record does not yet say
- the discussion gains exactly one new subtopic section, deciding what a
  shopper meets when a capture lands on an order they cancelled. The
  Gateway Integration subtopic and the Summary stand as the fixture left
  them, and no timeline entry appears anywhere in the document
- the specification's Capture Webhooks section now carries the rule, and
  the file ends with a Corrigenda section holding exactly one entry,
  dated and attributed to `implementation/pay`, citing the discussion's
  decision. A specification edited with no matching decision in the
  discussion means a product call was landed where no document records
  it
- the specification item is untouched: still `completed`, no reopen, no
  reconcile flag, its source row still `incorporated`. Nothing was
  routed and nothing queued — no triage landing, no `topic reopen`, no
  `sources stale`, and no pause commit
- the walk consumes exactly four user answers — the two setup skips, the
  side pick at the block gate, and the task approval — in that order and
  nowhere else
- exactly one fresh executor dispatch fired for pay-1-2, continued once
  with the answer, and exactly one reviewer dispatch — a second fresh
  executor means the continuation was lost, and the answer with it
- the plan is untouched beyond pay-1-2's own status: no task was
  amended, no task added, and `task_map` is what the fixture left
- the manifest's implementation item ends with pay-1-1 and pay-1-2 in
  completed_tasks, current_task pay-1-3, `completed_phases` and
  `consolidated_phases` both still empty, every gate mode still `gated`,
  and no bank field
- `tasks/pay-1-2.md` ends with status completed and `tasks/pay-1-3.md`
  is still pending; the capture source and test files exist as the stub
  gave them, and `src/checkout/payment-intent.js` holds exactly what the
  fixture left it holding
- no fix-tracking file and no attempt-findings cache file exist; the
  task-brief and task-result payload cache files under
  `.workflows/.cache` are expected residue of the renders
- the working tree is clean at the stop — everything the walk wrote sits
  inside one of its commits
