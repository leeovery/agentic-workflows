# PR 2: Bridge Always Fires

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md). Design context in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](archive/WORK-TYPE-ARCHITECTURE-DISCUSSION.md) (lines 592-594).*

## Summary

Update all processing skills to trigger workflow-bridge at phase conclusion, regardless of work type. The bridge reads work_type from the manifest and routes accordingly.

## Current State

Processing skills only fire the bridge when `work_type` was explicitly set in the handoff. If it's missing (standalone invocation, dropped context), the pipeline silently stops.

## Target State

Every processing skill fires the bridge at conclusion. The bridge:
- Reads work_type from the manifest (single source of truth)
- For feature/bugfix: linear forward routing (next phase)
- For epic: handled by PR 3

Since PR 5 ensures phase skills are always invoked with full context, the "no work_type" case should not arise. The bridge can assume a manifest exists.

## Changes

- Each processing skill's conclude step invokes workflow-bridge unconditionally
- Remove conditional "if work_type is set" checks around bridge invocation
- Bridge reads work_type from manifest via CLI, not from the handoff context

## Dependencies

- Depends on: PR 4/5 (callers always provide context, no standalone cases)
- Enables: PR 3 (epic-specific bridge behaviour)
