# Specification: Free Text Round Trip

## Specification

### 1. Purpose

`tick`'s toon output is the agent-facing format — the default whenever stdout is not a TTY. It does not parse. A standard TOON reader fails on the first line of `tick show` output and never reaches anything beneath it:

> `line 1: invalid unquoted key "task{id,title,status,priority,type,created,updated}"`

The failure that triggered this work was an agent abandoning the CLI and reading `.tick/tasks.jsonl` directly to obtain a task's description as a plain string. The file told it the truth without a decoding rule it had to already know.

The cause is uniform. Every section the formatter assembles by hand is malformed; every section it hands to the TOON library is correct.

| Written by | Sections | Parses |
|---|---|---|
| The library (`encodeToonSection`) | blocked_by, children, notes, priority breakdown, dep-tree edges | yes |
| Hand-assembled string building | task header, stats summary, dep-tree summary, tags, refs, description | no |

Each hand-rolled section exists because it wanted a shape the library does not produce directly — a singular object header, a list down the page, an unstructured text block. In every case the invented shape turned out to be invalid.

**This work delivers toon output that a standard TOON reader can read, for every command that returns data, and free text that survives an agent's read-edit-write cycle without a rule learned outside the output.**

A narrower version was available and refused: repair free text now and log the rest as a separate concern. A quarter of a broken format is exactly as unusable as all of it — the document fails on its first line, so a reader never reaches the repaired description and the agent goes back to the data file — which means the free-text work delivers nothing on its own. Free-text encoding is therefore not the deliverable in itself; it is one of the malformed sections. Taking the whole format brings in three areas that sat outside the original framing: the single-object section headers (§5), the tags and refs lists (§6.1), and the verification that keeps the output conformant afterwards (§11).

Measured against `github.com/toon-format/toon-go@v0.0.0-20251202084852` (`grep toon-go go.mod`). Whether the TOON specification itself permits a single-object scope header was not verified — the claim is only that the reference Go implementation rejects it, and that the form is hand-constructed by tick rather than produced by the library.

### 2. Round-Trip Contract

#### 2.1 Both reading paths are in scope

An agent must be able to fetch one field bare, **and** must equally be able to run one `tick show` and lift usable free text out of the full output. Neither is the designated path with the other as a fallback: the field flag (§9) does not excuse an ambiguous block in full output, and repairing the block does not remove the need for bare single-field output.

#### 2.2 The fidelity bar is byte-identity

Read a value out of `tick show`, write it back unchanged, and the stored value is byte-for-byte what it was.

Existing whitespace trimming does not stand in the way of this, **provided no stored value carries edge whitespace**. `create` and `update` both run a description through `TrimDescription` before storing (`grep -n 'TrimDescription(' internal/cli/create.go internal/cli/update.go` → `create.go:214`, `update.go:193`, `update.go:342`), which is `strings.TrimSpace` (`grep -n 'func TrimDescription' -A 2 internal/task/task.go` → `task.go:193-195`). The trim is idempotent over anything that came out of storage, so a read that returns the stored bytes exactly, written back, lands the identical value. The trimming behaviour on those two paths is out of scope as a defect.

The invariant that derivation rests on is not currently true. `tick migrate` is a third write path and it stores the source tool's value as it arrives — `grep -rn 'TrimDescription' internal/ --include='*.go' | grep -v '_test'` returns only the `create`/`update` sites above plus the definition, and `sed -n '75,84p' internal/migrate/store_creator.go` builds the task with `Description: mt.Description`. Titles carry the same hole: `grep -n 'TrimSpace(mt.Title)' internal/migrate/migrate.go` → `migrate.go:44` validates that a trimmed title is non-empty, and `store_creator.go:78` then stores the untrimmed one. An imported description with a leading newline or trailing spaces reads out of `tick show` intact and is silently trimmed on write-back — the bar failing on precisely the tasks nobody typed by hand.

**`tick migrate` therefore trims every free-text value it imports, exactly as `create` does.** Today that is descriptions and titles — the import framework carries no notes (`grep -rn 'Note' internal/migrate/ --include='*.go' | grep -v _test` → no matches; `MigratedTask` holds Title, Status, Priority, Description and the three timestamps, `sed -n '30,38p' internal/migrate/migrate.go`) — and a provider that later brings note text across is covered by the same rule rather than by a second decision. This is in scope for this work: it makes the invariant true system-wide rather than documenting an exception a reader cannot predict from the output. The trim normalises, it does not validate: a value that is nothing but whitespace stores as empty, and no import fails because of it. Import is already a translation boundary — statuses, priorities and timestamps are all mapped on the way in — so normalising whitespace there is the same kind of move, and it costs a reader nothing they would notice.

Two alternatives were declined. Dropping the trim from `create` and `update` would make byte-identity hold with no invariant at all, but changes behaviour for every user to serve a case only importers hit, and reopens whitespace-only descriptions, which `ValidateDescriptionUpdate` currently routes to `--clear-description`. Writing the exception down — the bar covering CLI-authored descriptions only — costs no code and hands the reader the kind of unpredictable exception this work exists to delete.

**Values already in storage are left alone.** The bar holds for everything written from this change onward; a task imported by an earlier version keeps its untrimmed value and can still lose edge whitespace on a write-back, and that exposure closes itself as those tasks are edited. No pass rewrites stored records, and `tick show` never emits anything but the stored bytes — trimming on the way out would buy the match by breaking the read the bar is stated over.

The bar also does not hold for free of charge across all three free-text carriers. Note text and task titles are rejected before reaching storage when they begin with a dash — see §10. Reaching byte-identity for them requires that fix, which this work carries.

The whitespace invariant itself covers all three the same way, and on the CLI side it already holds: **every path that stores free text trims edge whitespace before storing it** — `TrimNoteText` on note text (`grep -n 'TrimNoteText' internal/cli/note.go` → `note.go:50`) and `TrimTitle` on titles (`grep -n 'TrimTitle' internal/cli/create.go internal/cli/update.go` → `create.go:117`, `update.go:182`, `update.go:337`), exactly as `TrimDescription` does above. The import path is the only one where it does not, which is what the trim above adds. Stating it over all three is what makes the bar hold for a note or a title read out and written back, not descriptions alone.

#### 2.3 What is not a defect

The current output is not lossy. The description block prefixes two spaces to every line, so blank lines emerge as two spaces and originally-indented lines at four; stripping exactly two from each line returns the original bytes. Note text passes through the library's tabular encoder, which quotes and escapes any string containing a newline, carriage return or tab, so a multi-line note survives as `"multi\nline\nnote"`.

The defect is that the two free-text fields use two different, mutually incompatible decoding rules, neither of which the output announces, and that the description block has no count and no terminator — it works today only because it is emitted last and runs to EOF (`sed -n '104,109p' internal/cli/toon_formatter.go`).

### 3. Output Inventory

#### 3.1 Output that must parse

Every command listed here emits output a standard TOON reader decodes, on **every** branch — the empty one included (§8). Two things are exempt, both because they are not documents: a bare value from `tick show --field` (§9.2), for the reason §9.7 exempts it from the format flags, and a field selection that prints no bytes at all (§9.6), which is nothing rather than an empty document, in every format. Every document `show` produces — the full detail, and a filtered one — decodes.

**A value TOON cannot carry fails the command, it does not vanish from the document.** The encoder refuses any C0 control character other than tab, newline and carriage return, and a stored title, description or note can hold one — an escape sequence inside pasted terminal output is the everyday way. The command exits non-zero with a diagnostic naming the field or section it could not encode and the task that carries the refused value, and writes nothing to stdout. A task list names the offending row, not merely the section — an error that tells an agent only that a project-wide command failed leaves it bisecting the project or reading `.tick/tasks.jsonl`, which is the same defect as a document that lies, one step removed. Where the offending row cannot be identified, the section name alone stands. It never prints a document with the value silently dropped, a section whose count says zero over rows that exist, or a task list that reads as empty because one task among them is unencodable — each of those parses, so no amount of §11 coverage can catch it, and each tells an agent something untrue. JSON and pretty are unaffected: both carry these values, so a refused value still reads back through them and through §9.2's bare form, which reaches no encoder. The write path is untouched — the value is stored, and a mutation whose document is refused still commits.

