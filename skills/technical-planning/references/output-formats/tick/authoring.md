# Tick: Authoring

## Descriptions: Inline Only

**CRITICAL**: Always pass descriptions directly as inline quoted strings. Never use workarounds.

```bash
tick create "Title" --parent <id> --description "Full description here.

Multi-line content works fine inside double quotes."
```

You should never do the following:
- Do not use heredocs (`<<'EOF'`) — sandbox blocks the temp files they create
- Do not use the Write tool to create temp files — triggers approval prompts outside the project directory
- Do not use Bash functions, variables, or subshells to construct the description
- Do not write temp files anywhere (including `$TMPDIR`, `/tmp`, or the working directory)

If a description contains double quotes, escape them with `\"`. That's it.

## Task Storage

Tasks are created using the `tick create` command. Always set `--refs` to store the workflow's internal ID — this links every tick task back to the planning system. Before creating individual tasks, establish the topic and phase parent tasks.

**1. Create the topic task:**

```bash
tick create "{topic:(titlecase)}" --refs "{topic}"
```

This returns the topic task ID (e.g., `tick-a1b2`).

**2. Create phase tasks as children of the topic:**

The `--refs` value follows the internal ID format: `{topic}-{phase_id}`.

```bash
tick create "Phase 1: {phase:(titlecase)}" --parent tick-a1b2 --refs "{topic}-1"  # returns tick-c3d4
tick create "Phase 2: {phase:(titlecase)}" --parent tick-a1b2 --refs "{topic}-2"  # returns tick-e5f6
```

**3. Create tasks as children of their phase:**

```bash
tick create "{task:(titlecase)}" --parent tick-c3d4 \
  --refs "{topic}-{phase_id}-{task_id}" \
  --description "{description}

Acceptance criteria, edge cases, and implementation
details go here. Supports multi-line text."
```

Complete example — creating a task under Phase 1:

```bash
tick create "Implement authentication middleware" \
  --parent tick-c3d4 \
  --type task \
  --tags "api,auth" \
  --refs "auth-flow-1-1" \
  --description "Create Express middleware that validates JWT tokens on protected routes.

Acceptance criteria:
- Validates token signature and expiry
- Extracts user ID from token payload
- Returns 401 for missing or invalid tokens
- Passes user context to downstream handlers"
```

See **Task Properties** below for details on each flag.

## Post-Creation Verification

After every `tick create`, run `tick show <task-id>` and confirm that the title, description, and parent were all set correctly.

#### If any field is empty or wrong

Load **[updating.md](updating.md)** and follow its instructions to correct the field using `tick update`.

## Task Properties

### Status

Tasks are created with `open` status by default.

| Status | Meaning |
|--------|---------|
| `open` | Task has been authored but not started |
| `in_progress` | Task is currently being worked on |
| `done` | Task is complete |
| `cancelled` | Task is no longer needed |

### Phase Grouping

Phases are represented as parent tasks. Each task belongs to a phase by being a child of that phase's task. Use `--parent <phase-id>` during creation.

To list tasks within a phase:

```bash
tick list --parent <phase-id>
```

### Type

Optional. Set via `--type`. Valid types: `bug`, `feature`, `task`, `chore`. Use `bug` for bugfix work types, `feature` for feature work types, and `task` or `chore` as appropriate for individual tasks within any work type. Doesn't hurt to set — adds useful categorisation at no cost.

### Tags

Optional — not necessary in most cases, but available if needed. Set via `--tags` with comma-separated, kebab-case values. Tags provide additional categorisation beyond the parent/child hierarchy. Filter tasks by tag:

```bash
tick list --parent <parent-id> --tag api
tick ready --parent <parent-id> --tag security
```

### References

Set via `--refs` to store the internal ID on each tick task, linking it back to the planning system. Set at all levels: `{topic}` on the topic task, `{topic}-{phase_id}` on phase tasks, `{topic}-{phase_id}-{task_id}` on tasks. References are comma-separated if multiple are needed.

## Flagging

When information is missing, prefix the task title with `[NEEDS INFO]` and include questions in the description:

```bash
tick create "[NEEDS INFO] Rate limiting strategy" \
  --parent tick-c3d4 \
  --description "Needs clarification:
- What is the rate limit threshold?
- Per-user or per-IP?
- What response code on limit exceeded?"
```

## Cleanup (Restart)

Remove the topic task and all its descendants:

```bash
tick remove <topic-id> --force
```

Removing a parent cascades to all children (phases and tasks). Dependency references to removed tasks are auto-cleaned from surviving tasks.
