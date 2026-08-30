The prose should have taken this path:

1. the entry resolves the topic from its arguments, finds no experiment
   item, finds the carrier in the discovery session log (so no
   interview), and hands off to the experiment process with no
   `Spawned from:` line — nothing spawned this, discovery routed it
2. the process initialises: reads the carrier's two halves (description
   and Exploration), finds no seed, no brief, and no completed research,
   registers the topic (`topic start`), and commits the initialize
3. the session opens on the register — the none-yet line, E1 does not
   exist — and the loop's triage check finds the queue empty
4. the question crystallises and the user confirms it is worth a run:
   the walk conceives E1 with a kebab slug and holds the record dir. No
   evidence wait is recorded — the handoff carried no spawned-from line
5. the design is authored WITH the user before anything is measured:
   question, prediction with its reason, the decision rule stated
   concretely (over one percent duplicates → idempotent handling in v1),
   and the setup naming the export and the counting instruments. The
   step is recorded (`advance` → designed) and committed
6. the briefing presents the design conversationally — plain terms,
   never a file dump — the user's clarifying question (what counts as a
   duplicate) folds into the design before the freeze, and the approval
   gate is rendered and stopped on. Only after the user confirms does
   `approve` record the freeze
7. measurement begins on the user's go — `advance` → running comes after
   the approve, never before — and the walk executes the setup as
   designed: it actually counts the duplicates in `logs/webhooks.log`
   (three of sixty — five percent) and authors the report as the run
   goes: results traceable to the export, deviations (none), the reading
   kept separate
8. the conclusion executes the pre-registered rule — five percent is
   over the one-percent line, so the rule's branch fires: idempotent
   handling goes into v1. The verdict is recorded as one line via
   `experiment conclude`, committed, and the register re-rendered
   showing E1 concluded
9. the user is done; the series conclusion runs: the triage queue is
   checked, the compliance check passes, and the conclude gate renders
   its menu form — the engine's blocked shape never appears because no
   row is unfinished — without `--dead-end` (feature work; and the
   evidence is exactly what the discussion consumes)
10. the user concludes to discussion: `topic complete` succeeds, the
    design and report are indexed into the knowledge base per file, one
    `--kb` commit closes the phase, the sweep finds no leavings, the
    closing recap runs, the discussion-bound signpost is emitted, and
    the walk stops at the bridge invocation

Further claims:

- the freeze ordering held end to end: the approval gate was rendered
  and answered between the design being recorded and measurement being
  recorded — approve sits between the two advances
- every measured number in the report traces to `logs/webhooks.log`;
  the count is real (the walk ran the instruments), not asserted
- the verdict is the rule's outcome, not a fresh judgment — the report's
  conclusion names the branch that fired
- the design was never edited after the freeze: no amendment, no
  post-hoc rule change
- exactly one experiment ran; no second record was conceived
- no discussion item exists and no discussion was started — the bridge
  the walk stops at owns the routing

EXPECTED WORLD — the fixture plus: `phases.experiment.items.pay`
`completed`, its one series record E1 `concluded` with a kebab slug and
a one-line verdict naming the adopt-idempotency outcome; the record
directory holding `design.md` (question, prediction, decision rule,
setup) and `report.md` (results, deviations, reading, conclusion,
reproduce); the knowledge store carrying chunks for both files; and no
discussion item, no evidence wait, and no second record.