| Output | Commands |
|---|---|
| Task detail | `show`, `create`, `update`, `note add`, `note remove`. The four mutating commands share `outputMutationResult` (`grep -rn 'outputMutationResult' internal/cli/ \| grep -v _test` → `create.go:277`, `update.go:409`, `note.go:86`, `note.go:142`); `show` queries and renders the same detail inline (`sed -n '52,64p' internal/cli/show.go`), so a change made only at the helper leaves `show` — and §9's field selection, which never reaches the helper — untouched |
| Task list | `list`, `ready`, `blocked` |
| Stats | `stats` |
| Dependency graph | `dep tree` |
| Status change | `start`, `done`, `cancel`, `reopen` |

#### 3.2 Output that stays prose

`dep add`, `dep remove`, `remove`, `init`, and the general-purpose messages. These are confirmations of a command the caller issued: the caller already knows what it asked for and the exit code says whether it worked. Wrapping a one-line confirmation in a data format costs tokens to restate what the caller already knows and introduces a new way to fail.

The boundary this draws: a confirmation may be prose; an **answer to a query** may not. "No dependencies" is not a confirmation — it is the answer the caller ran the command to find out (§8).

This section scopes to toon and pretty, the formats where these commands print a line of text. Under `--json` all five return an object — `FormatDepChange` returns `{"action","task_id","blocker"}`, `FormatMessage` returns `{"message"}`, and `FormatRemoval` returns `{"removed":[…],"deps_updated":[…]}` — so under JSON they are documents, and §11's must-parse coverage reaches them there.

#### 3.3 `doctor` and `migrate` are out of scope

Both bypass the formatter entirely and print straight to the terminal — `handleDoctor` documents this in its own comment (`sed -n '44,46p' internal/cli/doctor.go`), and `RunMigrate` presents through `migrate.Present` rather than a `Formatter` (`grep -n 'migrate.Present' internal/cli/migrate.go` → `migrate.go:124`). Neither honours the format flags.

The defect being fixed is output that *claims* to be machine-readable and is not — a header no reader accepts, a list missing its item markers. These two never claimed it. Bringing them in means building new formatter surface rather than repairing broken output, which is different work.

Cost accepted: an agent running the health check reads a paragraph and works out what to do from the words.

This covers their **output** only. `migrate`'s import write path is touched by §2.2, which trims descriptions and titles on the way in.

### 4. Formatter Scope

#### 4.1 Pretty is unchanged, everywhere

What a terminal prints today is what it prints after this work — the single transition line, the box-drawing cascade tree, the indented description block, the dep-tree prose on empty branches. Pretty is the human surface; this work is about the agent surface, and nothing in pretty is broken by the standard being applied: it never claimed to be machine-readable, and a human reads it fine.

**The one exception is a value pretty was already reporting incorrectly.** The rule preserves pretty's shape, not a wrong number inside it: where this work's conformance passes expose a pre-existing defect in a figure the terminal shares with the agent formats, the answer is corrected in all three rather than kept wrong in one. It has arisen twice, both in `tick dep tree`, and both from the same root: the command derived `chains` and `blocked` from every task in a dependency while deriving `longest`, the drawn tree and the empty-answer sentence only from tasks no other task blocks. A project containing a dependency cycle therefore reported `2 chains, longest: 1, 4 blocked` against a tree showing one chain and one blocked task, and a project whose every participant was blocked reported `No dependencies found.` while the agent formats reported the edges. `longest` now walks the same set as the counts beside it, pretty's tree draws the participants no root reaches alongside the rooted ones, and the sentence fires only when the graph holds no participant at all — so the terminal and the agent formats answer alike.

Two candidate changes were declined explicitly and are **not** in scope:

- Replicating §7's table shape in pretty. The current cascade tree nests by which task caused which, so a grandchild closing because its parent closed shows as three levels of indentation. Flattened into rows, every knock-on looks equally directly caused. The toon table drops that too, but an agent holds the parent/child links and can reconstruct the chain; a human reading a terminal cannot, which is why the tree exists.
- Adding the task's title to pretty's single transition line. A genuine improvement rather than a defect fix, and out of scope.

#### 4.2 JSON moves with toon

A consumer parsing JSON gets the same structured answer as one parsing toon: the §7 `changed` list in place of the current `transition` object beside a `cascaded` list (`grep -n 'json:"transition"\|json:"cascaded"' internal/cli/json_formatter.go` → `json_formatter.go:276-277`), and the §8 structured empty dep-tree form in place of today's English sentence, which reaches JSON as a bare `message` object from the command handler rather than from the dep-tree formatter (§4.3).

Each note also carries its 1-based index, for the reason the toon table does (§6.3): a consumer that asked for one note (§9.3) needs the note's real position before it can call `note remove`, and that need is the same whichever format it parses.

#### 4.3 Two shared code paths must be split, not edited

Pretty being unchanged while toon and JSON move is not free — the code is shared in two places, and editing it in place would change pretty by accident:

- **The single transition line** comes from `baseFormatter.FormatTransition` (`grep -n 'func (b \*baseFormatter) FormatTransition' internal/cli/format.go` → `format.go:211`), embedded by both the toon and pretty formatters, so the two emit byte-identical text today. The sharing is redundant rather than load-bearing: `PrettyFormatter.FormatCascadeTransition` already produces that exact line on its zero-cascade branch, so restructuring the toon form removes the shared method outright rather than splitting it, and pretty's bytes are unaffected.
- **The dep-tree empty messages** are not produced by a formatter at all. They are set on the result in the shared graph builder (`grep -n 'No dependencies' internal/cli/dep_tree_graph.go` → `dep_tree_graph.go:177`, `dep_tree_graph.go:255`) and consumed by all three formatters, so removing them at source would strip pretty's message too.

  On the nothing-blocked branch they never reach a dep-tree formatter at all: `runFullDepTree` returns as soon as the root set is empty, printing the sentence through `FormatMessage` (`sed -n '34,44p' internal/cli/dep_tree.go` → `dep_tree.go:38-41`). The guards that look like they handle it — `json_formatter.go:366` and `toon_formatter.go:180-182` — are dead code. **The change therefore lands in the handler, not in the formatters**, and it has a consequence for pretty: `PrettyFormatter.formatFullDepTree` returns `""` for zero roots (`sed -n '316,319p' internal/cli/pretty_formatter.go`), so once that branch routes through the formatters pretty must be handed its sentence explicitly or it silently prints nothing. The named-task branch already reaches the formatters (`runFocusedDepTree` calls `FormatDepTree` unconditionally) and needs no handler change.

### 5. Single-Object Sections Become Top-Level Named Fields

#### 5.1 The current shape and its cause

Three places in the output describe one thing rather than a list of things: the task's own fields at the head of the task-detail document (§3.1), the counts summary in `tick stats`, and the chains/longest/blocked summary in `tick dep tree`. All three are malformed, and this is the line a reader fails on before it sees anything else.

The cause is a hand-edit. The value is marshalled as a one-element array and the `[1]` is then deleted from the header with a string replace to make it read as singular — `buildTaskSection` does it inline (`grep -n 'strings.Replace(s, "task\[1\]"' internal/cli/toon_formatter.go` → `toon_formatter.go:294`) and `encodeToonSingleObject` does it generically for stats and the dep-tree summary (`grep -n 'func encodeToonSingleObject' -A 10 internal/cli/toon_formatter.go` → `toon_formatter.go:371-379`). The result is a table header with no table beneath it, a shape TOON has no equivalent for.

#### 5.2 The required shape

**The task's own fields sit at the top level of the document, as named fields, with no wrapping key.** They are peers of the collection sections rather than nested inside a `task:` scope:

```
id: tick-a1b2
title: Add retry to the sync worker
status: in_progress
priority: 2
type: feature
created: "2026-09-10T09:14:00Z"
updated: "2026-09-17T16:00:00Z"

children[1]{id,title,status}:
  tick-9f3c,Parse the header,done

description: "Fix it.\n\nSteps."
```

**Which sections a document carries is unchanged by this work.** The example shows the form, not the full complement: `children`, `blocked_by` and `notes` are always present, carrying a count-zero header when empty (§8), while `type`, `parent`, `closed`, `tags`, `refs` and `description` appear only when the task carries them. The always-present rule of §7.4 is the `changed` section's and does not extend to the rest.

