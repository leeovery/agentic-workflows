---
topic: cli-enhancements
status: concluded
type: feature
work_type: feature
date: 2026-02-27
review_cycle: 2
finding_gate_mode: gated
sources:
  - name: cli-enhancements
    status: incorporated
---

# Specification: CLI Enhancements

## Specification

### Partial ID Matching

Allow users to reference tasks by a prefix of the hex portion instead of the full `tick-XXXXXX` ID.

**Resolution rules:**
- Both `tick-a3f` and `a3f` accepted — strip `tick-` prefix if present before matching
- Exact full-ID match takes priority: if input matches a complete ID (10 chars: `tick-` + 6 hex), return immediately without checking for prefix collisions
- Prefix matching only for inputs shorter than a full ID
- Minimum 3 hex chars required for prefix matching (prevents overly broad matches)
- Ambiguity (2+ matches): error listing the matching IDs
- Zero matches: "not found" error
- Case-insensitive: input normalized to lowercase before matching

**Implementation location:**
- Storage layer — `ResolveID(prefix)` method querying `WHERE id LIKE 'tick-{prefix}%'`
- Centralized: all commands resolve first, then proceed with the full ID
- Applies everywhere an ID is accepted: positional args, `--parent`, `--blocked-by`, `--blocks`

### Task Types

A string field on Task classifying the kind of work.

**Allowed values:** `bug`, `feature`, `task`, `chore` (closed set — anything else errors).

**Validation:**
- Case-insensitive input, trimmed, stored lowercase
- Validated on create and update

**CLI flags:**
- `--type <value>` on `create` and `update` — sets or replaces the type
- `--clear-type` on `update` — explicitly removes the type
- `--type` and `--clear-type` are mutually exclusive
- Empty value on `--type` errors (protective against accidental erasure)

**Filtering:**
- `--type <value>` on `list`, `ready`, `blocked` — single value filter only
- No comma-separated, no multiple flags (keeps comma semantics consistent with tags where comma = AND; AND is meaningless for a single-value field)
- Filter input normalized (trimmed, lowercased) before matching

**Storage:**
- JSONL: string field with `omitempty`
- SQLite: `TEXT` column on `tasks` table

**Display:**
- List output: shown as a column — ID, Status, Priority, Type, Title. Dash (`-`) when not set.
- Show output: displayed with other fields

### Tags

A `[]string` field on Task for user-defined labels.

**Validation:**
- Strict kebab-case: `[a-z0-9]+(-[a-z0-9]+)*`
- No spaces, no commas, no leading/trailing hyphens, no double hyphens
- Input trimmed and lowercased (normalize, don't error on case)
- Max 30 chars per tag
- Max 10 tags per task (validated after deduplication)
- Silently deduplicate on input (e.g. `--tags ui,backend,ui` stores `[ui, backend]`)

**CLI flags:**
- `--tags <comma-separated>` on `create` and `update` — sets or replaces all tags
- `--clear-tags` on `update` — explicitly removes all tags
- `--tags` and `--clear-tags` are mutually exclusive
- Empty value on `--tags` errors (protective against accidental erasure)

**Filtering:**
- `--tag <comma-separated>` on `list`, `ready`, `blocked` — comma-separated values are AND (task must have all listed tags)
- Multiple `--tag` flags are OR (task matches any group)
- Composable: `--tag ui,backend --tag api` means "(ui AND backend) OR api"
- Filter input normalized (trimmed, lowercased) before matching

**Storage:**
- JSONL: JSON array with `omitempty` (empty slices omitted entirely)
- SQLite: junction table `task_tags(task_id, tag)` — follows the established `blocked_by` → `dependencies` pattern. Populated during `Cache.Rebuild()`.

**Display:**
- List output: not shown (variable-length, would clutter the table)
- Show output: displayed with other fields

### External References

A `[]string` field on Task for cross-system links (`gh-123`, `JIRA-456`, URLs).

**Validation:**
- Non-empty, no commas, no whitespace (contiguous strings only)
- Input trimmed before validation
- Max 200 chars per ref
- Max 10 refs per task (validated after deduplication)
- No format validation — accept any ticket format, URL, or identifier
- Silently deduplicate on input

**CLI flags:**
- `--refs <comma-separated>` on `create` and `update` — sets or replaces all refs
- `--clear-refs` on `update` — explicitly removes all refs
- `--refs` and `--clear-refs` are mutually exclusive
- Empty value on `--refs` errors (protective against accidental erasure)

**Filtering:**
- Not filterable on `list`, `ready`, `blocked`. Refs are a "look up" thing — visible on `show`, followed as links. Add later if demand emerges.

**Storage:**
- JSONL: JSON array with `omitempty` (empty slices omitted entirely)
- SQLite: junction table `task_refs(task_id, ref)` — follows the same pattern as tags and dependencies. Populated during `Cache.Rebuild()`.

**Display:**
- List output: not shown
- Show output: displayed with other fields

### Notes

Timestamped text entries appended to a task — a log of context, decisions, progress.

**Data model:**
- Task struct gets `Notes []Note` where `Note` is `{Text string, Created time.Time}`
- Adding or removing a note updates the task's `Updated` timestamp

**Subcommands:**
- `tick note add <id> <text>` — append a timestamped note. Text is multi-word from remaining args after ID.
- `tick note remove <id> <index>` — remove by 1-based position
- No `tick note list` — view notes via `tick show`. Can add later if needed.

**Validation:**
- Empty note text: error
- Max length: 500 chars
- Note remove index must be >= 1 and <= number of existing notes; out-of-bounds errors

**Storage:**
- JSONL: JSON array with `omitempty`
- SQLite: `task_notes(task_id, text, created)` table

**Display (in `tick show`):**
- Notes shown chronologically (most recent last)
- Format:
  ```
  Notes:
    2026-02-27 10:00  Started investigating the auth flow
    2026-02-27 14:30  Root cause found — token refresh race condition
  ```

### List Count/Limit

A `--count N` flag to cap the number of results returned.

**Behaviour:**
- Translates to a SQL `LIMIT` clause
- Must be >= 1; zero or negative values error

**CLI flags:**
- `--count N` on `list`, `ready`, `blocked`

## Dependencies

All six features are additive enhancements to the existing CLI. They build on the current Task struct, storage layer (JSONL + SQLite cache), and command handlers — all of which already exist.

No blocking prerequisites. Implementation can begin immediately.

---

## Working Notes
