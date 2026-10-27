# Investigation: Same Second Tasks Sort By Id

## Symptoms

### Problem Description

**Expected behavior:**
Tasks listed back in creation order come back in the order they were authored. A batch written one after another — by an agent, an importer, or a shell loop — reads back in the sequence it was written.

**Actual behavior:**
Tasks created within the same wall-clock second come back in task-ID order, which is effectively random — IDs are three random bytes. The creation-date sort ties on every row in the batch and falls through to the secondary key.

### Manifestation

- `tick ready` returned a five-task phase shuffled out of authoring order
- The plan adapter's "N of M in phase" positions were visibly wrong
- No error, no warning — the ordering is silently wrong; a batch with real sequencing between tasks would execute out of order with no signal

### Reproduction Steps

1. Create several tasks in quick succession (scripted, so they share a wall-clock second)
2. List them back — `tick list`, `tick ready`, or `tick blocked`
3. Observe the order does not match the order of creation

**Reproducibility:** Always, when the batch shares a second. A human typing `tick add` repeatedly will not hit it; anything scripted hits it every time.

### Environment

- **Affected environments:** Local — all usage
- **User conditions:** Any batch created fast enough to share a wall-clock second. The faster the writer, the more reliably authoring order is lost.

### Impact

- **Severity:** Medium — silent wrong ordering, no data loss
- **Scope:** Every consumer that treats tick as an ordered list rather than a bag of tasks: the workflow system's plan adapter and its implementation loop, `tick list` on a freshly imported project, the migration framework's output, a dependency chain authored in one pass
- **Business impact:** Trust in tick as a plan store. The observed case had independent tasks so nothing broke; a sequenced batch would run out of order undetected. Sharpened by investigation: with `--count 1` the defect does not present a list in the wrong order, it returns the **wrong task**. Severity left at Medium on the strength of no live exposure and no urgency, not because the failure mode is mild.
- **Live exposure:** None. No active work units — every plan authored into tick has been executed, so no stored batch is currently being read in the wrong order. Nothing is being worked around by hand.
- **Urgency:** None. The investigation can take the time it needs; no pressure to land a narrow fix fast.

### References

- Seed: `seeds/2026-09-21-same-second-tasks-sort-by-id.md` (inbox:bug)
- Discovery session: `.workflows/same-second-tasks-sort-by-id/discovery/sessions/session-001.md`
- Observed while dogfooding tick as the plan store for the `free-text-round-trip` workflow (Phase 10)

### Scope Note (from discovery)

Getting creation order right for new tasks going forward is confirmed sufficient. What the fix should do about tasks already stored at second granularity — existing `tasks.jsonl` files that already carry ties — was deliberately left to this investigation.

Confirmed at symptom gathering: there is no live affected data. Existing-tie handling is a question about other people's projects and about tick's own tolerance for older files, not about rescuing a plan currently on disk.

---

## Analysis

### Hypotheses

**Checkpoint depth:** straight-through

- **H1: Creation timestamps are truncated to whole-second granularity before storage, so a batch written inside one wall-clock second stores identical `created` values and the ordering information never reaches disk.** [confirmed]
  Basis: `task.TimestampFormat = "2006-01-02T15:04:05Z"` carries no fractional part, and every stamping site applies `time.Now().UTC().Truncate(time.Second)`.
  Evidence: `task.go:41` fixes the format. Truncation at nine sites: `create.go:208`, `task.go:285` (`NewTask`), `state_machine.go:49`, `note.go:71`, `note.go:135`, `update.go:318`, `dep.go:116`, `dep.go:186`, `migrate/store_creator.go:62`. The truncation is belt-and-braces — `FormatTimestamp` (`task.go:264`) would drop any fraction anyway, since Go's `Format` emits only what the layout names. Reproduced: eight tasks created in a loop all recorded `2026-09-22T09:24:49Z`.

- **H2: The list-family `ORDER BY` terminates at `t.created ASC` with no deterministic tiebreak, so tied rows emerge in whatever order the SQLite query plan produces.** [confirmed — refined]
  Original basis: `list.go:317` (ready view) and `list.go:319` (neutral view) both end on `t.created ASC`; no ID term is written anywhere.
  Evidence: the seed's "falls through to the task ID" is true only for *some* queries. Measured against a seeded project (7 tasks, one second, one parent):
  - **Unfiltered `tick list` / `tick ready`** — plan is `SCAN t USING INDEX idx_tasks_priority` + `USE TEMP B-TREE FOR LAST TERM OF ORDER BY`. Rows reach the sorter in priority-index order, whose own internal tiebreak is rowid; the sorter preserves that for equal `created`, so output is **file order — the right answer, reached by accident**.
  - **`--parent` filtered (`tick list --parent X`, `tick ready --parent X`)** — the parent filter adds `t.id IN (?,?,…)` (`list.go:302`, fed by `queryDescendantIDs` at `list.go:233`). Plan becomes `SEARCH t USING INDEX sqlite_autoindex_tasks_1 (id=?)` + `USE TEMP B-TREE FOR ORDER BY`. Rows reach the sorter already in primary-key order, so output is **exact ascending task-ID order** — the reported symptom.
  This is the mechanism behind the original report: the workflow plan adapter reads a phase's tasks, which is a parent-filtered query.
  Consequence: the unfiltered case is not *correct*, it is *unspecified*. Nothing in the code or in SQLite's contract guarantees it; a different index, a statistics change or a SQLite version bump can flip it without warning.
  **Refined after validation (2026-09-22):** the plan is not a property of the command. Independent measurements disagree at nearly identical project sizes — the validation agent's 8-task project chose `SEARCH t USING INDEX idx_tasks_status` for `tick ready --parent` and returned *file* order, while a 7-task and an 18-task project here both chose `sqlite_autoindex_tasks_1` and returned *ID* order; running `ANALYZE` changed nothing. The optimiser's choice turns on data shape and statistics, not on row count or command name. Parent-filtered queries are the ones observed reaching the primary-key plan, but no query in the family is guaranteed either way. A regression test keyed to "this command returns ID order" would be asserting a coincidence of its own fixture.

