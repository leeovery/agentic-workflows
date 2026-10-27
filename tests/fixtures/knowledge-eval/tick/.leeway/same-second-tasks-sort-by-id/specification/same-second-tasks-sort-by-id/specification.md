# Specification: Same-Second Tasks Sort By ID

## Specification

### 1. The Ordering Contract

#### 1.1 The defect

Tasks created inside one wall-clock second come back in an order unrelated to the order they were written. There is no error and no warning — the ordering is silently wrong. A human typing `tick add` repeatedly never reaches it; anything scripted reaches it every time: an agent authoring a whole phase in one pass, the migration framework importing a project, a shell loop. Machine writers are now the normal case.

Two independent defects compound. Neither alone produces the symptom; together they mean authoring order is sometimes preserved and sometimes scrambled, with nothing to tell the two cases apart.

**The ordering information is never recorded.** Creation times are stored to whole-second granularity — the single format constant governing both storage and display names no fractional part (`sed -n 41p internal/task/task.go` → `const TimestampFormat = "2006-01-02T15:04:05Z"`), and every stamping site additionally truncates before the value is held (`rg -c 'Truncate\(time\.Second\)' internal/ --glob '!*_test.go'` → 9 sites). A batch authored inside one second records the same instant for every member. The intended order is not degraded in storage — it is absent from it.

**The sort has no deterministic final term.** Both list-family clauses end at `t.created ASC` (`rg -n 'ORDER BY' internal/cli/list.go` → `:317` ready view, `:319` neutral view). SQLite is free to emit tied rows in any order, and emits them in whatever order the chosen plan feeds the sorter. Three plans were observed across measured projects: the priority index and the status index both feed rows in rowid order, which is file order — the right answer, reached by accident; the primary-key index feeds rows in task-ID order — the reported symptom, and since task IDs are three random bytes, indistinguishable from a shuffle.

**Which plan a query gets is not predictable.** It turns on data shape and statistics, not on command name or row count: `tick ready --parent` returned file order in one 8-task project and ID order in 7-task and 18-task projects on the same schema and binary, and `ANALYZE` changed nothing. The correct mental model is not "parent-filtered reads are broken" but **tie order is undefined everywhere, and currently resolves correctly by chance in most cases**. A new index, a statistics change or a SQLite version bump can flip any of it silently.

#### 1.2 Severity

`--count` turns wrong order into wrong *selection*. `LIMIT` is appended after the tied `ORDER BY` (`internal/cli/list.go:321-324`), so it cuts the arbitrary order rather than the authored one. Measured: in a five-child phase authored step-1 … step-5, `tick ready --parent P --count 1` returned **step-4**. An implementation loop asking for the next available task is handed the wrong task outright, not a list it could re-sort.

No live exposure — no stored batch is currently being read in the wrong order, and nothing is being worked around by hand.

#### 1.3 What tick guarantees after the fix

Tasks come back in the order they were created, within a priority band — and within the `in_progress` band for `ready`, which floats above the priority terms. A batch written one after another by an agent or a shell loop reads back in the sequence it was written, as does an import whose source carries no creation times of its own. An import that supplies real historical creation times is ordered by those times instead, to whole-second resolution: recorded chronology outranks the sequence (§4.2).

The guarantee is **total**: every query in the list family produces one defined order under every condition, with no dependence on which plan SQLite chooses. A mixed-priority batch still does not read back in write order — priority and the `ready` band are semantic ordering and continue to outrank creation order.

Creation time stops being the last word on ordering: where two tasks record the same second, the sequence decides. Dates that differ still order the tasks — recorded chronology outranks the sequence (§4.2) — so a wall-clock step backwards of a second or more between two creations still misorders them (§7.2). The timestamp format is unchanged, and no stored timestamp changes value.

### 2. The Creation Sequence

#### 2.1 The decision

Every task carries an explicit creation sequence — a monotonic number assigned when the task is created and never renumbered afterwards. The list-family sort ends on it, and it is the only explicit statement of authoring order tick stores — a recorded creation date still outranks it, and the sequence decides where two dates tie (§4.2).

