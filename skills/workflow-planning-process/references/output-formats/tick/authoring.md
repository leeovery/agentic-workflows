# Tick: Authoring

## Descriptions: Inline Only

**CRITICAL**: Always pass descriptions directly as inline quoted strings. Never use workarounds.

```bash
tick create "Title" --parent <tick-id> --description "Full description here.

Multi-line content works fine inside double quotes."
```

You should never do the following:
- Do not use heredocs (`<<'EOF'`) — sandbox blocks the temp files they create
- Do not use the Write tool to create temp files — triggers approval prompts outside the project directory
- Do not use Bash functions, variables, or subshells to construct the description
- Do not write temp files anywhere (including `$TMPDIR`, `/tmp`, or the working directory)

If a description contains double quotes, escape them with `\"`. That's it.

## Storage Pathspecs

The git pathspecs this format writes **outside `--plan`'s own scope** — the planning topic's directory and the manifests. The array below is recorded verbatim as `storage_paths` on the planning item at plan init; workflow commits (`engine commit --plan`) stage every entry, and restart cleanups stage the same entries when removing authored tasks. Relative pathspecs only — `[]` when the format stores inside that scope.

```json
[".tick/"]
```

The task store lives in `.tick/` at the project root.

## Plan Structure

Create the topic task — this is the plan-level entity in tick. Always set `--refs` to store the workflow's internal ID.

```bash
tick create "{topic:(titlecase)}" --refs "{topic}"
```

The `id:` line of the returned document is the topic's tick id (e.g., `tick-a1b2`) — the plan's external identifier.

## Phase Structure

Create phase tasks as children of the topic task. Each phase is a parent task whose children are the individual tasks.

The `--refs` value follows the internal ID format: `{topic}-{phase_id}`.

```bash
tick create "Phase 1: {phase:(titlecase)}" --parent <topic-tick-id> --refs "{topic}-1"  # returns tick-c3d4
tick create "Phase 2: {phase:(titlecase)}" --parent <topic-tick-id> --refs "{topic}-2"  # returns tick-e5f6
```

The `id:` line of each returned document is that phase's tick id — the phase's external identifier.

## Task Storage

Create tasks as children of their phase task. Always set `--refs` to store the workflow's internal ID. Creating an open task under a `done` parent reopens that parent's `done` ancestors (recursively upward) — the hierarchy stays consistent, no manual reopen needed.

```bash
tick create "{task:(titlecase)}" --parent tick-c3d4 \
  --refs "{internal_id}" \
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

`tick create` answers with the stored record read back — the same document `tick show <tick-id>` prints. Confirm from it that the title, parent, and description are what was passed; a task created without a description carries no `description:` line at all. Never move on from a create whose document lacks a field that was passed.

#### If any field is empty or wrong

→ Load **[updating.md](updating.md)** and follow its instructions to correct the field using `tick update`.

#### If the create fails with a TOON encoding diagnostic

The task was stored and the diagnostic names its id — a control character in the description is what could not be encoded. Take that id; never re-create, which leaves a duplicate.

→ Load **[updating.md](updating.md)** and follow its instructions to rewrite the description without the control character.

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

Phases are represented as parent tasks. Each task belongs to a phase by being a child of that phase's task. Use `--parent <phase-tick-id>` during creation.

To list tasks within a phase:

```bash
tick list --parent <phase-tick-id>
```

### Type

Optional. Set via `--type`. Valid types: `bug`, `feature`, `task`, `chore`. Use `bug` for bugfix work types, `feature` for feature work types, and `task` or `chore` as appropriate for individual tasks within any work type.

### Labels / Tags

Optional — not necessary in most cases, but available if needed. Set via `--tags` with comma-separated, kebab-case values. Tags provide additional categorisation beyond the parent/child hierarchy. Filter tasks by tag:

```bash
tick list --parent <tick-id> --tag api
tick ready --parent <tick-id> --tag security
```

### References

Set via `--refs` to store the internal ID on each tick task, linking it back to the planning system. Set at all levels — topic, phase, and task — as shown in the Task Storage examples above. References are comma-separated if multiple are needed.

## Cleanup (Restart)

Remove the topic task and all its descendants. `<topic-tick-id>` is the plan's `external_id` in the manifest:

```bash
tick remove <topic-tick-id> --force
```

Removing a parent cascades to all children (phases and tasks). Dependency references to removed tasks are auto-cleaned from surviving tasks.