**The same treatment applies to the other two single-object sites**: `tick stats`' counts and the dep-tree chains/longest/blocked summary become top-level named fields beside their tables. Where `tick dep tree` names a task, the line identifying that task becomes top-level `id`, `title` and `status` fields in the same form, so a focused dependency document opens exactly as a task-detail document does. It is carried on both branches: today the identity appears only when the task has no dependencies, as a free-form line (`sed -n '209,212p' internal/cli/toon_formatter.go`), and the populated branch prints edge sections with nothing naming the task at all.

#### 5.3 Why named fields rather than a one-row table

Two conformant options existed; both were encoded and decoded back with the project's TOON library, and both round-trip.

The one-row table (`task[1]{id,title,…}:` with a single row beneath) is three characters longer than today's broken output and is the library's own output with nothing stripped. Its cost is positional reading: a consumer counts commas across to the matching name in the header. The table layout earns its keep when many rows would otherwise repeat the field names — that is `tick list`'s case, not this one. With a single row it repeats nothing, so it compresses nothing, and it trades that for a positional read that can go wrong.

Named fields put every value beside its name, so adding or reordering a field cannot break a positional read and a value containing a comma is safe without relying on quoting discipline.

Neither form is an invention. TOON is a compact way of writing JSON: an object inside an object is written as the key with its fields indented beneath (the named-fields form), and a list of same-shaped objects is written as a header plus rows (the table form, which is what `tick list` uses). What tick invented was neither.

#### 5.4 Why no wrapping key

Measured: 256 characters flat against 276 wrapped, for the same content, both parsing and round-tripping.

Three reasons, the size being the least of them:

1. **It removes an inconsistency the wrapper created.** `description` is a task field and sits at the top level. `title` is a task field and sat nested. The same kind of thing at two different depths, for no reason beyond one of them being long.
2. **It mirrors storage.** The JSONL file already holds each task as a flat object — `{"id":…,"title":…,"status":…,"description":…}` — so the output stops inventing a grouping that exists nowhere else in the system.
3. **The field flag falls out of it.** `--field title,status` returns two lines with nothing wrapped around them, rather than a trimmed block (§9.4).

Given up: a consumer can no longer grab "the task's own fields" as one object without naming them. Nothing identified wants that.

### 6. Collection and Free-Text Sections

#### 6.1 Tags and refs use the library's inline list form

Today tags and refs are emitted as a header followed by one raw item per indented line (`grep -n 'func buildStringListSection' -A 9 internal/cli/toon_formatter.go` → `toon_formatter.go:320-328`):

```
tags[2]:
  has space
  plain
```

A TOON reader rejects this: an item written on its own line carries a leading `- ` marker, and without it the decoder reports a length mismatch. The items are also written raw, so a ref containing a comma comes back as two values rather than one, and a URL's colon goes unquoted where the format's own rules would quote it.

**Both become the inline form, produced by the library:**

```
tags[2]: has space,plain
```

The deciding factor is that this deletes the hand-written builder rather than correcting its output, and quoting becomes the library's responsibility — so a comma-bearing ref is safe by construction. The alternative, one item per line each marked `- `, is not a form the encoder emits: it would have to be hand-built, preserving the exact class of defect this work removes.

Cost accepted: a long refs list becomes a long line. The reader of toon output is an agent; a human reading tags reads pretty output, which renders them separately and is unchanged (§4.1).

#### 6.2 The description is one TOON-quoted value

Today the description is the indented raw block §2.3 describes (`grep -n 'func buildDescriptionSection' -A 10 internal/cli/toon_formatter.go` → `toon_formatter.go:346-355`).

**It becomes a single TOON-quoted string, exactly as the library's `toon.MarshalString` produces from a Go string:**

```
description: "Retry the sync worker on transient failures.\n\nCurrent behaviour: a single 500 …"
```

Three reasons, in the order they carried:

1. **It is produced by the library, not hand-assembled.** The alternative — a dash-list of lines, one item per line with a declared count — is not a form the encoder produces from a `[]string` (given one it emits the inline form). It would have to be built by hand with our own quoting rules, which is the mechanism behind every malformed section this work removes.
2. **The dash-list's advantage evaporates on real content.** Measured on an actual 13-line, 1090-character task description from a live project: the quoted value is 1117 characters on one line; the dash-list is 1185 characters over 14 lines with **13 of 13 lines needing quotes** — for a colon in a heading, a leading dash on a bullet, leading spaces on an indented line. The line structure it exists to preserve is buried under quote marks, and it is larger as well.
3. **It is the rule note text already obeys.** One decoding rule for all free text in the output, which is what the reader needed and never had.

The quoted form's overhead on that text is 27 characters, about 2.5%, all of it newline escapes. On a 4500-character description it is roughly a hundred characters and one very long line.

Cost accepted: a long description is one long line and unpleasant to read in a terminal. A human reading a description reads pretty output, which this work does not touch.

A third candidate — keeping the indented raw block and adding a terminator or a line count — cannot be conformant however it is delimited: it is a block form TOON has no concept of.

#### 6.3 The notes section carries an index column

Notes already round-trip on the read side (§2.3). What changes is the schema.

**The notes section gains a leading `index` column carrying each note's 1-based position, present whether the section is filtered (§9.3) or not:**

```
notes[2]{index,text,created}:
  1,Retried twice before it stuck,"2026-09-14T10:02:00Z"
  2,"multi\nline\nnote","2026-09-16T08:30:00Z"
```

Position is the only handle a note has. There is no note ID; `note remove` takes a 1-based index (`grep -n 'index %d out of range' internal/cli/note.go` → `note.go:128`); and notes stay an append-and-retract log (§6.4), so nothing else identifies one. Without the column, an agent that asked for the third note alone sees `notes[1]` with one row, decides the note is wrong, runs `tick note remove <id> 1`, and deletes the first note on the task.

One shape either way, so there is no rule about when the column appears. It also retires a smaller oddity: in full output today an agent must count rows to work out what to pass to `note remove`.

#### 6.4 Notes stay read-side only — no edit command

Editing a note today means removing it and adding it back, which gives the corrected text a fresh `created` timestamp and moves it to the bottom of the list. The `note` command has exactly two subcommands (`grep -n 'case "add":\|case "remove":' internal/cli/note.go` → `note.go:28`, `note.go:30`).

**No `note edit` command is added by this work.** A note carries a `created` stamp and sits in a positional log you retract from by index — an append-only record of what was observed when, not a mutable field. Adding an edit would turn it into a list of editable strings, and would do so as a side effect of a formatting fix rather than as a decision about the annotation model. If notes should become editable, that is its own piece of work with its own reasoning.

Cost accepted: correcting a note still costs its timestamp and its position. The counter-argument — agents write these notes and agents typo — was weighed and did not carry, because the remedy it asks for changes the data model to serve a convenience.

What remains in scope for notes: their text is readable out of `tick show` without a rule learned elsewhere (already true, via TOON quoting), field extraction reaches it (§9), and note text that begins with a dash becomes writable (§10).

### 7. Status Change Output

#### 7.1 The current shape

When an agent closes a task and other tasks move with it, what comes back is an arrow diagram:

```
tick-a1b2: in_progress → done
tick-9f3c: open → done (auto)
tick-77ab: in_progress → done (auto)
```

Reading it requires knowing that the ID precedes the colon, that the arrow separates old state from new, and that `(auto)` marks a knock-on rather than the requested change. It is a bespoke line format, produced today by a method pretty also embeds though pretty does not depend on it (§4.3), and `ToonFormatter.FormatCascadeTransition` is the same construction with ` (auto)` appended (`grep -n 'func (f \*ToonFormatter) FormatCascadeTransition' internal/cli/toon_formatter.go` → `toon_formatter.go:145`).

#### 7.2 One table, always

**Every task whose status moved gets a row, and an `auto` column says whether that row is the change the caller asked for:**

```
changed[3]{id,title,from,to,auto}:
  tick-a1b2,Add retry to the sync worker,in_progress,done,false
  tick-9f3c,Parse the header,open,done,true
  tick-77ab,Validate fields,in_progress,done,true
```

