# Render Surfaces — moving menus and complex output into the engine

Design log for the render-surface programme. Long-lived branch, PR'd early,
merged when the programme lands. Dated entries append; decisions are edited in
place only to mark them superseded.

## Motivation (2026-07-21)

The engine campaign codified the *navigation* surfaces — start, continue-*,
the epic dashboard, map-view all emit engine-rendered DATA/DISPLAY/MENU
sections verbatim. The *phase-internal* surfaces — approval gates, findings
loops, task gates, resume gates, confirmation lines — remained prose templates
the model assembles at runtime. Two production incidents on Portal showed the
cost:

- **Planning task-list gate**: the prescribed display is a code block with
  one-line task summaries and comma-separated edge cases. The model emitted
  markdown instead of a code block and poured the task designer's full
  implementation detail into the overview — nine lines of argv arrays where
  one summary line belongs. Nothing enforces the shape, so the shape drifts.
- **Findings frame**: the `╭─ Finding … ─╮` boxed frame renders with a border
  that stops short of the content width — prose cannot compute widths.

The principle, per Lee: *menus and complex outputs are not rendered by the
LLM. Code produces structured content; the LLM blindly copies it to the
terminal.* Judgment decides; code renders.

## Census (2026-07-21)

Mechanical enumeration of every rendering-instruction-preceded fence in
`skills/`: **473 menu/display sites** — 296 templated, 177 static (plus 86
markers and 111 signposts, which are chrome, out of scope). Extraction script:
render-census.cjs (session scratchpad; re-runnable).

Key finding: **most "dynamic" content is already persisted at render time.**
The templates' own placeholder annotations say "from tracking file", "from the
planning file", "from task detail file"; validation surfaces reference their
cache paths. Genuine this-turn judgment payloads are rare.

### Surface families

| Family | ~Sites | Data source | Contract |
|---|---|---|---|
| Select/validate/display (continue-* ×5) | 30 | engine state | address (folds into clone-family factory) |
| Bridge continuations (×4 types) | 14 | manifest phase status | address |
| Resume gates (shared + inline variants) | 10 | file existence + manifest markers | address |
| Findings/approval loops (process-review-findings ×2 near-identical, analysis-approval-gate, spec-construction) | 35 | cache tracking files + gate modes | address |
| Task gates (define-tasks, author-tasks, analysis-loop, review-actions-loop) | 25 | task content + gate modes | **payload** (task content lives in markdown — never parsed) + address (gate mode) |
| Agent-verdict surfaces (validations, task review, task-graph) | 15 | agent output → cache | address after persist-first flip |
| Transaction confirmations ("Cancelled X", ⚑ warnings) | 45 | the engine response itself | fold into transaction verbs |
| Entry validation/error blocks | 35 | manifest state | address |
| Conversational judgment (openers, briefings, session prompts) | 50 | model synthesis | **stays prose** |
| Static menus/confirms | 88 | none | see Decisions |

## The contract

1. **Address-backed by default — JSON state only.** `engine render <surface>
   <work_unit>[.<phase>[.<topic>]]` reads manifest and cache (JSON). The
   engine **never parses markdown artifacts** to populate a render — markdown
   scraping is error-prone and forbidden (same rule as migrations vs the field
   surface).
2. **Payload for judgment content and markdown-held content.** Claude writes
   JSON to the phase cache dir with the Write tool (no shell quoting), passes
   `--file <path>`; the engine validates loudly per-field (the
   `--proposed-file` precedent) and renders. Scalars may ride as flags.
3. **Persist-first.** If a flow shows-then-persists JSON-representable state,
   flip the order and render from the address; never invent a payload for
   state that should exist.
4. **Gate modes render inside the surface.** A surface whose menu is
   gate-mode-coupled reads the mode from the manifest at the same address and
   returns either the menu or the auto-proceed line — the model no longer
   branches on mode.
5. **Output shape**: the existing demarcated-section contract —
   `=== DISPLAY ===` emitted verbatim as a code block, `=== MENU ===` verbatim
   as markdown. No new emission rules for skills to learn.
6. **One builder.** Every surface renders through shared primitives in
   `domain/projections` (menu, dot frame, callout, key, boxed frame). Boxed
   frames compute borders from content width — fixing the findings-frame
   defect by construction. Restyle in one place. *(Superseded for artefact
   content by D8 — the fence is the frame; boxedFrame retires in stage 6c.)*

