# Start/Continue Split — Design Document

*Part of the [Implementation Index](../IMPLEMENTATION-INDEX.md). Evolved from [PR4-START-CONTINUE-SPLIT.md](../PR4-START-CONTINUE-SPLIT.md). Full design context in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](../WORK-TYPE-ARCHITECTURE-DISCUSSION.md) (lines 609-636).*

## Summary

Split each work-type entry point into separate start and continue skills. Six new skills replace three overloaded ones. Workflow-start is redesigned as a unified router that delegates to these skills.

Current state: `start-feature`, `start-bugfix`, `start-epic` handle both creation AND resume (via name-check conflict detection). `workflow-start` has a two-step flow (pick type, then pick work unit) with type-specific routing references.

New state: Start skills only create. Continue skills only resume. Workflow-start shows everything in one view and dispatches in one step.

---

## Skill Responsibilities

| Skill | Responsibility | Args |
|-------|---------------|------|
| `workflow-start` | Show all state, unified menu, route to start/continue skills | None |
| `start-feature` | Gather context, name, create manifest, invoke first phase | None |
| `start-bugfix` | Gather context, name, create manifest, invoke investigation | None |
| `start-epic` | Gather context, name, create manifest, invoke first phase | None |
| `continue-feature` | List features (or accept work_unit), determine phase, route | Optional `work_unit` |
| `continue-bugfix` | List bugfixes (or accept work_unit), determine phase, route | Optional `work_unit` |
| `continue-epic` | List epics (or accept work_unit), show topic/phase state, route | Optional `work_unit` |

---

## Start Skills — Changes

Start skills become simpler. They only create new work units.

**Remove:** All resume/conflict-resume logic. The current `name-check.md` references offer "resume" when a name conflict is detected. This is removed entirely.

**Name conflict handling:** If a work unit with the same name exists, reject outright:

```
A {work_type} named "{work_unit}" already exists.
Run /continue-{type} to resume, or choose a different name.
```

No resume option, no type-mismatch handling. Just reject and redirect.

**Cross-routing:** When someone runs `/start-feature` and active features exist, show a lightweight nudge (not a full menu):

```
Note: 2 features already in progress. Run /continue-feature to resume one.
```

Then proceed with the "start new" flow. Don't block, don't duplicate the continue menu.

---

## Workflow-Start — Redesign

Redesigned as a single-step unified router. No more two-step flow (pick type, then pick work unit). One view, one menu, one pick.

### Empty State

> *Output the next fenced block as a code block:*

```
Workflow Overview

No active work found.
```

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
What would you like to start?

1. **Feature** -- add functionality to an existing product
2. **Epic** -- large initiative, multi-topic, multi-session
3. **Bugfix** -- fix broken behavior

Select an option (enter number):
- - - - - - - - - - - -
```

Routes to `start-feature`, `start-epic`, or `start-bugfix`.

### Active Work Exists

> *Output the next fenced block as a code block:*

```
Workflow Overview

Features:
  1. Auth Flow
     └─ Discussion (In Progress)
  2. Caching
     └─ Ready For Specification

Bugfixes:
  3. Login Crash
     └─ Investigation (In Progress)

Epics:
  4. Payments Overhaul
     └─ Research, Discussion, Specification
```

**Display rules:**

- Only show sections (Features, Bugfixes, Epics) that have active work units
- Tree view: numbered items with `└─` branches showing state
- Feature/bugfix: show `phase_label` from `computeNextPhase` (single topic, single phase)
- Epic: show list of phases that have active artifacts (not individual topics — that's continue-epic's job)
- Blank line between each numbered item
- Numbering is continuous across all sections

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
What would you like to do?

1. Continue "Auth Flow" -- feature, discussion (in-progress)
2. Continue "Caching" -- feature, ready for specification
3. Continue "Login Crash" -- bugfix, investigation (in-progress)
4. Continue "Payments Overhaul" -- epic

5. Start new feature
6. Start new epic
7. Start new bugfix

Select an option (enter number):
- - - - - - - - - - - -
```

**Menu rules:**