A re-parenting, where nothing the caller asked for was itself a status change, is the same shape with every row marked as a consequence:

```
changed[2]{id,title,from,to,auto}:
  tick-1111,Phase 5,done,open,true
  tick-2222,Phase 4,in_progress,done,true
```

Two reasons carried it:

1. **A reader must not have to branch on which document arrived before it can read either.** An agent parsing status output sees one table whatever command produced it, and the count is always right. A singular block for the requested change beside a table of knock-ons would be two documents for one kind of event.
2. **The marking column is not new vocabulary.** Every task's transition history already records each change with an `auto` flag — false when a user or agent asked for it, true when the system produced it as a consequence — stored per task in the JSONL and in the `task_transitions` table. Inventing a "requested" column instead would be exactly the move that produced the malformed output this work removes: a shape someone wanted, built by hand, outside the vocabulary that already existed.

The table carries the title so no second lookup is needed to know what moved. The trailing `(auto)` marker of the old arrow lines disappears into the column that always meant it.

**A task appears at most once.** One command can move the same task's status twice — the two cascades of §7.5 meeting on a shared ancestor — and the table still carries one row for it, reading from the status it held before the command to the status it holds after. A task that ends where it started carries no row: the table lists what changed.

#### 7.3 The per-command split is kept

`done`, `start`, `cancel` and `reopen` return **only** the `changed` table. `create` and `update` return the task's full record with the `changed` table as a section inside it.

The deciding factor: `create` and `update` are edits and the caller wants the result of the edit — the new ID, the merged fields — whereas a status change is something the caller already knows it did, so a full record is tokens it did not ask for.

`show`, `note add` and `note remove` carry no `changed` section at all. Only a parent/child structural change moves another task's status (§7.5), and none of the three performs one, so there is nothing for the section to hold. The section belongs to `create` and `update`, even though all four mutating commands share one detail helper (§3.1).

A third option was put up and declined: leave status output alone entirely, treating `tick done` as a prose confirmation like `tick dep add`, with an agent running `tick show` afterwards if it needed to know what cascaded. The single-transition case is indeed change for consistency rather than repair. It was declined once the cascade case was seen beside it: the multi-task output carries titles the agent would otherwise have to look up, and one command's output parsing while another's does not — depending on whether a cascade fired — is exactly the branching rule this work exists to delete.

#### 7.4 One document, never a document with loose lines after it

`create` and `update` today print the full task detail and then append transition lines after it (`grep -n 'outputTransitionOrCascade' internal/cli/create.go internal/cli/update.go` → `create.go:283`, `update.go:415`, `update.go:420`). A reader handed that stream sees a task-detail document with foreign lines stuck on the end.

**Where a command produces both a record and status changes, the result is one document with the changes as a section inside it.** Making each section valid is not sufficient on its own; the stream must be one document.

**The section is always there.** `tick create` with no parent moves no task's status; the document still carries `changed[0]{id,title,from,to,auto}:`, exactly as an empty notes or children section carries its count-zero header (§8). A reader that must first find out whether the section exists is branching on which document arrived, which §7.2 exists to prevent.

`update` can carry two independent cascade blocks today because two unrelated changes can fire at once — this collapses into the single `changed` table along with everything else.

#### 7.5 Why a structural change produces a status cascade

Recorded because it is not obvious from the code, and the implementation must preserve it. `create` and `update` emit cascades not because the edited task's status moved, but because *other* tasks' statuses moved as a consequence of the parent/child structure changing:

- **Adding work under a finished parent.** `tick create --parent <done task>` reopens that parent — it is no longer complete — and that reopen travels further up if its own parent was done (Rule 6, then Rule 5).
- **Moving a task to a different parent.** `tick update <id> --parent <other>` can fire two unrelated changes at once: the new parent reopens if it was finished, and the old parent may auto-complete if the moved task was the last unfinished thing under it (Rule 6 and Rule 3 together).

These tasks are elsewhere in the tree and are not in the edited task's record, which is why they cannot be folded into it.

#### 7.6 Unchanged terminal children are not reinstated

The `changed` table lists what changed, exactly as today's output does. The `auto-cascade-parent-status` specification's requirement that unchanged terminal children be shown alongside a cascade is a pre-existing unimplemented requirement in another work unit's specification; it is not reinstated and not decided here. See §12.2 for the correction owed to that document.

### 8. Structured Output on Empty Branches

`tick dep tree` currently answers `No dependencies found.` when nothing in the project is blocked, and a title line plus `No dependencies.` when a named task has no dependencies either way (§4.3 locates both). That is prose on the one branch an agent could not predict, from the formatter whose purpose is machine-readable output. **Both go, in toon and JSON; pretty keeps them (§4.3).**

**What replaces them is the document the non-empty branch produces, emptied**: the same fields, with the summary fields of §5.2 reading zero and the edges section carrying its count-zero header. Where the caller named a task, the emptied document still identifies it exactly as the populated one does. Both empty branches take that shape — nothing blocked anywhere, and a named task with no dependencies either way — so an agent parses one document whether or not anything is blocked, and reads the counts to learn which it got.

**The counts and the edge list never disagree.** A third state reaches the same emptied edge list without meaning "nothing is blocked": a project where no participant is a root, because every dependency edge sits inside a cycle or every blocker is a dangling ID. The edge list was derived by walking down from roots while the counts are derived from every participant, so that state would otherwise report a count-zero edges section beside a non-zero `chains` and `blocked`. **The full-graph edge list is therefore the stored relation itself**: one row per recorded dependency, in record order, covering every participant by construction and repeating none. A walk cannot do this — it re-emits the whole subtree below every point two paths converge on, so three stored dependencies came back as four rows beside a summary reading one chain. Reading the counts then tells an agent what it got, as above, rather than telling it the two halves of one document contradict each other.

**The node-shaped renderings still walk.** Pretty and JSON draw trees, where a task two things block appears under each of them — a drawing, not a duplicated fact. After the walk from the roots, any participant not yet drawn seeds a further walk, held back while any of its own blockers is still undrawn so that each chain is drawn once and a top-level entry is a participant nothing else drawn reaches. Where every remaining participant is blocked by another that is also undrawn — a cycle — the first in order is seeded so its edges still reach the output, and the passes resume afterwards so an independent second cycle is drawn too. That fallback is where the rule above stops holding: it seeds the first remaining participant whether or not that participant is itself in a cycle, so on a cycle carrying dependents a subtree can still be drawn twice and a blocked task can still appear as a top-level entry. The limit is accepted rather than fixed — every participant still reaches every format, and the counts still agree with the edge list, which §8 exists to guarantee.

**A participant that names no task says so.** Widening the coverage puts a dangling blocker — an ID no task record matches — into the node-shaped renderings for the first time, where it would otherwise carry a task's shape with every field but the ID blank. It renders instead with status `missing` and an empty title: pretty draws `tick-ghost   (missing)` and JSON returns `{"id":"tick-ghost","title":"","status":"missing"}`. The marker occupies the existing status slot and introduces no new visual form, so §4.1's bound on pretty holds, and it collides with none of the four real statuses. A blank status would make an agent learn outside the output that empty means "no such task" — the rule §1 exists to delete. The toon edge list is unaffected: it carries IDs only.

This is not an exception to §3.2's prose rule, it is that rule's boundary: the exemption covers confirmations of a command the caller issued, and "no dependencies" is the answer to a query — the answer the caller ran the command to find out.

The formatter already has the shape. An empty task list comes back as a structured empty section, and so does an empty edge set — `buildRelatedSection` and `buildNotesSection` both emit a count-zero header rather than prose (`grep -n '\[0\]{' internal/cli/toon_formatter.go` → `toon_formatter.go:300`, `toon_formatter.go:333`). The two dep-tree prose branches are the exception, not the pattern.

### 9. Field Selection

The companion to the format repair: a way to ask for one field's value and get it with nothing around it — no header, no indentation, no quoting. This is the case that started the work (§1).

Two routes to the same end were declined. `tick show --json` already returns the string and is the wrong shape for it: it costs tokens and hands back a value the caller has to parse JSON syntax off — the agent wanted the text, not a document containing it. A fourth output format, `--raw`, was pressed on and dropped: a format has to answer for every command in the CLI — `tick list --raw`, `tick stats --raw` — and carries that consistency burden forever. A flag that selects fields avoids designing a format at all.

