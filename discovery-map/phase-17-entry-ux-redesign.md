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

Pivot mechanics                           [exploring]
├─ Macro pivot triggers                   [pending]
├─ Scope-down + inbox surface             [converging]
└─ Reasoning surfacing                    [pending]

Imports & inbox handling                  [decided]

Entry surface design                      [converging]
├─ /workflow-start menu                   [decided]
├─ start-* future                         [exploring]
└─ continue-* mirror question             [exploring]

Migration & cutover                       [pending]
```

State key: `pending` (not yet discussed), `exploring` (active discussion), `converging` (narrowing toward decision), `decided` (locked in this pass; future refinements may revisit).

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