**Why an explicit field rather than finer timestamps or file position.** A timestamp is an *observation*, not a statement of sequence: it records when something happened and implies order only as a side effect, which is precisely the accident this bug is made of. Two alternatives were explored and reversed.

Sub-second timestamp precision was ruled out by measurement. It only ever covers tasks created by separate command invocations: 100 in-process stamps taken with tick's own ID generation in the loop produce **one** distinct millisecond; a microsecond layout gives ~40 distinct values with tie groups of 3–5, nanosecond ~37 with groups of 4. The whole `internal/migrate` surface is therefore untouched by it. Already-stored tasks gain nothing either — the first write re-emits an old whole-second value as `.000` rather than inventing precision. Its costs were real: 14 top-level tests across three packages (31 subtests), a read/write format split, a fixed-width-fraction requirement that inverts order if missed, and a new failure mode precision itself introduces — clock steps and hand-edited records produce times that *differ but are wrong*, which no tiebreak can catch because there is no tie.

Position-in-file was rejected because the ordering is invisible: nobody reading a task can see why two tasks came back in that order, no direct consumer of `tasks.jsonl` can reproduce it, and correctness would rest on an invariant of an artefact the design calls expendable — one that no test states and that any future incremental cache-update path would break silently. The sequence is that option's information promoted to a first-class, assertable field.

An explicit sequence is the only option where a clash is **impossible by construction** rather than improbable, and the only one that puts the order somewhere both a reader of `tasks.jsonl` and a test can see it.

#### 2.2 Assignment

A new task takes the next number above the highest sequence currently in the file. Sequences are positive: numbering begins at 1, so an absent or zero value on a record means it carries no sequence. The highest is taken from the task set as read, not from the stored bytes: backfill (§2.3) runs first, so records that reached the file without a sequence already carry one and the next number sits above those too.

Clashes cannot occur. Writes are serialised by the exclusive file lock, and `Store.Mutate` (`internal/storage/store.go:174`) reads the current task set inside that lock before calling the mutation function, so the next number is computed with no race.

**Numbers are not guaranteed unreused.** Removing the highest-numbered task frees its number for the next creation. Ordering does not need the guarantee — a reused number cannot collide, because the task that held it is gone.

#### 2.3 Backfill for records with no sequence

A record lacking a sequence is assigned one on read: take the highest sequence any record in the file carries — 0 when none carries one — then walk the records in order and give the next number above it to each record that has none.

This numbers above the file's highest sequence, **not** by line position. On a file where some records carry a sequence and some do not — the shape produced by a merge, or by a write from a binary that does not know the field — assigning line position would sort the newest record first. Numbering above the file's highest gets it right, and it is new-task numbering (§2.2) applied to each unnumbered record in turn, so backfill and creation are a single rule.

It is also **not** a running maximum — the highest seen so far — because that collides. A running maximum counts an unnumbered record's number only from the records above it, which a numbered record further down may already hold. The shape is reachable after a merge: a branch cut before the field existed appends `x` and `y` with no sequence; an upgraded `main` rewrites `a`, `b`, `c` as 1, 2, 3 and appends `d` (4) and `e` (5); resolving the conflict at the end of the file can leave `x` and `y` above `d` and `e`. A running maximum numbers them 4 and 5 — duplicates tick would manufacture itself, silent until the next write froze them and the doctor check (§5.2) reported a hand-edit chore. Numbering above the file's highest gives them 6 and 7, so a backfilled number can never equal a carried one. The cost is that an unnumbered record lying above numbered ones sorts after them where they share a creation second; outside a merge no unnumbered record lies above a numbered one, and a merge's line order carries no authoring information. On a file with no sequences, a file stripped by an older binary, and a file whose numbered records all precede its unnumbered ones, the two rules assign identically.

For a file with no sequences at all this yields line order, which *is* authoring order. Verified across the project's entire history: `git log -S "sort." -- internal/storage/ internal/task/ internal/cli/create.go` returns no commits — no sort call has ever existed on those paths — and every JSONL writer since the first has iterated the task slice unsorted exactly as today (`WriteJSONL` at commit `4278ba09`, `MarshalJSONL` from `23e0dc0f`).