## Layering

- `domain/projections/surfaces.cjs` — the primitives (pure functions,
  byte-golden tested).
- `domain/render.cjs` — the surface catalogue: named surfaces mapping
  (address, payload) → sections. Documented in the engine SKILL.md.
- `engine render <surface> …` — the single CLI noun for shared surfaces.
- Skill gateways keep skill-specific surfaces (select/display family — the
  clone-family factory), built on the same primitives.
- Transaction verbs absorb their own confirmation lines (existing
  labelled-section pattern, extended).

## Decisions

- **D1 (2026-07-21)**: Pilot surfaces are `resume-gate` (address-backed,
  7 consumers via the shared reference) and `task-list` (payload + gate-mode
  absorption — the Portal incident case). Agreed with Lee.
- **D2 (2026-07-21)**: Markdown artifacts are never parsed by render surfaces
  (Lee). Task/finding content reaches the engine as parameters at authoring
  time or from JSON cache written at persist time.
- **D3 (2026-07-22, decided (a))**: static menus stay prose. The 83 static
  menus (conclude gates, y/n confirms, mode choices) carry none of the
  failure class the programme kills — no placeholder to misfill, no state to
  drift from — and their grammar sits under conventions-lint checks 3–5.
  Full purity would be ~30 catalogue entries of fixed text: surfaces earned
  by nothing. Agreed with Lee.
- **D4 (2026-07-22, landed #501)**: the templated-fence ratchet —
  conventions-lint check 13. The census scanner counts templated
  menu/display fences per file against a pinned map (174 sites / 81 files at
  landing); drift fails both directions, so no new templated fence lands
  silently and every conversion shrinks the map. Markers/signposts are
  chrome, out of scope; static fences always fine.
- **D5 (2026-07-21)**: task-shaped displays use the subsection grammar — name
  line, `·`-glyphed wrapped summary, `· Edge cases` header owning a flat
  wrapped tree; continuations never fall to column zero (Lee, from the A′
  mock). Multi-phase displays (phase-structure approval, plan summary,
  task-graph view — stage 3) render as trees: numbered phase nodes with
  task/goal children, same primitives, one visual grammar.
- **D7 (2026-07-21)**: **one task, one call.** A flow must never prescribe a
  long run of sequential engine calls for one logical operation: Claude will
  always try to one-line repetition (shell variables, functions, python,
  `&&` chains) and those improvisations are where the failures live — the
  fumi harvest aliased 24 `discovery-map add` calls into `$E add …` and every
  call died on zsh's no-word-split (exit 127; PR #494 tried a prose guardrail
  in never-loaded authoring docs and was closed as the wrong layer). Where a
  task is N-ary, the engine offers the batch form (payload file, validated
  loudly, one lock, one commit — atomic, unlike a sequential run that can die
  mid-way leaving partial state). Canonical.
