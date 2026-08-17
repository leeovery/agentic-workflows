# Task-Result Lenses — the task loop's report register

A register for the implementation task loop's report moments, derived
from the writing rules of ASD-STE100 (Simplified Technical English),
plus a third lens — show-me, diagram-based — alongside the existing
product and technical retellings. Scope: the task loop only. Every
other report surface keeps the shared lens pair unchanged.

## Motivation (2026-08-17)

- **The end-of-task summary is hard to parse.** Lee's standing
  complaint: after a task lands, the product-lens narrative — flowing
  paragraphs, subordinate clauses, process interleaved with outcome —
  takes real effort to absorb, task after task. Multiple attempts to
  simplify within the narrative register have not fixed it.
- **The A/B that settled it.** A live Folio task summary (~600 words
  of narrative) was rewritten under STE-derived rules with labeled
  sections: ~330 words, and Lee's verdict was "orders of magnitude
  easier to read... exactly what I want that summary to read like."
  About half the gain came from the sentence rules (one fact per
  sentence, active voice, no nesting), half from sectioning — the
  original interleaved product facts with process narrative. The
  design adopts both; neither alone suffices.
- **The summary is a gateway, not the record.** The old register
  pre-answers the questions the user might have — that is where the
  narrative depth came from. Every gate carries Ask/Comment and the
  technical lens, so depth is pulled, not pushed: the default
  summary optimizes for parse speed and question-formation, and what
  it defers sits one option away. The record files on disk stay
  fully technical and authoritative, as today.
- **The dictionary is rejected; the rules are adopted.** ASD-STE100's
  controlled vocabulary (~900 approved words) cannot describe
  software and is not the point. Its writing rules are: short
  sentences, one fact each, active voice, one name per thing,
  explicit cause and effect, vertical lists, labeled sections.

## Scope: the task loop, and why the line sits there

The cone of collaboration already grades the phases: discovery widest,
implementation and review agent-led. **The register applies where the
cone is narrow — mechanical, report-and-loop moments — and never where
it is wide.** That one sentence derives the scoping:

- **In**: the task loop's report moments — the task brief (stage A),
  the fix-round findings summary (stage E), the result summary and its
  lenses (stages F and G). All task-loop internal; there is no
  conversation there to protect. Settled 2026-08-17: E is included —
  the whole loop speaks one register.
- **Out, deliberately**: the review phase's presentation
  (`present-review.md`), investigation signoff, background-agent
  finding surfacing in discussion/research, the analysis loop
  (Step 7), the consolidation pass (stage J), and ad hoc plan
  changes. These keep `product-lens.md` / `technical-lens.md` or
  their own shapes unchanged. They are candidates only after the
  task loop has produced evidence about which rules carry the value;
  a findings-specific variant, if any, is designed then — not now.
- **The shared lens pair is untouched.** `product-lens.md` and
  `technical-lens.md` are shared with review presentation and
  investigation signoff; this feature removes the task loop from
  their consumer list and changes nothing in either file.

Register placement follows the standing rule: presentation only.
Agent reports (executor SUMMARY, reviewer ISSUES/NOTES), cache files,
fix-tracking files, and every artifact on disk stay fully technical —
the register governs what the session composes for the user to read,
never what agents write or what lands in the record.

## The register

One reference file owns it:
`skills/workflow-implementation-process/references/report-register.md`
(name provisional). Implementation-local on purpose — promotion to
`workflow-shared/` happens if and when a second consumer arrives, and
the filesystem answers "is this global?" until then.

### Rules (STE-derived)

1. **One fact per sentence.** A sentence states one thing. Target
   under ~20 words; never nest a second fact in a subordinate clause.
2. **Active voice, named actor.** "The reviewer re-ran the suites",
   never "the suites were re-run".
3. **One name per thing, reused verbatim.** No elegant variation —
   the thing introduced as "the history" stays "the history".
4. **No narrative framing.** No "worth knowing", "on the way",
   "three things". Facts sit under their section label instead.
5. **Labeled sections; lists for parallel facts.** Enumerations go
   vertical. A section with nothing to say is omitted, never padded.
6. **Cause and effect explicit, in order.** "The preview rebuilds its
   DOM after each structural edit. That rebuild destroyed the
   browser's undo stack."
