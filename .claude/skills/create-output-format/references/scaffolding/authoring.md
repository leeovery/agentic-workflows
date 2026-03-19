# {Format Name}: Authoring

<!-- Instructions for creating plan structure and individual tasks -->
<!-- This file is used by the planning process and task authoring agent — do NOT include priority or dependency info -->

## Plan Structure

<!-- How to create the plan-level entity and what external identifier it produces -->
<!-- Every format must declare this, even when the identifier equals the internal topic name -->

{How to create the plan-level entity in this format. State what external identifier is produced.}

## Phase Structure

<!-- How to create phase-level entities and what external identifier each produces -->
<!-- Every format must declare this, even when the identifier equals the internal phase ID -->

{How to create a phase in this format. State what external identifier is produced.}

## Task Storage

<!-- How to create a task — show the full template -->

{How to create a task in this format — file path, API call, MCP operation, etc.}

<!-- Include a complete example showing the full task template -->
```
{Full task creation example with all properties}
```

## Task Properties

<!-- Properties set during authoring only — priority and dependencies are handled separately in graph.md -->

### Status

<!-- What status values are available and what they mean -->

| Status | Meaning |
|--------|---------|
| {status} | {meaning} |

### Phase Grouping

<!-- How tasks are grouped into phases -->
{How phases are represented — labels, directories, tags, etc.}

### Labels / Tags

<!-- What categorisation is available beyond phases -->
{Available labels/tags and their purpose, or "No additional categorisation beyond phases."}

## Flagging

<!-- How to mark tasks as needing clarification -->
When information is missing:

{Format-specific flagging instructions}

## Cleanup (Restart)

<!-- How to delete all authored tasks for a topic -->
{Format-specific cleanup command or instructions}