`show` accepts no command-specific flags today (`grep -n '"show":' internal/cli/flags.go` → `flags.go:72`, `"show": {}`), so this is its first, alongside the global `--quiet`.

It is `show`'s flag and no other command's. `create`, `update`, `note add` and `note remove` emit the same detail document but take no field selection: a caller that wants one value out of them runs `tick show --field` afterwards, and the flag stays registered against a single command.

#### 9.1 `--field` and `--fields` are the same flag

**`--field` takes a comma-separated list of field names, and `--fields` is an alias of it.** Both spellings work; the plural exists so the flag reads naturally when selecting several. The flag is a projection, not a single-value extractor — asking for the notes table is a legitimate thing to want, since editing and writing back is not the only reason to read a field.

The answer's shape is split by how many fields were asked for.

**The names the flag accepts are the names the output document uses** — the task's own top-level fields (`id`, `title`, `status`, `priority`, `type`, `parent`, `created`, `updated`, `closed`) and the section keys (`description`, `notes`, `tags`, `refs`, `children`, `blocked_by`), spelled as a full `tick show` spells them. There is no second vocabulary to learn: what you read in the output is what you ask for. A positional suffix (`notes.2`, §9.3) attaches only to a section that holds a list; on anything else the whole name is unrecognised and takes §9.6's error.

**The list is read leniently wherever its meaning is not in doubt.** Whitespace around a name is not part of it, so `--field "title, status"` selects what `--field title,status` selects. Repeating the flag composes rather than overrides: `--field title --field status` is `--field title,status`. A field named more than once renders once, and counts once when the answer splits by how many fields were asked for (§9.2) — `--field title,title` is `--field title` and comes back as the bare value. A section named both whole and by position comes back whole, and several positions on one section render it narrowed to those positions in output order. None of this softens §9.6: a name that is empty once its whitespace is gone is still the blank-name mistake.

Several of these are emitted only when the task carries them (§5.2, `sed -n '265,285p' internal/cli/toon_formatter.go`). **Recognition does not depend on presence**: a name on this list is always recognised, and asking for one the task does not carry is an empty field (§9.6). A name absent from the list is unrecognised whatever the task holds.

#### 9.2 One field returns the bare value; several return a filtered document

**One field — the bare value.** `tick show tick-a1b2 --field description`:

```
Fix the parser.

Steps:
  - read the header
  - validate
```

The value goes out as a line: its own bytes followed by a single newline, as the bare task ID already is (`grep -n 'Fprintln(stdout, id)' internal/cli/helpers.go` → `helpers.go:18`). Values stored from this change onward carry no edge whitespace (§2.2), so that byte is the terminator and never part of the value.

**A single field naming a list section returns that section, not a bare value.** `tick show tick-a1b2 --field notes` prints the notes table exactly as full output renders it, header and all; `--field tags` prints `tags[2]: has space,plain`. A list has no bare form, and the flag is a projection rather than a single-value extractor (§9.1), so the section is handed over in the one shape the library produces for it.

The bare form belongs to a selection that resolves to exactly one value: the task's own fields, `description`, and a position that names one — `notes.2`'s text, `tags.1`'s item (§9.3). A selection that resolves to a row rather than a value — `children.1` — comes back as its one-row section.

**Several fields — the normal document with only those sections in it.** `tick show tick-a1b2 --field description,notes`:

```
notes[2]{index,text,created}:
  1,Retried twice before it stuck,"2026-09-14T10:02:00Z"
  2,"multi\nline\nnote","2026-09-16T08:30:00Z"

description: "Fix the parser.\n\nSteps:\n  - read the header\n  - validate"
```

Identical to a full `tick show` minus the sections not asked for. **Sections keep their usual output order**, not the order they were typed, so the shape does not shift with how the flag was written.

The split between the two kinds of answer was locked in knowingly. `--field description` and `--field description,notes` return different kinds of thing — a raw value versus a document — so an agent building the flag from a variable must know which it will get. It is the honest split between *fetch me this value* and *give me a trimmed record*, and collapsing them would cost the bare-value case the work exists to serve.

#### 9.3 List fields are reachable by position

`notes.2` selects the second note. In a multi-field selection the section renders as normal, its count following the selection while each row carries its real position via the `index` column (§6.3) — `tick show tick-a1b2 --field description,notes.2`:

```
notes[1]{index,text,created}:
  2,"multi\nline\nnote","2026-09-16T08:30:00Z"

description: "Fix the parser.\n\nSteps:\n  - read the header\n  - validate"
```

A position narrows the section it names and nothing else: every other field in the selection comes back whole.

**The grammar is the same on every section that holds a list** — `notes.2`, `tags.1`, `refs.2`, `children.3`, `blocked_by.1`. Positions are 1-based throughout, the section renders in its normal form narrowed to the named item (a table keeps its header and one row; an inline list keeps its count and carries one item), and a position past the end is the error of §9.6 on any of them, naming the range the same way. Only notes carry a real position in the row itself, because only notes are addressed by position elsewhere in the CLI (§6.3).

Asked for alone, `--field notes.2` prints that note's text bare, by the one-field rule.

The alternative considered and rejected was to refuse filtering on notes altogether — `notes.3` returning the whole table, leaving position implicit in row order. That keeps the output minimal at the cost of the selector the caller asked for.

#### 9.4 The task's own fields are selectable individually

**Exactly like sections.** `tick show tick-a1b2 --field title,status`:

```
title: Add retry to the sync worker
status: in_progress
```

Refusing — on the grounds that only whole sections are selectable — would make the grammar depend on which side of a boundary a name happens to sit, which is a rule to learn rather than read. §5.2 removed the wrapper, so the result has nothing around it.

#### 9.5 Nothing rides along unasked, including `id`

**You get exactly the fields you named**, in both forms.

The opening position was that `id` should always be present so a filtered document identifies the task it describes. It does not survive the bare form: `--field description` prints the bare value with nothing around it, so an `id` riding along would wreck the case the flag exists for. Scoping the rule — `id` present in the document form, absent in the bare form — was available and rejected as a second rule to learn. The caller passed the task's ID on the command line to make the request; handing it back tells them something they just typed.

#### 9.6 Empty values, unrecognised names, and out-of-range positions

**An empty field prints what full output prints for it, and exits successfully.** A task legitimately having no description is a fact about the task rather than a failure of the command. A field or section full output omits when the task does not carry it (§5.2) prints nothing; a section full output always carries prints its count-zero header, so `--field notes` on a task with no notes returns `notes[0]{index,text,created}:`. In the bare form that means no bytes at all: the terminating newline of §9.2 belongs to a value, so a field with no value produces an empty stream rather than a blank line. The rule runs per name: in a multi-field selection each empty name contributes what it would contribute to full output, the rest of the document is unaffected, and a selection whose every name prints nothing prints nothing at all and still exits successfully.

**An unrecognised field name is an error with a non-zero exit.** A field name that is not a field at all is a caller mistake, and gets what every other unrecognised flag value already gets — `ValidateFlags` refuses rather than silently ignoring (`grep -n 'unknown flag %q for %q' internal/cli/flags.go` → `flags.go:138`).

**A selection that names nothing is the same mistake.** An empty value, or a stray or doubled comma leaving an empty name in the list, fails with the unrecognised-name error rather than printing nothing or falling back to the full record. A blank name is a caller mistake, not a field that happens to be empty.

**A position that names nothing is out of range whatever the reason.** `notes.4` on a task carrying two notes, `notes.0` where positions start at 1, and `tags.1` on a task carrying no tags all fail the same way: a non-zero exit and a message naming the range, rather than printing nothing and succeeding. A selector that resolves to nothing is not a field that happens to be empty — the position is a claim about the data that is false. A section the task does not carry is not the empty-field case above either: `tags` alone on a tag-less task is a field that happens to be empty, while `tags.1` is a claim that a first tag exists. `tick note remove` already answers this for the same 1-based addressing, reporting the index as out of range and naming how many notes the task has (§6.3); giving the same grammar a different answer under a different command would be a second rule for a reader to learn. A suffix that is not a number is no positional claim at all and takes the unrecognised-name error (§9.1).

#### 9.7 Interaction with the format flags

