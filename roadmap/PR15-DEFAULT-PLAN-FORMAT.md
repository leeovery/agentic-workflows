# PR 15: Default Plan Format Inheritance

## Summary

Add phase-level default format for planning. First topic's format choice is stored at phase level; subsequent topics inherit it automatically instead of prompting the user again. Topic-level format overrides the default if set.

## Background

`workflow-planning-entry/references/invoke-skill.md` already queries `--phase planning format` (phase level, no topic) — but nothing writes to that path. The planning process skill stores format at topic level only. This PR wires up both sides so the phase-level default actually works.

## Design

### Write side

When the planning process skill saves a format choice for a topic, also set it at phase level if no phase-level default exists yet:

```bash
# Always set at topic level (existing behaviour)
$MANIFEST set {work_unit} --phase planning --topic {topic} format {chosen-format}

# Also set at phase level if not already set
$MANIFEST set {work_unit} --phase planning format {chosen-format}
```

### Read side

The planning entry skill's invoke-skill.md already queries the phase-level field. No change needed — the existing query starts working once the write side populates it.

### Inheritance logic

In the planning process skill, when determining format for a new topic:

1. Check topic-level format (`--phase planning --topic {topic} format`) — if set, use it
2. Check phase-level default (`--phase planning format`) — if set, use it as recommendation
3. Neither set — prompt user to choose

### Override

User can always choose a different format for a specific topic. The topic-level value takes precedence. Phase-level default is a recommendation, not a constraint.

## Touch Points

- `skills/workflow-planning-process/SKILL.md` — write phase-level default on first format selection
- `skills/workflow-planning-process/references/` — format selection logic to check phase default
- `skills/workflow-planning-entry/references/invoke-skill.md` — already queries phase-level (no change needed, just verify it works)
- `tests/scripts/test-workflow-manifest.sh` — test phase-level format read/write