- **H3: The JSONL source of truth still holds true authoring order — records are written from the in-memory slice, which appends — so ordering is lost on read, not on write.** [confirmed]
  Evidence: `ParseJSONL` (`jsonl.go:89`) appends one task per line in file order. `create.go:253` appends the new task to the slice. No handler reorders the slice — the only other slice writes are field-level (`dep.go`, `note.go`, `helpers.go`). `Store.Mutate` (`store.go:174`) marshals the slice straight back out and rebuilds the cache from the same bytes. `Cache.Rebuild` (`cache.go:103`) does `DELETE FROM tasks` then inserts in slice order, so `rowid` restarts at 1 and tracks the JSONL line number exactly. Measured: `SELECT rowid, id FROM tasks ORDER BY rowid` returned lines 1–7 in file order.
  Consequence: authoring order is fully recoverable today, from either the file or `rowid` — no data is lost, and existing projects need no repair to be ordered correctly.
  **Verified across history after validation (2026-09-22):** the claim holds for files written by *any* past tick, not just current code. `git log -S "sort." -- internal/storage/ internal/task/ internal/cli/create.go` returns no commits — no sort call has ever existed on those paths. The first JSONL writer, `WriteJSONL` (`4278ba09`, "JSONL storage with atomic writes"), iterated the slice unsorted exactly as today, as did the first `MarshalJSONL` when it arrived in `23e0dc0f` (`git show 4278ba09:internal/storage/jsonl.go | grep -n '^func'` → `toJSONL`, `fromJSONL`, `WriteJSONL`, `ReadJSONL`; `git log --oneline --reverse -S 'func MarshalJSONL' -- internal/storage/jsonl.go` → `23e0dc0f`), and `create` has appended since `0d26e4b7`.

- **H4: Other fixed-order presentation paths share the defect or sort by ID deliberately — the blast radius exceeds the three list views.** [confirmed]
  Evidence:
  - `show.go:146` children — `ORDER BY id`. Explicit and unconditional: a task's sub-tasks are always ID-ordered, never authoring-ordered. Not a tie-break accident; a deliberate choice that produces the same wrong answer.
  - `show.go:137` blockers — `ORDER BY t.id`. Same.
  - `show.go:173` notes — `ORDER BY rowid ASC`, which is insertion order. Correct.
  - `dep tree` (`dep_tree.go:26`) reads via `store.ReadTasks()` — straight from JSONL, so it is in file order and **sidesteps the bug entirely**.
  - `migrate` (`migrate/store_creator.go`) appends per task and stamps `time.Now().UTC().Truncate(time.Second)` when the provider gives no creation time — so a whole import lands in one second. When the provider *does* supply a time (`beads.go:119` parses RFC3339, which may carry a fraction), `FormatTimestamp` flattens it to the second on write, so imported sub-second precision is discarded too.

- **H5: Second granularity is structural across every timestamp field, so raising precision changes the on-disk format for all of them and for files written by other versions.** [confirmed — basis corrected]
  Original basis claimed reading is strict. **That is wrong.** Go's `time.Parse` accepts a fractional second immediately after the seconds field even when the layout does not name one. Measured: `time.Parse("2006-01-02T15:04:05Z", "2026-09-21T12:00:00.123456789Z")` parses cleanly and retains the nanoseconds. Every parse site in tick uses this constant (`task.go:112,116,137`, `notes.go:41`, `transition_history.go:44`, `show.go:186,239,240,255`), so **an older tick binary reads a finer-grained file without error** — there is no forward-compatibility break on read.
  What *is* structural: one `FormatTimestamp` serves both storage and display. It is called by JSONL marshalling (`task.go:96`), by the cache writer (`cache.go:203,204,229,239`) **and** by all three formatters (`json_formatter.go:128`, `toon_formatter.go:249`, `pretty_formatter.go:170`, `show_fields.go:57`). Raising storage precision therefore also changes every user-visible timestamp unless the two are split. Test surface: 222 literal `…T..:..:..Z` occurrences across 16 test files, plus README samples at `README.md:197,198,502,503,515` which `readme_samples_test.go` compares byte-for-byte.

- **H6: A naive precision increase introduces a *new* ordering defect on mixed-precision data, because the cache sorts `created` as text and `Z` sorts after `.`.** [confirmed]
  Discovered mid-trace. The cache column is `created TEXT NOT NULL` (`cache.go:26`) and `ORDER BY t.created ASC` is a string comparison. Measured in Go: `"2026-09-21T12:00:00Z" < "2026-09-21T12:00:00.500Z"` is **false** — `'Z'` (0x5A) sorts above `'.'` (0x2E).
  Consequence: once a file holds both old whole-second records and new fractional ones, a task created at `12:00:00Z` sorts *after* one created at `12:00:00.500Z` — a fresh wrong-order case, confined to within-second comparisons (across seconds the leading digits still decide correctly). A fix that raises precision must therefore either write a fixed-width fraction on **every** record including rewrites of old ones, or stop relying on lexical comparison of the text column.

**Trace lines (in intended order):**
1. `internal/task/task.go` — `TimestampFormat`, `NewTask`, the JSON marshal/unmarshal round trip — **done**
2. Every stamping site: `create.go`, `update.go`, `note.go`, `dep.go`, `state_machine.go`, `migrate/store_creator.go` — **done**
3. `internal/cli/list.go:310-322` — the `ORDER BY`, plus an empirical `EXPLAIN QUERY PLAN` and live ordering check against a seeded project — **done**
4. `internal/storage/jsonl.go` and `cache.go` `Rebuild()` — whether authoring order survives the round trip and whether `rowid` tracks it — **done**
5. Other ordered read paths — `show.go` children/blockers/notes, dep tree, migrate output — **done**
6. Compatibility surface — strict `time.Parse`, `schemaVersion`, `internal/doctor/` checks, tests pinning the format — **done**