Backfill lives in `ParseJSONL` (`internal/storage/jsonl.go:89`), which is the single funnel for every read path (`rg -n 'ParseJSONL' internal/storage/store.go` → `:164` `ReadTasks`, used by `dep tree`; `:246` `Rebuild`; `:363` `readAndEnsureFresh`, used by every query and mutation). Anywhere else leaves one of those paths on a different rule.

Existing projects need no migration and no repair. The assignment becomes permanent on the next write.

#### 2.4 The sequence is not surfaced in command output

The sequence appears in `tasks.jsonl` and in the cache, and nowhere a command prints. No detail-document section, no field registry entry, no `--field` address, no README sample. It is an ordering mechanism, not information about the work; the guarantee it delivers is stated in the documentation (§6) and the one case where the sequence itself is worth inspecting is covered by the doctor check (§5.2).

### 3. Storage and Cache Representation

#### 3.1 The record

The sequence is the `seq` field on the stored task record in `tasks.jsonl`, alongside the existing fields (`sed -n '44,60p' internal/task/task.go` → the `Task` struct and its JSON tags). It round-trips through the file unchanged: written, read back, identical.

**Adding the field breaks an invariant currently asserted in the suite.** `internal/cli/migrate_test.go:702` asserts "it leaves values already in storage untouched"; every record gains the new field on the next write, so that test changes with this work. With `.tick/tasks.jsonl` git-tracked in this project, the first post-upgrade write produces a whole-file diff — accepted as a one-off.

#### 3.2 The cache

The `tasks` table gains a `seq` column (`sed -n '17,28p' internal/storage/cache.go` → the current ten-column definition), populated by the rebuild insert (`internal/storage/cache.go:137`). The list-family sort reads it from there.

The cache column is asserted directly by test, not only through an ordering result — an ordering assertion alone cannot distinguish a working sequence from an accidentally-correct query plan (§1.1).

#### 3.3 Dependency declaration order

The `dependencies` table gains an ordinal carrying each blocker's position in the record's `blocked_by` array (`sed -n '31,35p' internal/storage/cache.go` → the current two-column definition, whose primary key is the pair), populated by the dependency insert (`internal/storage/cache.go:143`). This is what `tick show`'s blocker list orders on (§4.3).

The array order is **explicit in the record** — a JSON array is ordered — and is lost only because the cache flattens it into a junction table. Carrying it across applies the same principle driving the whole fix: the order is in the record, so the cache should carry it rather than the query inventing one. `tick dep tree` already emits edges in this order, reading the task slice directly (`internal/cli/dep_tree_graph.go:186-198` — "one edge per `BlockedBy` entry, tasks in slice order and each task's blockers in stored order").

#### 3.4 Schema version

`schemaVersion` goes from 2 to 3 (`sed -n 15p internal/storage/cache.go` → `const schemaVersion = 2`).

No migration is needed. `ensureFresh` checks the version before every query and before every mutation; a mismatch deletes the cache file, recreates it and rebuilds from `tasks.jsonl`. The two new columns arrive through that existing path.

### 4. Query Changes

#### 4.1 The list-family sort

Both clauses in `buildListQuery` gain two terms, ending on the sequence and then the task ID:

- neutral view (`internal/cli/list.go:319`) — priority, created, sequence, id
- ready view (`internal/cli/list.go:317`) — the `in_progress` band, then priority, created, sequence, id

This covers `tick list`, `tick ready` and `tick blocked`, filtered and unfiltered alike, since all three run through the same builder. `tick blocked` needs its own tie assertion regardless: `BlockedConditions()` builds a different `WHERE` shape (`internal/cli/query_helpers.go:66-80`), so it reaches the sorter by a different route.

#### 4.2 Creation date stays above the sequence

`created` outranks `seq`. Two tasks whose recorded creation dates differ are ordered by those dates; the sequence speaks only when they tie.

