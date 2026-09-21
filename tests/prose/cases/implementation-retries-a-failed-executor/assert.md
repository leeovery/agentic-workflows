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
5. the executor is dispatched fresh and returns **failed**. Its report
   carries no BANK section, so nothing is deposited. This is not a
   product question, so **no classification runs**: the spec-gap tiers
   are never entered, nothing is read about the specification's state,
   and no presence is scanned
6. the task's header renders first, via `render task-result … --result
   failed`
7. beneath it the session composes the failure in the register's
   executor-failure shape, and all four sections appear, in order:
   **What failed** naming the failing test exactly, **What the executor
   tried** listing its three attempts in the order it made them, **Why**
   giving the session's own read of the cause — the guard keyed on the
   webhook envelope's per-delivery id, where the specification says a
   capture names an intent and the order carries that id from the work
   pay-1-1 left on the tree — and **Next attempt** saying what the retry
   should do differently. It is composed, not the executor's ISSUES read
   back, and it is **What is needed** that is absent: the cause is the
   code, not the environment
8. the gate is fetched with `render executor-block-gate
   pay.implementation.pay --result failed` — **no `--file`**, because a
   failure carries no sides — and its MENU is emitted verbatim: `r/retry`
   and **Comment**, and nothing else. There is no skip row and no stop
   row: during the build the task is finished or being fixed. The walk
   **STOPS** and consumes the third scripted answer, `r`
9. the retry is a **continuation**: the same executor, by its recorded
   agent id, carrying the block's **Next attempt** and anything the user
   added — never a second fresh dispatch, which would throw away the
   code and the context the first one built. It returns complete with
   the capture consumer's source and test files written
10. the reviewer is dispatched fresh and approves, so the fix machinery
    is never touched — no findings cache, no fix-attempt, no fix gate
11. the result header renders via `render task-result … --result
    approved`, the result summary follows, and the task gate is fetched
    via `render task-gate`; it is `gated`, so its MENU is emitted and the
    walk **STOPS**. The fourth scripted answer approves
12. progress lands for pay-1-2: frontmatter flips to completed, pay-1-3
    still remains in the phase so the disposition is `continuing` — no
    `--phase-complete`, no consolidation detour — the engine records
    completion naming pay-1-3 as next, and the task's commits land: the
    state through `--plan`, the code through `--paths` as
    `impl(pay): Tpay-1-2`
13. the loop returns to retrieval and the walk stops there — pay-1-3 is
    never started, no phase completion is recorded, and implementation
    is never marked complete

Further claims:

- **the failure gate offers a retry and Comment, and nothing else.** No
  skip row, no stop row: a failing task is not abandoned mid-build, and
  an environment nobody can fix now is left in progress for the session
  that comes back. A walk that skipped or stopped took a way out the
  gate does not have
- the gate is fetched **once**, with `--result failed` and **no
  `--file`**. A sides payload is never written and never read: the
  fork's sides belong to a block, and this was a failure
- the four failure sections appear **before** the gate, not after it and
  not instead of it — the user judges the retry on the composed read,
  and the menu follows it
- the executor's ISSUES are never echoed verbatim. The report is the
  raw material; what reaches the screen is the session's read of it
- **exactly one fresh executor dispatch fired for pay-1-2, continued
  once.** A second fresh dispatch means the retry was not a
  continuation, and the second executor started from nothing
- exactly one reviewer dispatch fired, after the retry returned complete
- the walk consumes exactly four user answers — the two setup skips, the
  bare `r` at the failure gate, and the task approval — and stops
  nowhere else
- no gate mode is ever written: nothing opts into auto or bounded, and
  both stops are gated stops
- nothing about the record moved: no specification status is read, no
  presence scanned, no corrigendum written, no knowledge re-index, no
  triage landing and no `sources stale`. A failure is not a gap, and a
  walk that entered the tiers over one has mistaken a test it cannot
  pass for a question the product has not answered
- the plan is untouched beyond pay-1-2's own status: no task amended, no
  task added, and `task_map` is what the fixture left
- the manifest's implementation item ends with pay-1-1 and pay-1-2 in
  completed_tasks, current_task pay-1-3, `completed_phases` and
  `consolidated_phases` both still empty, every gate mode still `gated`,
  `fix_attempts` still 0, and no bank field
- `tasks/pay-1-2.md` ends with status completed — the task finished, it
  was not skipped — and `tasks/pay-1-3.md` is still pending; the capture
  source and test files exist as the stub gave them, and
  `src/checkout/payment-intent.js` holds exactly what the fixture left
  it holding
- the discussion and the specification are byte-identical to the
  fixture's
- no fix-tracking file and no attempt-findings cache file exist; the
  task-brief and task-result payload cache files under
  `.workflows/.cache` are expected residue of the renders
- the working tree is clean at the stop — everything the walk wrote sits
  inside one of its commits
