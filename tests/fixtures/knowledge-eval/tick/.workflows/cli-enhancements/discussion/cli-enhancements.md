---
topic: cli-enhancements
status: concluded
work_type: feature
date: 2026-02-27
---

# Discussion: CLI Enhancements

## Context

Six feature additions bundled as one feature, all from the IDEAS.md planned list. These are additive enhancements to the existing CLI with no architectural impact — new fields on Task, new flags on commands, and one new subcommand.

1. **List Count/Limit** — `--count N` flag on `list`/`ready`/`blocked` to cap results (LIMIT clause)
2. **Partial ID Matching** — prefix matching on hex portion of task IDs, error on ambiguous match
3. **Task Types** — `bug`, `feature`, `task`, `chore` string field with validation + filtering
4. **External References** — `[]string` field for cross-system links (`gh-123`, `JIRA-456`, URLs)
5. **Tags** — `[]string` field with `--tags` on create/update, `--tag` filter on list
6. **Notes** — timestamped text entries appended to a task (subcommand)

### References

- [IDEAS.md](../../IDEAS.md) — source of all six items

## Questions

- [x] How should new fields (tags, type, refs) be stored in JSONL and cached in SQLite?
- [x] What's the right UX for partial ID matching — where does resolution happen?
- [x] How should Notes work as a subcommand — add/list/show?
- [x] Should tags and type be settable at creation only, or also via update?
- [x] How should filtering work for tags and type on list commands?
- [x] What validation rules apply to task types and tags?
- [x] Should partial ID matching apply to reference flags (--parent, --blocked-by, --blocks)?
- [x] Should refs be filterable on list commands?
- [x] What new fields show in list output vs show output?
- [x] Does adding/removing a note update the task's Updated timestamp?
- [x] What are the note text constraints?
- [x] What are the edge case rules for --count, dedup, partial ID min length, and ref limits?

---

*Each question above gets its own section below. Check off as concluded.*

---

## How should new fields (tags, type, refs) be stored in JSONL and cached in SQLite?

### Context
Three new fields need storage: tags (`[]string`), type (`string`), and refs (`[]string`). Need to decide JSONL representation and SQLite caching strategy.

### Options Considered

**Option A: Junction tables for slice fields** (like `dependencies` for `blocked_by`)
- `task_tags(task_id, tag)` and `task_refs(task_id, ref)` tables in SQLite
- Proper relational filtering: `WHERE EXISTS (SELECT 1 FROM task_tags ...)`
- Consistent with existing `blocked_by` → `dependencies` pattern

**Option B: JSON/comma-delimited column in tasks table**
- Single TEXT column storing serialized data
- Simpler schema, fewer joins
- Filtering is messy (LIKE or json_each)

### Decision

**Option A — junction tables.** Follows the established `blocked_by` → `dependencies` pattern exactly.

- **JSONL**: JSON arrays on the Task struct with `omitempty`. Empty slices omitted entirely. Simple, flat, human-readable.
- **SQLite**: Junction tables `task_tags(task_id, tag)` and `task_refs(task_id, ref)` populated during `Cache.Rebuild()` by iterating the slice fields — same as `dependencies` today.
- **Type field**: Simple `TEXT` column on `tasks` table, same as `status`. No junction table needed.

JSONL stays flat and simple as source of truth. SQLite gets relational structure for fast filtered queries.

---

## What's the right UX for partial ID matching — where does resolution happen?

### Context
Currently IDs are resolved by exact match (case-insensitive via `NormalizeID`). Every command that takes an ID does its own lookup. Partial matching would let users type `a3f` instead of `tick-a3f2b1`.

### Options Considered

**Option A: Storage layer resolution via SQLite**
- `ResolveID(prefix)` method querying `WHERE id LIKE 'tick-{prefix}%'`
- Centralized — all commands call it once to get the full ID, then proceed as normal
- Read operation, fits naturally as a Store.Query

**Option B: Task/helper layer — pure function scanning `[]Task`**
- `ResolvePrefix(tasks, prefix)` used inside Mutate closures
- Requires in-memory task list, scattered across commands

### Decision

**Option A — storage layer resolution via SQLite.**

