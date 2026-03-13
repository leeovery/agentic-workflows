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

Requires the Linear MCP server to be configured in Claude Code.

Check if Linear MCP is available by looking for Linear tools. If not configured, inform the user that Linear MCP is required for this format.

Ask the user: **Which team should own this project?**

## Structure Mapping

| Concept | Linear Entity |
|---------|---------------|
| Topic | Project |
| Phase | Label (e.g., `phase-1`, `phase-2`) |
| Task | Issue |
| Dependency | Issue blocking relationship |

Each topic becomes its own Linear project. Phases are represented as labels on issues.

## Output Location

Tasks are stored as issues in a Linear project:

```
Linear:
└── Project: {work_unit}
    ├── Issue: Task 1 [label: phase-1, priority: urgent]
    ├── Issue: Task 2 [label: phase-1, priority: normal]
    └── Issue: Task 3 [label: phase-2, priority: high]
```

Linear is the source of truth for task detail and status.
