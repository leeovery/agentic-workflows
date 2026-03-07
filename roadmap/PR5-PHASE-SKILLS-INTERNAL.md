# PR 5: Phase Skills Internal

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md). Design context in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](archive/WORK-TYPE-ARCHITECTURE-DISCUSSION.md) (lines 633-635).*

## Summary

Phase entry skills (`/start-discussion`, `/start-specification`, `/start-planning`, `/start-implementation`, `/start-review`, `/start-investigation`) become model-invocable only, no longer user-invocable. Users enter through `/workflow-start` or the type-specific start/continue skills.

## What Gets Removed

- **Standalone discovery mode** — no need to scan all manifests and present selection menus. The caller already picked the work unit.
- **Fresh paths** — context gathering (naming, bug description) is handled by start skills before invoking phase skills.
- **"No topic provided" gates** in processing skills — the caller always provides it.
- **Two-mode pattern collapse** — bridge mode is the only mode. Discovery lives exclusively in workflow-start and the three start/continue skill pairs.
- **Display files** that show flat cross-work-unit lists (display-plans.md, display-state.md, display-options.md, etc.) — replaced by the continue skill's scoped display.

## Rename

Rename phase entry skills from `start-*` to `workflow-enter-*` (e.g., `start-discussion` → `workflow-enter-discussion`). "Start" implies creation, but these skills enter an existing phase within an already-created work unit. The `workflow-` prefix groups them with other internal workflow skills (`workflow-start`, `workflow-bridge`, `workflow-manifest`, `workflow-shared`).

## What Remains

Each phase skill becomes a thin routing layer:
1. Validate the topic exists (plan file present, spec concluded, etc.)
2. Set up session state
3. Invoke the processing skill with work_type + work_unit + topic

## File Changes Expected

- Remove `scripts/discovery.js` from each start-phase skill (or heavily simplify)
- Remove display reference files (route-scenario.md, display-*.md, handle-selection.md)
- Remove gather-context reference files (moved to start skills)
- Simplify SKILL.md to just: determine mode → validate → invoke
- Set `user-invocable: false` on all phase entry skills

## Dependencies

- Depends on: PR 4 (start/continue skills must exist first)
- Enables: PR 2/3 (bridge is simpler when phase skills always receive full context), PR 6 (processing skills can assume pipeline context)