This cuts both ways and the trade is deliberate. Keeping `created` above preserves true chronology on imports, where the provider supplies real historical timestamps (`internal/migrate/beads/beads.go:119` parses RFC3339) and import order would otherwise override them; it also confines duplicate-sequence damage (§5) to within a single second. The chronology carried across is whole-second: a fraction in the source is flattened on write as it is today, so imported tasks that share a second tie on `created` and fall to the sequence — within one second the import's own order decides, not the source's. The cost: a backwards wall-clock step of a second or more between two creations still misorders them, and the sequence never gets to speak because the dates differ — the same failure mode cited against sub-second precision (§2.1), knowingly retained. A backwards step of ≥1s between two task creations on an NTP-synced machine is rare enough to trade against an everyday import benefit, and the misordering it produces is confined to the pair straddling the step: every other pair is ordered on keys the step did not touch, and the result is still one defined order rather than a plan-dependent one (§5.1).

#### 4.3 `tick show`'s sub-lists

Both sub-lists move off `ORDER BY id`, which is unconditional today and produces the same wrong answer as the tie — by explicit choice rather than by accident.

**Children** (`internal/cli/show.go:146`) order by created, then sequence, then task ID — the same absolute final term the list clauses carry (§5.1), so a duplicate sequence cannot leave the list plan-dependent. **Priority does not participate** — today's clause has no priority term, and adding one would be a second, unrequested behaviour change. A child with better priority does not float above an earlier-created sibling.

**Blockers** (`internal/cli/show.go:137`) order by the dependency ordinal (§3.3) — the order the dependencies were declared, matching the `blocked_by` array in the record and the edges `tick dep tree` already emits. The alternative — the blocker task's own creation order — would put `tick show` out of step with both `dep tree` and the stored record.

#### 4.4 What the sub-list change reaches

The two sections render from five sites, not one. `FormatTaskDetail` is called from `internal/cli/show.go:84` and from `outputMutationResult` (`internal/cli/helpers.go:30`), the latter serving `create.go:278`, `update.go:398`, `note.go:87` and `note.go:145`. Their detail documents and the conformance inventory are in scope, not only `tick show`. (`dep add` and `dep rm` render through `FormatDepChange` and do not carry these sections.)

`--field children.N` and `--field blocked_by.N` change meaning — positional addressing over a list whose order is changing. This is the intended fix applied to an addressing interface; the positional form is documented at `README.md:206`.

**Nothing in the suite pins the sub-list order today.** Changing both queries broke zero tests across `internal/cli`, conformance and README samples included. The new assertions (§8) are the only guard against the key drifting back.

### 5. Duplicate Sequences

A duplicate sequence is reachable in this project specifically. `.tick/tasks.jsonl` is git-tracked — `.gitignore` excludes only `cache.db`, `lock` and temp files — and implementation runs in worktrees on branches, so two branches each numbering from the same maximum merge into duplicates. Demonstrated: seven children forced to the same sequence returned plan-dependent garbage with no warning.

Two mechanisms answer it, one making the outcome defined and one making it visible.

#### 5.1 Task ID is the absolute final sort term

Every clause in §4.1 ends on the task ID, as does `tick show`'s children clause (§4.3); blockers order on the dependency ordinal, which is unique within a task's blocker set, so they are total already. Order is then total under every condition, so the worst a duplicate sequence can do is fall back to today's ID ordering **deterministically**, rather than varying with the query plan. The current failure is that tie order changes with the plan; after this change it cannot.

#### 5.2 A duplicate-sequence doctor check

A new check mirrors `DuplicateIdCheck` (`internal/doctor/duplicate_id.go`): read-only, never modifies the file, reports each duplicate group with its line numbers and returns a single passing result on a clean file. Records carrying no sequence — absent or zero (§2.2) — are not compared with one another: backfill numbers each of them above every sequence the file carries (§2.3), so they cannot collide with one another or with a carried sequence, and `DuplicateIdCheck` already skips records with no ID. A project that predates the field reports clean.