**A request that returns a bare value ignores `--json`, `--pretty` and `--toon`; a request that returns a document honours them.** A bare value is not a document, so there is nothing for a format flag to act on, and honouring one would re-quote the very string the flag exists to hand over unquoted. A multi-field request produces a document, and so does a single field naming a list section (§9.2); the resolved format applies to either exactly as it applies to a full `tick show`.

In pretty — the format a terminal resolves to unless a flag overrides it — the filtered document is the named fields rendered in pretty's usual style and nothing else: no header block, no labels for sections outside the selection (§9.5). A filtered record is output pretty does not produce today rather than a change to output it does, so §4.1 stands untouched.

#### 9.8 Interaction with `--quiet`

**Passing `--quiet` and a field selection together is refused.** `--quiet` prints a bare task ID and nothing else; a single-field request prints that field's bare value and nothing else. Two different single values have been asked for, and silently picking one hands back something the caller did not ask for.

The refusal is an error with a non-zero exit and nothing on stdout, exactly as an unrecognised field name is (§9.6).

### 10. Free Text That Begins With a Dash

#### 10.1 The defect

An agent reads a note off a task, corrects a typo, and writes it back. If the note begins with a dash — `- read the header`, the shape a bulleted note naturally takes — the command refuses it:

```
unknown flag "- read the header" for "note add"
```

Wider than notes: `tick create "- some title"` is refused identically. `ValidateFlags` inspects every argument beginning with `-` that is not numeric and not a global flag, and rejects any it cannot find in the command's flag set (`grep -n 'func ValidateFlags' -A 30 internal/cli/flags.go` → `flags.go:117-147`). Free text passed as a bare argument — note text, task title — is inspected alongside real flags. `--description` escapes only because its value follows a registered value-taking flag, so validation skips it.

The check itself is deliberate and worth keeping: it exists so `tick update tick-a1b2 --prioirty 3` refuses rather than silently reporting success. The defect is that it is applied to arguments that are free text by definition.

This is the one place the §2.2 round-trip guarantee has a hole — text an agent can read out of tick and cannot put back. It is fixed here rather than left as a follow-up, because leaving it means shipping the contract with an exception nobody wrote down.

#### 10.2 The fix, both halves

- **`--` is supported as the end-of-flags marker, and becomes the canonical documented way to pass free text that may begin with a dash.** Almost entirely additive: `--` is rejected as a bare argument on every command (`unknown flag "--" for "note add"`), so no existing invocation uses it there, and inputs that currently fail begin to succeed. One case does change: `--` is accepted today as the *value* of a registered value-taking flag — `tick update <id> --description --` stores the two-dash description, because `ValidateFlags` skips the argument after a `TakesValue` flag and `applyGlobalFlag` does not claim `--`. Once the marker is recognised at any position it consumes that value slot, and the invocation fails with `--description requires a value`. The marker alone cannot restore it, since a post-marker argument is a positional and can never re-attach to the flag; the attached form `--flag=value` is what closes it, and closes with it the pre-existing sibling case where a value spelling a global flag is stripped wherever it appears.

  Nothing after the marker is read as a flag — not the command's own flags and not the global format flags — so flags come before it and everything after it is text. Free text that spells a flag exactly, a note reading `--json`, is writable for the same reason a dash-leading one is.
- **Flag inspection stops after the task ID on `note add`.** The command registers no flags at all (`grep -n '"note add":' internal/cli/flags.go` → `flags.go:80`, `"note add": {}`), so nothing dash-leading after the ID could be a flag the check would have caught, and refusing it is the whole defect. What stops is the check, not flag handling: global flags are consumed wherever they appear, before the command sees its arguments (`sed -n '352,373p' internal/cli/app.go`), so `tick note add <id> "text" --json` prints a JSON document exactly as it does today, and note text that spells a global flag exactly still needs the marker. A dash-leading note that is not itself a global flag works with or without it.
- **The existing bare-argument form keeps working.** `--` is the recommended form, not a required one.

`create` cannot take the second half: its title shares the argument list with real flags (`--priority`, `--description`), so a dash-leading title is indistinguishable from a mistyped flag without a marker. `create` relies on `--`.

#### 10.3 No alternative input path

**Descriptions are passed as command-line arguments; no stdin or file input path is added.**

Measured: `getconf ARG_MAX` → `1048576`, and passing a 200 KB argument through a process call succeeds. A real task description taken from a live project runs to roughly 4.5 KB — under half a percent of the limit. Descriptions carry no length cap of their own, unlike note text, which is capped at 2000 characters (`grep -n 'maxNoteTextLen' internal/task/notes.go` → `notes.go:12`), so an arbitrarily large description remains possible in principle; building an input path for it would serve a case that does not occur.

### 11. Conformance Verification

Every other decision here is a shape. Nothing in them stops the next change adding a hand-built section and breaking the output again — which is exactly how it broke the first time.

The existing suite cannot catch it. Its assertions compare output against a string written down alongside the code, so a malformed header passed for the tool's entire life: the test compared a wrong string to the same wrong string. Every one of those assertions has to be rewritten regardless, since every shape this work touches changes.

Three parts:

1. **Every structured command's output is decoded by a real TOON reader in the suite, and the test fails if it will not parse.** This alone catches the entire class of defect this work exists to fix — a section nobody can read, whatever its content. The commands are §3.1's table, and the coverage is counted in documents rather than commands: every branch a listed command can take, the emptied forms of §8 included, and every document `show` produces, a multi-field selection and one narrowed by position included (§9.2, §9.3).

2. **One deliberately awkward task becomes a permanent fixture, round-tripped end to end.** Free text carrying newlines, quotes, commas, a leading dash, trailing spaces at the end of an interior line, and a line that looks like a section header. It carries that text in all three free-text carriers — title, description and a note — each taking what its shape allows: the title and the note text begin with a dash, and the description carries the multi-line content. Write it in, read it out, decode it, write the decoded text back, and assert the stored value is byte-for-byte what it was — the bar §2.2 sets. A note is written back by adding it again, since notes carry no edit (§6.4), and the assertion is made against the new note's stored text. Whitespace at the very start or end of a value is trimmed on the way in and stays trimmed, which is why the fixture carries its trailing spaces mid-text. That single test would have caught the original description defect, the tags item-marker defect and the refs comma defect — and it is the only test that checks the guarantee this work actually made, which is the round trip (§2.2) rather than parseability.

3. **Rewritten assertions check decoded values, not output text.** "The notes section has two rows and the second row's text is X", not "the output equals this blob".

**No byte-level pinning is kept in the machine formats.** Golden strings pin the exact output shape, so a future change cannot reshape a section without a test noticing — but they are the mechanism that rotted into the defect this work undoes. Decoded-value assertions survive harmless reformatting while still failing when a section goes missing or a value is wrong. That trade is taken for toon and JSON.

**Pretty keeps golden-string assertions.** Pretty output has no parser, so a decoded-value assertion does not exist for it; removing its golden strings would replace its only form of assertion with nothing.

### 12. Documentation Owed a Correction

Three published documents describe output this work replaces.

#### 12.1 The README is updated as part of this work

The agent-format output the README prints is not confined to its Output Formats section, and every sample this work replaces is corrected. Measured (`grep -n '^\$ tick' README.md` and the fenced samples beneath each):

| Sample | Location | Why it changes |
|---|---|---|
| `tick show` full detail | `README.md:430-450` | header, tags, refs and description block all change (§5, §6) |
| dep-tree summary header | `README.md:307` (inside `### dep`) | single-object section becomes top-level named fields (§5.2) |
| arrow transition | `README.md:473-475` | replaced by the `changed` table (§7.2) |
| JSON `{id,from,to}` transition | `README.md:481-486` | JSON moves with toon (§4.2) |
| cascade with `(auto)` / `(unchanged)` | `README.md:501-504` | replaced by the `changed` table; the `(unchanged)` marker was never implemented (§7.6) |