- **D8 (2026-07-22)**: **the fence is the frame.** Artefact demarcation for
  the *user* mirrors the demarcation system for the model: content outside a
  fence is narration; content inside a fence is artefact. The TUI's code
  fence is the native container — adaptive width (re-flows on resize),
  background tint, and syntax colour — and it dominates hand-drawn box
  glyphs, which commit to a fixed width the engine cannot know (stdout is a
  pipe; the render happens later in the user's TUI, so terminal width is
  structurally undetectable — resize shatter is unfixable for walls).
  Consequences: `boxedFrame` retires; diff-bearing artefacts render as
  ` ```diff ` fences (colour is keyed on `+`/`-` at column 0 — a left wall
  kills it, and ANSI cannot transit the model path), with space-prefixed
  context lines showing the insertion point; prose artefacts render in plain
  fences; surfaces carrying fenced artefacts emit in markdown mode (the mode
  menus already use) with meta as markdown. The only widths that remain are
  the conservative pre-wraps (72) we already bake in. Agreed with Lee from
  the Portal finding screenshots (enclosed-frame prototype rejected after
  the colour constraint and narrow-terminal shatter surfaced).
- **D6 (2026-07-21)**: assembly idioms live in `projections/surfaces.cjs` —
  the sanctioned middle layer between the mechanism kernel and per-surface
  projections that the campaign's two-layer doctrine lacked (which is where
  the five dot-frame copies accumulated). The dot-rule literal is pinned to
  one module by a single-source invariant test; the callout idiom is
  structurally single-sourced (no mechanical invariant — inline ⚑ headers
  make a content grep false-positive-prone).

## Staged plan

1. **Primitives + `engine render` + pilots** — surfaces.cjs, render.cjs, the
   noun, `resume-gate` + `task-list`, consumer swaps (shared
   resume-detection.md; define-tasks.md), byte-golden tests. Proves the
   contract end-to-end.
2. **Findings/approval family** — unify the two near-identical
   process-review-findings copies; analysis-approval-gate; spec-construction
   gates. Boxed-frame fix lands user-visibly here.
3. **Task gates** — author-tasks, analysis-loop + review-actions-loop
   (byte-identical task displays today), plan-construction's twin gate.
4. **Bridge + continue-*** — merges with the clone-family consolidation
   ledger item (same files, same factoring).
5. **One-call operations (D7) — MOVED out of this stack** (see log entry:
   #495 closed; census-first batching programme runs after the stack lands).
   Original scope for reference: — `discovery-map add-batch {wu} --file
   <topics.json>` (the harvest persists atomically in one call; the
   confirm-and-persist swap); **cache purge at work-unit close** (settled
   design: `workunit complete`/`cancel`/`absorb` remove
   `.workflows/.cache/{wu}/` wholesale — disk-only, reactivation-safe); and
   the **call-chain audit** — sub-agent sweep for every prose site
   prescribing long runs of sequential engine calls, each fixed with a
   batch form, not a warning.
5b. **Call-chain audit results (2026-07-21, two sub-agent sweeps)** — to scope
   with Lee. Audit A found 15 further repeated-engine-call sites; worst by
   multiplicity: (1) specification-entry analysis-flow.md reconcile step 7 —
   nested manifest set fan-out (proposed specs × grouping members); (2)
   planning resolve-dependencies.md — nested topics × external deps, set
   pairs per match; (3) planning author-tasks.md G — per-task task_map set +
   per-task git commit across a whole plan (highest real-run volume); (4)
   sequence-discovery-map.md — 2×N manifest gets per live topic (summary is
   already in the discovery dump; description could ride too — a #488-style
   read fold). Also: analysis-approval-gate per-candidate adds,
   brief-synthesis per-brief gets/sets, consult-reference per-ref sets
   (spec session-setup + spec-construction), review-actions per-plan
   reopen/set/commit, map-operations per-name edits, drain-triage per-entry
   discussion-map adds, read-plans per-plan gets, summary-backfill per-item
   sets, process-review-findings per-id task_map writes, topic-splitting
   per-topic creates. Audit B (shell constructions) found three clusters:
   multi-stage read pipelines whose stdout must be hand-carried into agent
   dispatch (implementation invoke-analysis, review invoke-task-verifiers /
   invoke-review-synthesizer); dynamic `git add -- … {format task storage
   paths}` argv assembly (11 sites — invites `git add -A` improvisation);
   and read-value-then-paste restart flows (planning + scoping SKILL.md).
   Fix shapes: batch verbs for the write fan-outs, dump/read folds for the
   get runs, and possibly an engine commit extension for the dynamic-path
   git adds. Prioritise with Lee before building.
6. **Entry validation + transaction folds.**
6c. **Artefact fences (D8)** — retire `boxedFrame`; `finding` and
   `proposed-task` move to markdown-mode emission: meta as markdown, the
   artefact in a fence (` ```diff ` from the payload's context/diff fields,
   plain fence for prose content); goldens and the single-source invariants
   updated. Slots before the sweep so stage 7 audits the final form.
7. **Static sweep + closing lint** — re-cut after the classification census
   (2026-07-22: five parallel classifiers over the 192 remaining templated
   sites; totals: state-render 62, chrome 71, judgment 20, hybrid 20,
   artefact-echo 19; agreed with Lee):
   7a. **Transaction-fold stragglers** — topic complete (×5 prose sites) and
      discovery-session close (×1) fold their kb warnings as sections.
      (Census correction: the three map-operations blocks first grouped here
      are pre-transaction proposals, not confirmations — moved to 7d's
      preview family.)
   7b. **Existing-surface swaps** — ~10 sites onto resume-gate / revisit-gate
      / phase-completed / entry-gate; the four identical continue-*
      "Completed" blocks onto one shared section.
   7c. **D3 + D4 land** — D3 decided (a): the 83 static menus stay prose
      (nothing to derive, nothing to misfill; grammar already linted).
      D4 as a ratchet lint: any NEW templated menu/display fence fails the
      suite; the remaining class-3 sites ride a pinned allowlist that only
      shrinks. Census recorded here.
   7d. **New-surface families → post-stack programme** (census-first, beside
      batching): spec-entry confirm-* ×8, dependency trees, legacy-split
      JSON blocks ×6, absorb preview, map-operations proposals, ~15 singles.
      Chrome (71) stays prose — earned-surface rule; judgment/artefact-echo
      sanctioned by doctrine.