- Continue items first (numbered to match the display above), then start-new items separated by a blank line
- Feature/bugfix continues show type + phase label
- Epic continues just show "epic" (detail is in continue-epic)
- No auto-select — always show the full menu even with one item
- No "(recommended)" labels

### Routing

| Selection | Routes to |
|-----------|-----------|
| Continue feature/bugfix | `continue-{type} {work_unit}` |
| Continue epic | `continue-epic {work_unit}` |
| Start new feature | `start-feature` |
| Start new epic | `start-epic` |
| Start new bugfix | `start-bugfix` |

### What This Replaces

The current `work-type-selection.md`, `feature-routing.md`, `bugfix-routing.md`, and `epic-routing.md` references are all replaced by a single unified flow.

### Future: Archived Work

Not part of this PR, but the design accommodates it. Below active sections:

```
Archived:
  2 features, 1 epic
```

With a menu option: "View archived". No structural changes needed.

---

## Continue-Feature

Linear pipeline, single topic (topic = work_unit). Pick which feature, determine phase, route.

### Two Modes

**With `work_unit` arg** (from workflow-start): skip to phase determination.

**Without arg** (standalone `/continue-feature`): list active features, user picks.

### No Features Exist

> *Output the next fenced block as a code block:*

```
Continue Feature

No features in progress.

Run /start-feature to begin a new one.
```

Terminal stop.

### Features Exist

> *Output the next fenced block as a code block:*

```
Continue Feature

2 features in progress:

  1. Auth Flow
     └─ Discussion (In Progress)
  2. Caching
     └─ Ready For Specification
```

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
Which feature would you like to continue?

1. Continue "Auth Flow" -- discussion (in-progress)
2. Continue "Caching" -- ready for specification

Select an option (enter number):
- - - - - - - - - - - -
```

No auto-select, even with one item. Consistent with workflow-start.

### Phase Routing

Read manifest, get `next_phase` from `computeNextPhase`, route:

| next_phase | Routes to |
|-----------|-----------|
| research | `start-research feature {work_unit}` |
| discussion | `start-discussion feature {work_unit}` |
| specification | `start-specification feature {work_unit}` |
| planning | `start-planning feature {work_unit}` |
| implementation | `start-implementation feature {work_unit}` |
| review | `start-review feature {work_unit}` |
| done | Show "Feature complete" message, terminal |

---

## Continue-Bugfix

Identical structure to continue-feature. Separate skill, not shared. Linear pipeline, single topic (topic = work_unit).

### No Bugfixes Exist

> *Output the next fenced block as a code block:*

```
Continue Bugfix

No bugfixes in progress.

Run /start-bugfix to begin a new one.
```

Terminal stop.

### Bugfixes Exist

> *Output the next fenced block as a code block:*

```
Continue Bugfix

2 bugfixes in progress:

  1. Login Crash
     └─ Investigation (In Progress)
  2. Memory Leak
     └─ Ready For Specification
```

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
Which bugfix would you like to continue?

1. Continue "Login Crash" -- investigation (in-progress)
2. Continue "Memory Leak" -- ready for specification

Select an option (enter number):
- - - - - - - - - - - -
```

No auto-select.

### Phase Routing

Same as continue-feature but includes investigation:

| next_phase | Routes to |
|-----------|-----------|
| investigation | `start-investigation bugfix {work_unit}` |
| specification | `start-specification bugfix {work_unit}` |
| planning | `start-planning bugfix {work_unit}` |
| implementation | `start-implementation bugfix {work_unit}` |
| review | `start-review bugfix {work_unit}` |
| done | Show "Bugfix complete" message, terminal |

---

## Continue-Epic

The most complex continue skill. Multiple topics, non-linear, topics in different phases simultaneously. After picking the work unit, shows full state and lets user choose what to do.

### Two Modes

**With `work_unit` arg** (from workflow-start): skip to state display.

**Without arg** (standalone `/continue-epic`): list epics, user picks.

### Epic Selection (standalone mode)

> *Output the next fenced block as a code block:*