The report does not fail the run. Tick's diagnostics carry the distinction already (`sed -n '13,17p' internal/doctor/doctor.go` → `SeverityError` is "a failure that breaks tick and affects exit code", `SeverityWarning` "a suspicious but allowed state that does not affect exit code"), and a duplicate sequence breaks nothing: order stays total (§5.1) and the group falls back to ID order among themselves. It reports at warning severity, joining `ParentDoneWithOpenChildrenCheck` (`internal/doctor/parent_done_open_children.go:59`), the one existing warning against nine errors. Failing the run would leave a project permanently red to any script or CI gate after a routine branch merge, clearable only by hand, since tick offers no command that renumbers a sequence. What the report tells the user is which tasks share a number and on which lines. Sharing a number costs the authoring order only where the tasks also record the same creation second — there the group falls back to ID order among themselves; where their recorded creation dates differ, those dates decide and the listed order is unaffected (§4.2). Where the order was lost, restoring it means editing the sequences in `tasks.jsonl` so they differ. It registers alongside the others in `RunDoctor` (`internal/cli/doctor.go:22`), whose doc comment enumerates the registered checks by name and count (`sed -n '11,15p' internal/cli/doctor.go` → "registers all 10 checks") and updates with the addition.

Tick's established handling for a duplicate-identity condition is a doctor check rather than a hard refusal on read. A refusal would block every command after a merge; detection plus a defined fallback gives both properties.

### 6. Documentation

`README.md:115` is the only site stating the sort contract (`rg -n 'sorted by|creation date' README.md` → one hit). It promises "sorted by priority (ascending), then creation date" and says nothing about what happens when creation dates are equal, so neither the code nor the docs commit to an answer today. It gains the tiebreak: within a priority band, tasks tied on creation date come back in creation order.

`README.md:396` is the second site the work touches: it enumerates what `tick doctor` checks for — JSONL syntax errors, invalid IDs, duplicates, orphaned references, self-referential dependencies, dependency cycles, parent/child constraint violations and cache staleness. The duplicate-sequence check (§5.2) joins that enumeration, named as duplicate creation sequences rather than folded into the existing "duplicates", which reads as duplicate IDs — a user whose tasks lost their authoring order after a merge has to be able to find the diagnostic that reports it. The sentence is prose outside every fence, so no README sample renders it.

An earlier revision of the investigation stated that `internal/cli/help.go:58` also documents the sort contract. It does not — `internal/cli/help.go` contains no statement about sort order at all, and needs no change.

`tick help doctor` does list checks — its description (`internal/cli/help.go:217`) names "JSONL syntax, ID format, duplicates, orphaned references, dependency cycles, and cache staleness" — but as a summary, not a standing enumeration: it already omits self-referential dependencies, parent/child constraint violations and a done parent with open children. The rule that puts the duplicate-sequence check in the README's list — a standing list of every check either gains it or is wrong — does not reach a list that makes no claim to completeness, so the help description is unchanged too.

The README-sample run does not cover it: `readme_samples_test.go` re-renders only fenced blocks carrying a `$ tick` prompt line (`sed -n 492p internal/cli/readme_samples_test.go` → `if fence.prompt == "" {`), and the sort-contract sentence is prose outside every fence. Nothing in the suite reads it today (`rg -n 'sorted by|priority \(ascending\)' internal/cli/*_test.go` → no output), so the sentence gets a prose assertion of its own (§8.6).

### 7. Scope Boundaries and Accepted Risks

#### 7.1 Out of scope

**Timestamp precision.** `TimestampFormat` (`internal/task/task.go:41`) is unchanged, the nine `Truncate(time.Second)` calls stay, and no stored or displayed timestamp changes value. The format constant serves both storage and display and splitting those roles is not part of this work.

**Mixed-version reasoning.** Only one tick binary is ever in use. No compatibility layer and no versioned migration. The chosen mechanism happens to be downgrade-tolerant — a binary that does not know the sequence field drops it on write but preserves line order, and the backfill rule (§2.3) restores it correctly on the next read — but nothing depends on that property.