### Code Trace

**Entry point:** `RunList` → `buildListQuery` (`internal/cli/list.go:262`) → `Store.Query` → SQLite.

**Execution path (the reported symptom — a parent-filtered list):**
1. `internal/cli/list.go:233` — `queryDescendantIDs` walks the parent chain with a recursive CTE, returning descendant IDs in walk order
2. `internal/cli/list.go:302` — those IDs become `t.id IN (?,?,…)`
3. `internal/cli/list.go:317` or `:319` — `ORDER BY … t.created ASC`, with no further term
4. SQLite plans `SEARCH t USING INDEX sqlite_autoindex_tasks_1 (id=?)` — rows are produced in primary-key order
5. `USE TEMP B-TREE FOR ORDER BY` sorts on priority and `created`; every row ties on both, so the incoming primary-key order survives to the output
6. The caller receives tasks in ascending task-ID order — task IDs being `tick-` plus three random bytes (`task.go` `GenerateID`), this is indistinguishable from random

**Key files involved:**
- `internal/task/task.go:41` — `TimestampFormat`, the single constant governing both storage and display precision
- `internal/task/task.go:264` — `FormatTimestamp`, the only writer of that format
- `internal/cli/list.go:262-325` — `buildListQuery`, both `ORDER BY` variants and the `id IN (…)` condition
- `internal/storage/cache.go:18-28` — the `tasks` table; `created` is `TEXT`, so the sort is lexical
- `internal/storage/store.go:174` — `Mutate`, full JSONL rewrite plus full cache rebuild on every write
- `internal/cli/show.go:137,146` — children and blockers, explicitly `ORDER BY id`

### Root Cause

Two independent defects compound. Neither alone produces the reported symptom; together they mean authoring order is sometimes preserved, sometimes scrambled, with nothing to tell the two cases apart.

**1 — The ordering information is never recorded.** Tick stores creation times to whole-second granularity. `TimestampFormat` (`task.go:41`) has no fractional component, so `FormatTimestamp` cannot emit one; every stamping site additionally truncates with `Truncate(time.Second)` before the value is even held. A batch of tasks authored inside one wall-clock second therefore records the *same instant* for every member. The order the user intended is not degraded in storage — it is absent from it.

**2 — The sort has no deterministic final term, so tied rows are ordered by whatever the query plan happens to do.** `buildListQuery` ends its `ORDER BY` at `t.created ASC` (`list.go:317`, `:319`). SQLite is free to emit tied rows in any order, and in practice emits them in the order the chosen plan feeds the sorter — which differs by filter:

| Plan observed | Rows reach the sorter in | Tie order out | Seen on |
|---|---|---|---|
| `SCAN t USING INDEX idx_tasks_priority` | rowid within each priority | file order — right, by accident | every unfiltered `list` / `ready` / `blocked` measured |
| `SEARCH t USING INDEX sqlite_autoindex_tasks_1 (id=?)` | primary key | **task ID — wrong** | parent-filtered queries, most of the time |
| `SEARCH t USING INDEX idx_tasks_status (status=?)` | rowid within status | file order — right, by accident | `ready --parent` in one measured project |

**Which plan a given command gets is not predictable.** The parent filter adds `t.id IN (?,?,…)` (`list.go:302`, fed by `queryDescendantIDs` at `list.go:233`), which makes the primary-key plan attractive — and that is the shape the reporter hit, since reading a phase's tasks *is* a parent-filtered query. But independent measurement disagrees at nearly identical sizes: `tick ready --parent` returned file order in an 8-task project and ID order in 7-task and 18-task projects, on the same schema and the same binary. `ANALYZE` changed nothing. Task IDs are `tick-` plus three random bytes, so whenever the primary-key plan wins, a deliberate sequence comes back looking like noise.

The second defect is the more important finding, because it reframes the bug. **No query in the family is correct — some are merely lucky.** Nothing in tick's code, and nothing in SQLite's contract, promises any of these orders. A new index, a statistics change, a different row mix or a SQLite version bump can flip any of them silently, in either direction. The right mental model is not "parent-filtered reads are broken" but "tie order is undefined everywhere, and currently resolves correctly by chance in most cases".

**Why this happens:** tick treats creation time as both a timestamp and an ordering key, but only the timestamp role shaped the format. Second granularity is a reasonable choice for a human-readable audit field and a poor one for a sort key, and nothing in the design separates the two roles or supplies a fallback when the key ties.

### Contributing Factors

- **IDs are random.** `GenerateID` uses three bytes from `crypto/rand`, so when the tie resolves to ID order the result is not merely arbitrary — it actively shuffles, and looks like a bug in the consumer rather than in tick.
- **The bug is filter-dependent and therefore invisible to casual checking.** The obvious manual test (`tick list` after creating a batch) returns the right answer. Only the parent-filtered path — the one machines use — goes wrong.
- **Machine writers are the normal case now.** Tick is used as a plan store by an agent that authors a whole phase in one pass; the migration framework stamps an entire import with one `time.Now()` (`migrate/store_creator.go:62`). Human-speed use never reaches the tie; every scripted use does.
- **Sub-second precision is discarded even when a source has it.** `migrate/beads/beads.go:119` parses RFC3339 creation times that may carry a fraction; `FormatTimestamp` flattens them on write.
- **The documented contract stops short of the tie.** `README.md:115` promises "sorted by priority (ascending), then creation date" and says nothing about what happens when creation dates are equal — so neither the code nor the docs commit to an answer, and the workflow plan adapter's own reading instructions assume one that tick does not give.

### Why It Wasn't Caught