```
Continue Epic

2 epics in progress:

  1. Payments Overhaul
     └─ Research, Discussion, Specification
  2. Platform Migration
     └─ Discussion
```

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
Which epic would you like to continue?

1. Continue "Payments Overhaul"
2. Continue "Platform Migration"

Select an option (enter number):
- - - - - - - - - - - -
```

No auto-select.

### State Display

Once the work unit is selected, show the full phase-by-phase breakdown. Only show phases that have artifacts.

> *Output the next fenced block as a code block:*

```
Payments Overhaul

  Research
    └─ Exploration (concluded)

  Discussion
    └─ Payment Providers (concluded)
    └─ Transaction Handling (concluded)
    └─ Refund Policy (in-progress)

  Specification
    └─ Payment Processing (in-progress)
       ├─ Payment Providers (incorporated)
       └─ Transaction Handling (pending)
```

**Display rules:**

- Phase headers as section labels
- Items under each phase use `└─` branches with title case names and parenthetical status
- Research topics have statuses (in-progress/concluded) like all other phases
- Specification items show their source discussions as a sub-tree beneath:
  - `├─` for non-last sources, `└─` for last
  - Source status: `(incorporated)` or `(pending)` from manifest
- Planning, implementation, review items use the same `└─` pattern (no sub-tree needed — topic name matches the spec it came from)
- Phases with no artifacts don't appear
- Blank line between phase sections

### Later State Example

> *Output the next fenced block as a code block:*

```
Payments Overhaul

  Research
    └─ Exploration (concluded)

  Discussion
    └─ Payment Providers (concluded)
    └─ Transaction Handling (concluded)
    └─ Refund Policy (concluded)
    └─ Webhook Handling (concluded)

  Specification
    └─ Payment Processing (concluded)
       ├─ Payment Providers (incorporated)
       └─ Transaction Handling (incorporated)
    └─ Refund And Webhooks (in-progress)
       ├─ Refund Policy (incorporated)
       └─ Webhook Handling (pending)

  Planning
    └─ Payment Processing (in-progress)
```

Topic flow is visible: 4 discussion topics grouped into 2 specs (with different names from grouping analysis). Concluded spec feeds planning. Source extraction status shows progress within each spec.

### Recommendations

Above the menu, show a short contextual recommendation when applicable. These inform without restricting — the user can ignore them and pick any valid option.

**Recommendation rules** (check in order, show the first that applies):

| Condition | Recommendation |
|-----------|---------------|
| In-progress items exist across multiple phases | No recommendation (user knows what they're working on) |
| Concluded discussions exist, not all sourced in specs | "Consider concluding remaining discussions before starting specification. The grouping analysis works best with all discussions available." |
| All discussions concluded, specs not started | "All discussions are concluded. Specification will analyze and group them." |
| Some specs concluded, some in-progress | "Concluding all specifications before planning helps identify cross-cutting dependencies." |
| Some plans concluded, some in-progress | "Completing all plans before implementation helps surface task dependencies across plans." |
| Reopened discussion that's a source in a spec | "{Spec} specification sources the reopened {Discussion} discussion. Once that discussion concludes, the specification will need revisiting to extract new content." |

Only one recommendation shown at a time. If none apply, no recommendation block.

### Menu

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
What would you like to do?

1. Continue "Refund Policy" -- discussion (in-progress)
2. Continue "Payment Processing" -- specification (in-progress)
3. Start new discussion topic
4. Start new research
5. Resume a concluded topic

Select an option (enter number):
- - - - - - - - - - - -
```

**Menu construction rules:**

**Section 1 — In-progress items** (always first):
- Any item with status `in-progress` in any phase
- Verb: "Continue"
- Format: `Continue "{Topic}" -- {phase} (in-progress)`

**Section 2 — Next-phase-ready items:**
- Concluded spec with no plan: `Start planning for "{Topic}" -- spec concluded`
- Concluded plan with no implementation: `Start implementation of "{Topic}" -- plan concluded`
- Completed implementation with no review: `Start review for "{Topic}" -- implementation completed`
- Concluded discussions not sourced in any spec: `Start specification -- {N} discussion(s) not yet in a spec`
- No "(recommended)" labels — ordering implies priority

