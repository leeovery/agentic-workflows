# PR 3: Bridge Epic Navigation

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md). Design context in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](archive/WORK-TYPE-ARCHITECTURE-DISCUSSION.md) (lines 596-602, 510-554).*

## Summary

Epic-specific bridge behaviour. When a phase concludes within an epic, the bridge presents navigation options rather than linear forward routing.

## Options Presented

1. **Proceed to next phase** — with a specific topic/grouping
2. **Stay in current phase** — work on another topic
3. **Go back to a previous phase** — reopen a concluded artifact or create a new one
4. **Done for now** — exit cleanly, return via `/continue-epic`

## Phase Gating

- **Hard gates** (blocking): can't enter a phase if zero completed artifacts from the prerequisite phase exist
- **Soft guidance** (non-blocking): warn if suggested completion isn't met (e.g., "3 of 5 discussions still in progress — specification works best with all concluded. Proceed anyway?")
- **No enforcement**: topics move independently within an epic

## Going Backward

Always valid. Could mean:
- Reopen a concluded artifact
- Create a new artifact in a previous phase
- Return to research

The bridge shows concluded artifacts that could be reopened alongside the option to create new ones.

## Dependencies

- Depends on: PR 2 (bridge fires unconditionally)
- Feature/bugfix bridge routing (linear) is handled by PR 2; this PR only adds epic navigation