- **No test constructs a creation-time tie.** Every ordering test gives each task in a priority band a distinct `Created` — `ready_test.go:306` uses `now`, `now+1s`, `now+2s`; `blocked_test.go:212` and `list_filter_test.go:368` follow the same fixture shape. The tie branch has never executed under test.
- **And it would pass by coincidence if it did.** Those fixtures use hand-written IDs (`tick-hi1111`, `tick-low111`, `tick-low222`) that already sort into the expected order, so an ID-ordered tie would satisfy the assertions.
- **No test exercises ordering under a parent filter.** The two plans are never compared, so the divergence between filtered and unfiltered results is untested ground.
- **The correct-looking case masks the broken one.** Unfiltered output being right is what makes the bug survive both manual use and code review.

### Blast Radius

**Directly affected — wrong order today:**
- `tick list --parent`, `tick ready --parent`, `tick blocked --parent` — any same-second batch under a parent returns in random ID order whenever the primary-key plan wins. This is the workflow plan adapter's read path and the reported symptom.
- **`--count` turns wrong order into wrong *selection*.** `LIMIT ?` is appended after the tied `ORDER BY` (`list.go:321-324`), so it cuts the arbitrary order rather than the authored one. Measured: in a five-child phase authored step-1 … step-5, `tick ready --parent P --count 1` returned **step-4**. This is the sharpest form of the defect — the implementation loop's "take the next available task" call is handed the wrong task outright, not a list it could re-sort. The Impact section's "ordering was merely visibly wrong" understates this case.
- `tick show <id>` sub-task list (`show.go:146`, `ORDER BY id`) and blocker list (`show.go:137`, `ORDER BY t.id`) — unconditionally ID-ordered regardless of timestamps. Same wrong answer, reached by an explicit choice rather than a tie.
- Anything importing through `internal/migrate/` — the whole import shares one second, so every parent-filtered read of imported tasks is scrambled.

**Correct today, but only by accident:**
- `tick list`, `tick ready`, `tick blocked` unfiltered, and every non-parent filter combination (`--tag`, `--type`, `--status`, `--priority`) that does not introduce an `id IN (…)` condition. These depend on an unspecified SQLite behaviour and could flip at any time.
- `tick stats` counts are order-independent — unaffected either way.

**Correct by construction:**
- `tick dep tree` reads from JSONL via `store.ReadTasks()` (`dep_tree.go:26`), so it is in file order and never touches the cache sort.
- `tick show` notes (`show.go:173`, `ORDER BY rowid ASC`) — insertion order.

**Surface any fix must cross:**
- **Authoring order is not lost and needs no recovery.** JSONL holds it (append-only writes from a slice nothing reorders), and `Cache.Rebuild` deletes and re-inserts in that order, so `rowid` equals the JSONL line number after every mutation. Both the file and `rowid` are usable today as a true authoring-order key — and existing projects are already repairable without a migration.
- **Timestamp precision is one knob for storage and display.** `FormatTimestamp` is called by the JSONL marshaller (`task.go:96`), the cache writer (`cache.go:203`) **and** all three formatters (`json_formatter.go:128`, `toon_formatter.go:249`, `pretty_formatter.go:170`, `show_fields.go:57`). Raising storage precision also changes every user-visible timestamp unless the roles are split.
- **Reading is tolerant, but writing is not — the compatibility hazard is downgrade, not upgrade.** Go's `time.Parse` accepts a fractional second even when the layout omits one (measured against nanosecond input), and every parse site uses `TimestampFormat`, so an older tick binary *reads* a finer-grained file without error. But `Store.Mutate` (`store.go:174-199`) rewrites **every** record through `MarshalJSONL` on every write, and `FormatTimestamp` drops the fraction. Measured end to end: a file hand-edited to carry `…30.100Z` and `…30.500Z` was read correctly by tick 0.3.0, and one `tick create` flattened both to `…30Z` — the whole file, `created`/`updated`/`closed`/note and transition stamps alike, with the bug fully reinstated and no warning. Any released precision change means a user on an older binary silently destroys the new ordering data on their next mutation. This bears directly on the fix: it is an argument for a mechanism that does not depend on every writer being new.
- **But mixed precision breaks the lexical sort.** The cache column is `created TEXT` and the comparison is a string comparison; `'Z'` (0x5A) sorts above `'.'` (0x2E), so `"12:00:00Z" < "12:00:00.500Z"` is false. A file holding both old whole-second and new fractional records orders them wrongly within a second. Any precision change must write a fixed-width fraction on every record, or stop comparing the text column.
- **Test and doc surface:** 222 literal `…T..:..:..Z` timestamps across 16 test files (plus the format constant itself at `task.go:41`), and README samples at `README.md:197,198,502,503,515` that `readme_samples_test.go` compares byte-for-byte.
- **Cache schema:** no version bump needed for a value-format change — the SHA256 freshness hash changes with the file and forces a rebuild. A bump from `schemaVersion = 2` would only be needed if a column were added.
- **`internal/doctor/` holds no timestamp logic at all** — nothing there to update either way.

---

## Fix Direction

### Chosen Approach

**Record an explicit creation sequence on every task, and sort on it beneath priority and creation date.**

Each task gains a monotonic creation sequence — the next number above the highest currently in the file, assigned at creation and never renumbered afterwards. (Numbers are not guaranteed unreused — removing the highest frees its number — which ordering does not need; see resolution 4.) The list-family `ORDER BY` ends on it — `priority`, `created`, `seq`, and `id` as an absolute final term so the order is total even if two sequences ever collide — and `show`'s children and blockers move off `ORDER BY id` as their primary key — children keep the ID as their own final term. **The timestamp is unchanged** and stops being load-bearing for ordering.

**Deciding factor — the reframing that settled it:** a timestamp is an *observation*, not a statement of sequence. It records when something happened and implies order only as a side effect, which is precisely the accident this bug is made of. Both earlier directions were approximations of an explicit sequence: position-in-file used the right information but left it implicit in a file's physical layout, and sub-second precision tried to reconstruct sequence from the wrong information and failed on measurement. Recording the sequence directly is the only option where a clash is **impossible by construction** rather than improbable, and the only one that puts the order somewhere both a reader of `tasks.jsonl` and a test can see it.

