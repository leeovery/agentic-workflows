The prose should have taken this path:

1. the plan gate renders empty and an implementation item exists, so
   the entry validates and hands off; resume detection reports the
   resumed mode and announces resuming from a previous session —
   never the created arm's start-implementation commit
2. environment setup finds the existing document and asks nothing;
   the plan adapter loads for local-markdown; project skills and
   linter discovery each ask only their skip-again question — the
   first two scripted answers skip both
3. the loop reads work_type once at entry; the crash-resume healing
   finds nothing to heal (pay-1-1 is in both the plan and
   completed_tasks)
4. retrieval selects pay-1-2 — pay-1-1 is completed — the task is
   normalised, started via the engine, marked in-progress, and its
   brief renders before the dispatch
5. the executor stub fires for pay-1-2 and completes; the reviewer
   stub approves with nothing banked, so the fix machinery is never
   touched and no bank push runs
6. the result header renders, the summary follows, the task gate menu
   is emitted, and the third scripted answer approves
7. progress lands for pay-1-2: frontmatter flips to completed, and the
   phase disposition comes out `boundary` — no open tasks remain, the
   work type is feature, the phase label is plan-authored, and
   consolidated_phases is absent — so the plan-side phase completion
   is deferred, the engine call carries --next-task ~ WITHOUT
   --phase-complete, the code commit lands as impl(pay): Tpay-1-2,
   and the stage routes to the consolidation pass
8. the pass announces itself, reads consolidation_gate_mode (gated)
   and the durable state (staging and consolidated_phases both print
   empty), sees a plan-authored phase label with no resume state, and
   dispatches the consolidation finder
9. the finder stub writes the findings file and returns STATUS
   findings; the findings commit runs and picks it up
10. the judge re-applies the bar first: the plan's open tasks are read
    through the format's reading adapter and neither finding's ground
    is already owned by one
11. the spec defect is settled before any proposal is written — the
    entry routes into the historical-artifact correction for this
    work unit's own concluded specification, and the record settles
    it: the claimed path is one the tree measures. The correction
    lands silently — the wrong path replaced in place, one dated
    corrigendum attributed to implementation/pay appended under a
    Corrigenda section the file did not have, the specification
    re-indexed with a single-file knowledge index, and one scoped
    commit carrying --kb and --sweep. No menu is rendered for it, no
    question is asked, no scripted answer is consumed, and the
    specification item's status is never touched. The pass says only
    that one correction was recorded — one line, no per-correction
    recap
12. the two findings fold into two staged proposals carrying problem
    and direction only — no Do, no Acceptance Criteria, no Tests,
    because nothing has been agreed to build yet. The extraction is
    an ordinary proposal; the short-capture finding is an irreducible
    product fork past the bar — product-level, mirrored costs no
    measurement or spec entry breaks, the tie-break the user's — so
    its proposal keeps a Solution for the part that is settled (the
    amount comparison) and adds a **Decision** with the question, a
    **Stakes** line arguing the stop, and the two sides — the
    recommended side first, marked (recommended). There are no bank
    verdicts and no pre-existing debt to push (nothing was ever
    banked), and the staging file is written to
    consolidation-tasks-p1.md
13. the walk's gate state initialises in one batched write — both
    rows pending — and the tasks-overview renders
14. the first proposal renders gated at proposal altitude: its
    payload carries problem and solution and no steps, criteria or
    tests, and the rendered body shows none of those blocks. The
    fourth scripted answer takes auto — the row records approved and
    consolidation_gate_mode is set to auto
15. the second proposal is re-derived against the bar first, with the
    session's context, and holds — the fork is product-level and
    nothing the session knows breaks the tie — so it is not settled
    away. Its payload carries the stakes string and the decision with
    its recommended-marked side; it renders with --gate auto, and
    because it carries a decision the response is MENU: task decision
    — the question as the display body's **Decision** line with the
    **Stakes** line beneath it, the menu under the engine's fixed
    question with the auto-override announcement, the two sides
    numbered recommended-first (the first carrying the (recommended)
    suffix), plus decline and comment — and the walk STOPS for the
    user. No auto-approval continuation is emitted for it: an
    irreducible product fork stops at either gate mode
16. the fifth scripted answer picks the second side as the menu
    rendered them; the staged proposal is rewritten so its Solution
    carries that side and its Decision and Stakes lines are gone, and
    the row records approved
17. no pending row remains and both are approved, so the pass records
    itself as landed — consolidated_phases gains 1 — before anything
    reaches the plan, then invokes the task author over the staging
    file with both approved task numbers; the author stub adds each
    task's Do, Acceptance Criteria and Tests beneath its existing
    heading, leaving titles, control lines, Problem and Solution as
    staged
18. only once the author has returned is the task writer invoked,
    with the per-task consolidation-boundary placement; the writer
    stub creates tasks/pay-1-3.md and tasks/pay-1-4.md, appends both
    planning rows, and records both task_map entries
19. nothing is pulled from the bank — nothing was ever deposited —
    and the two consolidation commits land via the engine: the
    staging file under the implementation topic, the tasks with
    --plan
20. the pass returns to the loop, retrieval sees the newly created
    work, and the walk stops there — no task is started and no phase
    completion is recorded

Further claims:

- exactly one executor dispatch and one reviewer dispatch fired, both
  for pay-1-2; pay-1-1 was never re-executed or re-reviewed
- exactly one consolidation-finder dispatch, one task-author dispatch
  and one task-writer dispatch fired, in that order: the author ran
  only after the walk settled both proposals, and the writer only
  after the author returned
- the specification's design note now names
  `src/checkout/payment-intent.js`, and the file ends with a
  Corrigenda section holding exactly one entry, dated and attributed
  to `implementation/pay`; nothing else in the file moved. The
  manifest's specification item is untouched — still completed, no
  reopen, no status change
- the five scripted answers were consumed by the two setup gates, the
  task gate, the auto opt-in and the decision, in that order and
  nowhere else — the specification correction took no user turn
- the proposed-task payload left under .workflows/.cache is the
  second proposal's: it carries a stakes string and a decision with
  two sides — exactly one marked recommended, listed first — and no
  steps, criteria or tests keys
- the staging file's second task carries the settled short-capture
  handling in its Solution — the side the rendered menu offered as 2
  — and no **Decision** or **Stakes** lines; both tasks carry the
  bodies the author added, and neither carried them before the walk
- staging.p1 ends with both rows approved and no third row;
  consolidation_gate_mode ends auto while task_gate_mode and
  fix_gate_mode both stay gated
- the manifest's implementation item ends with pay-1-1 and pay-1-2 in
  completed_tasks, current_task null, phase 1 in consolidated_phases
  and NOT in completed_phases — the phase stays open behind the two
  tasks the boundary added — and no bank field
- tasks/pay-1-3.md and tasks/pay-1-4.md exist with status: pending,
  and the planning file's Phase 1 table carries both rows
- no code was written for either consolidation task:
  src/gateway/result.js does not exist and src/webhooks/capture.js
  still reads exactly as the fixture left it — no amount comparison,
  no shortfall handling
- no fix-tracking file and no attempt-findings cache file exist
