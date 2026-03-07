# Remove Session State System

## Goal

Remove the session state / compaction recovery hook system entirely. It doesn't work reliably due to bugs, and the complexity isn't justified by the results.

## What to Remove

The current system consists of:

- `hooks/workflows/write-session-state.sh` — writes session YAML to `.workflows/.cache/sessions/{session_id}.yaml`
- `hooks/workflows/compact-recovery.sh` — reads session state on compaction, injects recovery context via `additionalContext`
- `hooks/workflows/session-cleanup.sh` — deletes session state on session end
- `hooks/workflows/session-env.sh` — exports `CLAUDE_SESSION_ID` env var

Plus all `write-session-state.sh` calls scattered across entry-point skill invoke files (25+ references in `skills/start-*/references/`).

## Why

The intent was to help Claude continue correctly after context compaction by injecting the current topic, skill, and artifact path. In practice it doesn't work — the hook system has bugs and the recovery context injection isn't reliable enough to justify the complexity.

## Side Effects

Removing this also resolves the known issue where `start-epic/references/invoke-skill.md` uses `{topic}` in the discussion session state path, but topic isn't defined yet at that point in the epic flow.

## Scope

- Remove the 4 hook scripts listed above
- Remove all `write-session-state.sh` calls from entry-point skills
- Remove `.workflows/.cache/sessions/` references
- Update `system-check.sh` to stop installing session-related hooks
- Update CLAUDE.md session state documentation
- Update tests (`test-session-state.sh`, `test-compact-recovery.sh`)
