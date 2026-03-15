# Dependencies

*Reference for **[workflow-planning-process](../SKILL.md)***

---

## Internal Dependencies

Internal dependencies are dependencies within a single topic/epic — where one task depends on another task in the same plan.

These are established during planning by the **Analyze Task Graph** step. After all tasks are authored, a dedicated agent analyzes the full plan, determines which tasks depend on which, assigns priorities based on graph position, and records both via the output format's `graph.md` instructions.

The output format's `graph.md` reference documents how dependencies and priorities are stored and queried for each format.

## External Dependencies

External dependencies are things a feature needs from other topics or systems that are outside the current plan's scope. They come from the specification's Dependencies section.

## Format

External dependencies are stored in the **manifest** as `external_dependencies` (under `planning.{topic}`), keyed by topic:

```json
{
  "billing-system": {
    "description": "Invoice generation for order completion",
    "state": "unresolved"
  },
  "user-authentication": {
    "description": "User context for permissions",
    "state": "resolved",
    "internal_id": "auth-1-3"
  },
  "payment-gateway": {
    "description": "Payment processing",
    "state": "satisfied_externally"
  }
}
```

The resolve-dependencies step handles all manifest writes — see [resolve-dependencies.md](resolve-dependencies.md) for the CLI commands.

## States

| State | Format | Meaning |
|-------|--------|---------|
| `unresolved` | `state: unresolved` | Dependency exists but not yet linked to a task |
| `resolved` | `state: resolved` + `internal_id: {id}` | Linked to specific task in another plan |
| `satisfied_externally` | `state: satisfied_externally` | Implemented outside workflow |

## Lifecycle

```
SPECIFICATION                    PLANNING
───────────────────────────────────────────────────────────────────
Dependencies section    →    Added to manifest as unresolved
(natural language)                      ↓
                             Resolved when linked to specific internal ID
                             (via planning resolve-dependencies step)
```

## Resolution

Dependencies move from `unresolved` → `resolved` when:
- The dependency topic is planned and the resolve-dependencies step identifies the specific task
- A reverse check during another topic's planning resolves it

Dependencies become `satisfied_externally` when:
- The user confirms it was implemented outside the workflow
- It already exists in the codebase
- It's a third-party system that's already available