**Why clashes cannot occur:** writes are serialised by the exclusive file lock (`store.go` `acquireExclusive`), and `Mutate` reads the current task set inside that lock, so the next number is computed with no race. No two tasks can be assigned the same sequence.

**Existing files need no migration.** A record with no sequence takes the next number above the highest sequence in the file while reading it, in line order (see resolution 2 below — *not* its line position, which is unsafe on mixed files, and not the highest seen so far, which collides). For a file with no sequences at all this yields line order, which *is* authoring order — verified across the project's entire history: `git log -S "sort."` over `internal/storage/`, `internal/task/` and `internal/cli/create.go` returns no commits, and every JSONL writer since the first — `WriteJSONL` at `4278ba09`, `MarshalJSONL` from `23e0dc0f` — has iterated the slice unsorted exactly as today. The next write materialises the assignment into the record permanently.

**Downgrade self-heals** — the one compatibility property neither alternative had. Verified: an older tick unmarshals a record carrying an unknown `seq` field without error, silently drops it, and writes the file back without it — but preserves line order. A newer binary then reassigns the sequence in line order, correctly. Nothing is permanently destroyed, unlike the precision route where sub-second data written by a newer tick is flattened irrecoverably.

**Cost:** a field on the record, a cache column and a `schemaVersion` bump from 2 to 3 (absorbed by the existing delete-and-rebuild path — `ensureFresh` checks the version before every query, in both the `Query` and `Mutate` paths), assignment logic in the single write path, backfill-on-read for records lacking it, the two `ORDER BY` clauses, and the two `show` sub-queries.

**Settled at fix validation (2026-09-22).** Seven risks were raised against this direction; all are resolved below. None changed the mechanism.

**1 — A duplicate sequence must never produce undefined order, and must be detectable.** Demonstrated risk: seven children forced to the same sequence returned plan-dependent garbage with no warning. Reachable in this project specifically — `.tick/tasks.jsonl` is git-tracked (`.gitignore` excludes only `cache.db`, `lock` and temp files) and implementation runs in worktrees on branches, so two branches each numbering from the same maximum merge into duplicates. Two-part resolution:
  - **Task ID becomes an absolute final sort term** — `priority`, `created`, `seq`, `id`. Order is then total under every condition, so the worst a duplicate can do is fall back to today's ID ordering *deterministically* rather than varying with the query plan. The same final term ends `show`'s children clause (resolution 5), so no read path is left plan-dependent under a duplicate. Blockers need none — the declaration ordinal is unique within one task's blocker set by construction. *Derivation: "total under every condition" cannot hold while a user-facing list still turns on the query plan after a merge, and nothing recommends the other side.*
  - **A `DuplicateSeqCheck` diagnostic**, mirroring the existing `DuplicateIdCheck` (`internal/doctor/duplicate_id.go`): read-only, reports line numbers, never modifies the file. *Derivation: tick's established handling for a duplicate-identity condition is a doctor check rather than a hard refusal on read — a refusal would block every command after a merge. Detection plus a defined fallback gives both properties.*

    It reports at **warning** severity, so the run does not come back failing. `sed -n '13,17p' internal/doctor/doctor.go` defines the two: `SeverityError` is "a failure that breaks tick and affects exit code", `SeverityWarning` "a suspicious but allowed state that does not affect exit code". A duplicate sequence breaks nothing — the ID final term keeps the order total and the group falls back to ID order among themselves — so it is the second by the codebase's own definition, and the precedent matches: `grep -rn SeverityWarning internal/doctor` finds one existing user, `ParentDoneWithOpenChildrenCheck` (`parent_done_open_children.go:59`), a state tick permits and flags, against nine checks that are errors. *Derivation: the alternative that also fits is failing the run, on the strength of the check being mirrored — rejected because a duplicate ID breaks task identity and partial-ID resolution outright where this costs bounded ordering information, and because a merge leaves no command that could clear a failing verdict; the project would stay red to any script or CI gate until someone hand-edited `tasks.jsonl`.* The report names which tasks share a number and on which lines, says those tasks have lost their authoring order relative to one another, and points at editing the sequences in `tasks.jsonl` as what restores it.

    Records carrying no sequence are not compared with one another — backfill gives each of them a number above every sequence the file carries, distinct from one another, so they cannot collide with each other or with any carried sequence, and `DuplicateIdCheck` already skips records with no ID. A project predating the field reports clean.

**2 — The backfill rule numbers above the file's highest sequence, not line position.** "A record with no sequence takes its line position" is wrong on a file where some records carry one and some do not: it can sort the newest record first. The correct rule is to take the highest sequence any record in the file carries, then walk the records in order and assign the next number to each record lacking one. This is new-task numbering (the next number above the highest in the file) applied to each unnumbered record in turn, so backfill and creation are a single rule.

  Numbering from the highest *seen so far* — a running maximum — was rejected because it collides. An unnumbered record is given a number counted only from the records above it, which a numbered record further down may already hold. The shape is reachable after a merge: a branch cut before the field existed appends `x` and `y` with no sequence; `main`, upgraded, rewrites `a`, `b`, `c` as 1, 2, 3 and appends `d` (4) and `e` (5); resolving the conflict at the end of the file can leave `x` and `y` above `d` and `e`, and a running maximum then numbers them 4 and 5 — duplicates tick manufactured itself, silent until the next write freezes them and `DuplicateSeqCheck` starts reporting a hand-edit chore. Numbering above the file's highest gives them 6 and 7: no clash, by construction. The cost is that an unnumbered record lying above numbered ones sorts after them where they share a creation second; outside a merge no unnumbered record lies above a numbered one, and a merge's line order carries no authoring information anyway. On a file with no sequences, on a file stripped by an older binary, and on a file whose numbered records all precede its unnumbered ones, the two rules assign identically.

  Sequences are positive: the file's highest is 0 when no record carries a sequence, so numbering begins at 1 and an absent or zero value on a record means it carries no sequence. The reserved value is what makes the rule work at all — without it the first task a project ever created is indistinguishable from a legacy record, and under Go's `omitempty` a zero sequence vanishes from the record entirely, so that task would be re-backfilled to a different number on every read until a write froze it wrong. *Derivation: a nullable field (`*int`) would draw the same distinction without reserving a value; 1-based numbering is preferred because it falls out of the numbering rule itself and puts nothing in the record a reader has to interpret.*