**Section 3 — Standing options** (always present):
- `Start new discussion topic`
- `Start new research`
- `Resume a concluded topic`

**Phase-forward gating:**
- You cannot skip phases. No "Start planning" unless at least one spec is concluded. No "Start implementation" unless at least one plan is concluded. No "Start review" unless at least one implementation is completed.
- But you don't need ALL items in a phase to conclude before the next phase is available. One concluded spec is enough to offer "Start planning" even if other specs are still in-progress.
- Discussion and research are independent — neither requires the other. But specification requires at least one concluded discussion.

### Reopened Discussion Detection

There is no explicit "reopened" status in the manifest. It's derived:

- If a discussion topic has status `in-progress` AND it appears as an `incorporated` source in a specification, it was reopened.
- Display it as `(in-progress)` in the menu — same as any in-progress item.
- Show a recommendation note about the downstream spec impact (see Recommendations table above).

### Resume Concluded Topic — Sub-View

When the user selects "Resume a concluded topic", show a second display listing all concluded items across all phases.

> *Output the next fenced block as a code block:*

```
Concluded Topics

  Research
    └─ Exploration (concluded)

  Discussion
    └─ Payment Providers (concluded)
    └─ Transaction Handling (concluded)

  Specification
    └─ Payment Processing (concluded)
```

Only show phases with concluded items.

> *Output the next fenced block as markdown (not a code block):*

```
- - - - - - - - - - - -
Which topic would you like to resume?

1. Resume "Exploration" -- research
2. Resume "Payment Providers" -- discussion
3. Resume "Transaction Handling" -- discussion
4. Resume "Payment Processing" -- specification
5. Back to main menu

Select an option (enter number):
- - - - - - - - - - - -
```

**Resume routing:** Route to the appropriate phase skill with the topic. The phase entry skill (e.g., `start-discussion`) handles setting the status back to `in-progress` — continue-epic does not modify the manifest status.

**"Back to main menu":** Returns to the continue-epic main display and menu.

**Scope:** All phases appear — research, discussion, specification, planning, implementation, review. If a concluded plan is resumed, the user can add tasks and re-enter implementation. This is a supported workflow.

---

## Reopening Status — Where It's Handled

When a concluded topic is resumed, its status needs to change from `concluded` to `in-progress`. This is NOT done in continue-epic. It's handled by the phase entry skills (`start-discussion`, `start-specification`, etc.).

**Rationale:** Phase entry skills are the bridge between user intent and processing. They already validate topic state. Adding "if concluded, set to in-progress" there keeps it consistent across all invocation paths — from continue-epic, from workflow-bridge, from any future entry point.

**To verify during implementation:** Check whether phase entry skills already handle this. If not, add it consistently across all of them.

**Downstream cascade (deferred):** If a plan is reopened, should implementation/review statuses change? The current system handles forward cascade through source tracking and hash-based change detection in the specification phase. Backward cascade (reopening a plan invalidates later phases) would be new behaviour. Separate design discussion when relevant.

---

## What This Resolves

- **Resume-in-start awkwardness** — start skills only create, continue skills only resume. Single responsibility.
- **Two-step workflow-start** — replaced with one unified view and one menu selection.
- **Flat cross-work-unit display** — eliminated. Continue skills pick the work unit first, then show topics within it.
- **Topic/work_unit conflation** — with work unit already selected, displays only show topics.
- **Epic navigation complexity** — continue-epic shows full phase-by-phase state with source tracking, contextual recommendations, and a resume sub-view for concluded topics.

## Dependencies

- Depends on: PR 1 (manifest CLI, work-unit-first directories, research status tracking)
- Enables: PR 5 (phase skills can go internal once start/continue own all entry logic)

## Open Questions

- **Downstream cascade on reopen**: If a plan is reopened, should implementation/review statuses change automatically? Deferred to separate discussion.
- **Research multiple topics**: Research supports multiple files/topics and has per-topic status. Verify the manifest and discovery scripts fully support this for the display.
