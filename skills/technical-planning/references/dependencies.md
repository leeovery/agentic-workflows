# Dependencies

*Reference for **[technical-planning](../SKILL.md)***

---

## Internal Dependencies

Internal dependencies are dependencies within a single topic/epic — where one task depends on another task in the same plan.

These are established during planning by the **Analyze Task Graph** step. After all tasks are authored, a dedicated agent analyzes the full plan, determines which tasks depend on which, assigns priorities based on graph position, and records both via the output format's `graph.md` instructions.

The output format's `graph.md` reference documents how dependencies and priorities are stored and queried for each format.

## External Dependencies

External dependencies are things a feature needs from other topics or systems that are outside the current plan's scope. They come from the specification's Dependencies section.

## Format

External dependencies are stored in the **manifest** as `external_dependencies` (under `--phase planning --topic {topic}`), keyed by topic:

```json
{
  "billing-system": {
    "description": "Invoice generation for order completion",
    "state": "unresolved"
  },
  "user-authentication": {
    "description": "User context for permissions",
    "state": "resolved",
    "task_id": "auth-1-3"
  },
  "payment-gateway": {
    "description": "Payment processing",
    "state": "satisfied_externally"
  }
}
```

Set individual dependencies via dot-path:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies.billing-system '{"description":"Invoice generation","state":"unresolved"}'
```

If there are no external dependencies, use an empty object:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies '{}'
```

This makes it explicit for downstream stages that dependencies were considered and none exist.

## States

| State | Format | Meaning |
|-------|--------|---------|
| `unresolved` | `state: unresolved` | Dependency exists but not yet linked to a task |
| `resolved` | `state: resolved` + `task_id: {id}` | Linked to specific task in another plan |
| `satisfied_externally` | `state: satisfied_externally` | Implemented outside workflow |

## Lifecycle

```
SPECIFICATION                    PLANNING
───────────────────────────────────────────────────────────────────
Dependencies section    →    Added to manifest as unresolved
(natural language)                      ↓
                             Resolved when linked to specific task ID
                             (via planning or /link-dependencies)
```

## Resolution

Dependencies move from `unresolved` → `resolved` when:
- The dependency topic is planned and you identify the specific task
- The `/link-dependencies` command finds and wires the match

Dependencies become `satisfied_externally` when:
- The user confirms it was implemented outside the workflow
- It already exists in the codebase
- It's a third-party system that's already available