**3 — Backfill lives in `ParseJSONL`** (`jsonl.go:89`). Verified as the single funnel for every read path — `store.go:164` (`ReadTasks`, which `dep tree` uses), `:246` (`Rebuild`) and `:363` (`readAndEnsureFresh`, which every query and mutation uses) all call it. Anywhere else leaves one of those paths on a different rule.

**4 — "Never reused" is dropped as a claim, not engineered.** Taking the next number from the current maximum means removing the highest-numbered task frees its number for reuse. Ordering never needed the guarantee — a reused number cannot collide, because the task that held it is gone. The recommended test (remove a *middle* task) would not have caught the case anyway; the claim goes rather than the behaviour.

**5 — `show`'s sub-lists: children by creation order, blockers by declaration order.**
  - **Children** sort by `created, seq, id` — the same absolute final term the list clauses carry (resolution 1), so a duplicate sequence cannot leave the list plan-dependent. Priority does **not** participate — today's `ORDER BY id` (`show.go:146`) has no priority term, and adding one would be a second, unrequested behaviour change.
  - **Blockers** follow the order the dependencies were declared, matching the `blocked_by` array in the record and the edge order `dep tree` already emits (`dep_tree_graph.go:186-198`). *Derivation: the array order is **explicit in the record** — a JSON array is ordered — and is lost only because the cache flattens it into a junction table. Carrying it across (an ordinal on the `dependencies` rows) applies the same principle driving the whole fix: the order is in the record, so the cache should carry it rather than the query inventing one. The alternative — the blocker task's own sequence — would put `tick show` out of step with both `dep tree` and the stored record.* This is the one place the fix's scope grows beyond the reported symptom.

**6 — The stored-record byte-immutability break is accepted and recorded.** Adding a field to every record on the next write breaks the invariant asserted by `internal/cli/migrate_test.go:702` ("it leaves values already in storage untouched"), which updates with the change. With a git-tracked task file the first post-upgrade write is a whole-file diff — accepted as a one-off. The oscillation-under-two-binaries concern does not apply: confirmed with the user that only one tick binary is ever in use.

**7 — `created` stays above `seq` in the sort.** It cuts both ways and this is the decision most worth revisiting at specification. Keeping it preserves true chronology on imports, where the provider supplies real historical timestamps (`beads.go:119`) and import order would otherwise override them; it also confines duplicate-sequence damage to within a single second. The cost is that a backwards clock step of a second or more between two creations still misorders them, and the sequence never gets to speak because the dates differ — the same failure mode cited against sub-second precision, retained. *Position: keep it. A backwards clock step of ≥1s between two task creations on an NTP-synced machine is rare enough to trade against an everyday import benefit, and the fourth sort term bounds the damage when it happens.*

**Factual correction to this record:** an earlier revision stated that `help.go:58` documents the sort contract. It does not — `internal/cli/help.go` contains no statement about sort order at all. Only `README.md:115` does, and it is the only documentation site the fix must update.

**The sequence does not surface in command output.** It is written to `tasks.jsonl` and carried in the cache, and nothing a command prints exposes it — no detail-document section, no field registry entry, no `--field` address, no README sample. *Derivation: every field tick's detail document carries is information about the work itself — title, status, priority, parent, dependencies, type, tags, refs, notes, transitions — and the sequence is an ordering mechanism, whose payoff reaches the user as correct output rather than as a number to read. The alternative that also fits is surfacing it as an addressable field for anyone diagnosing an ordering problem; it loses because `DuplicateSeqCheck` already covers the one condition worth inspecting and `tasks.jsonl` stays readable, while surfacing it grows every detail document, the conformance inventory and the README samples for a value that says nothing about the task.* Nothing about the fix turns on it either way.

### Options Explored

**A — An explicit creation sequence. CHOSEN.** As above.

**B — Position in the task file, left implicit (agreed, then reversed).** The sort ends on the cache row's position. Cheapest change available and correct today. Rejected because the ordering is invisible: nobody reading a task can see why two tasks came back in that order, no direct consumer of `tasks.jsonl` can reproduce it, and correctness rests on an invariant of an artefact the design calls expendable — one that no test states and that any future incremental cache-update path would break silently. Option A is this option's information promoted to a first-class, assertable field.

**C — Sub-second creation timestamps, with or without a tiebreak (agreed, then reversed). Ruled out by measurement.** It only ever covered tasks created by separate command invocations. Measured with tick's own ID generation in the loop: 100 in-process stamps produce **one** distinct millisecond; a microsecond layout gives ~40 distinct with tie groups of 3–5; nanosecond gives ~37 with groups of 4. So the entire `internal/migrate` surface is untouched by it. Already-stored tasks gain nothing either — the first write re-emits an old whole-second value as `.000` rather than inventing precision. Its costs were real: 14 top-level tests across three packages (31 subtests), a read/write format split that makes every existing file unreadable if missed (`cannot parse "Z" as ".000"`), a fixed-width fraction requirement that inverts order if missed (`.5Z` sorts after `.55Z` — verified), a downgrade that destroys the new data permanently, and a new failure mode precision introduces — clock steps, hand-edited files, records merged across machines produce times that *differ but are wrong*, which no tiebreak can catch because there is no tie.

**D — Leaving the tie undefined.** Never viable: `--count 1` converts the misordering into returning the wrong task outright.

### Discussion

The direction reversed twice. Both reversals came from measurement correcting analysis, and the record is more useful with the path than with only the destination.

**First position: position-in-file only.** Reasoning: authoring order is already recorded in `tasks.jsonl` line order and the fix merely has to ask for it. Empirically sound — validation reproduced both the symptom and the fix mechanism against a live project and verified the invariant through create, remove, update and rebuild.