- Both `tick-a3f` and `a3f` work — strip `tick-` prefix if present before matching
- Exact full-ID match takes priority: if input matches a complete ID, return immediately without checking for prefix collisions
- Prefix matching only kicks in when input is shorter than a full ID (< 10 chars: `tick-` + 6 hex)
- On ambiguity (2+ matches): return error listing the matching IDs so user can be more specific
- On zero matches: return "not found" error
- Centralized in one place — commands resolve first, then proceed with the full ID

---

## How should Notes work as a subcommand — add/list/show?

### Context
Notes are timestamped text entries appended to a task — a log of context, decisions, progress. Need to decide subcommand structure, mutability, and display.

### Options Considered

**Implicit default: `tick note <id> <text>`**
- Simplest possible UX for adding
- But inconsistent if there are other subcommands like remove

**Explicit subcommands: `tick note add` / `tick note remove`**
- Consistent — symmetric verbs
- Matches full-word convention used everywhere else (`remove`, `create`, `cancel`)

**Append-only vs mutable**
- Append-only matches JSONL philosophy, but too restrictive for typo corrections
- Full edit adds complexity for little gain
- Delete-only is the sweet spot — remove mistakes, re-add if needed

### Journey
Initially considered `tick note <id> <text>` as the simplest approach with notes displayed via `tick show`. Then discussed mutability — started with append-only to match JSONL philosophy, but agreed that's too restrictive when typos happen. Settled on allowing delete but not edit. Once `remove` was introduced, the implicit-add felt inconsistent — symmetry demands explicit `add` verb. Confirmed all existing commands use full words (no abbreviations like `rm`).

### Decision

**Explicit subcommands with full words:**
- `tick note add <id> <text>` — append a timestamped note
- `tick note remove <id> <index>` — remove by 1-based position
- `tick show <id>` — displays notes chronologically (most recent last)
- No `tick note list` — view notes via `show`. Can add later if needed.

**Storage:**
- Task struct gets `Notes []Note` where `Note` is `{Text string, Created time.Time}`
- JSONL: JSON array with `omitempty`
- SQLite: `task_notes(task_id, text, created)` table

**Display in show:**
```
Notes:
  2026-02-27 10:00  Started investigating the auth flow
  2026-02-27 14:30  Root cause found — token refresh race condition
```

---

## Should tags and type be settable at creation only, or also via update?

### Context
Need to decide lifecycle of new fields — create-only or mutable via update? And if mutable, how to handle clearing.

### Journey
Straightforward that both create and update should support all three fields (tags, type, refs). The interesting question was clearing. The `--clear-description` pattern already exists — it was added specifically because empty `--description ""` was erroring, and agents were accidentally erasing descriptions. Same protective philosophy applies here: empty values on `--tags`/`--refs`/`--type` should error, clearing requires an explicit flag.

### Decision

**All fields settable on both create and update. Replace semantics.**

- `--tags`, `--refs`, `--type` on create: set initial values
- `--tags`, `--refs`, `--type` on update: replace entire value
- Empty value on any of them: error (protective against accidental erasure)
- `--clear-tags`, `--clear-refs`, `--clear-type`: explicit clearing flags
- Mutually exclusive: `--tags` and `--clear-tags` can't be used together (same as `--description` / `--clear-description`)

---

## How should filtering work for tags and type on list commands?

### Context
Tags and type need filtering on list-style commands. Tags are multi-value (a task can have many), type is single-value. Need to decide filter semantics and which commands support them.

### Journey
Started with simple `--tag` filter. Explored AND vs OR semantics — considered using pipe (`|`) for OR but rejected due to shell metacharacter quoting issues. Settled on comma-separated = AND, multiple flags = OR. This reads naturally: `--tag ui,backend` is a single grouped condition ("both of these"), `--tag ui --tag backend` is two separate filters ("this or that"). Composable: `--tag ui,backend --tag api` means "(ui AND backend) OR api".

For type, initially considered comma-separated OR and multiple `--type` flags. But comma = AND for tags and comma = OR for type would be inconsistent syntax with different semantics. Since AND is meaningless for a single-value field, the cleanest answer is: type supports single value filter only. No comma-separated, no multiple flags.

Confirmed all filters (`--tag`, `--type`, `--count`) apply to `list`, `ready`, and `blocked` — they're all just additional WHERE clauses.

### Decision