7. **Numbers stay exact.** Measurements, counts, versions — as
   measured, with their conditions.
8. **Audience carries over from the lens being spoken.** The product
   lens translates codebase-internal names; the technical lens uses
   real names with `file:line`.

### Boundary rule

The register governs **report blocks only** — the brief, the findings
summary, the result summary, the retellings. Conversational turns
inside the loop — Ask answers, comment exchanges, blocker discussion —
follow `voice.md` as everywhere else. Engine-emitted `DISPLAY`/`MENU`
sections sit outside both, byte-for-byte, as today. This line is
stated in the reference itself; scoping by load keeps the register
out of discussion sessions, and this rule keeps it out of the loop's
own conversational moments.

## The lenses

Three lenses on one delivered task, all under the register's rules.
The default is the product lens; `t` and `s` are retellings fetched
on demand at the gate, which re-emits after each.

### Product summary (default — stage G)

Fixed section vocabulary, so every task reads the same. Sections
render in this order; empty ones are omitted:

- **Before** — what this part of the product did before the task.
- **Now** — what it does now. The behaviour, as bullets when the
  facts are parallel.
- **Decisions** — calls made during the task that shape the result,
  each with its grounds in a sentence.
- **Fixed on the way** — bugs found and fixed inside the task's
  scope, cause and effect stated.
- **Watch** — what the executor or reviewer flagged and left:
  known limits, unrecorded costs, platform gaps.
- **Tests** — what proves it: counts, suites, independent probes,
  known unrelated failures.

After a fix round, a **Changed since last gate** section leads.
When comment corrections were applied (stage D), a one-line note
follows the sections, naming any that were dropped — as today.

Sources: the executor's report, the reviewer's report and notes, the
fix history, and the diff — not the executor's SUMMARY alone (2–5
lines; the current prose names it as the sole source, which is
thinner than what the session actually holds).

The existing four-beat instruction (before / now / issues on the way
/ anything to watch) maps onto Before / Now / Fixed on the way /
Watch — the beats survive as sections; the register replaces the
narrative that carried them.

### Findings summary (stage E)

Per issue, in order of severity: what is wrong, the risk it carries,
the proposed fix — each a labeled short block, one fact per sentence.
The alternative or the reviewer's confidence appears only where it
changes the call (as today). Non-blocking notes: one line each.

### Technical retell (`t` — both gates)

The same item decomposed from the code's side:

- **Structure** — the files/modules touched and each one's role.
- **Flow** — the runtime path as ordered steps, real names,
  `file:line` anchors.
- **Decisions** — the same calls as the product lens, with their
  technical grounds.
- **Costs and invariants** — measurements, complexity notes, what
  must stay true.

Fidelity as `technical-lens.md` defines it today: a retelling, not a
summary — every substantive point of the record appears; the record
file stays authoritative. On the fix gate, the same decomposition
applies to the findings (mechanism of each issue, where it sits).

### Show me (`s` — both gates)

The mechanism as a picture. New option wherever `t` exists in the
loop: on the task gate it diagrams what was built; on the fix gate,
where the findings sit in the flow.

- **Form**: ASCII diagrams in a plain code fence — topology,
  dataflow, sequence, or state, chosen for the mechanism at hand.
  One caption line above each diagram. A short legend only when a
  symbol is not obvious.
- **Width**: diagrams stay under ~60 columns. Prose cannot know the
  terminal width, and a fenced block never reflows — narrow is the
  only safe shape.
- **Hand-drawn is correct here.** The "displays are engine-rendered"
  rule kills hand-drawn *state* displays, which drift from the state
  they mirror. A show-me diagram is judgment content about the code
  just built — the engine has no view of it, and there is no state
  to drift from. It is conversational content in a fence, like the
  diff excerpts the loop already shows.
- **Escalation**: after the diagrams, one line offers an interactive
  browser artifact when the harness provides an artifact surface
  ("Want this as an interactive page?"). Declined or unavailable:
  nothing — the ASCII stands alone. The offer never leads; the
  diagrams are the deliverable.
- After the lens, the gate re-emits its menu — same shape as `t`.

## Touch points (edge enumeration)

Prose:

- `task-loop.md` prelude (line 29): the `product-lens.md` load
  becomes the `report-register.md` load; same sentence structure —
  register for the brief in A, findings and result summaries in E
  and G.
