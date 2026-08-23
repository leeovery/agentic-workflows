# Review Finding Gate — the shape follows the move, not the category

The specification and planning review loops present findings through
one surface, `render finding`, and that surface picks its shape from
the finding's *category* — a taxonomy describing what the reviewer
found, not what the user has to do about it. The result is a gate that
stops the user on calls already made, rubber-stamps calls it should
have discussed, and hands over raw artifact source in place of a
report. This programme replaces the category switch with the move
owed, and re-registers the finding as report-class content. Design log
for the stack. Opened 2026-08-23 from a live portal session.

This closes an open decision left by
[review-finding-lanes.md](review-finding-lanes.md): *"Whether
investigation and specification review surfaces want the same
treatment. Both have finding-shaped output; neither was audited for
this programme."*

## Motivation (2026-08-23)

A live specification review in portal, phase 2 (Input Review), five
findings: gap, gap, enhancement, unsourced decision, gap. The user had
approved `finding_gate_mode: auto` at the phase-1 claims finding. Four
distinct defects surfaced in one sitting.

- **The auto gate was ignored, by design.** Three of the five stopped
  despite `auto`, because `render.cjs` carried
  `items.finding_gate_mode === 'auto' && p.category !== 'gap'`. Each
  stop offered `y` or `skip` over a proposal Claude had already
  written — a settled call presented for ratification, which is
  precisely the wall [ask-or-decide.md](../skills/workflow-shared/references/ask-or-decide.md)
  exists to prevent. The user: *"There's no decision to make here;
  Claude has already made the decision. My only option is to say yes
  or skip, which seems weird to me."*

- **The finding arrived as a slab.** A `gap` finding carries no
  **Current** field (`review-tracking-format.md:36`), so it takes the
  `content` payload path, which emits `emit verbatim as a code block`
  — a plain unlanguaged fence. Whole proposed sections of
  specification markdown rendered literally: `##` headings, `>`
  blockquotes, backticks, all as source. The user: *"That output's not
  really designed for human consumption … I am not reading the
  specification document. I don't particularly care what's in the
  spec. What I care about is what it's saying — the product, the end
  result."* Every `gap` and `new-topic` finding is structurally
  guaranteed to land on this path.

- **Every finding prints its heading twice.** The surface emits the
  head (`**Finding N of M: Title**` + meta + Details), then the
  content, then a menu whose *opening label is the same string*
  (`render.cjs:2018`). Menus must open with a question or contextual
  label (`CONVENTIONS.md:327`); this one reused the title.

- **The unsourced decision faked a conflict.** Finding 4 routed to
  [resolve-source-incoherence.md](../skills/workflow-specification-process/references/resolve-source-incoherence.md)
  and rendered `incoherence-gate --variant conflict` — numbered sides,
  one recommended, `Comment`. That branch's condition is *"a brief
  exchange settles it **and the sources document the sides**"*. An
  unsourced decision means no source decides it, so no source
  documents the sides; Claude constructed them. The branch was taken
  because none of the four fits an absence: nothing to measure, no
  supersession to derive, no documented sides. The only branch that
  genuinely applied was the gap exit, which pauses the spec entirely.

**Provenance.** The gap carve-out is collateral from #957
(`b08ef4f9`, 2026-08-20), whose subject was routing source-indicting
findings back to their owner. One line, added alongside the routing,
with a comment and a test but no design entry. Before it,
`finding_gate_mode: auto` meant auto for everything.

**The common cause.** All four trace to the same substitution: the
surface asks *what kind of finding is this* when the only question
that determines presentation is *who can answer it*.

## The contract

- **F1 — the shape follows the move owed, never the category.** Each
  finding carries the move explicitly: **settled** (the record admits
  one defensible answer), **choice** (real options exist and picking
  is the user's), **route** (nobody here can answer it; it goes back
  to the owning document). Category — `gap`, `enhancement`,
  `new-topic`, `duplication`, `unsourced-decision` — reverts to
  metadata in the tracking file and gates nothing. This is L1 of the
  lanes contract applied to a surface that never adopted it.

- **F2 — `finding_gate_mode` keeps its meaning exactly.** `gated`:
  every finding is shown and pauses before anything lands. `auto`: the
  pause is dropped for what Claude can decide. It is a control over
  *being stopped*, not over *being shown*, and it is not a batching
  switch. The default stays `gated`.

- **F3 — a choice always overrides `auto`.** This is the fourth member
  of the stays-gated family (Context Resurfacing, Reconcile Stale
  Sources, decision-worthy incoherence —
  [spec-side-coherence.md](spec-side-coherence.md)), and it joins on
  the family's own terms: membership is *a choice exists*, never a
  category. `auto` means "don't pause me for what you can decide"; it
  has never meant "decide what you can't". #957's carve-out reached
  for this and keyed on the wrong thing.