**`tick stats`** is order-independent and unaffected. **`tick dep tree`** reads from `tasks.jsonl` via `store.ReadTasks()` (`internal/cli/dep_tree.go:26`), so it is already in file order and never touches the cache sort. **`tick show`'s notes** already order by insertion (`internal/cli/show.go:173`, `ORDER BY rowid ASC`). **Tags and refs** sort alphabetically by design (`internal/cli/show.go:155`, `:164`) and are untouched.

**`internal/doctor/` holds no timestamp logic** — nothing there changes beyond the new check (§5.2).

#### 7.2 Accepted risks

**The backfill rests on a historical claim, not an enforced invariant.** For files written before this change, line order is authoring order — verified across the full git history (§2.3). But a `tasks.jsonl` whose lines were reordered by hand or by a git merge is backfilled in the wrong order, silently and permanently, since the next write freezes the assignment. The duplicate-sequence check (§5.2) catches the collision case; it cannot catch a reordering that produces no duplicates.

**A backwards wall-clock step of ≥1s between two creations misorders them**, because `created` outranks `seq` and the sequence never gets to speak. Accepted deliberately in exchange for import chronology (§4.2).

**Sequence numbers are reusable after a removal** (§2.2). This is a dropped claim, not a defect — a reused number cannot collide, because the task that held it is gone.

**The stored-record byte-immutability break** (§3.1) — every record gains a field on the next write.

#### 7.3 Release posture

Regular release. No urgency — no active work unit holds affected data (§1.2), and no existing file becomes unreadable at any point.

Regression risk is low: a final sort term cannot reorder any result whose earlier keys already differ, verified empirically by adding the terms and observing zero new failures. The one intended behaviour change is `tick show`'s children and blockers moving from ID order to creation and declaration order, which has no existing coverage to update and needs new assertions instead (§4.4, §8).

### 8. Verification Requirements

No test constructs a creation-time tie today. Every ordering test gives each task in a priority band a distinct `Created` — `ready_test.go:306` uses `now`, `now+1s`, `now+2s`; `blocked_test.go:212` and `list_filter_test.go:368` follow the same fixture shape — so the tie branch has never executed. And it would pass by coincidence if it had: those fixtures use hand-written IDs (`tick-hi1111`, `tick-low111`, `tick-low222`) that already sort into the expected order, so an ID-ordered result would satisfy the assertions.

Three constraints therefore apply to every ordering fixture below.

- **IDs must contradict the authoring order.** An ascending-ID result and a creation-order result must be distinguishable, or the assertion proves nothing.
- **Creation seconds must tie wherever the sequence or the ID term is what is under test.** A recorded creation date outranks the sequence (§4.2), so a fixture whose records carry distinct seconds returns the expected order whether the sequence works or not — the backfill and duplicate-sequence assertions (§8.2, §8.3) would pass over a backfill that gave every record the same number, and over a duplicate group the ID term never reached. Records in those fixtures record one creation second.
- **Fixture size must not be load-bearing.** The query plan flips on data shape alone (§1.1), so a test keyed to "this command returns this order at this size" would be asserting a coincidence of its own fixture. Assertions state the required order, never the plan.

#### 8.1 Ordering

- A same-second tie orders correctly, asserted from an unfiltered list **and** from a `--parent`-filtered one — those take different query plans, and the unfiltered case passes today by accident.
- `tick blocked` carries its own tie assertion — `BlockedConditions()` builds a different `WHERE` shape (§4.1).
- The `ready` band still wins over the sequence: an `in_progress` task authored *after* tied `open` tasks stays at the top. Without this, a final term inserted before the band term passes everything else.
- `--count 1` under a tie returns the first-authored task, not the ID-lowest.
- An in-process batch, not only separate invocations — the migration framework is the natural fixture, with the explicit note that its timestamps are identical.

#### 8.2 The sequence itself