- `task-loop.md` E (both threshold branches): "product-lens summary"
  instruction becomes the register's findings-summary instruction.
- `task-loop.md` F `#### If technical` and G `#### If technical`:
  drop the `technical-lens.md` load; the retell follows the
  register's technical section, already loaded.
- `task-loop.md` F and G: new `#### If show` branches — compose per
  the register's show-me section, then return to the gate.
- `task-loop.md` G: the four-beat instruction becomes the sectioned
  product summary.
- `display-task-brief.md` (line 21): "product-lens register" in the
  `summary` field description becomes the report register. Brief
  content is otherwise unchanged — a sentence or two already
  complies.
- `display-task-result.md`: untouched (header surface only).

Engine:

- `domain/projections/tasks.cjs`: `taskGateSection` and
  `fixGateSection` each gain `cmdOption('s', 'show', …)` between
  `t/technical` and the prompt options. Wording at implementation
  time; the task gate's describes diagramming the result, the fix
  gate's the findings. No letter collision (menus hold y/a/t + Ask/
  Comment; the auto-splice in `fixGateSection` is positional —
  verify the index survives the insertion).

Docs:

- `CONVENTIONS.md` §Presentation Register: one sentence added — the
  implementation task loop's report moments follow
  `report-register.md` in place of the lens pair.
- `voice.md`: untouched. The register pointer runs one direction
  only — `report-register.md` names `voice.md` for the loop's
  conversational turns; a file loaded into every session never
  names a phase-local register.

Tests:

- `tests/scripts/test-engine-tasks.cjs` and
  `test-engine-render-surfaces.cjs`: gate menu pins gain the `s`
  row.
- `test-pipeline-simulation.cjs`: render-surface audits re-pinned
  where they assert gate menu content.
- Prose cases `implementation-executes-the-loop` and
  `implementation-loops-on-auto` reference the gate menus — check
  `assert.md` expectations; regenerate snapshots only if an engine
  change moves a world (menu text alone does not).
- `npm run typecheck` for the engine change.

Context refresh: the register load lives in the `task-loop.md`
prelude, which the recovery protocol re-walks when the loop resumes —
no recovery-list change needed. Verify at implementation.

## Not prose-testable — judged in live use

Register compliance is display-only content; prose cases cannot
assert it (no hook evidences text put on screen). The deterministic
fallout above is the whole regression net. Whether the register
holds — and whether narrative drift creeps back — is judged by
reading real task summaries. First live use is the review point for:

- rule-level value (which rules carry the gain — the bet: one fact
  per sentence and no narrative framing do most of it, the word cap
  least),
- register bleed into Ask answers and whether it matters,
- whether the findings variant for the deferred surfaces should
  exist, and what it keeps.

## Stack plan

1. **PR1** — this design doc.
2. **PR2** — `report-register.md` + the prose rewiring (task-loop,
   display-task-brief) + the CONVENTIONS/voice touches. The loop
   speaks the register; lenses are product + technical.
3. **PR3** — show-me: the engine menu option on both gates, the
   `#### If show` branches, the register's show-me section, engine
   test updates.

## Decision log

- 2026-08-17 — Rules adopted, dictionary rejected. (Lee + Claude,
  from the Folio A/B.)
- 2026-08-17 — Scope: task loop only; cone-of-collaboration line.
  Review phase, investigation, discussion surfaces deferred pending
  evidence. (Lee.)
- 2026-08-17 — Stage E included: the whole loop speaks one register.
  (Lee, on recommendation.)
- 2026-08-17 — Show-me ships in v1, on both gates — lenses stay
  symmetric with `t`. ASCII first-class; browser artifact is an
  offered escalation, never the default. (Lee, on recommendation.)
- 2026-08-17 — Register doc is implementation-local
  (`workflow-implementation-process/references/`), promoted to
  shared only when a second consumer exists. (Lee.)
- 2026-08-17 — Subagent-composed summaries rejected: the session
  holds the arc (plan intent, fix history) that a summarizer agent
  would lack, and the loop has no conversational register to
  protect. (Lee + Claude.)
- 2026-08-17 — voice.md stays untouched: register pointers run
  local → global only. Nothing global — loaded or named in every
  session's context — references the task loop's register. (Lee,
  at review.)