The `tick list` table (`README.md:396-401`) is library-written (`grep -n 'encodeToonSection("tasks"' internal/cli/toon_formatter.go` → `toon_formatter.go:75`) and its shape is untouched by this work. Its printed row is nonetheless wrong and is corrected while the section is being rewritten: it renders an empty `type` as a bare trailing comma, where the formatter quotes it (`sed -n '31p' internal/cli/toon_formatter_test.go` → the suite's own golden row `  tick-a1b2,Setup Sanctum,done,1,""`). `toonTaskRow.Type` carries no `omitempty` and the library quotes an empty string.

It is live documentation someone reads to learn the tool, not a record of a past decision, so leaving it describing output the tool does not produce is shipping a defect.

The README also gains the new input surface, for the same reason: `--field`/`--fields` on `show` (§9), and `--` as the way to pass free text that may begin with a dash (§10.2). Calling `--` the canonical form only means something if a caller can find it written down, and a flag documented nowhere is a flag nobody uses.

The command's own help text carries both alongside — not a preference but a constraint: `--field` must be registered in `commandFlags` for §9.6's unrecognised-name error to fire at all, and `TestCommandFlagsMatchHelp` (`grep -n 'func TestCommandFlagsMatchHelp' internal/cli/flag_validation_test.go` → `flag_validation_test.go:310`) fails the suite when a registered long flag has no matching help entry.

#### 12.2 Two completed specifications are corrected selectively

Both belong to completed work units, so the correction runs through the corrigendum facility: each proposed amendment is presented and confirmed before another unit's record is edited, the wrong claim is replaced in place, a dated corrigendum entry records what the document used to claim and what is true instead, and the document is re-indexed. The re-index is the point of the route — a specification's content stays live in the knowledge base at full confidence, so an amendment that stops at the file leaves the superseded claim being served as validated context to every later query.

| Document | What is wrong | Status |
|---|---|---|
| `v1` / `tick-core` specification | States "long text fields get their own unstructured sections" as a principle and prints the indented description block as its worked example (`sed -n '693,714p' .workflows/v1/specification/tick-core/specification.md`) | Work unit completed |
| `auto-cascade-parent-status` specification | Fixes the arrow-and-`(auto)` lines as the machine-readable cascade form (`sed -n '117,162p' .workflows/auto-cascade-parent-status/specification/auto-cascade-parent-status/specification.md`) | Work unit completed |

**Corrections are made by judgement, not as a blanket rewrite.** Specifications are forever documents that do not churn out of the knowledge base, and the facility for amending them exists, so a correction can be made wherever something is obviously wrong. But this specification supersedes those decisions regardless, so correcting them is not obligatory. Where a point is plainly and load-bearingly wrong, amend it; otherwise let supersession carry it.

Both documents carry a point that is plainly and load-bearingly wrong, so both are amended. `tick-core` states as a rule the exact thing §6.2 removes. `auto-cascade-parent-status` fixes the arrow-and-`(auto)` lines as the machine-readable cascade form, which §7.2 replaces outright. The amendment does not touch its requirement that unchanged terminal children be shown alongside a cascade (§7.6).

---

## Working Notes

## Corrigenda

> **Corrigendum 2026-09-19** (from `implementation/free-text-round-trip`): "Restructuring the toon form requires splitting that method" (§4.3, first bullet; echoed by §7.1's "a bespoke line format, shared with pretty") — corrected: the method was removed outright rather than split, and pretty's bytes are unchanged because `PrettyFormatter.FormatCascadeTransition` already produced that exact line on its zero-cascade branch before this work. The sharing the claim identified was redundant, not load-bearing. §4.3's second bullet (dep-tree empty messages) is unaffected and still governs later phases.

> **Corrigendum 2026-09-19** (from `implementation/free-text-round-trip`): "an agent parses one document whether or not anything is blocked, and reads the counts to learn which it got" (§8) — corrected: §8 did not consider a third state that reaches the emptied edge list, a project where no participant is a root because every dependency edge sits inside a cycle or every blocker is a dangling ID. `BuildFullDepTree` derives edges by walking down from roots and counts from every participant, so that state reported a count-zero edges section beside a non-zero `chains` and `blocked`, and reading the counts told an agent only that the two halves of one document disagreed. §8 now fixes that the full-graph edge list covers every participant. Derivation: §8's stated purpose requires the counts to be meaningful, so zeroing them would destroy the fact that tasks are blocked, while extending the edge list preserves both halves and makes the document self-consistent — which is §1's whole bar, output an agent can read without a rule learned outside it. Both producing states are ones the project expects, per `internal/doctor/dependency_cycle.go` and `internal/doctor/orphaned_dependency.go`.

> **Corrigendum 2026-09-19** (from `implementation/free-text-round-trip`): "What a terminal prints today is what it prints after this work" (§4.1) — corrected: §4.1 was written assuming what the terminal printed was correct, which for one figure it was not. `tick dep tree`'s summary line has always derived `chains` and `blocked` from every task participating in a dependency while deriving `longest`, and the drawn tree, only from tasks no other task blocks. A project carrying a dependency cycle therefore reported `2 chains, longest: 1, 4 blocked` beside a tree drawing one chain and one blocked task — verified against a binary built from the commit preceding this work unit, so the defect is pre-existing and not introduced by it. §8's requirement that the agent formats list every participant's edges made the mismatch unrepresentable there, and preserving it in pretty alone would have kept a known-wrong number to honour a promise written in ignorance of it. §4.1 now states the exception: pretty's shape is preserved, a figure it was already reporting incorrectly is not. Pretty's tree rendering is unchanged — a cycle has no root to draw from.

> **Corrigendum 2026-09-19** (from `implementation/free-text-round-trip`): "Pretty's tree rendering is untouched, since a cycle has no root to draw from" and "It has arisen once" (§4.1's exception paragraph, added earlier the same day) — corrected: the exception has arisen twice, and the second instance is pretty's tree rendering itself. Having taught the agent formats to cover every participant, the terminal was left answering `No dependencies found.` for a project whose every participant is blocked — a cycle, or a task blocked by an ID no task carries — while `tick dep tree --toon` in the same project printed the edges and `blocked: 1`. That sentence is an answer, not a shape: §3.2 already holds that an answer to a query may not be prose, and §8 removed the same sentence from the agent formats for the same reason. Pretty now draws the participants no root reaches alongside the rooted ones, through the existing tree rendering with no new visual form, and the sentence fires only when the graph holds no participant at all. The summary line and every rooted rendering are unchanged.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): "Purely additive: `--` is currently rejected on every command (`unknown flag \"--\" for \"note add\"`), so no existing invocation uses it. Everything that works today works identically" (§10.2) — corrected: `--` was rejected only as a bare argument. As the *value* of a registered value-taking flag it was accepted and stored, because `ValidateFlags` skipped the argument following a `TakesValue` flag and `applyGlobalFlag` never claimed `--`. Verified by building the commit preceding this phase (`b9782df7`): `tick update <id> --description --` stored the two-dash description there and fails with `--description requires a value` once the marker is recognised at any position. The marker's introduction therefore takes one case away rather than none, and the marker alone cannot restore it — a post-marker argument is a positional and can never re-attach to the flag. The attached form `--flag=value` is the repair, and it closes with it the pre-existing sibling case where a value spelling a global flag is stripped wherever it appears. The rule §10.2 sets and §2.2's byte-identity bar are unaffected; only the no-regression claim was wrong, and it was wrong about the behaviour it measured rather than about the design.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): "`dep add`, `dep remove`, `remove`, `init`, and the general-purpose messages. These are confirmations of a command the caller issued" (§3.2) — corrected: the exemption reads format-independent but holds only for toon and pretty. Under `--json` all five already return an object and predate this work: `JSONFormatter.FormatDepChange` (`internal/cli/json_formatter.go:193`) returns `{"action","task_id","blocked_by"}`, `FormatMessage` (`:265`) returns `{"message"}` for `init` and `rebuild`, and `FormatRemoval` (`:283`) returns `{"removed":[…],"deps_updated":[…]}` with both arrays always `[]` rather than `null`. §3.1 is explicitly scoped to "a standard TOON reader" and §4.2 says JSON moves with toon, so neither settled what §3.2 meant for JSON, and this phase's conformance inventory read it as covering every format and excluded all five from the JSON driver. §3.2 now carries the scoping clause: under JSON these five are documents, and §11's must-parse coverage reaches them there. The prose rule itself and its confirmation-versus-answer boundary are unchanged.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): "`FormatDepChange` returns `{"action","task_id","blocked_by"}`" (§3.2's scoping clause, added earlier the same day) — corrected: the dependency-change document's key is now `blocker`. Running `dep add` and `dep remove` through the JSON conformance driver for the first time — which that same clause is what made possible — exposed `blocked_by` carrying two types across tick's JSON: a list of nodes in the detail and dep-tree documents (`internal/cli/json_formatter.go:352`, and the detail document's own `blocked_by`), and a bare task ID in the dependency-change document (`:189`). An agent had to know which command it ran to know whether the key held a list or a string, with no discriminator in the document — the branching rule §7.2 and §8 delete elsewhere, and the class of defect §1 opens this work for. Renaming the scalar was chosen over exempting that one document from the type invariant, which would blind the guard precisely where the type was wrong, and over leaving the two commands outside the JSON driver, which is the gap the work closes. The change is confined to `jsonDepChange`: toon and pretty return plain text through `baseFormatter.FormatDepChange` (`internal/cli/format.go:268`), and no README sample or other test named the old key. This is a change to shipped output, not a repair of a stale claim: `tick dep add --json` and `tick dep remove --json` now return `{"action","task_id","blocker"}`.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): §8's corrigendum of 2026-09-19 widened the full-graph edge list to cover every participant, and §4.1's second corrigendum had pretty draw the participants no root reaches — neither said how a participant that is not a task is presented as a *node*. The gap was not a wrong claim but an unmade decision, and the zero value stood in for it: `buildUnrootedTrees` seeds `DepTreeTask{ID: id}` (`internal/cli/dep_tree_graph.go:228`) and the blanks reach both node-shaped renderings, so pretty drew `tick-ghost   ()` and JSON returned `{"id":"tick-ghost","title":"","status":""}` — an agent reading a task that exists with no title, then told "task not found" when it asks for it. §8 now fixes the shape: status `missing`, empty title. Derived rather than chosen from taste. Dropping non-task participants from the node renderings was the alternative, and it would take the blocked real task out of pretty's tree with the ghost that seeds its walk, reversing the settled direction that the terminal stops denying dependencies that exist; leaving the blanks makes an agent learn outside the output that an empty status means "no such task", the rule §1 exists to delete. The marker occupies the existing status slot, so §4.1's no-new-visual-form bound holds, and it collides with none of the four real statuses. Before this work the ID could reach neither rendering, so both outputs are new with it.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): "The edge list is derived by walking down from roots" and "after the walk from the roots, any participant not yet emitted seeds a further walk" (§8, the second as amended by the corrigendum of 2026-09-19) — corrected: the edge list is no longer derived from a walk at all, and the seeding rule the walk follows has changed. Both were found by analysis after the widening landed, and both are changes to shipped output. **The edge list.** A walk cannot represent a graph without repeating the shared part below every point two paths converge on. Four ordinary commands — create two tasks, block a third on both, block a fourth on that — stored three dependencies and returned four rows, one of them a duplicate, beside a summary reading `chains: 1`: the two halves of one document disagreeing, which is what this paragraph exists to prevent. The seeded walks this work added widened it to a second class, a dangling blocker above a real chain returning six rows for four dependencies. The rows now come from the `BlockedBy` relation itself, one per recorded dependency in record order, which covers every participant by construction rather than by seeding and cannot repeat. Row order therefore moves from walk order to record order. **The seeding rule.** A participant a later seed would reach was itself seeded first, because the rule skipped only participants an *earlier* tree had drawn, and `collectParticipants` visits a blocked task before its blockers — so the redundant case was the normal one, not a corner. A dangling blocker above a chain drew that chain twice in pretty and JSON, once top-level and once under the ghost, presenting a blocked task as a top-level entry, which is the one thing a top-level entry rules out and what README.md:321 already promised. A participant is now held back while any of its own blockers is undrawn, with a first-in-order fallback where every remaining participant is blocked by another that is also undrawn — a cycle — and the passes resume after that fallback. Cycle coverage and its counts are unchanged. Known limit, recorded rather than fixed: the fallback picks the first remaining participant whether or not it is in a cycle, so on a cycle carrying dependents a subtree can still be drawn twice.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): "held back while any of its own blockers is still undrawn so that each chain is drawn once and a top-level entry is a participant nothing else drawn reaches" (§8, "The node-shaped renderings still walk", added earlier the same day) — corrected: that invariant was stated unqualified in the body while the exception to it lived only in the corrigendum beneath. The fallback the very next sentence prescribes cannot preserve it — it seeds the first remaining participant whether or not that participant is in a cycle — so on a cycle carrying dependents a subtree is still drawn twice. The document as a whole was already right; a reader implementing from the body paragraph alone was not, and would take the invariant as a guarantee to hold, re-opening a decision already made. The limit now sits in the body beside the invariant it qualifies. Editorial: no code or behaviour follows from it.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): §8's rule that the edge list is the stored relation was landed for the full graph only, leaving the focused form — `tick dep tree <id>` — building its `blocked_by` and `blocks` sections from the walk. One command therefore emitted `from,to` rows under two rules depending on whether an id was named: five stored dependencies came back as five rows from the full graph and six from the focused view, the shared branch below a convergence point repeated, which is the double-count §8 exists to remove. **The focused sections are now the relation too**, scoped to the neighbourhood the walk reaches: one row per stored dependency among the target's transitive blockers and among its transitive dependents, in record order, neither repeating. Transitivity is unchanged — the sections still reach the whole chain, which is what the focused form exists to show. The node trees behind pretty and JSON are untouched in both forms. Two boundaries the change fixes deliberately: a cycle inside the neighbourhood contributes every one of its stored dependencies, including the edge the walk suppresses as a re-entry; and a blocker naming no task contributes no focused row, since the walk never reaches it, which keeps a task's focused blockers equal to what `tick show` lists. Those two pull apart on one input — a dependency whose blocker names no task reaches the full-graph list but never a focused section — so the two forms agree on every edge between real tasks, and the full graph additionally carries the dangling ones. That asymmetry is accepted: the full graph's job is to account for every participant, the focused form's is to answer for one task as the rest of the tool answers for it.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): §3.1 required every listed command's output to decode on every branch and said nothing about a value the encoder cannot carry — an omission, not a wrong claim, and the code filled it the worst way. The encoding helpers answered a refusal by substituting a well-formed falsehood: the top-level field writer returned an empty string and the whole header block was dropped, and the section writer returned a count-zero header over rows that exist. Both were silent, both exited 0, and both produced documents that parse — so §11's conformance drivers passed on them however many branches the inventory covered. Reproduced against a built binary with ordinary commands: one task whose title carried an escape made `tick list` print `tasks[0]:` while `--json` returned every task; that task's detail document carried no `id`, `title` or `status`; a description carrying one vanished from the detail document while JSON kept it. That is the defect class §1 opens this work for, made invisible by the reshape — the pre-change header site at least printed a visibly broken `task:`. §3.1 now fixes the rule: the command fails, naming the field or section and the task where the document covers one, and writes nothing to stdout. Derived rather than chosen: TOON cannot carry the codepoint at all, so no encoding preserves the value, leaving a diagnostic or an announced substitution — and an announced substitution breaks §2.2's byte-identity silently, the trade §2.2 already declines when it refuses to write the exception down. Rejecting the input at the write path was considered and left out: it is additive behaviour this work does not carry, and it would not cover values already stored or arriving through `tick migrate`, which still have to read back honestly.

> **Corrigendum 2026-09-20** (from `implementation/free-text-round-trip`): "naming the field or section it could not encode, and the task where the document covers one" (§3.1's refusal paragraph, added earlier the same day) — corrected: that clause was written to describe the code as it had just been built rather than the bar the section sets, and it scoped task-naming to single-task documents. It left `tick list`, `tick ready` and `tick blocked` failing with `cannot encode section tasks as TOON: …` and nothing else — the agent told a project-wide command failed and given no row to act on, its routes being bisection or reading the store file directly. That is §1's failure reached from the other side, and the same work had already established the rule against it: the field-level path hunts its culprit by re-encoding each field alone, precisely because the library's error names none. §3.1 now requires the diagnostic to name the task carrying the refused value in a list as well, with the section name alone standing only where no single row can be attributed. The hunt runs on the error path only, so a healthy command pays nothing for it.