**First reversal, to sub-second precision.** The reporter reopened it, arguing precision was more honest and asking whether the objections were overcooked. Two arguments carried it: the cost of a format change had been quoted as 222 test literals, and separating storage from display measured it at six failures; and precision puts ordering in the record, dissolving what the investigation itself had named as the principal residual risk of the position route — correctness living in a disposable cache.

**Second reversal, to an explicit sequence.** Validation dismantled both arguments with measurement. The six-test figure was taken on a configuration that **fixes nothing** — widening the stored format while leaving the nine `Truncate(time.Second)` calls in place writes every value as `.000`. Reproduced independently: doing the actual work costs 14 top-level tests across three packages including `internal/cli`. And precision's reach is far narrower than assumed — one distinct millisecond for 100 in-process stamps means imports get nothing, and legacy records never gain precision at all, so every already-stored project would still have rested on position-in-the-cache. The honesty argument that justified the reversal held only for tasks created after the upgrade by separate invocations.

**The reframing came from the reporter, not from the analysis.** Priorities and dependencies dictate order at the semantic level; beneath them the intended order is simply the order the tasks were written, and a timestamp is a side effect of creation rather than a hard order indicator. Under that reading, using creation time as an ordering key was never an implementation detail of the bug — it *is* the bug, and both earlier directions were working around a mis-modelled field rather than fixing it. Option D had been dismissed in a single line during the first exploration ("it duplicates what line order already says"), which was wrong in exactly the same way: line order is not duplicated information, it is the same information hidden where nothing can assert on it.

**Risks carried forward from validation of the earlier directions**, unaffected by the change of mechanism because they concern `show` and priority banding rather than the ordering key:
- The blocker-list key is underspecified and the obvious reading is the inconsistent one (see Chosen Approach).
- The `show` sub-list change reaches **five render sites**, not one: `FormatTaskDetail` is called from `show.go:84` and `helpers.go:30`, the latter serving `create.go:278`, `update.go:398`, `note.go:87` and `note.go:145`. (`dep add`/`dep rm` use `FormatDepChange` and do not render these sections.)
- `--field children.N` and `blocked_by.N` positional addressing changes meaning — the intended fix applied to an addressing interface, documented at `README.md:206`.
- **Nothing in the suite pins the `show` sub-list order today** — changing both queries broke zero tests across `internal/cli`, conformance and README samples included. The new assertions are the only guard against the key drifting back.
- The guarantee is authoring order *within a priority band*, and within the `in_progress` band for `ready`. A mixed-priority batch still does not read back in write order. `README.md:115` and `help.go:58` promise only "priority (ascending), then creation date" and need the tiebreak stated.

### Testing Recommendations

**Ordering — the core, none of which exists today.** Every current ordering test gives each task in a priority band a distinct `Created` (`ready_test.go:306`, `blocked_test.go:212`, `list_filter_test.go:368`), so the tie branch has never executed.

- A same-second tie ordering correctly, with **IDs whose ascending order contradicts the authoring order** — current fixtures use hand-written IDs that already sort into the asserted order, so an ID-ordered result would pass and prove nothing.
- The same assertion from an unfiltered list **and** a `--parent`-filtered one: those take different query plans and the unfiltered case passes today by accident. Fixture size must not be load-bearing — measurements show the plan flips on data shape alone.
- **`blocked` gets its own tie assertion** — `BlockedConditions()` builds a different WHERE shape (`query_helpers.go:66-80`).
- **The `ready` band interaction:** an `in_progress` task authored *after* tied `open` tasks — the band must still win over sequence. Otherwise a final term inserted before the band term passes everything else.
- **`--count 1` under a tie returns the first-authored task**, not the ID-lowest.
- **An in-process batch**, not just separate invocations — the migration framework is the natural fixture, and the assertion is on *ordering* with the explicit note that its timestamps are identical.

**The sequence itself.**
- Assigned monotonically; **never reused after a removal** — remove a middle task, create another, assert the new one sorts last rather than taking the gap.
- **Backfill: a fixture file carrying no sequence field at all orders by line position**, permanently, including after the first mutation materialises the assignment. This is the durable legacy case, not a transient window, and it is what pins the backfill as the mechanism carrying every pre-existing project.
- Survives create, update, remove and `tick rebuild`. Phrase the invariant as "sequence order equals record order", not "equals line number" — `ParseJSONL` skips blank lines (`jsonl.go:99-101`).
- **The cache column carries the sequence** and the sort uses it — asserted directly, because an ordering test alone cannot distinguish a working sequence from an accidentally-correct query plan.
- Round-trip through JSONL: written, read, unchanged.
- **Downgrade tolerance:** a record whose sequence is absent because an older binary stripped it is reassigned correctly on the next read.

**The `show` sub-lists — a behaviour change with no existing coverage to move.**
- Children and blockers follow creation order, not ID order.
- The same sections render under `create`, `update` and both `note` handlers via `helpers.go:30` — their detail documents and the conformance inventory are in scope, not just `tick show`.
- **The blocker key is pinned by a test**: a blocker created *after* the blocked task's other blocker, so the blocker's own creation order differs from the declaration order. Whichever key is specified, this stops it drifting.
- `--field children.N` / `blocked_by.N` positional addressing changes meaning — assert it rather than discover it.

**Duplicate sequences and the fallback (added at fix validation).**
- Two tasks sharing a sequence produce a **deterministic** order — the ID tiebreak — under both the filtered and unfiltered query plans. The current failure is that the order varies with the plan; the assertion is that it no longer can.
- `tick show`'s children under a shared sequence are deterministic too — the same ID tiebreak, asserted on the parent's detail document.
- `DuplicateSeqCheck` reports a duplicate with its line numbers, mirroring `DuplicateIdCheck`'s existing tests, and reports nothing on a clean file.
- A file with sequences assigned on some records and absent on others — the post-merge shape — backfills above the file's highest sequence, with the newest record ordering last rather than first. This is the case the line-position rule got wrong.
- A file whose unnumbered records lie above numbered ones — the merge shape of resolution 2 — backfills with no sequence equal to any carried one, and `DuplicateSeqCheck` stays clean after the next write. This is the case a running-maximum rule gets wrong.

