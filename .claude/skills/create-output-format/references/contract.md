# Output Format Contract

*Reference for **[create-output-format](../SKILL.md)***

---

Every output format adapter is a directory of 5 files, each serving a specific concern.

## Required Files

| File | Purpose |
|------|---------|
| `about.md` | Format identity, setup, and storage layout |
| `authoring.md` | Creating tasks and setting their properties |
| `reading.md` | Extracting tasks and determining work order |
| `updating.md` | Modifying tasks — status, content, properties |
| `graph.md` | Task graph — priority and dependencies across tasks |

**Header exemption.** `about.md` opens with the adapter attribution line (`*Output format adapter for …*`). The per-concern files — `authoring.md`, `reading.md`, `updating.md`, `graph.md` — are read by many callers (the planning process, the task-authoring and graphing agents, implementation, and review), so they carry no attribution line: each begins with its `# {Format}: {Concern}` title and goes straight into content.

## File Specifications

### about.md

Provides everything needed to evaluate and initialise the format.

Must include:

- **Format name and description** — what this format is
- **Benefits** — why choose this format
- **Setup** — installation, configuration, prerequisites
- **Structure Mapping** — how workflow concepts (topic, phase, task) map to the format's entities
- **Output Location** — where tasks are stored

### authoring.md

Instructions for creating plan structure and individual tasks. This file is used by the planning process and task authoring agent. It must NOT contain priority or dependency information — those are set later by the graphing agent using graph.md.

Must include:

- **Plan Structure** — how to create the plan-level entity in the format (project, directory, top-level task, etc.) and what external identifier it produces. Every format must declare this, even when the identifier equals the internal topic name.
- **Phase Structure** — how to create phase-level entities (parent tasks, parent issues, directories, etc.) and what external identifier each produces. Every format must declare this, even when the identifier equals the internal phase ID.
- **Storage Pathspecs** — the git pathspecs the format writes outside the work unit, as a JSON array (`[]` when everything lives inside the work unit or off-disk). Recorded as `storage_paths` at plan init; `engine commit --plan` stages them.
- **Task Storage** — how to create a task (file path, API call, etc.) with a complete example showing the full task template
- **Task Properties** — properties set during authoring:
  - **Status** — available values and their meanings
  - **Phase grouping** — how tasks are grouped into phases
  - **Labels/tags** — categorisation available beyond phases
- **Flagging** — how to mark tasks as needing clarification
- **Cleanup (Restart)** — how to delete all authored tasks for a topic

### reading.md

Instructions for extracting tasks and determining work order.

Must include:

- **Listing Tasks** — how to retrieve all tasks for a plan. Returns summary-level information (id, title, status, phase, priority, dependencies) suitable for building a task graph or overview. Format-specific filtering and query capabilities may be documented here.
- **Extracting a Task** — how to read full task detail including all properties
- **Next Available Task** — how to determine the next task to work on. Document how the format uses status, priority, dependencies, and phase ordering to determine sequence.

### updating.md

Instructions for modifying tasks.

Must include:

- **Status Transitions** — how to change task status. Document all supported statuses (e.g., complete, skipped, cancelled, in progress) and how to set each one.
- **Updating Task Content** — how to modify a task's title, description, or other properties after creation.
- **Phase Completion** — what to do when all tasks in a phase are complete or skipped. Formats with no phase entity (or with automatic cascading) declare an explicit no-op — consumers follow this section at every phase boundary.

### graph.md

Instructions for establishing priority and dependencies across tasks. This file is used by the graphing agent after all tasks have been authored. The agent receives the complete plan and uses this file to build the task execution graph.

Must include:

- **Priority** — available levels, how to set priority on a task, and how to remove it.
- **Dependencies** — how to declare that one task depends on another. Must support multiple dependencies per task.
  - **Adding a Dependency**
  - **Removing a Dependency**