**Tags:**
- `--tag ui,backend` → AND (task has both tags)
- `--tag ui --tag backend` → OR (task has either tag)
- Composable: `--tag ui,backend --tag api` → "(ui AND backend) OR api"
- Available on `list`, `ready`, `blocked`

**Type:**
- `--type bug` → single value filter only
- No comma-separated, no multiple flags — keeps comma semantics consistent (always AND) and AND is meaningless for single-value field
- Available on `list`, `ready`, `blocked`

**Count:**
- `--count N` → LIMIT on results
- Available on `list`, `ready`, `blocked`

---

## What validation rules apply to task types and tags?

### Context
New fields need validation rules. Types are a closed set, tags are user-defined, refs are freeform references to external systems.

### Decision

**Types:**
- Closed set: `bug`, `feature`, `task`, `chore`
- Anything else errors
- Case-insensitive input, trimmed, stored lowercase
- Validated on create and update

**Tags:**
- Strict kebab-case: `[a-z0-9]+(-[a-z0-9]+)*`
- No spaces, no commas, no leading/trailing hyphens, no double hyphens
- Input trimmed and lowercased (normalize, don't error on case)
- Max 30 chars per tag
- Max 10 tags per task
- Validated on create and update

**Refs:**
- Minimal validation: non-empty, no commas (comma-separated input)
- Max 200 chars per ref
- No format validation — accept any ticket format, URL, or identifier
- Validated on create and update

---

## Should partial ID matching apply to reference flags (--parent, --blocked-by, --blocks)?

### Decision

**Yes — everywhere an ID is accepted.** Partial matching applies to `--parent`, `--blocked-by`, `--blocks`, and any other flag that takes a task ID. The resolution function is centralized in the storage layer, so all ID inputs go through it. Users will expect consistent behaviour across all ID inputs.

---

## Should refs be filterable on list commands?

### Decision

**No, not initially.** Refs are a "look up" thing — visible on `show`, followed as links. Filtering by ref is a niche search use case. Keep it simple: refs are set on create/update, displayed on show, no filtering on list/ready/blocked. Add later if demand emerges.

---

## What new fields show in list output vs show output?

### Decision

**List output adds type only.** List becomes: ID, Status, Priority, Type, Title. Type is a single short word, high signal for scanning. Tags and refs are variable-length and would clutter the table — they belong in `show` detail only. When type is not set, display a dash (`-`) to keep alignment clean.

**Show output adds all new fields:** type, tags, refs, notes.

---

## Does adding/removing a note update the task's Updated timestamp?

### Decision

**Yes.** It is a mutation to the task record — the JSONL line changes. Consistent with how every other mutation updates the timestamp. Useful to know a task was touched recently even if the touch was just a note.

---

## What are the note text constraints?

### Decision

- Empty note text: error
- Max length: 500 chars
- Multi-word text from remaining args after ID

---

## What are the edge case rules for --count, dedup, partial ID min length, and ref limits?

### Decision

**`--count` edge cases:**
- Must be >= 1, error on zero or negative values

**Tag/ref deduplication:**
- Silently deduplicate on input (e.g. `--tags ui,backend,ui` stores `[ui, backend]`)

**Partial ID minimum length:**
- Minimum 3 hex chars required for prefix matching
- Prevents overly broad matches like `tick show a`

**Refs input format:**
- `--refs gh-123,JIRA-456` comma-separated on create/update, same pattern as tags
- `--clear-refs` to explicitly remove all refs

**Max refs per task:**
- 10, consistent with tags
- Validated after deduplication

---

## Summary

### Key Insights
1. Junction tables for slice fields (tags, refs) follow the established blocked_by → dependencies pattern — JSONL stays flat, SQLite gets relational structure
2. Comma-separated = AND, multiple flags = OR provides intuitive composable tag filtering without shell metacharacter issues
3. Protective clearing pattern (explicit `--clear-*` flags, empty values error) prevents accidental data loss, especially in agent workflows
4. Partial ID resolution belongs in the storage layer, centralized, used everywhere an ID is accepted

### Current State
- All 12 questions resolved
- Six features fully designed: list count/limit, partial ID matching, task types, external references, tags, notes
- No open uncertainties

### Next Steps
- [ ] Specification
- [ ] Planning
- [ ] Implementation