**The `show` sub-lists (revised).**
- Children follow creation order and **priority does not participate** — a child with better priority does not float above an earlier-created sibling.
- Blockers follow declaration order: a fixture where a blocker created *later* was declared *first* must list it first, and `tick show` must agree with `tick dep tree` and with the `blocked_by` array in the record on the same fixture. This single assertion pins the key against drift.

**Documentation and regression floor.**
- `README.md:115` states the sort contract (`help.go` carries no statement about sort order — see the factual correction above). **The README-sample run does not cover it.** Measured: the sentence is prose outside every fence (`awk 'BEGIN{inf=0} /^```/{inf=!inf} NR==115{print inf}' README.md` → 0), and `readme_samples_test.go` skips any fence with no `$ tick` prompt line (`sed -n '492p' internal/cli/readme_samples_test.go` → `if fence.prompt == "" {`); nothing in the suite reads it (`rg -n 'sorted by|priority \(ascending\)' internal/cli/*_test.go` → no output).
- **`README.md:396` is a second documentation site.** It enumerates what `tick doctor` checks for — JSONL syntax errors, invalid IDs, duplicates, orphaned references, self-referential dependencies, dependency cycles, parent/child constraint violations and cache staleness — and `DuplicateSeqCheck` belongs in it, named as duplicate creation sequences rather than folded into the existing "duplicates". *Derivation: the enumeration is a standing list of every check, so a new check either joins it or the list is wrong; the alternative that also fits is relying on "duplicates" to cover it — rejected because that word reads as duplicate IDs, the condition it was written for, leaving a user whose tasks lost their authoring order after a merge nothing to search for.* The sentence is prose outside every fence, so no README sample renders it.
- **Pin the new sentence with a prose assertion.** The suite already does this for README prose it cares about — `TestREADMEDocumentsFieldSelection` (`readme_samples_test.go:570`) and `TestREADMEDocumentsEndOfFlagsMarker` (`:637`) — and the sort contract is the only user-facing statement of the guarantee this fix exists to deliver, so an unguarded sentence can ship worded wrong or drift the next time the sort changes with the suite green either way. *Derivation: the alternative that also fits is leaving it unguarded on the grounds that no README prose is guarded by default — rejected because two assertions of exactly this shape already exist for lesser statements, and the cost here is one of them.*
- **Pin the doctor enumeration the same way.** A second prose assertion requires `README.md:396` to name the duplicate-sequence check as its own entry. *Derivation: the reasoning behind pinning the sort sentence — prose the sample run never reads, so nothing catches a rewrite — applies unchanged to the second site, and the entry's whole purpose is that a user whose tasks lost their order can find the diagnostic; the alternative that also fits is leaving a list of check names unpinned as a non-behavioural statement, rejected because folding the entry back into the generic "duplicates" would pass unnoticed and cost exactly that discoverability.*
- Existing ordering tests stay green **unchanged** — a final sort term must not disturb any result whose earlier keys already differ. Empirically satisfiable: adding a final term to both clauses added zero failures.

### Risk Assessment

- **Fix complexity:** Moderate. A record field with above-the-maximum assignment and backfill in `ParseJSONL`, a cache column, an ordinal carried onto the `dependencies` rows, a `schemaVersion` bump, two `ORDER BY` clauses, two `show` sub-queries, a `DuplicateSeqCheck` diagnostic, and the new tests. Larger than the position-only route, smaller in conceptual surface than the precision route.
- **Regression risk:** Low. A final sort term cannot reorder any result whose earlier keys already differ — verified empirically. The one intended behaviour change is `show`'s children and blockers moving from ID order to creation order, which has no existing test coverage and therefore needs new assertions rather than updated ones.
- **Compatibility risk:** Low, and the lowest of the options considered. No existing file becomes unreadable — an absent sequence is backfilled from line order. A newer file read by an older tick loses the field on write but keeps line order, so a newer binary restores it. Nothing is permanently destroyed in either direction.
- **Recommended approach:** Regular release. No urgency — confirmed at symptom gathering that no active work unit holds affected data.
- **Compatibility scope narrowed:** confirmed with the user that only one tick binary is ever in use, so mixed-version reasoning is out of scope. The self-healing downgrade property remains true but is no longer a selling point, and no compatibility layer or versioned migration is needed. Note this removed only the oscillation half of one risk — the other six were never version-dependent.
- **Principal residual risk:** the backfill rests on line order being authoring order for files written before the change. Verified across the full git history, but it is a historical claim rather than an enforced invariant — a hand-edited or git-merged `tasks.jsonl` whose lines were reordered is backfilled in the wrong order, silently and permanently, since the next write freezes the assignment. `DuplicateSeqCheck` catches the collision case; it cannot catch a reordering that produces no duplicates.
- **Second residual risk:** a backwards wall-clock step of ≥1s between two creations misorders them, because `created` outranks `seq` and the sequence never gets to speak (resolution 7). Accepted deliberately in exchange for import chronology.

## Notes

**User's fix lean (symptom gathering, 2026-09-21) — resolved.** The lean was to raise timestamp precision so the sort no longer ties. It was taken seriously: adopted as the direction at one point, then ruled out by measurement (100 in-process stamps share one millisecond; already-stored tasks never gain precision). The reporter's own reframing replaced it — a timestamp is an observation, not a statement of sequence — which produced the chosen direction. Full journey in Fix Direction → Discussion.

**Scope note on the chosen direction.** Blocker-list ordering (resolution 5) is the one place the fix reaches past the reported symptom: it requires the `blocked_by` array's order to be carried into the cache so `tick show` stops disagreeing with `tick dep tree` and with the stored record. Flagged here because a specification could reasonably split it out.
