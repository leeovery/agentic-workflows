# Phase 17 — Entry UX & Inception Unification (Exploratory Design)

> **Naming note:** This doc was written before the inception → discovery rename. Every mention of "inception" below refers to what is now called the **discovery** phase. The doc is left as-written (historical capture of the design conversation); read with the substitution in mind. Do not edit for terminology.

**Status:** Exploratory — **nothing decided yet**. Design needed before any implementation. · **Depends on:** Phase 16 (this phase sits *after* the current initiative completes — possibly as the seed of a successor initiative, possibly as the closing phase of this one).

## Heads-up — this phase doc is different

The other phase docs in this initiative captured already-settled design and listed what ships. **This one captures an ongoing design conversation that has not been decided.** The phase number is reserved so the thinking doesn't get lost, not because the work is queued. When work eventually starts, this doc will probably either:

- get rewritten into a proper "what ships" phase doc once the design lands, or
- get split into multiple ship-able phases, or
- get absorbed into a successor initiative with its own design surface (`discovery-map/` was the planning home for the inception/map work; this might warrant a sibling directory).

Treat this as a planning surface, not an implementation plan. Read it as *"here's the thread of conversation that surfaced these questions"* and pick the discussion back up from where it left off.

**The direction described here may change completely before the final design takes shape.** What looks like "the latest landing" right now is just the latest pause in an evolving conversation — not a commitment. Every refinement so far has narrowed *or* widened the scope of change, and the next refinement may do either again. Do not implement anything described in this doc.

---

## How we got here — the journey

The conversation started inside Phase 12 review and snowballed. Worth preserving the path because each step's reasoning informs the next.

### The trigger

Phase 12 dropped the `e`/`explore` open-mode menu in research-entry. During cleanup, the question came up: *"does the `source: import` branch in research-entry still make sense?"* Answer: yes, it's still load-bearing for the start-feature import flow. But that question opened the door to a broader one — *how does the import flow actually work post-Phase-8, and does it still make sense at all stages?*

### The feature-import shape problem

Tracing the current import flow surfaced an asymmetry:

- **Epic imports** go through inception, which actively reads the import bytes, synthesises tentative topic shapes from the content, and lets the user curate into a multi-row discovery map. Multi-topic seed material gets properly decomposed.
- **Feature imports** go straight to research with a blank file. The session is hard-bound to a single topic (`{work_unit}`). Imports are KB-indexed and surface as relevant chunks during the session, but there's no decomposition. If imports span multiple topics, 80% of it might be wasted (chunks tagged to the work_unit but conversationally orphaned).

Inception got the proper *"read + synthesise + decompose"* treatment in Phase 4+. Feature imports got "drop into KB and start cold." That asymmetry was identified as a real UX hole.

### The project-level imports idea

The user proposed a high-level import facility that sits *above* any individual work unit — shared reference material (architecture docs, design principles, retros) that any subsequent epic/feature could draw on via KB retrieval. Confirmed the current implementation stores imports strictly at `.workflows/{work_unit}/imports/` (work-unit scoped, no leakage). So no bug; but the high-level facility is genuinely interesting and worth considering.

Agreed to defer to its own phase. Mechanics roughly:

- Store at `.workflows/.imports/` (mirrors `.inbox/` namespace)
- KB-index under a `project` identity so any work-unit's contextual query naturally pulls from project + own imports
- New `/workflow-import` capture skill for adding files outside any pipeline
- Surface a "N project-level imports available" note when starting new work units

Open questions: lifecycle (when do they expire?), conflict resolution (same filename across project and work-unit?), management surface.

### The classifier extraction idea

For the feature-import scope problem, an early proposal was to extract the classify-routing logic that inception already runs per-topic into a shared reference (`workflow-shared/references/classify-routing.md`) and have start-feature invoke it after import. Single source of truth, both code paths use the same classifier.

### The "should inception itself do this?" reframe

The user pushed back on the extraction: if we're extracting inception's classifier, maybe inception should be the home for the logic, not have it pulled out. *"Inception" semantically means the beginning — the conception, the act of incepting. That applies whether you're decomposing 10 topics or confirming a single feature scope.* This led to the proposal that **inception extends to features** (and cross-cutting), running in a single-topic-confirmation mode that includes a pivot-to-epic offer if the imports look multi-topic.

This was the first big architectural shift. Key implications:

- Inception's "epic-only" gate disappears. Manifest CLI's `phases.inception` validation extends to feature and cross-cutting.
- Features get a degenerate one-row "discovery map" — `phases.inception.items.{feature_name}` with `routing: research` or `discussion`.
- start-feature routes through inception. The `r`/`d`/`i` menu in research-gating disappears — inception handles routing.
- discussion-entry gains a `source=import` branch (currently doesn't exist) so the feature-import-routed-to-discussion path can hand off cleanly.
- Bugfix/quickfix still skip inception (constrained by design — no research-vs-discussion split).
- The discovery map render stays hidden for non-epic work units (a one-row map adds no value).
- Refinement is epic-only (a one-row map has nothing to refine).

### The universal start reframe

Once inception was extending to features, the next question naturally arose: *if inception is the curatorial entry for epics and features, what about the case where the user doesn't even know what work type they're starting?* Currently the user has to pre-classify by picking `/start-epic` vs `/start-feature` vs `/start-bugfix` etc. — but in practice ideas often arrive un-classified.

Proposal: **inception becomes the universal entry**. A new top-level "ambiguous start" option in `/workflow-start` routes to inception without a pre-set work type. Inception classifies first (epic / feature / bugfix / quickfix / cross-cutting), then proceeds with the appropriate flow.

The user's reported behaviour validated this: *"I literally never use /start-feature directly — I always go through /workflow-start"*. That suggests the upfront work-type decision is friction the user routinely doesn't engage with.

### The conversation-first reframe

The user took it a step further: rather than asking the user to classify upfront *at all* (even in workflow-start's menu), the entry could be **dialogue-first**. The user just describes what they want to build; Claude asks probing questions when needed, classifies naturally, names, and routes — all in one continuous conversation.

This is the most radical of the proposals. It would mean:

- The `f`/`e`/`b`/`q`/`c` menu options in workflow-start may collapse to a single "start something new" option
- All entry classification happens conversationally inside inception
- start-* skills become structurally vestigial unless explicitly preserved

### The latest landing (still tentative — all of this may shift)

> **Reminder:** every bullet in this section is provisional. Reviewing this doc in the future, do not treat any of it as committed direction. The shape may change completely before the final design lands.

The user's most recent refinements:

- **Keep the start-* skills** as routing units (don't delete them) — they do real work (gather context, name, manifest creation, optional import collection, route to first phase)
- **Make them non-user-invocable** — add `disable-model-invocation: true` (or similar) so they only fire via internal routing from workflow-start
- **`/workflow-start` becomes the sole user-facing entry point** — everything else is model-only
- workflow-start gains an `s`/`start` option alongside the existing `e`/`f`/`b`/`q`/`c` for the "I don't know what this is yet" case
- The `s`/`start` option routes to inception directly without a pre-set work_type; inception classifies and routes onward
- The pre-committed options keep doing what they do today (route to their respective start-* skills which then call inception for the curatorial pass)

This preserves the existing flow architecture while consolidating the user experience.

### Refinement: brand-new-work entry vs within-epic direct-entry are different cases

A second-pass refinement narrowed the scope of what Phase 17 actually changes. There are two distinct "no-topic" cases that look similar at first but solve different problems:

**Brand-new-work entry** — the user runs `/workflow-start` and wants to start something fresh. They don't yet know if it's an epic / feature / bugfix / quickfix. They may have imports that need decomposition. **This is where inception's classifier earns its keep** — the whole point is figuring out shape.

**Within-epic direct-entry** — the user is already inside an epic, browsing its discovery map via `/continue-epic`, and picks `r`/`research` or `d`/`discuss` to add a fresh topic. They already know what work unit they're in, what kind of work they want (research vs discussion), and have a topic name in mind. **Routing through inception's classifier here would be friction** — shape is already known.

These shouldn't get conflated. If Phase 17 (whatever form it takes) preserves the within-epic direct-entry path, then a chunk of skill-level structure persists that the original sketch implied would collapse:

- continue-epic's `r`/`research` and `d`/`discuss` menu options stay
- research-entry's no-topic-epic branch stays (load-bearing for the above)
- discussion-entry's no-topic-epic branch stays (same)
- workflow-bridge's "Start new research" / "Start new discussion" routing rows stay (same use case from bridge continuations)

What may still collapse or change:

- The `r`/`d`/`i` menu in start-feature/start-cross-cutting research-gating — may be replaced by inception classification on the `s`/`start` path, but might persist for explicit `f`/`feature` invocations
- start-* skills become non-user-invocable (per the previous landing)
- workflow-start gains the `s`/`start` option

So the **scope of "things Phase 17 changes" is narrower than the original sketch implied**. Inception classification only enters at brand-new-work time. Within-epic direct-entry remains a fast path that bypasses classification entirely.

Whether this scoping holds, or further refinement narrows / broadens it again, is open. The pattern of "inception is the brand-new-work classifier; existing within-work paths preserve their fast-path UX" is one plausible landing among several.

---

## Open structural questions — none of these are decided

### Flow architecture

- **Does inception duplicate start-* logic, or do start-* skills get inlined into inception for the `s`/`start` path?** With two entry paths converging on inception, either inception re-implements the gather-context / name-check / import-collection logic, or those pieces get extracted into shared references that both paths use.

- **When does manifest creation happen on the `s`/`start` path?** Today it's in start-* Step 2 (name + conflict check creates the work unit). On the ambiguous path, inception has to do this mid-session, after classification but before whatever curation produces. The work unit doesn't have a name or a work_type until inception decides them.

- **Mid-flow pivot mechanics.** If the user picked `f`/`feature` from workflow-start and inception decides "this looks like an epic", does inception abandon the in-flight work and re-invoke start-epic? Or does it just flip `work_type` in the in-flight manifest and continue? The latter is cleaner but means start-* can never assume its work_type is stable.

- **Import flow ordering.** start-epic does import *before* inception (Step 3 collect-import). With inception driving the `s`/`start` path, import happens *inside* inception (the user might mention "I have some files" partway through). Two orderings of the same operation, depending on entry path. Either we standardise (import always inside inception, even for pre-committed paths) or we accept divergence.

- **The "naturally classifies" UX itself.** The conversation pattern needs design — what questions does Claude ask? When does it commit to a classification vs keep probing? When are pivots offered? When does naming get proposed? When are imports invited? These are the meat of the inception session loop in the new model and need a deliberate flow design, not just principles.

### Surface-area decisions

- **Should the `e`/`f`/`b`/`q`/`c` menu options stay in workflow-start, or collapse to just `s`/`start`?** The latest landing keeps both. The most-radical conversation-first proposal collapses them. Either is defensible — depends on whether power users want the fast-path shortcut for cases where they already know.

- **Bugfix/quickfix on the `s`/`start` path.** If inception classifies as bugfix or quickfix, what does it do? These work types don't have inception phases by design. Options:
  - Short-circuit: name + create manifest + immediately invoke `/start-bugfix` (or scoping for quickfix)
  - No-op: inception just classifies, hands off all subsequent work to the appropriate start-* skill
  - Or: bugfix/quickfix can't be reached via `s`/`start` (the user has to know they want one upfront, picks `b`/`q` from the menu) — but this re-introduces upfront classification

- **Cross-cutting on the `s`/`start` path.** Same question. Cross-cutting is a small, system-level shape. Does inception ever classify something as cross-cutting from a fresh prompt, or does that always need to be a deliberate user choice (`c` from workflow-start)?

- **Project-level imports — this phase or its own?** Originally captured as a separate concern (a project-level `/workflow-import` capture skill, `.workflows/.imports/`, KB indexing under a project identity). Could ship independently of the inception unification work, but the import flow overlaps enough that doing them in the same design pass might make sense.

### Mechanical questions

- **discussion-entry needs a `source=import` branch.** It currently doesn't have one. If inception classifies routing for feature imports and picks discussion, we need a clean handoff. Small addition (skip redundant context-gathering questions, seed the discussion file with the appropriate framing) — but it's not in the current code.

- **Manifest schema for non-epic work units with inception items.** Today `phases.inception` is validated as epic-only by the manifest CLI. Extending to features and cross-cutting requires schema changes + a migration for existing in-progress features (or a "leave alone, only new features get inception" policy).

- **The "naming after classification" sequencing.** Today the suggested name comes from the user's description in start-* (after Step 1's gather-context). With inception driving the `s` path, naming has to happen *inside* inception after classification. That logic (`name-check.md`) probably needs to become a shared reference.

- **`disable-model-invocation: true` on start-*.** What does it actually do, mechanically? Currently `workflow-start` has it. Need to verify it produces the intended effect (model can't directly invoke; only `/`-prefixed user invocation triggers it). For start-* skills the intent is the inverse: model-only invocation, no `/`-prefixed user invocation surfaced. The flag name and semantics need verifying.

### Migration and backwards compatibility

- **Existing in-progress features** have no inception phase. If inception extends to features, either we leave them alone (only new features go through inception) or migrate them retroactively (give each existing feature a one-row inception item with the work_unit name and inferred routing). The former is simpler.

- **Existing direct invocations of `/start-feature`, `/start-epic` etc.** If these skills become non-user-invocable, any user who's used to typing them directly gets blocked. Probably fine if the user reports they never invoke them directly — but worth a deliberate decision before disabling the surface.

- **Stacked initiative.** This work happens *after* the current discovery-map initiative completes (Phases 1–16). It touches files those phases also touch (inception-entry, inception-process, start-*). Whether it's the closing phase of this initiative or the seed of a successor — TBD.

---

## What is explicitly NOT decided

Listed bluntly so no later reader assumes any of these are settled:

- Whether to extend inception to features at all
- Whether to introduce an `s`/`start` "ambiguous start" option
- Whether to remove or make non-user-invocable the start-* skills
- Whether to go full conversation-first (no menu at all) or keep the menu with a new option
- Whether to add a project-level imports facility
- Whether all of this is one phase, several phases, or a successor initiative
- The classifier UX design
- Manifest schema decisions for features-with-inception
- Migration policy for existing in-progress features
- Naming and timing of all related skill changes
- Whether within-epic direct-entry paths (continue-epic `r`/`research`, `d`/`discuss`) survive unchanged, get routed through inception, or get reshaped some third way
- The actual scope of change — what persists, what collapses, what new pieces appear

The conversation has clarified the *direction*, identified the *constraints*, and surfaced the *open questions*. None of the proposals has been signed off. **A subsequent round of discussion could reshape the entire thing.**

---

## Out of scope — separate concerns

These came up during the conversation but are clearly their own things, not part of this design:

- **`workflow-explorer.html`** — already excluded from every phase of the initiative per the project-wide note in INDEX.md. Stays out.
- **Legacy `exploration.md` files** — already handled by Phase 11 migration. No change here.
- **The existing pivot-to-epic / feature-to-epic absorption flows** — already exist, not being redesigned. Inception's pivot prompts would *use* the existing absorption mechanism, not replace it.
- **Bugfix and quickfix internal flows** — these are constrained-shape pipelines that won't change. The only question is how they're entered (from workflow-start, possibly via inception classification).

---

## Next steps

1. **Land Phase 12** (PR #277) and the stack ahead of it. None of this design conversation has shipped on any branch.
2. **Decide whether this lives as Phase 17 in the current initiative or as the seed of a successor initiative.** If successor: create `inception-unification/` (or similar) as a sibling directory with its own `design.md` and phase docs. If Phase 17: keep it here, but it's a larger phase than the others by a wide margin and probably wants splitting anyway.
3. **Settle the open structural questions above** through further discussion — likely several conversations. The decisions cascade (e.g., "do start-* stay?" gates several mechanical questions downstream), so the order of decisions matters.
4. **Once the design lands, replace this doc** with a proper "what ships" phase doc (or set of phase docs). The journey-and-open-questions content here is temporary; it captures the path, not the destination.

The phase number (17) is reserved. The slug is TBD. The branch name is TBD. Everything else is up in the air.

---

## Current Design (2026-05-29 onward)

This section captures the design as it crystallises through ongoing discussion. The journey above is historical context for how we got here — read it for the path that led us here, but treat what follows as the live working surface.

We're running this in the spirit of a real discussion process (Discussion Map, lifecycle states, per-subtopic documentation) but without manifest writes or workflow-skill invocation. This project authors the workflow system; we can't dogfood it for design work on the system itself.

**Naming note 2:** Beyond the earlier inception → discovery rename, this section drops the "Inception" label entirely. Discovery absorbs the role that the original Phase 17 sketches imagined for a separate Inception phase. The word "inception" stays unused in the workflow phase taxonomy from this section forward.

### Discussion Map

```
Discovery as universal entry              [decided]
├─ Macro/micro routing structure          [decided]
├─ Cross-worktype symmetry                [decided]
└─ Shape vs content guardrail             [decided]

Discovery loop mechanics                  [decided]
├─ Opener shapes across worktypes         [decided]
├─ Shape-detection heuristics             [decided]
├─ Routing-confirmation mechanism         [decided]
└─ AskUserTool integration                [decided]

Pivot mechanics                           [decided]
├─ Macro pivot triggers                   [decided]
├─ Scope-down + inbox surface             [decided]
└─ Reasoning surfacing                    [decided]

Imports & inbox handling                  [decided]

Entry surface design                      [decided]
├─ /workflow-start menu                   [decided]
├─ start-* future                         [decided]
└─ continue-* mirror question             [decided]

Migration & cutover                       [decided]
```

State key: `pending` (not yet discussed), `exploring` (active discussion), `converging` (narrowing toward decision), `decided` (locked in this pass; future refinements may revisit).

> **2026-05-31 refinement passes.** After the first implementation attempt (see post-mortem at the foot of this doc), six same-day refinement passes were appended at the end of this doc — read **all six before implementing**; where they differ from the sections above, they govern:
> - **Refinement pass — universal loop & resolution order** refines **Cross-worktype symmetry**, **Shape-detection heuristics**, **Routing-confirmation mechanism** (loop *length* → depth = f(unknowns); gather-then-resolve-in-order).
> - **Refinement pass II — funnel entry, deferred persistence & the landing** resolves the entry architecture (workflow-start → discovery directly; start-\* dissolve), deferred persistence (confirm is the single trigger), and the post-confirm landing — revising **start-\* future** (no separate bootstrap skill) and the manifest-timing assumptions in **Migration & cutover**.
> - **Refinement pass III — imports vs inbox & the discovery→first-phase carrier** sharpens **Imports & inbox handling** (same-at-read / distinct-at-persist) and adds the discovery→first-phase seed-carrier contract.
> - **Refinement pass IV — path inventory (acceptance spec)** — every new-work entry path with expected behaviour, universal invariants, the must-not-regress checklist, and Step-0/bridge survival. The implementation acceptance gate.
> - **Refinement pass V — PR shape & sequencing** — three stacked PRs (schema → funnel → continue-* lockdown), held until all done, merged bottom-to-top; legible commits, never squashed.
> - **Refinement pass VI — Discovery as the umbrella entry skill** — the **authoritative architecture**: discovery is *one* umbrella skill (collapses the entry/process pair) with two invocation modes; macro-confirm is the durability boundary; `continue-epic` delegates refinement to discovery; uniform persistence (no epic special-casing); the engine/cutover split is discarded. **Supersedes the entry/process framing in earlier passes and the structural work-items in the PR scope briefs.**
>
> The universal-entry decision itself is unchanged. **Plus, at the very end: "PR scope briefs"** — the per-PR work-item references a fresh plan-mode session loads to plan PR1/PR2/PR3, with a status tracker at the top.

---

### Discovery as universal entry [decided]

**Context.** The original Phase 17 sketches treated "inception" (now discovery) as a specialised epic-only phase we'd extend. After the inception → discovery rename, the word "inception" was free again, and we considered reintroducing it as a separate classifier phase between workflow-start and start-*. The question was whether to introduce that separate phase or to make Discovery itself the universal entry.

**Journey.** We considered three handoff models for connecting a separate Inception classifier to Discovery:
- **A.** Inception writes a draft Discovery session log; Discovery's existing resume mechanism picks it up.
- **B.** Inception writes a structured seed to manifest; Discovery reads it on first invocation and skips its own opener.
- **C.** Re-merge them into one continuous flow.

(A) had appeal because it reused the existing resume mechanism — no new wiring. But on reflection it was solving a problem created by the artificial split. (B) was cleaner data-modelling but worse continuity. (C) was conceptually clean but felt like undoing the rename's separation.

Then the framing changed: "Discovery just IS the universal first step regardless, and handles macro routing before micro routing." That collapsed the question — no separate Inception skill, no handoff seam, no continuity problem. The classifier conversation IS the opening of the Discovery conversation; they're not two things glued together.

**Decision.** Discovery is the universal first step for all brand-new work. The word "inception" stays unused in the workflow phase taxonomy. Discovery's role expands beyond epic-only topic curation to include shape detection for all work types.

---

### Macro/micro routing structure [decided]

**Context.** Discovery now handles two distinct routing levels: *what kind of work is this* (epic / feature / bugfix / quickfix / cc), and for work types with per-topic routing decisions, *how to handle each topic* (research vs discussion).

**Decision.** Two routing levels stack inside one continuous Discovery conversation:

- **Macro routing** — shape detection. *"What kind of work is this?"* Applies to all work types. Pre-seeded by user's menu choice from workflow-start, OR inferred conversationally by Claude when the entry is via `/start`.
- **Micro routing** — topic-level routing. *"For this topic, research or discussion?"* Applies to epic / feature / cross-cutting (the work types that have a research/discussion split in their pipelines). Does not apply to bugfix or quickfix — those pipelines are constrained-shape and don't carry a research/discussion choice.

The conversation transitions from macro to micro naturally as shape settles. For epic/feature/cc, the conversation continues into topic synthesis with micro routing per topic. For bugfix/quickfix, the conversation produces a brief intent capture and routes out — no micro routing applies.

---

### Cross-worktype symmetry [decided]

**Context.** Should Discovery look meaningfully different across work types, or share most of its structure?

**Journey.** First instinct was to design mode-specific conversation shapes (epic mode does decomposition, feature mode does single-topic confirmation, bugfix mode is brief and routing-focused). On reflection, that introduced unnecessary variance. The exploration loop is the same regardless of work type; only what gets produced at the end differs.

**Decision.** Discovery's conversation pattern is **largely the same across all work types**. Same opener pattern (read seed material if any, ask the user to describe what they want), same exploration discipline (open questions, no premature decisions, listen for shape signals), same shape-watching behaviour.

What differs by work type:
- **What synthesis produces at endpoint** — multi-row map for epic, single-row map for feature/cc, brief intent capture + routing decision for bugfix/quickfix
- **What pivot heuristics watch for** — feature mode watches for "this is multi-topic, suggesting epic"; epic mode watches for "this is actually one topic, suggesting feature"; bugfix mode watches for "this is new behaviour, not a bug"; etc.

There's no "epic mode" vs "feature mode" vs "bugfix mode" as distinct conversation shapes. There's one Discovery conversation with shape-detection and shape-appropriate synthesis at endpoint.

The discovery-guidelines reference grows from "epic curatorial moves" to "shared core + per-mode pivot watchpoints" — likely implemented as a shared core reference plus small mode-specific overlays. Implementation detail; comes later.

---

### Shape vs content guardrail [decided]

**Context.** Discovery in the old (epic-only) form was structurally constrained from "doing research" or "making decisions" by its specific role of curating topics. With Discovery becoming universal and running for bugfix/quickfix too, this constraint needs to be explicit — otherwise the conversation could drift into symptom analysis (bugfix mode), architecture talk (feature mode), or thread-pulling (epic mode).

**Decision.** Discovery handles SHAPE; downstream phases FILL the shape. Hard rules:

- Discovery does not do **research** (no investigating market/tech/feasibility — research phase does that)
- Discovery does not do **investigation** (no symptom analysis, reproduction, root-cause hunting — investigation phase does that)
- Discovery does not do **decision-making** (no resolving design questions, no choosing between options — discussion phase does that)
- Discovery does not do **scope work** (no spec content, no plan content)

What Discovery DOES:
- Name the work unit
- Figure out shape (macro routing)
- Curate topics + per-topic routing (micro routing) where applicable
- Read seed material (imports, inbox content) and use it to shape the conversation, NOT to extract substantive content
- Capture intent in the journey record

The discipline is recognising the difference between *"this is shaping up as a bugfix"* (Discovery's job) and *"the bug is probably in the session middleware"* (Investigation's job). Discovery makes the routing call; downstream does the work.

This guardrail applies regardless of work type. It's the most important constraint on Discovery's behaviour.

---

### Imports & inbox handling [decided]

**Context.** Today's import flow is per-work-unit, collected at start-* time, copied to `.workflows/{wu}/imports/`. Inbox items live at `.workflows/.inbox/{bugs,quickfixes,ideas}/`. Different mechanisms for similar purposes.

**Decision.** Both are seed material with the same handling pattern in Discovery:

**Imports** are read at Discovery's opener (across all work types). Interpretation is mode-specific:

- Epic-mode: imports drive topic decomposition
- Feature/cc-mode: imports inform single-topic shape; multi-topic content triggers epic-pivot offer
- Bugfix-mode: imports are reference material (logs, error reports, prior tickets) — read for context, not analysed for content (would violate the shape vs content guardrail)
- Quickfix-mode: similar — reference material

**Inbox items** are similar to imports but with an implied classification hint from the source folder:

- `.inbox/bugs/` → pre-seeds macro routing as bugfix (still pivot-able)
- `.inbox/quickfixes/` → pre-seeds macro routing as quickfix (still pivot-able)
- `.inbox/ideas/` → no pre-seed, Claude classifies from content
- Inbox selection routes through Discovery via the `/start` path (or user picks `i`/`inbox` from `/workflow-start` menu, which still ends up in Discovery)

Inbox content drives Discovery's opening exploration the same way imports do — Claude reads the content, sketches what they're picking up, asks targeted questions to confirm shape and uncover detail.

**Mechanism: same as today's epic import flow, just extended across work types.**

---

### /workflow-start menu [decided]

**Context.** `/workflow-start` is the user-facing universal entry. Today's menu has `f`/`feature`, `e`/`epic`, `b`/`bugfix`, `q`/`quickfix`, `c`/`cross-cutting`, `i`/`inbox`, `v`/`view`. Phase 17 needed to decide whether to keep these, add a new option, or collapse them.

**Decision.** Keep the existing menu structure with one addition:

- **`e`/`epic`, `f`/`feature`, `b`/`bugfix`, `q`/`quickfix`, `c`/`cross-cutting`** — fast paths for users who know what they want. Pre-seed Discovery's macro routing. Discovery still runs (for micro routing, topic surfacing, and pivot opportunity).
- **New: `s`/`start`** — unknown-shape entry. Routes to Discovery with no work_type pre-set. Discovery classifies macro shape during exploration.
- **`i`/`inbox`** — stays. Routes to Discovery via `/start` (or the inbox-item's pre-classified path) with inbox item as seed material.
- **`v`/`view`** — stays. Completed/cancelled work units.

Even when user picks a work-type fast path, Claude may suggest a pivot during Discovery (e.g. *"looks more like an epic"*). User controls the final call; Claude proposes and explains reasoning.

---

### Opener shapes across worktypes [decided]

**Context.** Discovery's first turn shapes the entire conversation. With Discovery becoming universal across work types, we needed to decide whether the opener is one universal sentence or varies by entry path. First instinct was a single universal opener for cross-worktype symmetry, but that produces awkward phrasing (asking *"what's on your mind"* to someone who picked `/bugfix` from the menu is bizarre — they already told us a thing is broken).

**Journey.** Landed on a model that holds the symmetry rule at the *pattern* level while letting the *specific text* phrase itself appropriately. Worked through three judgement calls along the way:

1. Should the opener pre-announce that Discovery is "shape-figuring, not problem-solving"? **No** — discipline shows through behaviour. Pre-announcing the process is annoying for repeat users. Claude redirects deep dives when they happen (*"hold that thread — we'll cover it in [research / discussion / investigation]"*) rather than caveating upfront.
2. Should workflow-start announce the handoff to Discovery? **Yes** — the workflow already has signpost conventions for phase boundaries (step markers + signpost blockquotes). Discovery's entry uses the same pattern. The signpost gives the user a clear *"we're moving into Discovery now"* moment.
3. For `/start` entry (no pre-seed), should the opener acknowledge that explicitly? **Yes, lightly** — naturally folded into the question itself (*"we'll figure out the shape together"*). No need for a separate caveat.

**Decision.** Discovery's opener has four elements, applied in sequence:

1. **Phase signpost** — workflow-start → Discovery boundary marked via the established step-marker + signpost-blockquote convention. One sentence indicating what's about to happen. The signpost text may carry shape-appropriate framing (e.g. for `/start`: *"figuring out what kind of work this is, then the details inside it"*; for `e`/`epic`: *"setting up the epic — we'll pull on shape before naming topics"*). Same convention as the rest of the workflow.

2. **Seed-material acknowledgment** (when imports or inbox content is present) — Claude reads the seed material and surfaces a brief sketch of what was picked up. Sketch first, then the opening question. Pattern matches today's epic-mode opener:

   > Read your import(s). Here's the shape I'm picking up:
   > 
   >   {one-line summary}
   >
   > {targeted opening question}

3. **Opening question, shape-appropriate** — phrased per work_type pre-seed (or fully open for `/start`). The PATTERN is universal across entry paths and work types; the SPECIFIC TEXT varies for conversational naturalness. Sketch (illustrative, not final wording):

   | Entry path | Opening question |
   |---|---|
   | `/start` | *"Tell me what's on your mind. I'll ask open questions and we'll figure out the shape together."* |
   | `e`/`epic` | *"Tell me about the epic. I'll ask open questions to pull on it before we synthesise topics."* |
   | `f`/`feature` | *"Tell me about the feature."* |
   | `b`/`bugfix` | *"What's broken?"* |
   | `q`/`quickfix` | *"What's the change?"* |
   | `c`/`cc` | *"Tell me about the cross-cutting concern."* |
   | inbox | (after reading the inbox item) *"I've read your {bug/idea/quickfix}. Here's the shape I'm picking up: {sketch}. {targeted question}."* |

4. **No pre-announce of process discipline** — Claude doesn't preamble *"we're in setup mode, not problem-solving."* Discipline is enforced by behaviour (open exploratory questions, no commitments, redirects on deep dives). The user finds out *what* Discovery does by being in it; they don't need a meta-explanation upfront.

The pattern is universal. The text varies for naturalness. Cross-worktype symmetry is preserved at the structural level — same opener stages, same conversational discipline, same pivot availability.

---

### Shape-detection heuristics [decided]

**Context.** Discovery needs to figure out what kind of work the user is bringing — feature, multi-feature initiative, fix, targeted change, project-wide pattern — and for the work types that have it, the per-topic routing decision (research vs discussion). This is the listening discipline that drives everything else in the loop. Two angles needed nailing: *what signals Claude listens for*, and *how it surfaces tentative reads to the user without dropping into workflow jargon*.

**Journey.** Started by sketching per-shape signal lists (bugfix-shaped vs feature-shaped vs epic-shaped, etc.) — concrete cues Claude would weight. Then hit a more important point: those bucket names (epic / feature / bugfix / quickfix / cc) are workflow internals. They mean nothing to a user who hasn't lived in the system. Saying *"this sounds like an epic"* assumes user vocabulary that often isn't there.

Reframed: we're not detecting *"which bucket does this fall into."* We're detecting **what kind of work the user is actually describing**, in plain terms. The bucket names are how we route internally; the shape language we speak with the user is something else.

The signals stay (substantively). The surfacing language flips.

Also worked through three structural points:

1. **Macro and micro signals co-emerge** — not sequential phases. A user describing *"operators do X, kitchen does Y, customers do Z"* surfaces BOTH multi-shape (macro signal) AND candidate topic seeds (micro signal) simultaneously. The macro/micro structure from the earlier subtopic is about routing OUTPUTS, not about loop sequencing. One loop, both signal flavours accumulating in parallel.
2. **Mid-loop surfacing** — Claude shares tentative reads as patterns clearly emerge, not silently accumulating to endpoint. User gets to push back while reads are still tentative, before momentum builds.
3. **The explicit shape question** — when shape questions are exhausted but ambiguity remains, Claude asks an explicit disambiguator (rather than continuing to fish, which would risk dropping into content territory).

**Decision.** Five elements:

**1. Signals are about substance, not bucket names.** Claude listens for plain shape-cues in the user's framing:

| Substance signal (what's being described) | Routes to internally |
|---|---|
| New behaviour not present today, single coherent scope, clear actors and flows | feature |
| Multiple distinct concerns from one description, multi-week / multi-phase shape, broader system-level reshaping, *"project"* / *"initiative"* framing | epic |
| System-wide concern affecting multiple work units, pattern / principle / strategy definition (*"error response shape"*, *"auth strategy"*, *"logging convention"*), no customer-facing deliverable | cross-cutting |
| Past-tense or present-broken descriptions, specific failure cases with reproducible conditions, error messages / stack traces in imports | bugfix |
| Imperative scoped changes (*"bump the timeout"*, *"rename X to Y"*, *"add a flag"*), one-shot adjustments without behaviour debate | quickfix |
| *"Not sure how"*, *"what's possible"* — could route research-shaped; descriptions that mix broken + new — could be bugfix-with-feature-followup | ambiguous — keep exploring |

These are illustrative first-pass cues; will be tuned via real use. Hardcoding them as a strict checklist risks Claude getting trigger-happy on weak matches.

**2. Surfacing language stays plain until commit.** When Claude shares a tentative read or asks for confirmation, it speaks in user-facing shape-terms:

| Internal (workflow lingo) | User-facing (plain shape) |
|---|---|
| *"This sounds like an epic"* | *"This sounds like several distinct things — more than one feature in scope"* |
| *"This is a feature"* | *"Sounds like a single coherent piece of work"* |
| *"This is cross-cutting"* | *"Sounds like a pattern or principle that affects the whole project — something to define, not something to ship as a feature"* |
| *"This is a bugfix"* | *"Sounds like something broken we're fixing rather than something new we're building"* |
| *"This is a quickfix"* | *"Sounds like a small targeted change — adjustment rather than a whole feature"* |

The bucket names only appear at the routing-commit moment (next subtopic), and even then framed naturally. Up until commit, everything is described in terms of what the user is actually doing.

**3. Confidence heuristics** — Claude is *"confident enough to surface"* when:

- **Multiple converging signals** point at the same shape (not just one weak hint)
- **User framing has been consistent** across multiple turns (not switching shapes mid-conversation)
- **Ambiguity has been resolved** — Claude has asked at least one explicit-shape question if needed, and the user's answer resolved it
- **Pivot signals aren't lit** — Claude isn't sitting on a competing shape's signals at the same time

Below this threshold, keep exploring.

**4. Mid-loop surfacing** — when patterns clearly emerge, Claude shares a tentative read mid-loop rather than holding to endpoint. Examples (illustrative wording):

- After several exchanges hinting at multiple concerns: *"I'm hearing a few distinct things — this might be more than one feature. Want to pull on that or stay focused?"*
- After enough scope clarity: *"Sounds like a single coherent thing, with the routing tendency I'm reading as discussion-shaped. Anything I'm missing?"*
- After a tangential concern surfaces: *"You mentioned X — that feels separate from what we're shaping. Surface to inbox for later?"*
- After topic seeds start clustering: *"I'm seeing menu-management and kitchen-printers as candidate topics. Sound right or wrong shape?"*

Surfacings are conversational — soft, easy for the user to redirect. Not every signal triggers a surfacing; only when there's enough to test against the user usefully.

**5. The explicit shape question** — when shape questions are exhausted but ambiguity remains. Trigger: the next natural question would drop into content territory (research, decision-making, investigation) and we'd be violating the shape-vs-content guardrail. Move: ask the user directly to disambiguate.

Examples (illustrative):

- *"Two readings here — this could be fixing something that's currently broken, or adding something new that doesn't exist yet. Which is closer?"*
- *"This is shaping bigger than a single feature — does it feel to you like one focused thing, or several connected things?"*
- *"This sounds like a small targeted change, but if it touches behaviour the user sees, we should treat it as a feature instead. How does it feel from your end?"*

These are the explicit disambiguators that prevent the conversation from looping forever and force a commit so we can progress.

**The hardest discriminations** are the pairs at the boundaries:

- **Single feature vs multi-feature** — *"is this one thing or several things stuck together?"*
- **Building vs fixing** — *"is the behaviour missing, or is the behaviour broken?"*
- **Quick targeted change vs feature vs bugfix** — *"is this a small adjustment, a new behaviour, or a fix?"*

These are where mid-loop surfacings and explicit shape questions earn their keep.

---

### Routing-confirmation mechanism [decided]

**Context.** Once the loop has accumulated enough signal, Claude needs to move from *"I have an opinion"* to *"we've committed"* — for macro routing (what kind of work) and, for the work types that have it, micro routing (per-topic research vs discussion). This is the commit moment. It needs to be informative (user understands the reasoning), bidirectional (user can override), and patient (we don't rush it).

**Journey.** Worked out the moment-of-commit mechanics, then realised the more important point was *when* the commit should happen at all. Early reads can be revised as conversation continues — an early *"feature"* read can become *"epic"* after more talking, and that's fine if we never committed early. The substance-focus discipline that keeps us in shape rather than content also keeps us patient on the commit: as long as Claude keeps the conversation on *"what are we doing"* rather than racing to *"which bucket,"* shape emergence is organic. Premature bucket-labelling pushes Claude to commit too early. Substance-labelling stays patient.

**Decision.** Five elements:

**1. State the read.** When committing, Claude says what the shape is in plain user-facing terms, with the workflow bucket name folded in naturally — not before. Example: *"This is feature-shaped — one focused thing to build. The routing tendency I'm reading is discussion since the shape is clear and the open questions are about trade-offs not unknowns."*

**2. Explain the reasoning.** Per the earlier principle, the user needs to be informed enough to agree or push back. Reasoning surfaces the signals that drove the read. Should be brief — one or two sentences — but specific enough that the user knows *why*, not just *what*.

**3. Invite confirmation or override.** Soft conversational invitation, or structured tool prompt, depending on confidence and stakes. AskUserTool fits cleanly here (see next subtopic).

**4. Honour user override authoritatively.** If the user pushes back, Claude takes their call as final. No re-litigation. If the user redirects to a different shape, Claude adjusts without needing further justification.

**5. Patience on the commit.** Even when signals have reached the surfacing threshold, hold off committing until:

- Signals have **converged AND been stable** across the last few exchanges (not just hit threshold this turn)
- Mid-loop tentative surfacings have been **confirmed or adjusted** by the user
- The natural next move would **drop into content** if we kept exploring — we've truly run the shape conversation as far as it can go without violating the shape-vs-content guardrail
- The user's framing has been **consistent enough** that we're not about to revert the commit in two turns

This is the same patience discipline as the surfacing threshold, applied one step later in the loop. Substance-focus enables it: stay on what's being built/fixed/changed, not on which bucket it lands in, and the commit lands when it's actually ready.

**Operational commit semantics:**

Once routing is committed:
- The committed shape is written to Discovery's session log (the journey record)
- Claude transitions into shape-appropriate output (topic synthesis for epic/feature/cc, brief intent capture for bugfix/quickfix)
- Pivots after commit are possible but expensive — they reset the synthesis. Claude treats post-commit pivots as deliberate redirects, not casual exploration
- For epic/feature/cc, the macro commit doesn't necessarily lock micro routing yet — per-topic routing commits happen during/after synthesis

The macro and micro commits can land at the same conversational moment (single-topic feature: *"feature-shaped, routing is discussion"*) or at different moments (epic: macro commit first, then per-topic routing commits during synthesis).

---

### AskUserTool integration [decided]

**Context.** AskUserTool provides structured user input (typed answers, menus, binary confirmations). The question was where it fits in Discovery's loop — given the loop is largely conversational, tool-driven prompts could feel mechanical if misplaced.

**Decision.** AskUserTool is used **where appropriate** — specifically:

- **NOT for mid-loop tentative surfacings.** Those stay conversational and soft (*"I'm hearing X — want to pull on that?"*). Tool prompts in the middle of an exploratory flow break the conversational rhythm without adding clarity.
- **OK for explicit shape questions** when implicit confidence is borderline. Quick binaries like *"is this fixing something or adding something new?"* can be cleaner as a tool prompt than as prose. Use judiciously — only when the disambiguation is genuinely binary and the user benefits from explicit framing.
- **YES for the committed routing-commit moment.** Structured confirm-or-override locks the call cleanly without ambiguity and matches the formality of a commit. The user sees the proposed routing, the reasoning, and structured options (confirm / override-to-{alternative} / discuss-more). This is the cleanest fit.

The principle: AskUserTool appears at structured decision moments, not during conversational exploration. The tool's clarity is its value at commit; that same clarity is its cost mid-loop.

---

### Macro pivot triggers [decided]

**Context.** When Claude is in Discovery with a pre-seeded or tentatively-converging shape, and signals start pointing at a *different* shape, Claude needs to raise the pivot. The question was: what specifically triggers raising a pivot, and how does it differ from the normal shape-detection flow?

**Decision.** The trigger pattern matches the regular shape-detection threshold (multiple converging signals, consistent framing, etc.) — just applied to the *competing* shape rather than the current one. Same patience discipline applies: don't pivot on a single weak signal; wait until the alternative shape has built actual momentum.

Specifics for each common pivot path (illustrative cues; tune via real use):

| Pivot direction | Cues |
|---|---|
| feature → epic | Multiple distinct concerns surface from what was framed as one feature; topic seeds start clustering into independent groups; user describes scope expansion mid-conversation |
| epic → feature | Synthesis converges on one coherent topic; "multiple shapes" never quite materialises; user keeps pulling back to one core concern |
| bugfix → feature | Described "broken" behaviour turns out to be missing-by-design rather than malfunction; user struggles to describe a working state before the bug |
| feature → bugfix | Described "new" behaviour is actually restoring something that should already work; user mentions regression or "it used to work" |
| quickfix → feature/bugfix | Scope discussion gets substantive; behaviour debate emerges; user starts describing how the change *should* work |
| any → cross-cutting | Described work turns out to be defining a pattern, principle, or strategy rather than shipping a feature; no customer-facing deliverable surfaces |

The pivot offer surfaces mid-loop as a tentative read (per the shape-detection mid-loop surfacing pattern). Plain language, not workflow jargon: *"This is shaping bigger than one feature — sounds like several connected things. Want to treat as a larger initiative made of multiple features?"* User confirms, declines, or redirects — Claude takes the call.

Pivot offers can fire multiple times in one Discovery session. Each one is a tentative surfacing, easy to push back on.

---

### Scope-down + inbox surface [decided]

**Context.** During Discovery for one work unit, Claude often notices a related-but-separate concern the user mentions in passing. Without a release valve, this would either (a) scope-creep into the current work unit, contaminating its shape, or (b) get lost entirely. We want a third path — surface to inbox for later, keep the current work focused.

**Decision.** When Claude notices a tangential concern that doesn't fit the current shape, it surfaces a brief offer:

> *"You mentioned X — that feels separate from what we're shaping. Surface to inbox for later?"*

If user accepts, the mechanism reuses existing inbox capture infrastructure:

- Inbox capture skill is invoked (`/workflow-log-idea`, `/workflow-log-bug`, or `/workflow-log-quickfix` — pick based on the tangential concern's shape; if uncertain, default to idea)
- File lands in `.workflows/.inbox/{ideas,bugs,quickfixes}/` per existing capture pattern
- Discovery's session log notes the surfacing as part of the journey record (so it's discoverable in the journey record even if the inbox file gets actioned later)
- Conversation continues with the original work, now without scope creep

The decision moment is conversational, not structured — soft surfacing, easy redirect. No AskUserTool needed.

If user declines (*"no, that's actually part of this"*), Claude folds the concern into the current work. The surfacing offer is the value-add either way — surfaces the question rather than silently scope-creeping.

---

### Reasoning surfacing [decided]

**Context.** Throughout the loop, Claude shares tentative reads (mid-loop surfacings) and committed routing offers (at the commit moment). Both require the user to be informed enough to agree or push back. The question was: how does Claude express reasoning so the user can engage with it meaningfully?

**Decision.** Two principles guide reasoning surfacing:

**1. Brief and concrete.** Reasoning names the specific signals that drove the read. Not *"based on the conversation"* (vague, unfalsifiable). Not *"because of multiple factors"* (no entry point for pushback). Instead: *"because you described X and Y as separate concerns and each came with substantive weight."*

Brief — one or two sentences. The point is to make the read auditable, not to defend it.

**2. Pull-on-able.** Reasoning surfaces in a way the user can challenge specific cues, not just accept-or-reject the whole conclusion. Saying *"because you described X and Y as separate concerns"* lets the user respond *"actually X and Y are the same thing — Y is just a subset"* — which Claude takes as an update to the read.

This is the difference between *"trust me"* reasoning and *"check my work"* reasoning. Discovery uses the latter.

The principle applies to:
- Mid-loop tentative surfacings (*"I'm hearing several distinct shapes — your descriptions of X and Y feel orthogonal. Want to pull on that?"*)
- Committed routing offers (*"This is feature-shaped — one focused thing with clear actors. Routing is discussion since you described the shape but flagged trade-off questions, not unknowns. Confirm or override?"*)
- Pivot offers (*"Sounds like several connected things rather than one — you've sketched menu-management, kitchen-printers, and operator-analytics as distinct concerns. Want to treat as a larger initiative?"*)

When Claude doesn't have enough signal to give pull-on-able reasoning, that's the trigger to keep exploring rather than surface a read — the read isn't ready yet.

---

### start-* future [decided]

**Context.** Pre-Phase-17, start-* are five user-invocable skills (one per work type), each handling: gather context, name + collision check, manifest creation, optional import collection, route to first phase. Post-Phase-17, Discovery has absorbed everything work-type-specific (the conversation, the classification, the import handling, the routing decisions). The question: do start-* skills survive as five thin wrappers, collapse into one shared utility, or disappear entirely?

**Decision.** **Collapse to one shared utility.** Post-Phase-17, what's left for start-* to do is identical across all five work types except for *which downstream phase to route to* — that's a parameter, not a separate skill. Five thin wrappers that differ only in routing target = duplication for no benefit.

Working name: `workflow-bootstrap` (or similar — TBD). Single skill, invoked by Discovery's terminal step with the resolved `work_type` and routing decisions. Its job:

1. Create the manifest with the resolved work_type + name
2. Copy imports to their final location (if not already there)
3. Route to the first phase based on work_type + micro routing

All three steps are work-type-aware via parameters, not via separate skills.

**Frontmatter:** `user-invocable: false`. The skill is model-only — Discovery invokes it internally; users never reach it directly.

---

### continue-* mirror question [decided]

**Context.** The question that paralleled start-*: does continue-* also collapse, or stay separated per work type? Different from start-* because continue-*'s resume logic varies meaningfully across work types — different displays, different menu options, different state aggregation. Also: Discovery doesn't have an equivalent absorber for continue-* the way it does for start-*.

**Decision.** **Keep five continue-* skills, all become `user-invocable: false`.**

Reasoning:

- **Resume logic genuinely differs by work type.** continue-epic shows the discovery map; continue-feature shows a single-topic phase tree; continue-bugfix shows investigation state and routes accordingly; continue-quickfix shows scoping state; continue-cross-cutting handles the terminal-at-spec case. Collapsing into one skill would mean a big conditional skill with five-way display/menu logic — that's a complexity *increase*, not a decrease.
- **No equivalent absorber.** Discovery handled all the work-type-specific *entry* logic that justified start-* collapse. There's no analogous *resume* mechanism in Discovery. Keeping continue-* per work type keeps that logic clean.
- **The user-facing surface isn't the load-bearing part.** Bridge invocations, absorb-into-epic invocations, and manage-work-unit invocations of `/continue-epic` all keep working (model-side invocation). The only thing that goes is the user-typed `/continue-bugfix auth-flow` direct invocation — which user behaviour suggests isn't load-bearing either (users go through `/workflow-start` to navigate to existing work).

**Result:** `/workflow-start` is the only user-invocable entry. For both new work (→ Discovery → bootstrap utility → first phase) AND continuing work (→ continue-* per work type, internally → phase routing), `/workflow-start` is the surface.

**Text migration that follows:**

Making continue-* model-only requires updating user-facing guidance text in a finite set of files:

- `workflow-start/references/active-work.md` — table currently maps actions to `/continue-*` slash commands; rewrite to direct internal invocation (user sees outcome, not command)
- `start-*/references/name-check.md` files with *"Run /continue-X to resume"* text → rewrite as *"Run /workflow-start to resume {work_unit}"* or equivalent
- `continue-cross-cutting/references/validate-selection.md` and similar → same treatment
- Any documentation surfaces that promise the `/continue-*` commands as user-typeable

Mechanical text updates, not architectural restructuring.

**Implementation note: Step 0 centralization opportunity.**

With `/workflow-start` as the only user-invocable entry, Step 0 (casing conventions, migrations, knowledge check, knowledge compact) no longer needs to be defensively repeated in every entry-point skill. The full Step 0 runs once at `/workflow-start`. But continue-* invocations from the bridge happen mid-session, so some Step 0 elements need to remain available at bridge time:

| Step 0 element | Needs to survive a bridge? |
|---|---|
| Migrations | No — idempotent and state-tracked. `/workflow-start` only. |
| Knowledge check | No — gates session at entry; once cleared, stays cleared. `/workflow-start` only. |
| Casing conventions | **Yes** — content authoring rules. Bridge to research/discussion/spec/etc. needs the conventions to author files correctly. |
| Knowledge compact | No — TTL-based decay at entry boundaries. `/workflow-start` only. |

Expected pattern (implementation detail, not a decision now):
- `/workflow-start` runs full Step 0
- Bridge invocations and continue-*'s own Step 0 are trimmed to the bridge-survival subset (casing + anything else identified later)
- Continue-* is no longer defensive about migrations or knowledge check — those are guaranteed to have run at `/workflow-start`

Net: real simplification of duplicated Step 0 content. Worked out concretely during implementation.

---

### Migration & cutover [decided]

**Context.** Phase 17 is a substantial shape change — Discovery becomes universal, start-* collapses, continue-* becomes model-only. The question was: what happens to existing in-progress work units, what's user-visible on upgrade, and what data migrations are needed?

**Key insight.** The change is **largely additive in terms of shape.** Existing in-progress work is past Discovery's entry point; their pipelines continue unchanged. Non-epic work types don't get a discovery map even under the new design — Discovery for feature/bugfix/quickfix/cc doesn't produce backfillable manifest state (no items, no per-topic curation manifest entries). The only Discovery artefact for those types is the session log itself, which only applies to *new* work going forward.

The biggest backfill problem (epic discovery maps for legacy epics) was already solved in Phase 11 via migration 038. That ship sailed and is already deployed.

**Decision.**

**1. Existing in-progress work units are untouched.**

They're past Discovery's relevance. They continue running through their pipeline as before. No discovery-related back-fill needed for non-epic existing work because Discovery for those types doesn't produce manifest state to backfill. For existing epics with `phases.discovery` already populated (from Phase 11), nothing changes — the structure is already there.

**2. Schema change is permissive, not destructive.**

The manifest CLI's `phases.discovery` validation currently rejects non-epic work types (epic-only). The change is to *allow* `phases.discovery` for all work types, not to *require* it. Existing non-epic work units don't have `phases.discovery`, and they don't need it added — they're grandfathered. New non-epic work units going forward will write the session log under `discovery/session-NNN.md` but won't populate `phases.discovery.items` (there are no items for single-topic work types).

No new migration script needed. The schema change is purely permissive validation.

**3. No deprecation period for start-\* / continue-\* slash commands.**

Release notes flag the change. Direct invocations of `/start-feature`, `/continue-feature`, etc. fail with the standard "skill not user-invocable" behaviour. Self-healing — users adjust on first encounter.

The decision rests on this codebase having effectively one user. A wider-user codebase might prefer a deprecation pattern (emit a *"moving to /workflow-start"* notice before proceeding), but the cost-benefit doesn't justify it here.

**4. Active user sessions during upgrade.**

Upgrades happen at-install-time (`npx agntc add ...`), not auto-pushed. Users explicitly upgrade between sessions. Mid-conversation upgrades aren't a real concern.

**What's user-visible on upgrade.**

For existing in-progress work:
- Continue exactly as before — pipeline runs through to the end
- No new discovery-map artefacts get created retroactively
- No prompts about Discovery
- The `/workflow-start` entry surface is still the way back in

For new work after upgrade:
- `/workflow-start` is now the only entry point (other slash commands fail)
- Picking any menu option goes through Discovery
- Discovery handles classification + curation + routing
- Users feel the new flow on first new-work invocation

**Summary:** the change is large in scope but small in disruption. Existing state is preserved; existing flows continue; new work goes through the new shape. No data backfill, no deprecation period, no breaking of in-progress sessions.

---

### Currently exploring / pending — to be filled

These subtopics are open. Captured here for tracking; will get Context / Journey / Decision sections as each lands.

- **Discovery loop mechanics** — what the conversation actually looks like across work types. Openers, exploration questions, shape-detection signals, routing-confirmation. *No arbitrary turn counts* — loop runs as long as needed to form a confident opinion. Currently exploring.
- **Shape-detection heuristics** — what cues does Claude read to commit to a macro shape? Same for micro routing. Tight guidelines on what's being shaped and why. Exploring.
- **Routing-confirmation mechanism** — when does Claude surface a routing proposal? Principles agreed: Claude must be confident before proposing, asks more questions if unsure, always explains reasoning so user can agree or push back. Mechanism details pending.
- **AskUserTool integration** — could be a clean fit for the explicit routing-confirmation moments. Pending exploration.
- **Macro pivot triggers** — what specific signals raise an epic-pivot offer, feature-pivot offer, etc.? Pending.
- **Scope-down + inbox surface** — when discussing one work, noticing a separate concern, surface to inbox rather than scope-creep into the current work. Principle agreed; mechanics pending.
- **Reasoning surfacing** — how does Claude explain why it's proposing a routing decision so the user is informed enough to agree/push back? Principle decided; convention pending.
- **start-\* future** — collapse to one shared utility or stay as five thin model-only wrappers. Exploring.
- **continue-\* mirror question** — does the start-* model-only move imply continue-* should also become model-only? Note that continue-* is currently user-invocable and load-bearing for user navigation back to existing work; the case for moving it to model-only is weaker. Exploring.
- **Migration & cutover** — what happens to existing in-progress work units, what's user-visible on upgrade. Pending.

---

This is the working design surface. Decided subtopics are locked in this pass but can be revisited if further discussion reveals problems. Exploring/pending subtopics get worked through as conversation continues.

---

## Implementation attempt — recorded observations (2026-05-30)

Factual record of the first implementation attempt. PR #306 was opened from `feat/phase-17-discovery-universal-entry` and subsequently closed without merging. All implementation changes were reverted from the branch; only the design-doc lock commits above remain.

### Implementation shape

- Implementation was structured as 7 stacked PRs (17a–17g) per a self-derived implementation plan.
- Once all 7 were open, they were flattened into a single PR (#306) via `git merge --squash` at user request. The squash bundled the implementation commits AND the 7 design-doc lock commits (the latter had not yet been merged to `main`).
- Multiple audit-fix rounds followed inside PR #306. Total commits between flatten and close: ~15.

### Regressions identified by audit (vs `main`)

Audit was performed by five parallel sub-agents tracing pre-Phase-17 → post-Phase-17 user paths.

**Epic path (`/workflow-start` → `e`/`epic`)**

- Pre-Phase-17 `start-epic` Step 1 emitted an explicit "What's the product or initiative?" prompt with a STOP gate; the user's reply became `manifest.description`. Post-implementation: `gather-context.md` returned `description = (none)` when `work_unit` was empty; description was synthesized from later conversation in `resolve-identity.md` E.
- Pre-Phase-17 `name-check.md` collision branch told the user to run `/continue-epic`. Post-implementation: `resolve-identity.md` E re-prompted for a new name with no resume signpost.
- Pre-Phase-17 `start-epic` Step 0.3 rendered a "New Epic" bullet-bordered banner. Post-implementation: only generic discovery-entry chrome rendered.
- `import-collection.md` was added unconditionally at Step 0.2 with no "if resumed, skip" branch; it would prompt on every continuing epic Discovery session.

**Feature / cross-cutting paths**

- All five `/start-*` directories were deleted with no shim. Direct invocations of `/start-feature` etc. fail with "skill not found".
- `README.md` at lines 104–108 and 232 continued to list the deleted `/start-*` slash commands and reference `skills/start-feature/` paths that no longer exist.
- Pre-Phase-17 supported `/start-feature .workflows/.inbox/ideas/{file}` as a direct CLI invocation. Post-implementation: no positional-arg entry path remained.
- Pre-Phase-17 `research-gating.md` gave the user a flat `r`/`d`/`i` choice before routing. Post-implementation: routing was inferred from conversational cues by `routing-inference.md` and surfaced as a proposal at the routing-commit gate. The user-up-front-choice was replaced by an override-after-proposal.

**Inbox + s/start paths**

- Pre-Phase-17 each `start-*` Step 1 derived the suggested work-unit name from the inbox filename slug (strip `YYYY-MM-DD--` prefix, strip `.md`). Post-implementation: `resolve-identity.md` E proposed the name purely from conversational framing; the filename slug was not used.
- Pre-Phase-17 archival fired in `name-check.md` immediately after manifest creation. Post-implementation: archival deferred to `workflow-bootstrap/references/archive-inbox-seed.md` at Discovery's terminal step. Abandoning Discovery between Step 0.1 (manifest commit) and conclude-discovery left both a partial manifest and the inbox file in `.inbox/{folder}/`.
- Pre-Phase-17 `start-from-inbox.md` for `.inbox/ideas/` asked the user to pick `f`/`e`/`c`. Post-implementation: routed to `/workflow-discovery-entry "" ""` (classifier mode). `opener-pattern.md` inbox row prescribed `{targeted question drawn from the seed material}` with no guarantee that the question elicited a shape signal.

**Bugfix / quick-fix paths**

- Pre-Phase-17 neither `start-bugfix` nor `start-quickfix` had `collect-import.md`. Post-implementation: `import-collection.md` was loaded at Step 0.2 unconditionally for all work types, including bugfix and quick-fix.
- `opener-pattern.md` had both `b`/`bugfix` (→ "What's broken?") and `inbox` (→ "{targeted question drawn from the seed material}") rows with no precedence rule when an inbox file seeded a bugfix.
- Pre-Phase-17 bugfix and quick-fix flows were ~3 user interactions (description → name → route). Post-implementation: ~5–6 interactions through Step 0.1 (opener + name confirm), Step 0.2 (import y/n), and topic-synthesis G (brief intent commit gate with explore/adjust loop).

**Continue / bridge paths**

- `continue-*` Step 0 was reduced from Casing + Migrations + Knowledge Check to Casing only.
- Migration removal was per the design's centralization decision (verified safe within a single conversation rooted at `/workflow-start`).
- Knowledge-check removal had no replacement in `workflow-bridge` or any `workflow-*-entry` skill. `workflow-bridge/SKILL.md:84` documents a context-clear / plan-mode handoff that lands the user in a fresh session; that fresh session reaches the next phase via `workflow-*-entry`, none of which gate on knowledge-check.

### Implementation errors found during audit

The following were introduced during implementation and corrected during audit-fix rounds:

- `workflow-bootstrap/references/ensure-manifest.md` documented exit codes "0 = present, 2 = absent" for `manifest.cjs exists`. The CLI writes `true`/`false` to stdout; exit code is always 0 (`manifest.cjs:836–858`).
- `workflow-discussion-entry/SKILL.md:59` accepted `source = $3`; `workflow-bootstrap/references/route-to-phase.md` invoked `/workflow-discussion-entry {work_type} {work_unit}` with no `$3`. The `source = import` branch was unreachable.
- `workflow-bootstrap/SKILL.md:4` `allowed-tools` omitted `Bash(mv …)` and `Bash(rm …)` although `archive-inbox-seed.md` and the prior `land-imports.md` invoked them.
- `workflow-bootstrap/references/land-imports.md` referenced an `imports_staging` manifest field; no skill or script wrote that field. The flow was dead code.
- `workflow-discovery-process/references/{shape-detection,routing-commit,pivot-watchpoints,discovery-mode-overlays,opener-pattern}.md` were listed as "discipline references" in `workflow-discovery-process/SKILL.md` Purpose. `pivot-watchpoints.md` and `discovery-mode-overlays.md` had no `Load **[…]**` directive in any reachable Step.
- `workflow-discovery-process/SKILL.md` Step 00 emitted an opener and confirmed identity. `session-loop.md` A "Otherwise" branch then re-rendered an opener prompting the user to re-describe the work. (Addressed via an `identity_just_resolved` flag.)
- `workflow-discovery-process/SKILL.md` Step 00 created the manifest via `manifest.cjs init`. The CLI dies on name collision (`manifest.cjs:510–511`). No collision check preceded the call. (Addressed via an `exists` pre-check.)
- `workflow-discovery-entry/SKILL.md:55` accepted `inbox_seed = $2` and forwarded it via the handoff text. No Step in `workflow-discovery-process` read `inbox_seed`. The inbox file content was not surfaced. (Addressed in `resolve-identity.md` B.)
- `workflow-bootstrap/references/route-to-phase.md` had `## A. Dispatch` ending all branches with `Terminal.` and `## B. Failure Mode` with no incoming routing from A. (Addressed by converting B into an `#### Otherwise` branch.)
- Multiple fenced blocks lacked the convention-required rendering instruction: `conclude-discovery.md:38–43`, `route-to-phase.md:37–43`.
- `workflow-bootstrap/SKILL.md:9` Zero Output Rule blockquote was truncated relative to the canonical text used in `workflow-discovery-entry/SKILL.md:9`.

### Convention violations (per CONVENTIONS.md)

- `workflow-discovery-process/SKILL.md` introduced `## Step 00` — non-standard per the sequential `## Step 0`, `## Step 1` numbering convention.
- Step 00 used `#### Classifier mode`, `#### Pre-seeded shape`, `#### Name resolution` as sequential subsection headings. H4 is reserved for conditional routing (`#### If` / `#### Otherwise`).
- `workflow-discovery-process/SKILL.md:123` `→ Return to **Step 00** name resolution` did not match any defined backward-routing target form.

### Deviations from the locked design introduced during implementation

These were either subsequently reverted or persisted to the close:

- `conclude-discovery.md` routed `work_type = epic` directly to `/workflow-bridge`, bypassing `workflow-bootstrap`. User correction: bootstrap is the universal landing surface for all work types per "start-* future" §Decision; this was reverted.
- `workflow-bootstrap/references/land-imports.md` and the multi-file import collection path were deleted on the grounds that `imports_staging` was unpopulated. User correction: the import flow was an explicit design decision ("Mechanism: same as today's epic import flow, just extended across work types"); a replacement `import-collection.md` was authored.
- `import-collection.md` in one revision treated the inbox seed file as the first import (copied to `imports/`, indexed into KB). User correction: inbox and imports are distinct concepts; the inbox-as-import logic was removed.
- `continue-*` Step 0.2 Migrations was restored with an idempotent guard after the audit flagged a bridge-entry knowledge-check concern. User correction: migrations remain `/workflow-start`-only per the design; the restoration was reverted.
- Menu picks (`e`/`f`/`b`/`q`/`c`) routed `/workflow-discovery-entry {work_type} ""`, which entered `session-loop.md` B's full exploration loop after Step 0.1 created the manifest. User indicated this was a quick-start regression vs pre-Phase-17 `start-*` behaviour; `session-loop.md` A was modified to dispatch by `work_type` (epic → exploration, others → topic-synthesis directly).

### Conflations recorded

- Inbox seed (a pre-captured idea/bug/quickfix consumed by Discovery's opener and archived by bootstrap) and imports (user-attached persistent reference files copied to `imports/` and indexed into KB) were briefly treated as the same flow in one revision of `import-collection.md`. They were separated after user correction.

### Process facts

- Sub-agents reported 12 BLOCKER items and 14 NEEDS-FIX items across two audit rounds (one pre-flatten convention/design/clarity audit, one post-flatten regression audit). Items overlapped between audits.
- All 251 manifest CLI tests, the discovery test suite, and migration tests passed at every commit. None of the regressions identified by the audits were detectable by the existing test suite.
- The `update-config` skill was used to set `workflowKeywordTriggerEnabled: false` in `~/.claude/settings.json` after the harness's "workflow" keyword auto-trigger fired repeatedly on messages that referenced the workflow system being authored.
- PR #306 was closed without merging. The branch was reset to `main` and the 7 design-doc lock commits cherry-picked back. The branch is preserved.

---

## Refinement pass — universal loop & resolution order (2026-05-31)

This pass refines three already-`[decided]` subtopics in light of the first implementation attempt — **Cross-worktype symmetry**, **Shape-detection heuristics** (specifically the co-emergence point), and **Routing-confirmation mechanism**. It does **not** reopen the universal-entry decision; it sharpens *how the loop runs*. Where it differs from earlier text, this section governs. Written for the eventual plan-mode pass — it captures the model *and* what the first attempt got wrong, so the implementation plan can encode "what not to do" as much as "what to do."

### The keystone model

One loop for every entry, with five properties:

**1. Universal entry; depth scales to unknowns.** Every selection routes through Discovery so shape is *verified*, never assumed. But the loop's length is a function of how much shape is still unknown at entry — not of work type, and never a fixed turn count. Pre-seeded menu picks start at high confidence (the loop mostly *confirms*); `s`/start starts flat (the loop *establishes*). The "dispatch by work_type" patch the first attempt reached for is correct in effect, but the honest framing is depth = f(unknowns), not per-work-type branching.

**2. The invariant is discipline + pivot-availability, not loop length.** "Conversation pattern is the same across work types" was right about *discipline* — open questions, no premature decisions, shape-watching, pivot offers, scope-down-to-inbox — and wrong if read as *same length*. Same discipline everywhere; depth differs. **Every turn must earn its place**: it must be verifying or resolving shape. The metric is not "fewest turns" — a shape-confirm turn earns its place (it's the whole reason everything routes through Discovery). Ceremony turns (a standalone import y/n gate, a synthesis loop where there's nothing to synthesise) do not. Cut those; keep shaping turns.

**3. Gather simultaneously; resolve in dependency order.** Listen for all signal flavours at once — work-type cues and topic seeds co-emerge in the same breath; never sequence the *conversation* into "first interrogate type, then topics." But *commitment* is dependency-ordered: you cannot route topics before knowing it's an epic, nor pick research-vs-discussion before knowing it's a feature. The first attempt's confusion came from resolving without an order. **Gather freely; commit in order.** This is the reconciliation of "co-emergence" (gathering) with "you need the work type before topic routing" (resolution) — they were never in conflict; they're different stages.

**4. Two-layer knowledge loading.**
- **Detection core** — *universal, always loaded.* The boundary discriminators, reroute triggers, confidence heuristics, and the confirm-with-reasons protocol. Must be universal because `s`/start has no overlay to pick from, and reroute needs the *other* shapes' signals even when pre-seeded. Bounded by construction: it carries signals + the confirm protocol, **never execution detail** — so it cannot bloat without limit. Organise it around the hard boundary discriminators (below), not six per-shape signal catalogs; that is leaner, serves reroute directly, and avoids the trigger-happy-on-weak-matches risk.
- **Execution overlay** — *polymorphic, lazy, loaded on commit.* Epic topic-synthesis, feature/cc micro-routing, b/q intent-capture + handoff. This is where per-work-type reference files live (the original "polymorphic reference files" idea survives — but only **below the commit line**).
- **Reroute is the detection core pointed at a competing shape** — one body of knowledge, two targets (the current shape: am I confirmed? / competitors: is something else converging?). Not separate machinery.

**5. Confidence is the clock.** The loop runs until confident-enough-to-commit, then confirms with the user: state the read in plain terms, give the specific signals that drove it (so the user can validate or push back on a *cue*, not just accept/reject), invite override, honour override as final. No arbitrary turn counts.

### Terms

- **Macro / work-type level** — one activity in two modes: *shape* it (flat prior, `s`/start) or *confirm* it (pre-seed, looking for disconfirmation). Confirmation is shaping with a prior; the two rattle one from the other. Output: the work type.
- **Micro / topic level** — two sub-things: *topic-shaping* (how many topics, what they are) and *topic-routing* (per-topic research-vs-discussion).

### The discriminator tree (resolution order)

Resolve in order of cost + terminality:

1. **Broken / tiny-adjustment?** → bugfix / quickfix. Cheap, distinctive, terminal. Confirm → pass seeding through to investigation / scoping → done. Fast exit; no topic work, no micro routing.
2. **Not b/q** → keep exploring until topic-count settles:
   - pattern/principle, nothing ship-able → **cross-cutting**
   - ship-able, one coherent topic → **feature**
   - ship-able, topics multiply → **epic**

**Key entanglement: topic-count is a macro discriminator, not a post-commit step.** You cannot tell epic from feature without surfacing whether topics multiply — so topic-*existence* detection happens *during* macro resolution, by the detection core. Only topic-*routing* and topic-*refinement* continue after the macro commit. The **absence** of further topics is itself the feature/cc signal ("discovery long enough to recognise it" = explore until no new topics surface).

The elegant consequence: confirming "epic" *required* surfacing the topics, so by the time epic commits you already hold the topic seeds — topic discovery is the **deepening** of the same exploration that detected epic, not a fresh start.

**Completeness asymmetry.** The feature↔epic *boundary* needs *higher* confidence than epic *topic-enumeration*. The boundary has no safety net; topic-enumeration does (gap-analysis runs at every workflow-bridge transition and keeps hydrating the map). So explore the boundary carefully, but don't over-invest in exhaustive topic lists at initial discovery.

### Epic discovery: reuse, don't rebuild

Epic already has a full discovery phase today — the discovery map, the over-split/under-split rules, the curatorial map-operations. **Phase 17 adds the macro layer in front of the existing epic topic-discovery; it does not rebuild it.** All existing epic-discovery rules still apply.

- Initial epic discovery is not about perfection — it's "rooted correctly + enough topic seeds to start." Stopping at "enough" is correct, not lazy.
- Confirming epic does **not** finish discovery and does **not** lock the surfaced topics. Keep shaping if useful.
- When topics get pruned ("focus on A, surface B and C to the inbox"), use the existing **scope-down + inbox-surface** mechanism.

### Imports

Universal across all work types — all benefit from seed material if it exists. **Folded into the opener, not a standalone gate.** No-files path costs zero extra turns; got-files path attaches one or more, read at the opener. Imports remain distinct from inbox seed (the first attempt conflated them — see post-mortem); do not treat an inbox seed file as an import.

### What not to do (distilled from the first attempt)

- Don't run the full exploration loop when shape is pre-seeded — confidence starts high; confirm and move.
- Don't add ceremony turns to b/q — no import y/n gate, no synthesis explore/adjust loop. They have nothing to route or decompose.
- Don't make detection knowledge polymorphic — it must be universal, or reroute and the `s`/start path break.
- Don't resolve macro and micro simultaneously — gather simultaneously, *commit* in dependency order.
- Don't rebuild epic topic-discovery — reuse it; add only the macro layer.
- Don't conflate inbox seed with imports.
- Don't optimise for fewest turns — optimise for every turn earning its place.

---

## Refinement pass II — funnel entry, deferred persistence & the landing (2026-05-31)

Second pass, same day, continuing from the loop-mechanics pass above. This one resolves the **entry architecture** and the **post-confirmation landing**, and revises two earlier `[decided]` subtopics: **start-\* future** (no separate bootstrap skill) and the manifest-timing assumptions threaded through **Migration & cutover**. Same convention — where this differs from earlier text, this section governs.

### Discovery is the funnel — one feature, not a per-type migration

`workflow-start` → discovery **directly**, for every menu pick. `work_type` is an optional *pre-seed*, not a routing fork. `start-*` do **not** sit between `workflow-start` and discovery, and the manifest is created *after* discovery confirms the shape, never before — creating a manifest with a pre-seeded work_type before confirmation fights discovery's reroute job.

Rejected: migrating one work type at a time onto the funnel. The detection core, the confirm-trigger, and routing are inherently universal (the funnel routes to *every* first phase), so a partial migration leaves discovery half-applied across two coexisting entry mechanisms — it fractures the process. Build it as **one coherent feature**.

### start-\* dissolve

There is nothing left for the five `start-*` skills to *be*. Every piece redistributes:

| `start-*` piece | New home |
|---|---|
| Step 0 — casing / migrations / knowledge-check | `workflow-start` (sole entry, runs once) |
| Step 1 — gather context / read inbox seed | discovery opener |
| Step 2 — name + `manifest.cjs init` | discovery confirm-trigger (deferred — see below) |
| Step 3 — optional import | discovery opener (read) + confirm-trigger (land) |
| Step 4 — route to first phase | discovery terminal (per-type overlay) |

Carry-over not to lose: the inbox **filename-slug → suggested-name** derivation (strip `YYYY-MM-DD--`, strip `.md`) lived in `start-*` Step 1 and was *lost* in the first attempt. It must survive into discovery's name resolution.

### Deferred persistence — confirmation is the single trigger

A new work unit cannot be persisted until `work_type` + name are known. For `s`/start, neither is known at entry — so the manifest, the work_unit dir, the session log, and import-landing all have nowhere to live during pre-confirmation discovery.

Resolution, applied **uniformly** (pre-seeded picks included, not just `s`/start):

- **Pre-confirmation discovery is ephemeral** — lives in the conversation only (the dialogue, any imports *read* for shaping, the emerging shape). Nothing on disk yet.
- **Confirmation is the single persistence trigger.** It fires, in order: init manifest (confirmed `work_type` + resolved name) → write the session log, backfilling the conversation so far → land imports into `imports/`. Discovery then continues with persistence live.

Why uniform, rather than "init upfront when work_type is known":

- **Kills a regression by construction** — the first attempt's "partial manifest + orphaned inbox file on early abandon" cannot happen if nothing persists before confirm.
- **One code path, not two.** Pre-seeded and `s` differ only in starting confidence; same trigger, same persistence. Path-divergence was a root cause of first-attempt bugs.
- **Matches the existing "session log written lazily on first state change" convention** — confirmation *is* the first persistable state change for new work.
- **Imports get the same benefit** — read at the opener for shaping, *landed* at confirm. No premature work_unit dir, no separate import gate.

Consequence accepted: a pre-confirmation `s` session that is interrupted is **not resumable** (nothing persisted). Fine — re-describing un-shaped work is cheap; the expensive work (topics) is all post-confirm, where resume works normally.

### No separate `workflow-bootstrap` skill

The first attempt introduced a standalone `workflow-bootstrap` skill (consolidating `start-*`'s manifest-create + import-land + route-to-phase) under the old "collapse five wrappers into one shared utility" framing. That framing predates the funnel decision.

Under the funnel, **discovery is the only caller** that ever creates a new work unit. A skill with exactly one caller is indirection — and it was where a cluster of first-attempt bugs lived (dead `imports_staging` code, `exists` exit-code confusion, archival-timing partial-state, the unreachable `route-to-phase` failure branch).

Decision: **no bootstrap skill.** Its job folds into `workflow-discovery-process` — the confirm-trigger and a terminal route step, as reference files. This revises "start-\* future → single bootstrap skill".

### The landing splits along the two-layer line

The post-confirmation landing is *both* universal and work-type-specific, cleanly separated along the detection-core / execution-overlay line already locked:

- **Confirm-trigger = universal.** init manifest (`--work-type {wt}` is a *parameter*; the CLI scaffolds the per-type phases from the flag), flush log, land imports. Zero work-type branching at the discovery call site.
- **Post-confirm = work-type-specific → the polymorphic execution overlay.** Each overlay owns its own post-confirm playbook *and* its own route-out:

| Overlay | Post-confirm work | Routes to |
|---|---|---|
| **epic** (heavy) | does **not** route out — *continues* in discovery: topic synthesis + per-topic micro routing, reusing the existing machinery | existing conclude-discovery → map routing |
| **feature** | one micro-routing decision (research vs discussion) | research-entry / discussion-entry |
| **cross-cutting** | optional-research micro routing | research-entry / discussion-entry |
| **bugfix** | brief intent capture | investigation-entry |
| **quickfix** | brief intent capture | scoping-entry |

**Routing is overlay-local, never a central dispatch table.** The first attempt's central `route-to-phase.md` table is exactly where the unreachable-failure-branch bug lived. Each overlay ends by invoking *its own* first-phase entry — self-contained, nothing to desync.

### Implementation shape (agreed so far)

- Build discovery-as-funnel as **one feature** (not per-type slices).
- **Legible commits, never squashed** — the first attempt's squash erased slice isolation and bundled the design-lock commits with code.
- **continue-\* lockdown is carved out** into its own follow-up PR — it's the one cleanly separable piece, and the source of the bridge/Step-0 knowledge-check regressions.
- Gate on a **path inventory** acceptance spec (still to be defined — tests cannot see the prose/UX regressions that sank the first attempt).

### What not to do (this batch)

- Don't route `workflow-start` → `start-*` → discovery. It's `workflow-start` → discovery directly; `start-*` are gone.
- Don't create the manifest before `work_type` is confirmed — defer all persistence to the confirm-trigger.
- Don't resurrect a standalone bootstrap skill — fold it into `workflow-discovery-process`.
- Don't centralise route-to-phase — keep it overlay-local.
- Don't lose the inbox filename-slug → suggested-name derivation.
- Don't migrate work types onto the funnel incrementally — it fractures discovery.

---

## Refinement pass III — imports vs inbox & the discovery→first-phase carrier (2026-05-31)

Third pass, same day. Sharpens the locked **Imports & inbox handling** subtopic (which treated the two as "the same handling pattern") and adds a new decided point: the **discovery → first-phase seed-carrier contract**. Same convention — where this differs from earlier text, this section governs.

### Imports vs inbox — converge at the opener, diverge at the confirm trigger

The first attempt conflated these (it briefly copied the inbox seed into `imports/`). The fix is to recognise they share a *read* moment but not a *persistence* moment. Core difference is **role**:

- **Inbox item = the work's *origin*.** A pre-captured thought that *becomes* a work unit. Exactly one per entry. Consumed when the work begins. Carries a classification hint via its folder.
- **Imports = *reference material* that informs the work.** Zero-to-many. Retained (`imports/`, KB-indexed). No classification role.

| | Inbox seed | Imports |
|---|---|---|
| Role at opener | read → shapes conversation; **folder pre-seeds macro** (bugs→bugfix, quickfixes→quickfix, ideas→none) | read → informs shape via *content* (multi-topic content can trigger epic-pivot) |
| Classification hint | yes (explicit user act — filed in a folder) | no (material to interpret, never a pre-seed) |
| Cardinality | exactly one (see idea #29 for future multi-seed) | zero-to-many |
| Pre-confirm persistence | none (already on disk in `.inbox/`) | none (bytes read into context only) |
| **At confirm trigger** | **archived** → `.inbox/.archived/` | **landed** → copied to `imports/`, KB-indexed, recorded in `imports[]` |
| Persists into the work unit? | no — consumed | yes — retrievable via KB |

**Unifying insight:** inbox is not a third entry type — it's **a pre-captured opening description + an optional folder-based macro pre-seed**:
- enter from `.inbox/bugs/X.md` ≡ pick `b`/bugfix + a seed description
- enter from `.inbox/ideas/X.md` ≡ `s`/start + a seed description

Imports are orthogonal — an optional attachment to *any* entry (typed, `s`, a menu pick, or an inbox-seeded one). You can enter from a bug report (seed) *and* attach a log file (import); both read at the opener, distinct lifecycles at confirm.

**Anti-conflation rule:** an inbox seed is **never** copied into `imports/`. It's archived (not deleted). Its substance isn't lost — it shapes the conversation, which is backfilled into the session log, and flows into downstream artifacts (which *are* KB-indexed).

**Consistency win:** deferred persistence fixes the archival-timing regression for free — manifest-init and inbox-archival both fire at the *same* confirm trigger, so there is no window where a manifest exists but the inbox file is still pending. Abandon pre-confirm → the item simply stays in `.inbox/` for next time.

### The discovery → first-phase seed-carrier contract

Discovery shapes; the first phase fills the shape. Whatever discovery captured — the inbox seed, the shaped intent, the routing decision — must reach the first phase reliably.

**Contract: discovery's *persisted* output must be sufficient to bootstrap the first phase without the live conversation.** That output is the **session log + manifest `description`** (+ the discovery map for epics). The first-phase entry skill reads it as seed material.

- The **"brief intent capture"** (bugfix/quickfix) and the shaped scope + micro-routing (feature/cc) are the *handoff payload* — written to the session log at conclusion, read by investigation-entry / scoping-entry / discussion-entry / research-entry. Not throwaway.
- For **epics** this is the existing map-driven seeding (Phase 14 two-tier summary + description per map item). For **single-phase types** it is **new wiring** — those entries never read a discovery artifact before, because feature/bugfix/quickfix/cc had no discovery.

**Don't rely on live conversation context.** On first startup, discovery → first phase is one continuous session (workflow-bridge fires only on *subsequent* phase conclusions, **not** first startup), so live context *is* present — but treat it as a bonus, never the contract:

- **Cross-session resume** — conclude discovery, return later via continue-* / continue-epic with no live context; the session log is then the only carrier (the normal multi-session rhythm for epics; the resume case for single-phase types).
- **Compaction** within a long discovery → first-phase session.
- **Single source of truth** — correctness must not depend on "still in context," which can't be reliably detected.

So first-phase entry **always** reads the durable carrier; live context is a bonus.

**Two channels, each matched to what the material *is*:**

| Material | Channel to the first phase | Why |
|---|---|---|
| **Import** | KB index (+ `imports[]`) → *automatic* retrieval, this phase and every future phase/work-unit | durable reference material |
| **Idea / inbox seed** | the explicit session-log + `description` handoff (scoped to this work unit) | a seed, not validated content |

**Do not KB-index the discovery session log.** It would violate the shape-vs-content guardrail (discovery is shape-talk, not substance) and pollute the KB with un-validated seed chatter. The seed's substance earns KB indexing *later* — once the first phase turns it into a real artifact (investigation/discussion/etc.), which *is* indexed.

### What not to do (this batch)

- Don't copy an inbox seed into `imports/` — archive it.
- Don't treat inbox and imports as identical at persistence — same at read, distinct at persist.
- Don't KB-index the discovery session log.
- Don't rely on live conversation context to carry discovery's output into the first phase — read the durable carrier (session log + `description`).

---

## Refinement pass IV — path inventory (acceptance spec) (2026-05-31)

Fourth pass, same day. The **path inventory** — the acceptance spec for the implementation. Every new-work entry path with its expected post-Phase-17 behaviour, the universal invariants, the must-not-regress checklist distilled from the first attempt, and the Step-0 / bridge survival table. The existing test suite cannot see prose/UX regressions (all 251 tests passed through the first attempt); this is what a walkthrough — human or audit agent — validates against, path by path.

**Current routing it must preserve:** epic → `discovery-entry`; feature/cc → `research-gating` (flat `r`/`d`) → research/discussion-entry; bugfix → `investigation-entry`; quickfix → `scoping-entry`. Imports today exist only for epic + feature — **b/q/cc gain them**, folded into the opener (not a gate).

### Part 1 — Universal invariants (every new-work path)

1. `workflow-start` → discovery directly; no `start-*` intermediary.
2. Manifest created **only at the confirm trigger**, never before.
3. Session log written at confirm (backfilled), lazily — not up-front.
4. Inbox seed archived **at the same confirm trigger** (no deferred-archival window).
5. Imports offered **in the opener**, not a standalone y/n gate; read at opener, landed at confirm, KB-indexed.
6. Opener phrased per pre-seed (shape-appropriate); no process pre-announce.
7. Pre-seeded paths **confirm-and-move** — no full exploration loop; every turn earns its place.
8. Pivot/reroute passively available on all paths.
9. First-phase entry reads the **durable carrier** (session log + `description`); never relies on live context.
10. User's framing captured → `manifest.description`.
11. Name resolved at confirm; collision → **resume signpost** ("run `/workflow-start` to resume {wu}"), not a silent re-prompt.
12. Abandon-before-confirm leaves **no trace** (no partial manifest; inbox file stays put).

### Part 2 — Per-path table

| Entry | Pre-seed | Opener | Name suggestion | Micro routing | Handoff |
|---|---|---|---|---|---|
| `e`/epic | epic | "Tell me about the epic…" | conversational | per-topic (in discovery) | existing conclude → map routing |
| `f`/feature | feature | "Tell me about the feature." | conversational | one decision (research/discussion) | research-entry / discussion-entry |
| `b`/bugfix | bugfix | "What's broken?" | conversational | none | investigation-entry |
| `q`/quickfix | quickfix | "What's the change?" | conversational | none | scoping-entry |
| `c`/cc | cross-cutting | "Tell me about the cross-cutting concern." | conversational | one decision | research-entry / discussion-entry |
| `s`/start | none | "What's on your mind…" | conversational | per resolved type | per resolved type |
| inbox→bug | bugfix (folder) | read seed → sketch → targeted Q | **filename-slug** | none | investigation-entry |
| inbox→quickfix | quickfix (folder) | read seed → sketch → targeted Q | **filename-slug** | none | scoping-entry |
| inbox→idea | none | read seed → sketch → targeted Q | **filename-slug** | per resolved type | per resolved type |

Note: inbox→idea now classifies through discovery, so it can resolve to *any* type (f/e/c/**b/q**) — superseding today's f/e/c-only menu. A strict improvement; overlaps idea #18 (inbox pickup actions).

### Part 3 — Regression watchlist (must-not-regress, from the post-mortem)

| # | Check | Paths |
|---|---|---|
| R1 | description captured from the user, not silently synthesised | all (esp. epic) |
| R2 | name collision → resume signpost, not re-prompt | all |
| R3 | shape-appropriate entry chrome/signpost retained (the old "New Epic" banner role) | each menu pick |
| R4 | no forced import y/n gate | b, q, c |
| R5 | inbox **filename-slug** drives the suggested name | inbox paths |
| R6 | inbox archival fires at confirm, no partial-state window | inbox paths |
| R7 | b/q stay ~3 interactions (opener + name + route); no synthesis loop | b, q |
| R8 | `discussion-entry` import/seed handoff branch is actually reachable | f, c (→ discussion) |
| R9 | inbox selection still works end-to-end via `workflow-start` (positional `/start-* {path}` CLI entry is intentionally gone) | inbox paths |

### Part 4 — Continue / bridge (Step 0 survival)

| Step 0 element | `workflow-start` | continue-* / bridge |
|---|---|---|
| Casing conventions | ✓ | ✓ (needed to author files) |
| Migrations | ✓ | ✗ (idempotent, state-tracked) |
| Knowledge **compact** | ✓ | ✗ (maintenance decay) |
| Knowledge **check** | ✓ | ✗ — guaranteed by `workflow-start`; bridge starts nothing new |

Knowledge-check is a **project-setup gate, not a per-session gate** — once a project's KB is set up it stays set up, and setup is human-only. A bridge only ever runs inside a work unit that was created via `workflow-start`, where the check already passed; re-checking verifies something already guaranteed. The context-clear "fresh session" edge is a new *conversation*, not a new *project*. The pathological case (KB deleted mid-pipeline) degrades gracefully via stub/keyword mode + the pending queue. So: no knowledge-check at bridge.

---

## Refinement pass V — PR shape & sequencing (2026-05-31)

Fifth pass, same day. Closes the last open thread. The implementation ships as **three stacked PRs**, held until all are complete, then merged **bottom-to-top** — no partial Phase-17 state ever sits on main (the same stacked-PR strategy as the parent initiative).

```
main
└─ PR 1 = this design branch (refinement passes + briefs + idea #29) — the base
   └─ PR 2  discovery as universal funnel (incl. the manifest cross-type contract test)
      └─ PR 3  continue-* lockdown
```

> **Note:** the original "PR1 = manifest schema" collapsed after investigation — the CLI is already permissive, so the manifest work is a test-only contract folded into PR2, and this design branch becomes PR1/the base. See the PR scope briefs' status-tracker note.

**PR 1 — manifest schema.** ~~Allow `phases.discovery` for all work types + a test.~~ **Resolved: folded into PR2.** The CLI is already permissive (no schema change needed); only the contract test remains, now PR2's first commit. PR1 is instead this design branch as the base. See the PR scope briefs.

**PR 2 — discovery as universal funnel.** The whole improvement, as one feature (not per-work-type slices — that fractures discovery):
- `workflow-start` rewire — every menu pick + `s`/start + inbox → discovery; full Step 0 lives here.
- `workflow-discovery-process` — universal detection core + per-type execution overlays + the confirm-trigger (init manifest · flush log · land imports · archive inbox seed) + overlay-local route-to-phase.
- delete the five `start-*`; redistribute their pieces; fix the resume-text / README references that die with them.
- first-phase entry skills read the durable carrier (session log + `description`) — new wiring for single-phase types.
- `continue-*` untouched here — still user-invocable, still own their Step 0, so the resume path keeps working.
- gated by the path inventory (pass IV).

**PR 3 — continue-\* lockdown.** Flip the five `continue-*` to `user-invocable: false` · trim their Step 0 (now safe — only reachable via `workflow-start`) · text-migrate the *user-facing* `/continue-*` promises (internal invocations unchanged) · resume **logic** unchanged (five skills stay, same displays/menus). Must follow PR 2 — you can't strip continue-*'s Step 0 while it's still directly typeable. Confirmed **in scope** (pass II's "carved out" is now PR 3 of the held stack, not a deferred maybe).

**Merge discipline.** Legible commits, **never squashed** (the first attempt's squash erased slice isolation and bundled design-lock commits with code). Each PR reviewed on its own; merge bottom-to-top only once all three are done.

**Logistics deferred to implementation kickoff:** the base of the stack (merge this design branch to main first vs hold it as the stack base) and cleanup of the abandoned first-attempt branches (`feat/phase-17a`…`-17g` on origin).

---

## Refinement pass VI — Discovery as the umbrella entry skill (2026-05-31)

This pass is the **authoritative architecture for discovery's structure**. Where it conflicts with the entry/process framing inherited by earlier passes or the structural work-items in the PR scope briefs below, **this section governs**. It captures the model settled after a plan-mode misstep (next) was discarded.

### The misstep it corrects

A plan-mode session proposed splitting PR2 into an "engine" PR + a "cutover" PR, bridged by an `init-if-absent` + `persistence_live` shim that kept `start-epic` alive during the engine PR and preserved epic's existing mid-loop persistence. It was **discarded** because:
- The deferred-persistence change is **entangled with the entry change for epic**: `start-epic` (codebase fact) creates the manifest at its Step 2 *before* invoking discovery, which conflicts with a confirm-trigger that creates the manifest. Splitting them forced epic-specific persistence handling (the `persistence_live` flag) — i.e. **special-casing epic**, violating the locked "uniform persistence / epic-not-special" principle.
- Any clean split collapses into per-work-type slicing, which fractures discovery (rejected earlier).

PR2 is therefore **one uniform feature**, not a split.

### Discovery is an umbrella, not a phase

- **Codebase fact:** discovery is currently two skills — `workflow-discovery-entry` + `workflow-discovery-process` — built like the phase skills (research/discussion each have an `-entry` + a `-process`). This mirrors the phases *because discovery was modelled as the epic's first phase.*
- **Decision:** discovery is **not** a phase of the epic. It is the **universal umbrella entry** between `workflow-start` and the phase skills. No work type "starts" until discovery concludes and routes out. Discovery shapes the problem space — confirms the work type, sketches the outline — so we know where to begin. It is **step zero of the macro level**: it pencils the shape; the pipeline pens it in.

### One skill, one continuous shaping process

- **Decision:** collapse the `-entry`/`-process` pair into **one discovery skill** (still reference-file-modular). The split was an artefact of the phase framing.
- Work-type detection and topic surfacing are the **same process** — you cannot tell epic from feature without surfacing whether topics multiply. So macro shaping and topic shaping are *not* separable into two skills; they are one continuous conversation governed by **depth = f(unknowns)**.
- The **work-type commit** is the only meaningful boundary inside that process, and it is a **durability boundary** (the confirm-trigger fires; the manifest lands) — *not* a skill boundary. The conversation flows straight through it.
  - Non-epic: little left to resolve once the type is known → shaping ends at/near the commit → route to the first phase.
  - Epic: more to resolve (topics) → the same shaping continues past the commit into the initial topic sketch.
- A **pre-seeded work type** (a `workflow-start` menu pick) is a *hint*, not a given — discovery still watches for signals it's something else. Same process as the no-hint (`s`/start) path; just higher starting confidence.

### Discovery's two invocation modes (the backbone)

The discovery skill's backbone dispatches by how it is invoked:
- **New mode** — invoked with *no* `work_type` (from `workflow-start`). Decide the work type, then: epic → initial topic sketch; feature/cross-cutting → micro-routing decision (research vs discussion) + intent; bugfix/quick-fix → intent capture. The **macro role lives only here — one-shot per work unit.**
- **Existing-epic shaping mode** — invoked with a *known epic* `work_unit` (from `continue-epic`). Skip macro entirely; re-shape the map. Handles **refinement** (add/edit/remove/rename of a concluded map) *and* **resuming an unfinished initial sketch** (resume-detection offers continue/restart). Edit operations load by progressive disclosure (only when a populated map exists).

### Return contract

On conclude, discovery routes out by context:
- non-epic (new) → the first-phase entry (`workflow-{research,discussion,investigation,scoping}-entry`).
- new epic → `continue-epic` (begin navigating the fresh map).
- refinement (was invoked by `continue-epic`) → back to `continue-epic`.

So an epic **always lands in `continue-epic`** after any discovery session; a non-epic lands in its first phase.

### The three topic-growth activities — do not blur

1. **Initial topic sketch** — discovery, *new mode*, session 001, continuous with the macro decision. Conversational.
2. **Refinement** — discovery, *existing-epic mode*, invoked from `continue-epic`, sessions 002+. Conversational, user-initiated. Re-shapes the map.
3. **Bridge enrichment** — *analytical*, automatic. **Codebase fact (CLAUDE.md):** research-analysis and discovery-gap-analysis run from `continue-epic` Step 6 and `workflow-bridge` "not from inside discovery." Not a discovery session.

#2 and #3 both grow the epic's map but by different mechanisms (a conversation vs an analysis pass). Both are epic-owned; **neither re-enters discovery's macro role.**

### `continue-epic` delegates shaping to discovery

- **Decision:** when `continue-epic` offers refinement, it **routes to the discovery skill** (existing-epic mode) rather than implementing shaping itself. Discovery owns *all* conversational shaping; `continue-epic` owns navigation and delegates.
- This resolves the apparent circularity: discovery is the *shaping* skill, refinement *is* shaping, so a navigator delegating to the shaper is correct layering, not a loop.
- **Precise re-entry rule:** discovery is re-invoked for **shaping** (refinement / resume), **never** for its **macro role** (one-shot).

### Responsibility map

- **discovery** = all conversational shaping (macro decision + initial sketch + refinement + resume), dispatched by invocation context. Absorbs the `start-*` setup job.
- **continue-epic** = epic navigation; delegates shaping to discovery; triggers the analytical bridge enrichment.
- **continue-{feature,bugfix,quickfix,cross-cutting}** = per-type resume/navigation (single-topic).
- **workflow-start** = sole user entry → discovery (new) or continue-* (resume).

### Uniform persistence; macro-confirm is the durability boundary

- The **confirm-trigger** (at the work-type commit) creates the manifest for **every** work type — no `start-*` pre-creates it anymore. A generic **create-if-absent** guard covers the existing-epic case (refinement/resume — manifest already present); this is plain correctness, **not** the discarded `persistence_live`/epic-special shim.
- **Before macro-confirm:** pre-confirm shaping is **ephemeral** (conversation only; nothing on disk). Session end → lost → re-start via `workflow-start`. This is a *positive* property — no orphaned manifest / partial state (a first-attempt regression).
- **At/after macro-confirm:** persisted (manifest + session log; for single-phase types the **routing decision** is recorded too, so the post-confirm handoff is deterministic). Resumable.

| Interrupted | On disk | Resume |
|---|---|---|
| before macro-confirm (work_type unknown) | nothing | re-start via `workflow-start` (lost, cheap) |
| after confirm — epic mid-topic-shaping | manifest + partial session log + marker | `workflow-start` → `continue-epic` → discovery (existing-epic mode) |
| after confirm — single-phase | manifest + session log (type + routing + intent) | `workflow-start` → continue-* → route to first phase from the carrier |

### `start-*` dissolve; `continue-*` stay (the asymmetry, resolved)

- `start-*` and `continue-*` were never mirrors. **`start-*` set up *new* work** (gather context → name → create manifest → route); the setup is now discovery's job (shaping + confirm-trigger), the route is trivial → `start-*` have nothing left → **deleted**. Pieces redistribute: Step 0 → `workflow-start`; gather → discovery; name + manifest → confirm-trigger; imports → discovery; route → discovery's conclude.
- **`continue-*` navigate *existing* work** — per-type state/dashboard/resume. Irreducibly per-type; absorbed by nothing → **stay** (five skills, model-only after PR3).
- A single "continue umbrella" (universal dispatch + per-type navigation overlays) is *viable* now that the overlay pattern exists, but it is a **separate refactor, out of scope** — noted as an optional future symmetrisation.

### Carrier contract (restated; unchanged from pass III) + a correction

Discovery's *persisted* output (session log + manifest `description`; + the recorded routing for single-phase) must bootstrap the first phase **without** the live conversation. First-phase entry skills read the durable carrier; live context is a bonus.

**Correction to the PR2 brief below:** `ensure-discovery-item.md` (`workflow-shared`) **stays epic-only** — single-phase types correctly get **no** `phases.discovery.items`. **Codebase fact:** it already no-ops for non-epic and is called by `workflow-research-entry` and `workflow-discussion-entry`. The reconciliation is *not* "remove its gate" (an error in the PR2 brief, now fixed); it is that the first-phase entry skills must read the durable carrier rather than depend on that no-op call.

### What this means for the PRs

- **PR2 (the whole funnel — one uniform feature):** collapse `workflow-discovery-entry` + `workflow-discovery-process` into one umbrella discovery skill with the two invocation modes; route `workflow-start` (every pick + `s` + inbox) → discovery; uniform confirm-trigger (create-if-absent); delete the five `start-*`; `continue-epic` delegates refinement to discovery; first-phase entry skills read the carrier; `ensure-discovery-item` unchanged (stays epic-only); the manifest cross-type **contract test** (test-only). Acceptance = the full path inventory (pass IV).
- **PR3 (continue-* lockdown):** unchanged from pass V.
- The **engine/cutover split is discarded.**

### Codebase facts grounding this pass (verified)

- `manifest.cjs` already accepts `phases.discovery` for all work types: `VALID_PHASES` includes `discovery`; `validatePhase`/`validateSet` validate the phase *name* only, with no work-type cross-check. So the manifest change is test-only.
- Discovery is currently two skills (`workflow-discovery-entry` + `workflow-discovery-process`); `discovery-process` runs a conversational session (Resume Detection, Session Loop, Confirm-and-Persist, Conclude) and creates its session log lazily.
- `start-*` route targets (grepped): epic → `/workflow-discovery-entry`; feature/cross-cutting → `research-gating` → `/workflow-research-entry` | `/workflow-discussion-entry`; bugfix → `/workflow-investigation-entry`; quick-fix → `/workflow-scoping-entry`. `collect-import.md` exists for epic + feature only.
- `ensure-discovery-item.md` is epic-only (no-ops for non-epic); called by `workflow-research-entry` and `workflow-discussion-entry`.
- CLAUDE.md: self-healing analyses (research-analysis, discovery-gap-analysis) run from `continue-epic` / `workflow-bridge`, **not** from inside discovery.
- `continue-*` are currently user-invocable (no `user-invocable` flag) and each carry a Step 0 with migrations + knowledge-check.

---

## PR scope briefs (durable plan-mode references)

> **Purpose.** These are the per-PR work-item references. Each is self-contained enough that a **fresh session with none of the design conversation in context** can load it (plus the relevant refinement passes via the forward-pointer, plus the codebase) and generate that PR's detailed plan-mode plan. The brief is the *scope*; plan-mode produces the *line-level plan* against the actual merged code. Do **not** pre-generate PR2/PR3 detailed plans — they depend on the merged state of the PR below them.

> **Superseded-where-conflicting by Refinement pass VI (immediately above).** Pass VI is authoritative for discovery's *structure* — discovery is **one umbrella skill with two invocation modes**, not the entry/process pair these briefs were first written against. The PR boundaries, the contract-test-folds-into-PR2 decision, the `start-*` deletion list, and the path-inventory acceptance all stand; the discovery-internal work-items in PR2 below are restated by pass VI (and one error — listing `ensure-discovery-item` as a gate to remove — is corrected below).

### Status tracker

> **2026-05-31 update — supersedes pass V's "PR1 = manifest schema" framing.** A plan-mode investigation found the manifest CLI is *already* permissive: there is no work-type→phase gate — `VALID_PHASES` includes `discovery` and `validatePhase`/`validateSet` (`manifest.cjs` lines 339–393) check the phase *name* only, never the work type. So there is **no schema change**. The only worthwhile artefact is a cross-type **contract test**, folded into PR2 as its first commit. **PR1 is now this design branch itself** (the base), per the branching decision below.

| PR | Scope | Branch | Status |
|---|---|---|---|
| 1 | This design doc + idea #29 — the **base** | `feat/phase-17-discovery-universal-entry` (off `main`) | content complete |
| 2 | Discovery as universal funnel (incl. the manifest cross-type contract test) | branches off PR1 | Not started |
| 3 | continue-* lockdown | branches off PR2 | Not started |

*(Update this table as each PR opens / merges. A resuming session reads it first to know where it is.)*

**Branching decision.** This branch is the stack base — it's already on `main` and carries the design docs, so PR2 branches directly off it and PR3 off PR2 (no orphaned design branch, no premerge dance). Merge bottom-to-top at the end.

### PR 1 — design base (this branch)

This branch (`feat/phase-17-discovery-universal-entry`) carries this design doc + idea #29 and is the **stack base**. It has no code change of its own. PR2/PR3 branch off it; it merges to `main` bottom-to-top with the rest at the end.

**The manifest change folded away.** Investigation found `manifest.cjs` already accepts `phases.discovery` for every work type (see the status-tracker note above). The epic-only restriction lives **only in the skill layer** — `workflow-shared/references/ensure-discovery-item.md`, `workflow-discovery-entry/SKILL.md`, `workflow-research-entry/references/invoke-skill.md`. So the only artefact kept is a **contract test** pinning cross-type acceptance, folded into PR2 as work item 0 (below). Mirrors the abandoned `17a` commit `09e4b531` (also test-only).

### PR 2 — discovery as universal funnel

**Goal.** `workflow-start` → discovery directly for every entry; discovery shapes/confirms work type, persists at confirm, routes to the first phase. start-* dissolve.

**Preconditions:** branches off PR1 (the design base).

**Work items, by area:**

**0. Manifest cross-type contract test** (folded from the original PR1)
- Add a test to `tests/scripts/test-workflow-manifest.sh` pinning that `phases.discovery` is accepted for all five work types — session-level field writes, `init-phase {wu}.discovery.{topic}`, and status validation (discovery items accept only `in-progress`). **Test-only — no `manifest.cjs` change** (the CLI is already permissive). Mirror commit `09e4b531`. Land it as PR2's first commit, before the behaviour that relies on it.

**Skill-layer epic-only assumptions to rework** — where discovery is currently restricted to epics. *(Note: `ensure-discovery-item.md` is **not** here — it correctly **stays** epic-only; see pass VI's correction.)*
- `workflow-discovery-entry/SKILL.md` — the "Discovery is epic-only" declarations + arg parsing (subsumed when entry/process collapse into one umbrella skill — pass VI).
- `workflow-research-entry/references/invoke-skill.md` — the "non-epic → no discovery phase, skip" precondition (non-epic now has a discovery session log; rework to the carrier contract).

**`workflow-start`**
- Add `s`/start menu option (unknown shape).
- Route every pick → `workflow-discovery-entry`: `e/f/b/q/c` with a `work_type` pre-seed; `s` with none; inbox selection with the seed file (folder → pre-seed hint).
- Host the **full Step 0** (casing · migrations · knowledge-check · knowledge-compact) — it is now the funnel entry.
- `start-from-inbox.md`: route to discovery, not start-*; preserve the **filename-slug → suggested-name**; drop the idea `f/e/c` sub-menu (discovery classifies).
- `active-work.md` untouched here (continue-* stay user-invocable until PR3).

**The discovery skill** (per pass VI — collapse `workflow-discovery-entry` + `workflow-discovery-process` into **one umbrella skill**, two invocation modes)
- **Backbone dispatch:** *new mode* (no `work_type`, from `workflow-start`) decides the work type then sketches; *existing-epic mode* (known epic `work_unit`, from `continue-epic`) skips macro and re-shapes the map (refinement / resume).
- **Universal detection core** (loaded every entry): boundary discriminators, pivot/reroute watch, confidence heuristics, confirm-with-reasons. A pre-seed is a hint, still confirmed.
- **Per-type endpoint:** epic → initial topic sketch (reusing the existing curatorial machinery); feature/cc → micro-routing decision (research vs discussion); bugfix/quickfix → brief intent. Routing is overlay-local — each invokes its own first-phase entry / conclude target; no central route table.
- **Confirm-trigger** = the single persistence hinge: **create-if-absent** `manifest init --work-type {wt}` (resolved name) → write/backfill session log → land imports → archive inbox seed. **Nothing persists before the work-type commit.** Uniform across all types — no `persistence_live`/epic special-casing.
- Opener phrased per pre-seed; name resolution incl. filename-slug (inbox) + conversational (`s`). Pre-seeded → confirm-and-move; b/q ~3 interactions.
- **Return contract:** non-epic → first phase; new epic → `continue-epic`; refinement → back to `continue-epic`.

**Delete the five `start-*`**
- Redistribute per pass II's table (Step 0 → workflow-start; gather → opener; name+manifest → confirm-trigger; imports → opener+confirm; route → terminal).
- Fix references that die with them (start-*/`name-check.md` resume text, README lines, `start-from-inbox.md`).
- **No** `workflow-bootstrap` skill — it folds into the one discovery skill (pass VI).

**First-phase entry wiring** (`workflow-{investigation,scoping,discussion,research}-entry`)
- When invoked by discovery's terminal route, **read the durable carrier** (session log + manifest `description`) as seed; don't re-gather. The existing `source` machinery + the "caller already gathered context — do not re-ask" pattern is the hook.
- **Key reconciliation / risk:** `discussion-entry` and `research-entry` currently call `ensure-discovery-item` (a discovery-map item) and derive summary/description. Reconcile with "single-phase types have **no** `phases.discovery.items`" — for single-phase work arriving from the funnel, seed from the session log instead of creating a map item. This is the subtlest part of PR2; plan it explicitly.

**Imports** — universal (all types), folded into the opener (read at opener, landed at confirm); replaces the epic/feature `collect-import.md` gate (b/q/cc gain imports).

**Acceptance:** the **entire path inventory** (pass IV) — Part 1 invariants, Part 2 per-path behaviour, Part 3 regression watchlist R1–R9. Walk every path.

**Out of scope:** continue-* lockdown and continue-* Step 0 trimming (PR3).

### PR 3 — continue-* lockdown

**Goal.** Make `workflow-start` the sole user-facing entry; continue-* become model-only.

**Preconditions:** PR2 merged.

**Work items.**
- Add `user-invocable: false` to the five `continue-*/SKILL.md`.
- **Trim Step 0** in continue-* (remove migrations + knowledge-check; keep casing) — safe now, since they're only reachable via `workflow-start`.
- **Text-migrate user-facing `/continue-*` promises** → "resume via `/workflow-start`": `workflow-start/references/{active-work,manage-work-unit,absorb-into-epic}.md`, `continue-*/references/validate-selection.md` (×5), `README.md`, and any others surfaced by `grep -rl '/continue-'`. **Leave internal invocations unchanged** (workflow-bridge, workflow-legacy-research-split, topic-discovery-dispatch, map-operations, migration 038).
- `active-work.md` routing becomes model-side invocation (user sees outcome, not a command to type).

**Resume logic unchanged** — five distinct continue-* skills, same displays/menus/state aggregation.

**Acceptance:** path inventory Part 4 (Step-0 survival); `/continue-*` no longer typeable; existing work still reachable via `workflow-start` → active-work; internal invocations still resolve; bridge knowledge-check confirmed a non-issue (pass IV).
