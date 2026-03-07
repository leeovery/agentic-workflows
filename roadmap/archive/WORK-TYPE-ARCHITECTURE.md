# Work Type Architecture — Design Questions (Resolved)

Captured during the unified entry point PR (`feat/unified-entry-point-work-type-architecture`). These questions were resolved by the V2 architecture — see `WORK-TYPE-ARCHITECTURE-DISCUSSION.md` for the design discussion and decisions.

## Background

The workflow system originally targeted epic development — research through to implementation for a new product. Work types (feature, bugfix, epic) were added to support different pipeline shapes on existing products. The current PR adds investigation for bugfix, unified entry points (`/workflow-start`, `/workflow-bridge`), and two-mode phase skills (bridge vs discovery).

## Problem 1: Pipeline Continuity Is Fragile

`work_type` in artifact frontmatter serves two purposes:
1. **Pipeline shape** — determines which phases exist and how they connect
2. **Pipeline continuity** — tells the processing skill to fire `workflow-bridge` at conclusion

These are conflated. If `work_type` is missing from an artifact, the pipeline silently stops — no bridge, no continuation. The user gets a terminal message instead of being routed forward.

### Where work_type gets lost

- **Bare invocations from epic menus**: "Start specification", "Start new discussion", "Start new research" invoke skills without arguments. No work_type flows through.
- **Direct phase entry**: `/start-discussion`, `/start-specification`, etc. invoked without arguments create artifacts without work_type.
- **Templates don't include work_type**: Only investigation template has it. Discussion, specification, and research templates omit it.
- **Discovery-mode handoffs don't pass work_type**: Only bridge-mode handoffs and power-user skills (`/start-feature`, `/start-bugfix`) explicitly instruct work_type in the handoff text.

### Current mitigations

- Migrations 013-015 backfill `work_type: epic` into existing artifacts — fixes old files but doesn't prevent the issue for new ones
- Bridge mode (topic + work_type positional args) carries work_type correctly
- Power user entry points hardcode work_type in handoff templates

### What needs deciding

Should pipeline continuity be tied to work_type, or should there be an independent mechanism (e.g., `pipeline: active` flag, or always fire the bridge and let it decide)?

## Problem 2: Greenfield Scope Pollution

All artifacts live in `.workflows/` with no scoping. A epic v1 project creates research, discussions, specifications, plans — all concluded. When the user later wants to do major new work (v2, new subsystem), those old artifacts pollute discovery scripts, menus, and analysis.

### What needs deciding

- Should there be a concept of "archiving" or "closing" a epic cycle?
- Should discovery scripts filter by some scope/project/cycle marker?
- Is this a naming problem (epic implies "from scratch") or a structural problem?

## Problem 3: Missing Middle Ground in Work Type Taxonomy

Current work types:
- **Greenfield**: Phase-centric, multi-topic, long-running. All artifacts in a phase complete before moving on.
- **Feature**: Topic-centric, single-session, linear. One topic through all phases.
- **Bugfix**: Investigation-centric, single-session. Investigation replaces discussion.

Gap: Large feature set on an existing product. Multiple related discussions and specs needed, but it's not a "new product from scratch." Greenfield's model (complete all discussions before any specs) may be too rigid. Feature's model (one topic) is too narrow.

### What needs deciding

- Is a fourth work type needed (epic, initiative, project)?
- Or can epic be repurposed to mean "multi-topic, phase-centric work" regardless of whether the product exists?
- If epic is repurposed, does it need scoping (Problem 2) to separate cycles?

## Problem 4: No Work Type Pivot

If a user starts with `/start-feature` but research reveals the scope is larger than one topic, there's no mechanism to pivot to epic (or whatever the multi-topic work type is). The pipeline is locked to feature.

### What needs deciding

- Should there be a pivot mechanism?
- Or should the guidance be "start over with the right work type"?
- How much context can be preserved during a pivot?

## Problem 5: Direct Phase Entry Ambiguity

When a user calls `/start-discussion` directly (no `/start-feature`, no `/workflow-start`), what work type applies?

Options discussed:
1. **No pipeline** — direct entry is standalone, no work_type, no bridge at conclusion
2. **Default to epic** — assume multi-topic if not specified
3. **Ask** — if no existing context provides work_type, ask the user

### What needs deciding

- Which option is correct?
- Should the answer differ by phase? (e.g., `/start-research` is commonly standalone, `/start-planning` almost always needs a pipeline)
- If existing artifacts have work_type, should resuming them carry it forward? (Currently: yes, the file on disk preserves it)

## Immediate Fixes (This PR)

The following concrete bugs are being fixed in this PR regardless of the above design questions:

1. **Greenfield menus stripped "Continue specification" entirely** — should offer it routing to bare `/start-specification` (discovery mode with analysis)
2. **Bare invocations from epic menus need work_type** — parameter reorder: `$0` = work_type, `$1` = topic, so work_type can be passed without topic
3. **Bridge discovery script research→discussion bug** — research has no `status: concluded`, so feature bridge never routes forward (fixed)
4. **Bridge mode gather-context-bridge loses research context** — now detects research file and includes discussion-ready summary (fixed)
5. **Convention fixes across validate/check reference files** (fixed)

## Next Steps

This document should be the seed for a proper workflow discussion cycle once the project is set up for dogfooding. Run `/start-discussion` on this document to work through the design questions systematically.
