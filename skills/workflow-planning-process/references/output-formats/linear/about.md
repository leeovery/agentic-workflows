# Linear

*Output format adapter for **[workflow-planning-process](../../../SKILL.md)***

---

Use this output format when you want **Linear as the source of truth** for task management. Tasks are stored as Linear issues and can be updated directly in Linear's UI.

## Benefits

- Visual tracking with real-time progress updates
- Team collaboration with shared visibility
- Native priority, estimation, and dependency support
- Update tasks directly in Linear UI without editing markdown
- Integrates with existing Linear workflows

## Setup

Requires the Linear MCP server to be configured in the harness.

Check if Linear MCP is available by looking for Linear tools. If not configured, inform the user that Linear MCP is required for this format.

Ask the user: **Which team should own this project?**

## Structure Mapping

| Concept | Linear Entity |
|---------|---------------|
| Topic | Project |
| Phase | Parent issue (tasks are sub-issues) |
| Task | Issue (sub-issue of phase parent) |
| Dependency | Issue blocking relationship |

Each topic becomes its own Linear project. Phases are parent issues within the project. Tasks are sub-issues of their phase parent.

## Output Location

Tasks are stored as issues in a Linear project:

```
Linear:
└── Project: {topic name}
    ├── Issue: "Phase 1: {phase name}"
    │   ├── Sub-issue: Task 1-1 [priority: urgent]
    │   ├── Sub-issue: Task 1-2 [priority: normal]
    │   └── Sub-issue: Task 1-3 [priority: high]
    └── Issue: "Phase 2: {phase name}"
        ├── Sub-issue: Task 2-1
        └── Sub-issue: Task 2-2
```

Linear is the source of truth for task detail and status.
