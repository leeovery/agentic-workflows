# Review Finding Lanes — classify by the move owed, present by lane

Every background review currently returns an undifferentiated list of
findings, and every finding gets the same treatment: a full scene
reconstruction, a position, a proposal, and a mandatory stop. The
ceremony is tuned for the hardest finding in the set and spent on all
of them. This programme classifies findings by *what the user has to
do about them* and gives each class its own presentation. Design log
for the stack. Opened 2026-08-03 from live evidence in fumi.

## Motivation (2026-08-03)

- **The measurement.** fumi has 12 discovery topics. Three are
  in-progress; **zero are decided**. Across those three, 17 review
  rounds have run (note-window is on review-006). 25 rerouted concerns
  sit unresolved across six topics. The epic has not advanced past its
  first three topics in weeks.

- **The user's answers.** Across the last ten findings raised in two
  concurrent live sessions (note-model and storage-and-sync,
  2026-08-03): "yes agree", "Yes, I agree", "Yea, that sounds good",
  "I don't know where this belongs, but I agree", "I don't know. Just
  do what makes sense." Roughly one genuine decision in ten. Each of
  those answers cost a ~600-word raise with a worked example, a
  diagram, and a stop.

- **The user's verdict, twice, unprompted, in both sessions within
  four minutes of each other.** *"I'm very tired of these reviews.
  They're a little too much."* and *"go ahead and make the decisions
  that are already decided, that are just about missing documentation
  … I think I might work this type of thing into the workflows
  themselves, because this is too tiring."*

- **The pump.** storage-and-sync review-006's own summary: six of its
  ten findings are ripples off two triage edits made an hour earlier
  in the same session. Absorbing a rerouted concern is a "meaningful
  commit" (`review-agent.md` trigger checklist excludes only `review-`
  and `(deferral)` markers), which re-arms the dispatch check, which
  produces ten more findings, several of which reroute to sibling
  topics whose absorbs re-arm *their* dispatch. note-model,
  storage-and-sync and note-window are mutually re-arming.

- **No bar exists.** `agents/workflow-discussion-review.md` steps 3–6
  are "assess coverage / decision quality / depth / identify gaps"
  with no sufficiency test anywhere. A fresh-eyes read of a 270KB
  document will always return 10–14 findings. Nothing in the
  workflows defines *good enough* — `meeting-assistant.md` says "More
  discussion = More documentation" and `discussion-guidelines.md` says
  "depth of understanding, not speed of coverage". With an unbounded
  generator on one side and no stopping rule on the other, the only
  terminator is the user giving up.

- **The diagnosis is the design's, not the model's.** In the
  storage-and-sync session the orchestrator diagnosed itself
  correctly: *"The discussion skill genuinely pushes toward offering
  alternatives … That guidance is aimed at ground being explored for
  the first time. Triage isn't that … I applied the exploring reflex
  to a folding job."*

## The contract

- **L1 — classify by the move owed, never by severity.** High/medium/
  low says how much a finding matters, not what to do about it, and
  two low-severity findings can need opposite moves. The lane name is
  the answer to "what happens to this", which is what makes a batch
  answerable at a glance.

- **L2 — the protocol owns shapes; the caller owns lane names.**
  Three presentation shapes live in the shared protocol —
  **batch-apply**, **walk**, **batch-route**. Each calling reference
  declares which of its lanes maps to which shape. Research findings
  are not decisions ("this area is unexplored" is a gap to look into,
  not a choice to make), so a discussion-specific vocabulary must
  never be hardcoded in the shared file.

- **L3 — findings move toward the user, never away.** The
  orchestrator may promote a finding out of batch-apply into the walk
  when it finds a real choice hiding in it. It may never demote a walk
  finding into batch-apply to save a turn. The user can promote at any
  point via **Ask**. This one-way rule is what makes an auto-gate
  unnecessary: the risk an auto-gate would carry is already fenced.

- **L4 — nothing is applied without being shown.** A batch-apply is
  presented in full, numbered, two lines each, before a single edit
  lands. Silent editing on the grounds that "there was no choice
  anyway" is the same convention breach as silent state mutation.

- **L5 — no lane defers work out of the phase.** Everything raised is
  dealt with here. There is no "park for specification" lane: a
  genuine model decision passes the bar and becomes a walk finding; an
  implementation detail fails the bar and is never raised. Deferral
  remains available as the *user's answer* to a walk finding, handled
  by the existing defer gate — never as a lane the reviewer puts them
  in.

- **L6 — a bar, at the agent, before presentation.** Each review
  brief states the sufficiency test its consumer imposes: discussion —
  *would the specification be wrong, blocked, or built on a
  contradiction without this?*; research — *would the discussion that
  consumes this be wrong or blocked?* Findings that fail go to
  Observations in the report: written, auditable, never surfaced. The
  announce count is post-filter.