- Assigned monotonically.
- **Backfill: a fixture file carrying no sequence field at all orders by line position**, permanently, including after the first mutation materialises the assignment. This is the durable legacy case, not a transient window, and it is what pins the backfill as the mechanism carrying every pre-existing project.
- A file with sequences on some records and absent on others — the post-merge shape — backfills above the file's highest sequence, with the newest record ordering **last** rather than first. This is the case a line-position rule gets wrong (§2.3).
- A file whose unnumbered records lie above numbered ones — the merge shape of §2.3 — backfills with no sequence equal to any carried one, and the doctor check reports clean after the next write. This is the case a running-maximum rule gets wrong (§2.3).
- A record whose sequence is absent because a binary that did not know the field stripped it is reassigned correctly on the next read.
- Survives create, update, remove and `tick rebuild`. The invariant is phrased "sequence order equals record order", not "equals line number" — `ParseJSONL` skips blank lines (`internal/storage/jsonl.go:99-101`).
- Round-trips through JSONL: written, read, unchanged.
- The cache column carries the sequence and the sort uses it, asserted directly (§3.2).

#### 8.3 Duplicate sequences

- Two tasks sharing a sequence produce a **deterministic** order — the ID tiebreak — under both the filtered and unfiltered query plans. The assertion is that tie order can no longer vary with the plan.
- `tick show`'s children under a shared sequence are deterministic too — the same ID tiebreak, asserted on the parent's detail document.
- The new doctor check reports a duplicate with its line numbers, mirroring `DuplicateIdCheck`'s existing tests, and reports nothing on a clean file.
- A duplicate does not fail the run: the check reports at warning severity and `tick doctor` still exits zero on a file carrying one (§5.2).

#### 8.4 `tick show`'s sub-lists

- Children follow creation order, and **priority does not participate** — a child with better priority does not float above an earlier-created sibling (§4.3).
- Blockers follow declaration order: a fixture where a blocker created *later* was declared *first* must list it first, and `tick show` must agree with `tick dep tree` and with the `blocked_by` array in the record on that same fixture. This single assertion pins the key against drift.
- The same sections render under `create`, `update` and both `note` handlers via `outputMutationResult` — their detail documents and the conformance inventory are in scope, not only `tick show` (§4.4).
- `--field children.N` and `--field blocked_by.N` positional addressing changes meaning — asserted rather than discovered.

#### 8.5 Regression floor

Existing ordering tests stay green **unchanged**. A final sort term must not disturb any result whose earlier keys already differ, and this is empirically satisfiable (§7.3).

#### 8.6 The documented contract

- The README's sort-contract sentence is pinned by a prose assertion, following the two the suite already carries for README prose — `TestREADMEDocumentsFieldSelection` (`internal/cli/readme_samples_test.go:570`) and `TestREADMEDocumentsEndOfFlagsMarker` (`:637`). It is the only user-facing statement of the guarantee this work delivers, and the sample run never reads it (§6).
- The README's doctor enumeration is pinned the same way: a prose assertion requires it to name the duplicate-sequence check as its own entry (§6). It is the only place a user meets the new diagnostic, it is prose the sample run never reads, and folding it back into the generic "duplicates" would otherwise pass unnoticed.

---

## Working Notes

## Corrigenda

> **Corrigendum 2026-09-22** (from `planning/same-second-tasks-sort-by-id`): "walk the records in order, tracking the highest sequence seen so far — starting at 0 — and give the next number to any record that has none … This is a running-maximum rule" (§2.3), with §5.2's "backfill gives each of them a distinct number on read (§2.3), so they cannot collide" — corrected: a running maximum collides when an unnumbered record lies above a numbered one after a merge, contradicting §5.2; per the investigation's resolution 2, backfill numbers each unnumbered record, in line order, above the highest sequence the file carries — new-task numbering applied per record — so a backfilled number never equals a carried one. §2.3, §5.2 and §8.2 updated, §8.2 gaining the merge-shape case.

> **Corrigendum 2026-09-22** (from `planning/same-second-tasks-sort-by-id`): §6 left open whether `tick help doctor`'s check list (`internal/cli/help.go:217`) gains the duplicate-sequence check — settled: it does not. That list is a summary already omitting three existing checks, and the README's inclusion rule (a standing enumeration of every check gains each new one) does not reach it. §6 updated.