Each stage is a stacked PR; stack driven per the pr-stacked skill
(author → chain PR bases → `safe-stack sync` → review → `safe-stack merge`).

## Log

- 2026-07-22 — STACK LANDED: #490–#501 squash-merged to main in order
  (safe-stack; one transient GitHub mergeability failure at #500 recovered
  by restoring #501's PR base to the git chain and resuming). The
  render-surface programme's in-stack scope is complete. Remaining scope
  lives in 7d (post-stack, census-first): the conversion families, the
  batching programme, and the cache purge.

- 2026-07-22 — Completeness sweep (Lee: "everything left is intentional?"):
  the templated population was already fully classified by the census +
  pinned by the ratchet, so no re-classification. Three blind spots checked
  mechanically instead: (1) instruction-less plain fences (141 — all
  model-facing by design: skill payloads, agent return formats, commit
  templates); (2) indented rendering instructions — 3 sites the column-0
  anchor hid from census AND ratchet (incl. the supersede warning); trigger
  fixed, sites pinned; (3) cross-file byte-duplicate static fences — 3
  groups (the confirm-* Proceed menu ×9 across 5 files, the "Understood.
  Continue…" display ×4, the review menu twins ×2) — static drift class,
  rides the 7d confirm-* family conversion.
- 2026-07-22 — End-of-stack logic-trace review (Lee's path-solidity gate
  before landing): two mechanical traces (44 render call sites vs catalogue —
  clean; 102 prose section-name references vs emitters — clean) + six agent
  slices (planning resume incl. reader/writer field parity, review/scoping,
  spec-entry gates, finalise/session folds, engine-diff correctness,
  test adequacy), findings adversarially verified. Confirmed and fixed on
  #501: two ratchet holes (diff-form instruction trigger; narrow placeholder
  class), plan-variant phase-only anchor, promoted_to guards, pivot warning
  instruction, orphaned JSDoc; coverage added for the CLI boolean-flag path
  (--own/--paths), the pipeline-banner matrix, the no-sections inverse
  guard. Everything else traced clean. Banked for 7d: topic supersede
  warning fold (spec-completion renders it manually — correct today, same
  class as 7a).
- 2026-07-22 — Stage 7c up (#501): D3 decided (static menus stay prose), D4
  landed as the templated-fence ratchet (check 13, 174 sites pinned across
  81 files, shrink-only). The in-stack programme is complete: stack runs
  #490–#501; remaining conversion work (7d families) moves to the
  post-stack census-first programme beside batching and the cache purge.
- 2026-07-22 — Stage 7b up (#500): the existing-surface swaps. resume-gate
  becomes the resume-menu family (--variant plan/review/scoping/session —
  position, coverage, and marker state all derived engine-side); entry-gate
  --own renders specification's own superseded/promoted terminals;
  phase-completed --paths carries scoping's conclusion; the four continue-*
  "Completed" blocks ride the workunit complete --pipeline banner. Ten prose
  sites deleted.
- 2026-07-22 — Stage 7a up (#499): topic complete + discovery-session close
  append DISPLAY: kb warning; six prose blocks deleted. Classification
  census run and recorded (stage 7 re-cut as 7a-7d, agreed with Lee).

- 2026-07-22 — Stage 6c up (#498): boxedFrame retired. finding's diff is one
  ```diff-fenced section (the frame-open/diff/frame-close sandwich gone);
  prose content renders as a code block; spec-construction's resurfacing
  borders and the twins' frame-rules wording swapped; CONVENTIONS.md carries
  the fence-is-the-frame rule; a retirement invariant pins box glyphs out of
  skills/ entirely. Suite 1516/1516.
- 2026-07-22 — D8 settled (the fence is the frame) from Lee's Portal finding
  screenshots: a fully-enclosed box was prototyped (side rails, padding,
  verbatim-aware width) and rejected on two structural constraints — diff
  colour needs `+`/`-` at column 0 (walls kill it; ANSI can't transit the
  model path) and terminal width is undetectable engine-side, so fixed-width
  walls shatter on narrow terminals while fences re-flow. Diff presentation
  kept deliberately (add/remove polarity + context either side is the right
  reviewer format at the highest-stakes approval moment). Stage 6c slotted
  before the sweep.
- 2026-07-21 — Census run (473 sites), families table drawn, contract and
  layering agreed in session with Lee. Portal incidents recorded as
  motivation. Doc branch opened; stage 1 begins.
- 2026-07-21 — Stage 1 up (#490): surfaces primitives, `engine render`
  catalogue, resume-gate + task-list pilots, consumer swaps. Lee's review
  drove the subsection grammar (D5), surfaced the assembly-idiom duplication
  (D6 — four projections adopted, byte-identity by golden pins), and the
  boxed-frame width fix landed in the primitive. Option grammar became
  builders (cmdOption/promptOption/rangeOption) with a third single-source
  invariant; 22 legacy literals converted.
- 2026-07-21 — Stage 2 up (#491): finding + findings-summary unify the two
  near-identical process-review-findings references; diff frame ships as
  three sections so ```diff colouring survives; frame borders computed from
  content, capped at 100 so a border never wraps. Banked separately: cache
  purge at work-unit close (design settled).
- 2026-07-21 — Stage 3 up (#492): proposed-task (analysis + review loops'
  byte-identical twins unified; gate mode as a flag — mode ownership differs
  per consumer), tasks-overview, author-task-gate, phase-tree (D5 delivered;
  define-phases gains shaped output), task-list --variant existing for
  plan-construction's twin gate. Stack synced: main → #490 → #491 → #492.
  Remaining: stage 4 (bridge + continue-* = clone-family), stage 5 (entry
  validation + transaction folds), stage 6 (static sweep + D4 lint).
- 2026-07-22 — Five-dimension stack review (parity, flow logic, conventions,
  code correctness, test adequacy) over #490–#496; all findings fixed on
  #496: pivot menu opt-in (reroute derail), pipeline banner folded into
  workunit complete --pipeline (double-confirmation gone, pipeline-complete
  surface retired), selection zero-guard + blank line + stale-dump rule,
  loud-validator holes closed, conventions callout for warnings, absorb H4,
  stale doctrine paragraph, grammar carve-out, CLI-boundary subprocess
  suite. Command-prelude rule codified (decisions before the fence).
- 2026-07-22 — Stage 6b up (#497): entry-gate (prerequisite verdicts derived
  engine-side — planning/implementation/review/specification state machines;
  validate-spec and validate-source collapse to one call each), phase-note
  (entry one-liners), selection not-found on the view snapshot. The surface
  census families are now all codified; stage 7 (static sweep + D4 lint)
  closes the programme.
- 2026-07-21 — Stage 6a up (#496): transaction confirmation sections —
  workunit complete/cancel/reactivate/absorb/promote/pivot and topic
  cancel/reactivate carry their own confirmation and kb-warning sections
  (pivot also its continuation MENU); six references swapped. Inbox
  confirmations deliberately excluded (titles are markdown-held — D2);
  they fall to the static-sweep decision. Stage 6b (entry validation)
  next; then stage 7 (static sweep + D4 lint).
- 2026-07-21 — Stage 5a (#495) built and CLOSED unmerged: built backwards.
  add-batch was implemented from the one known site before the audit results
  were folded in (census-first is this programme's own discipline), and the
  unrelated cache purge was conflated into the same PR mid-stack. Lesson
  recorded. Batching returns AFTER this stack lands as its own census-first
  programme: classify all 16 audited sites (batch verb / dump fold /
  structural), design the general batch contract (payload shape, validation,
  atomicity, response), agree with Lee, then implement — the harvest
  add-batch re-cut as one instance of the contract. Cache purge ships then
  too, as its own standalone PR (design settled; code recoverable from the
  closed #495 branch history or recut).
- 2026-07-21 — Stage 4 up (#493): selection projection (one composition,
  five type configs — the clone-family factory for the select step; all five
  gateways append deferred selection sections, select-*.md templates gone);
  five work-unit-addressed bridge surfaces (pipeline-complete,
  phase-completed, early-completion-gate, revisit-gate, epic-all-done-gate);
  titlecaseLabel promoted to conventions. Bare work-unit addressing joins
  the grammar. Stack: main → #490 → #491 → #492 → #493.