- **F4 — a finding is report-class content.** It leads with what is
  wrong in product terms and what Claude would do about it, in the
  register `CONVENTIONS.md:53` already prescribes for findings and
  which this surface never adopted. The walked lane's raise
  (`background-agent-surfacing.md`) is the model: a position with one
  load-bearing reason, a worked example where shape helps, one genuine
  question, the full case held back until the conversation asks.

- **F5 — artifact source is not the report.** A short `diff` keeps its
  fence — coloured, in place, readable. Whole-section `content` is
  never dumped. A `v/view` option renders the exact wording as
  markdown, per `CONVENTIONS.md:53`'s own clause: *"where a raw view
  earns a place, it is a separate `v/view` option rendering the record
  file as markdown."*

- **F6 — nothing is dismissed by menu.** `skip` is deleted from the
  gate, from both `process-review-findings.md` loops, and from the
  Resolution vocabulary. A found problem is settled, chosen, or
  routed. "Leave it" remains reachable as the *outcome of a
  conversation* through feedback — never as a one-keystroke exit past
  a known defect. This mirrors L5: deferral is the user's answer,
  never a lane the reviewer offers.

- **F7 — a settled finding carries its fix; a choice does not.** L8,
  restated for this surface. A settled finding must carry the call
  *and* what determined it, or it is not settled — it is a choice, and
  it stops. A choice finding presents options and proposes none as
  fait accompli.

- **F8 — classification promotes toward the user, never away.** L3.
  The move is re-derived at presentation time against the live
  session: a settled finding whose derivation no longer holds, or that
  Claude cannot itself stand behind, becomes a choice. Never the
  reverse. This is what keeps a misclassification cheap — one
  exchange, not a false menu or a stalled spec.

## Divergence from the lanes protocol

The lanes vocabulary and classification rules carry over; the
batching does not, and `auto` survives here where L3 argued it was
unnecessary. The two surfaces have different shapes for a reason:

`background-agent-surfacing.md` handles findings that *arrive
uninvited* mid-session, where volume is the complaint and the batch
is the remedy. The finding gate is a foreground pass the user entered
deliberately, one review at a time, where seeing each finding is the
point. L3's reasoning — that the one-way promotion rule makes an
auto-gate unnecessary — was argued for the batched case, where auto
would remove only the reading. Here it removes the stopping, which is
a thing the user has asked for and set deliberately.

So: no screens of five, no announce micro-menu, no `agent scan`, no
natural-break deferral. One finding at a time, as now.

## The stack

1. **The surface** — `render finding` leads with the report, stops
   dumping `content`, replaces `view full` with a rendering `v/view`,
   drops `skip`, and gives the menu a question for its label. A
   sibling options surface beside `incoherence-gate`'s conflict
   variant, without the quotes block: these sides are constructed by
   Claude, not quoted from colliding documents.

2. **The contracts** — `review-tracking-format.md` gains the move
   field and the two report fields; the five review agents (three
   specification, two planning) learn to write findings as reports and
   to classify by move. The bulk of the programme.

3. **The loops** — both `process-review-findings.md` files route on
   the move, lose their `skip` and `view full` branches, and stop
   re-rendering whole findings after feedback.

4. **The missing branch** — `resolve-source-incoherence.md` gains
   "settle it with the user now, where no source frames the sides":
   the case an unsourced decision actually is. Today it can only stall
   the spec or fake a conflict.

Prose cases alongside: a settled finding riding `auto`, a choice
stopping over `auto`, an unsourced decision taking the new branch.
Simulation re-pin where call sequences move.

## Decisions taken

- **`auto` survives, and its meaning is unchanged.** Ruled by the user
  2026-08-23 against the alternative of retiring it in favour of a
  batch: *"If the user hasn't set auto to true then all findings
  should be shown and pause before approval. That's the point. Lanes
  can be borrowed but the shape is different."*

- **No new category.** The move is a separate field. Adding a category
  to fix a shape problem is what #957 did; doing it twice would
  entrench the substitution this programme exists to remove.

- **Planning aligns.** Its payload never passed `category` at all, so
  its gaps have always ridden `auto` — an asymmetry nobody chose. It
  passes the same move field, and it needs the presentation fix
  regardless: `add-task` and `add-phase` findings take the same
  `content` dump path.

- **The claims agent's `Unreproducible → Gap/Ambiguity` mapping
  stands.** Under F1 it needs no category of its own: restate
  measurably, source it, or remove it is settled by definition, and
  where none of the three is obvious it is a choice. The rule handles
  both.

## Open decisions

- **`analysis-loop.md:269`'s skip is out of scope and stays.** It
  declines *work to build* — scope and appetite, legitimately the
  user's — where the finding gate's skip dismissed a defect in a
  document Claude is authoring. Same word, different job. It wants a
  rename (`d/decline`) so it stops reading as ignoring a problem;
  separate pass, different skill, different state.

- **Whether investigation review wants the same treatment.** The
  lanes programme left it open alongside specification; this one
  answers specification and planning only.

## Log

- 2026-08-23 — Programme opened. Evidence from a live portal
  specification review; four defects traced to one substitution;
  contract F1–F8 drafted against the lanes contract it inherits from.
