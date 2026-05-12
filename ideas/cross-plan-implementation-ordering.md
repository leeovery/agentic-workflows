# Cross-Plan Implementation Ordering

## The Issue

In an epic with multiple topics, the workflow has no reliable way to enforce that plans are implemented in the right order. The user can pick any "plan completed" topic from the epic menu and start implementation — even if it logically depends on another topic that hasn't shipped yet.

Concrete example encountered: an epic with two completed plans — `nuxt-frontend-auth-scaffold` and `template-authoring-system`. The latter's Phase 1 walking-skeleton acceptance criteria assume the SPA project already exists with auth-aware routing and Sanctum session login — which is exactly what `nuxt-frontend-auth-scaffold` ships. Implementation order matters. But the epic menu listed both as equally implementable and the only soft-ordering hint was a narrative recommendation prefix.

## Findings From a Walk Through the Skills

### What exists today

**Planning side — `workflow-planning-process/references/resolve-dependencies.md`** (alive):
- Sections A–F. Reads the spec's "Dependencies" section into `manifest.planning.{topic}.external_dependencies` keyed by `dep_topic`.
- Section D resolves forward: if `dep_topic` has a planning entry, find the matching task by name vs description and record `state: resolved` + `internal_id`.
- Section E (Reverse Check) scans *every other* topic's `external_dependencies` for entries pointing at the current topic, and resolves those on the inverse plan's manifest entry.

**Implementation gate — formerly `workflow-implementation-entry/references/validate-dependencies.md` + `check-dependencies.md`** (deleted on commit `4faa144`, Mar 28 2026):
- Ran only for `work_type == epic`.
- Evaluated each declared `external_dependencies` entry: `satisfied_externally` skipped, `unresolved` blocked, `resolved` looked up the `internal_id` in the upstream plan's `implementation.{dep_topic}.completed_tasks` and blocked if the upstream task was not yet done.
- If blocked, prompted `s/satisfied` (mark satisfied externally) or `i/implement` (bail to implement upstream first).

**Together** these two halves enforced ordering: planning wired the dependencies, implementation entry gated start until upstream tasks were done.

### What broke / went missing

1. **The implementation gate is gone.** The deletion in `4faa144` removed the enforcement half. Planning still wires `external_dependencies` into the manifest but nothing reads them at implementation time.
2. **Both halves depend on the spec author declaring deps.** Even if the gate were restored, it only enforces what the spec's "Dependencies" section names. Implicit deps inferred from narrative acceptance text (e.g. Phase 1's "A Nuxt SPA project exists with auth-aware routing and Sanctum session login" implying a dep on `nuxt-frontend-auth-scaffold`) are invisible to the resolver.
3. **The epic menu has no order awareness.** `continue-epic`'s `epic-display-and-menu.md` shows all plan-completed topics as equally selectable. The only ordering signal is the static "(recommended)" prefix from the `gating.next_phase_ready` logic — which is currently based on phase state, not cross-plan dep state.

## Proposed Direction (from user)

The user's proposal is to centralise this in three layers:

1. **Planning gains a content-appraisal pass for cross-plan ordering.** After a plan finishes authoring, an agent reads the new plan's content together with all other completed plans in the epic and infers cross-plan dependency candidates. Surfaces them for user confirmation. Approved candidates are written into `manifest.planning.{topic}.external_dependencies` (same shape resolve-dependencies.md uses) so by the time the last plan is done, the full inter-plan dependency graph is wired.

2. **Output format enforces the ordering.** Once cross-plan deps are in the manifest, the format adapter (tick, linear, etc.) materialises them as real task-graph edges — e.g. for tick, `tick dep add` between specific tasks across plans. The implementer's `tick ready` then naturally surfaces tasks in the right order regardless of which plan they live in.

3. **The epic menu becomes "implement next available task" rather than "pick a topic".** Instead of listing every plan-completed topic as an option, the menu collapses to a single "Start implementing the next ready task" action backed by the format's ready-set query. The user no longer needs to know which topic to start — the format's dep graph says.

## What This Requires

- **A new cross-plan content-appraisal agent** at the planning layer (sits in `workflow-planning-process`, likely at or near Step 9 plan-review, or as a new dedicated step after Step 8 resolve-dependencies). Reads multiple plan files + the new plan's content, proposes inferred deps, gates on user confirmation, writes approved entries into the manifest.
- **Format-adapter extension** to materialise cross-plan `external_dependencies` as real graph edges in the chosen format. The current `graph.md` reference for each format documents intra-plan dep wiring; this would extend it to cross-plan.
- **A new epic menu action that delegates to the format's ready-set.** Replaces (or augments) the per-topic implementation options with a single "next available task" entry. The current `continue-epic` discovery + display would need to query the format adapter for ready tasks rather than just listing plan-completed topics.
- **Optional: restore the deleted implementation gate** as a backstop. Even with format-level enforcement, a manifest-level gate at `workflow-implementation-entry` protects against the user picking a specific topic directly. Whether this is needed depends on whether the menu still allows topic-specific entry points.

## Scope Note

This is an overhaul that touches planning (new agent + step), the format adapters (cross-plan dep materialisation), and the epic menu (ordering-aware option set). It also implies a shift in the user's mental model — from "I pick what to implement" to "the workflow picks the next ready task". That UX change should probably be considered explicitly rather than incidentally.