- **L7 — the batch is fixed at classification time.** The counts shown
  at the announce cannot grow mid-walk. Anything new that surfaces
  while the user is deciding is ordinary session material on the
  Discussion Map, not an addition to this review's set. A walk with a
  visible floor is what makes an unbounded-feeling process feel
  finite.

- **L8 — Apply findings carry their fix; the others do not.** Both
  review briefs currently forbid proposing solutions. That prohibition
  is what forces every finding to arrive as open work. It is relaxed
  for the Apply lane only — an Apply finding must carry its determined
  fix *and* cite the decision it follows from, or the batch screen has
  nothing to show. Walk and Route findings keep the prohibition
  intact.

## Lanes

| Lane | Shape | Discussion | Research |
|---|---|---|---|
| Apply | batch-apply | fix follows from what's already decided | fix follows from what's already been found |
| Decide / Explore | walk | this topic owns an open choice | a genuine gap; the move is to look |
| Route | batch-route | a sibling topic owns it | a sibling topic owns it |
| (below bar) | not surfaced | Observations in the report | Observations in the report |

Synthesis tensions are inherently walk-shaped; perspective agents need
no change.

Lane order is **Apply → Decide → Route**. Route runs last so that a
reroute generated *during* the walk joins the same batch — one send,
one commit, instead of two rounds.

## The stack

1. **Groundwork** — `final-review-menu.md` stops cloning the
   raise-one-finding step and loads the shared protocol instead. The
   clone has already drifted (its Present beat lacks the
   scene-reconstruction arc the shared file gained); under this
   programme it would drift twice. No behaviour change.

2. **The protocol** — `background-agent-surfacing.md` section D
   becomes lane routing with three shapes; both review briefs gain the
   bar, the lane field, and the L8 relaxation; `agent surface` gains
   its comma-list form (see below); four new prose cases; simulation
   re-pin.

3. **Carry-notes** — `document-review.md` section C walks misdirected
   carry-notes one at a time with a stop each: the same shape as
   Route, on the same kind of item. It moves onto the batch-route
   screen. Leaving it out means two routing UXs for one concept.

## Relationship to the batching programme

`agent surface` takes exactly one finding
(`domain/agent-state.cjs:388`). A batch-apply calls it N times in a
row — a new census row for [batching.md](batching.md), and its first
instance of the N-call shape that programme exists to remove.

Per **C6** the batch form is a uniform comma list
(`… {id} F1,F5,F7,F11`), validated all-or-nothing inside the existing
lock before any mutation, single form retained. Per **C5** no new verb
is warranted — the comma list is the cheapest class. Per **C4** it
lands with the call site it collapses, so it rides stack item 2, not
the groundwork PR.

The agent store needs nothing else. Lanes live in the report file,
which is durable and already re-read on resume, so `findings` /
`surfaced` / `remaining` are unchanged. `scan.next` is unaffected —
the protocol already forbids reading it.

## Decisions taken

- **No auto-gate.** `coherence-findings-gate.md` has an `a`/`auto`
  option because it presents findings one at a time; auto is its only
  escape from N stops. Batching removes the stops, so auto would
  remove only the reading. L3 fences the risk an auto-gate would
  carry. Revisit only if the apply batch is rubber-stamped every time
  for a sustained period — by then there is data to justify it.

- **Per-finding commits in the apply batch**, not one combined commit.
  Keeps history bisectable; needs no change to the closing-gates
  classifier, which drops on the `review-` prefix.

- **Below-the-bar findings are silent.** They are in the report file;
  the announce count is post-filter. Reversible in one line if the
  count should be shown.

- **Park is deleted.** It was hiding a classification failure — "is
  `fumi://` a system-registered URL scheme or an internal convention?"
  looked parkable only because the reviewer had no bar. It changes
  whether there is an Info.plist entry, so it is a decision. See L5.

## Open decisions

- Whether the walk's raise, moved verbatim from today's section D,
  wants any trimming now that it is only ever spent on genuinely open
  ground. Deliberately deferred: change one thing at a time, and the
  walk is the part that works.

- Whether investigation and specification review surfaces want the
  same treatment. Both have finding-shaped output; neither was audited
  for this programme.

## Log

- 2026-08-03 — Landed whole in #737. Lanes across every surface that
  raises findings: discussion review, research review, deep-dive,
  synthesis, the final-review menu, and document-review's carry-note
  walk. The walked lane is named by its phase (`decide` / `explore`)
  and the shared protocol carries a heading parameter rather than
  discussion's word for it. Two engine additions the prose earned:
  `render finding-batch` (D4 refuses a templated batch screen in prose)
  and `agent surface`'s comma form (a new batching census row — first
  instance of the N-call shape that programme exists to remove).
  `final-review-menu` stopped cloning the raise; `document-review`'s
  ratchet pin shrank to zero. Three prose cases and a simulation leg.

- 2026-08-03 — Programme opened. Evidence gathered from two live fumi
  discussion transcripts and the epic's manifest state; contract L1–L8
  drafted; stack scoped against the five loaders of
  `background-agent-surfacing.md` and both review briefs.
