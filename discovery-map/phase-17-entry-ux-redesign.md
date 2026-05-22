# Phase 17 — Entry UX & Inception Unification (Exploratory Design)

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
