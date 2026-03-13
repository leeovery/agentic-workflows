# Tick: Authoring

## Descriptions: Inline Only

**CRITICAL**: Always pass descriptions directly as inline quoted strings. Never use workarounds.

```bash
tick create "Title" --parent <id> --description "Full description here.

Multi-line content works fine inside double quotes."
```

**Do NOT**:
- Use heredocs (`<<'EOF'`) — sandbox blocks the temp files they create
- Use the Write tool to create temp files — triggers approval prompts outside the project directory
- Use Bash functions, variables, or subshells to construct the description
- Write temp files anywhere (including `$TMPDIR`, `/tmp`, or the working directory)

If a description contains double quotes, escape them with `\"`. That's it.

## Task Storage

Tasks are created using the `tick create` command. Before creating individual tasks, establish the topic and phase parent tasks.

**1. Create the topic task:**

```bash
tick create "{Topic Name}"
```

This returns the topic task ID (e.g., `tick-a1b2`).

**2. Create phase tasks as children of the topic:**

```bash
tick create "Phase 1: {Phase Name}" --parent tick-a1b2
tick create "Phase 2: {Phase Name}" --parent tick-a1b2
```

**3. Create tasks as children of their phase:**

```bash
tick create "{Task Title}" --parent tick-c3d4 \
  --description "{Task description content.

Acceptance criteria, edge cases, and implementation
details go here. Supports multi-line text.}"
```

Complete example — creating a task under a phase:

```bash
tick create "Implement authentication middleware" \
  --parent tick-c3d4 \
  --description "Create Express middleware that validates JWT tokens on protected routes.

Acceptance criteria:
- Validates token signature and expiry
- Extracts user ID from token payload
- Returns 401 for missing or invalid tokens
- Passes user context to downstream handlers"
```

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

Set the task type during creation to reflect the work type:

```bash
tick create "Fix null pointer in auth handler" --parent <phase-id> --type bug
tick create "Add OAuth2 support" --parent <phase-id> --type feature
tick create "Refactor database connection pool" --parent <phase-id> --type task
tick create "Update CI pipeline config" --parent <phase-id> --type chore
```

Valid types: `bug`, `feature`, `task`, `chore`. Use `bug` for bugfix work types, `feature` for feature work types, and `task` or `chore` as appropriate for individual tasks within any work type.

### Tags

Tags provide additional categorisation beyond the parent/child hierarchy:

```bash
tick create "Add rate limiting" --parent <phase-id> --tags "api,security"
```

Tags are comma-separated, kebab-case. Filter tasks by tag:

```bash
tick list --parent <topic-id> --tag api
tick ready --parent <phase-id> --tag security
```

### References

Link tasks to external resources (spec sections, discussion topics, tickets):

```bash
tick create "Implement caching layer" --parent <phase-id> --refs "spec:caching,discussion:performance"
```

References are comma-separated free-form strings.

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
