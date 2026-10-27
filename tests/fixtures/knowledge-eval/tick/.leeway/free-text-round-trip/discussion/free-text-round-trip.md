# Discussion: Free Text Round Trip

## Context

Free-text fields on a task — the description and the notes — must survive an agent's read-edit-write cycle through the toon output format without a transformation step in either direction. An agent runs `tick show <id>`, takes the description text, edits it, and writes it back with `tick update --description`. Today that cycle does not close cleanly, and the failure that triggered this work was an agent abandoning the CLI altogether and reading `.tick/tasks.jsonl` directly to get a task's description as a plain string.

The existing escape hatch, `tick show --json`, works but is the wrong shape: it costs extra tokens and forces the agent to parse JSON syntax back off the string it wanted. The irony named during discovery — the token-efficient format exists for agents, and it is the format agents cannot use.

### Inherited position (from discovery)

Carried forward as working ground, not re-opened:

- **Scope is free text generally**, not descriptions alone. Notes were named as carrying the same problem, reaching output through the same formatter.
- **The primary fix is repairing the toon format** for round-trip fidelity, not adding a parallel raw output format.
- **Field extraction is a companion of interest** — `tick show <id> --field description` printing the bare string and nothing else: no header, no indentation, no JSON quoting.
- **A fourth output format was rejected.** `--raw` was pressed on and dropped: a format has to answer for every command in the CLI (`tick list --raw`, `tick stats --raw`) and carries an ongoing consistency burden across all of them. Field extraction was the alternative framing that avoids designing a format at all.
- **Work type is feature**, not bugfix — the indentation is deliberate design that defeats its own purpose, not a regression.

### Open tension carried in from discovery

TOON is an indentation-scoped format. Removing the indent from a free-text block requires some other means of marking where the block ends, and a description line resembling a section header is precisely the case a naive delimiter fails on. This is what made the work a discussion rather than a direct route to specification.

### Current state, measured

The description section prefixes every line of the description with two spaces and emits no terminator:

`sed -n '345,355p' internal/cli/toon_formatter.go` → `buildDescriptionSection` writes `description:` then `"\n  "` before each line produced by `strings.SplitSeq(desc, "\n")`.

The notes section takes a different path. Notes are encoded as a TOON tabular section through the `toon-go` library, and the library quotes and escapes any string containing a newline:

`grep -n "case '\\\\n':" "$(go list -m -f '{{.Dir}}' github.com/toon-format/toon-go)/internal/format/format.go"` → `QuoteString` maps `\n` to the two-character escape `\n`; `NeedsQuoting` returns true for any string containing `\n`, `\r` or `\t`.

Observed output for a task carrying a multi-line description and multi-line notes (rendered through `ToonFormatter.FormatTaskDetail`):

```
notes[3]{text,created}:
  single line note,"2026-09-16T12:00:00Z"
  "multi\nline\nnote","2026-09-16T12:00:00Z"
  "note, with comma and \"quotes\"","2026-09-16T12:00:00Z"

description:
  Line one
  
  Line two with trailing space   
    indented line
  notes[2]{text,created}:
  tabs	here
```

Three things follow from that output, and they change the shape of the problem discovery described:

1. **Notes already round-trip losslessly.** A multi-line note is emitted as one quoted, backslash-escaped TOON string. The data survives; what the agent must do is unquote and unescape — a transformation, but a standard one with an unambiguous result.
2. **The description transform is reversible but undeclared.** Stripping exactly two spaces from every line recovers the original, including blank lines (which render as a line of two spaces), preserved trailing whitespace, and originally-indented lines (which render at four). Nothing in the output says so, and no count or terminator marks where the block ends — it works today only because description is emitted last and runs to EOF.
3. **The "indistinguishable header" case is narrower than stated in discovery.** A description line reading `notes[2]{text,created}:` lands at column 2; a real section header sits at column 0. A parser that respects indentation can tell them apart. A parser that scans for the pattern anywhere on the line cannot.

So the defect is not data loss in the toon output. It is that reading free text out of it requires a per-field transformation the format does not announce, and that the two free-text fields use two different and mutually incompatible schemes.

The write side has its own fidelity question, independent of format: `tick update --description` runs the value through `TrimDescription`, which is `strings.TrimSpace` (`internal/task/task.go:193`), so leading and trailing whitespace does not survive a write even when the read was exact.

`show` currently accepts no command-specific flags at all — `grep -n '"show":' internal/cli/flags.go` → `"show":        {},` — so `--field` would be the first, alongside the global `--quiet` which already prints a bare task ID and nothing else.

### References

- Discovery session log: `.workflows/free-text-round-trip/discovery/sessions/session-001.md`
- Manifest `description` (the work unit's carrier)
- `internal/cli/toon_formatter.go` — `buildDescriptionSection`, `buildNotesSection`, `FormatTaskDetail`
- `internal/cli/show.go` — `RunShow`, `queryShowData`
- `internal/cli/update.go` — `--description` / `--clear-description` parsing and validation
- `internal/cli/note.go` — `RunNoteAdd`, note text assembly from argv
- `internal/task/notes.go`, `internal/task/task.go` — `TrimNoteText`, `TrimDescription`, length validation
- `internal/cli/flags.go` — `commandFlags` registry and `globalFlagSet`

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture.*

---

## Round Trip Contract

### Context

"Free text survives the round trip" needs a definition before any of the encoding subtopics can be judged against it. Two things had to be pinned: which reading paths the guarantee covers, and what fidelity it promises.

### Journey

The session opened by measuring the current output rather than taking discovery's account of it. Three findings reshaped the problem:

1. **Notes are not lossy.** A note containing newlines is emitted as a single TOON-quoted string with the newlines escaped (`"multi\nline\nnote"`). Nothing is lost; the reader unquotes a standard TOON string and the result is unambiguous. Discovery recorded notes as carrying the same problem as descriptions — they carry a different one.
2. **The description block is not lossy either.** Two spaces are prefixed to every line; blank lines emerge as two spaces, originally-indented lines at four. Stripping exactly two from each line returns the original bytes. The transform is reversible.
3. **What is missing is the declaration.** Nothing in the output says the description block is indented, and nothing marks where it ends — it works today only because the description is emitted last and runs to EOF.

So the defect is not data loss. It is that the two free-text fields use two different, mutually incompatible decoding rules and neither announces itself. That is why the agent in the triggering incident read `.tick/tasks.jsonl` directly: the file told it the truth without a rule it had to already know.

That led to the framing question — is the round trip the single-field fetch (`tick show <id> --field description`), or the whole-task read that an agent edits in place? The lean offered was the second, with the first as a fast path, on the grounds that an agent deciding *whether* to edit usually needs the surrounding context and a second call is the same token tax in a different currency.

### Decision

#### 2026-09-17 — revised
*Trigger: `grep -rn 'TrimDescription' internal/ --include='*.go' | grep -v '_test'` → only `internal/cli/create.go:214`, `internal/cli/update.go:193`, `internal/cli/update.go:342`; `internal/migrate/store_creator.go:81` stores `Description: mt.Description` raw. The derivation below names two write paths and there are three.*

**Free text is trimmed on import, so the invariant the bar rests on holds for every stored task.** `tick migrate` runs descriptions and titles through the same trim `create` applies, rather than storing the source tool's value as it arrives. Titles carry the same hole — `internal/migrate/migrate.go:44` validates that a trimmed title is non-empty, then `internal/migrate/store_creator.go:78` stores the untrimmed one.

Without it the bar fails on imported tasks and only on those: a description arriving from beads with a leading newline or trailing spaces reads out of `tick show` intact, and the write-back trims it — the stored value silently differs from what was sent, on precisely the tasks nobody typed by hand.

Two alternatives were weighed and declined. Dropping the trim from `create` and `update` would make byte-identity hold with no invariant at all, but changes behaviour for every user to serve a case only importers hit, and reopens whitespace-only descriptions, which `ValidateDescriptionUpdate` currently routes to `--clear-description`. Writing the exception down — the bar covering CLI-authored descriptions only — costs no code and hands the reader exactly the kind of unpredictable exception this work exists to delete.

The deciding factor: import is already a translation boundary, mapping statuses, priorities and timestamps on the way in, so normalising whitespace there is the same kind of move and costs a reader nothing they would notice.

#### 2026-09-17 — revised
*Trigger: review finding — the byte-identity derivation below was drawn from the description write paths only, and note text and task titles do not meet the bar as things stand.*

The bar itself is unchanged, and the reasoning about trimming below still holds. What was incomplete is the claim that it costs nothing to reach: it holds for descriptions, and for note text and task titles it does not, because text beginning with a dash is rejected before it reaches storage. Reaching the bar therefore requires the free-text argument fix recorded under Write Side Input, which this work now carries.

#### Initial

**Both reading paths are in scope, and both must work.** The user ruled both valid: an agent must be able to fetch one field bare, and must equally be able to run one `tick show` and lift usable free text out of the full output. Neither is the designated path with the other as a fallback — the field flag does not excuse an ambiguous block in full output, and the block being fixed does not remove the need for bare single-field output.

This constrains the encoding subtopics directly: whatever the description block becomes, it must hand over text the reader can lift without a rule learned elsewhere, *and* a bare-field path must exist alongside it.

**The fidelity bar is byte-identity, and the existing whitespace trimming does not stand in its way.**

**Settled by derivation** — not discussed. Determined by the write paths' own behaviour: `create` and `update` both run the value through `TrimSpace` before storing (`internal/cli/create.go:214`, `internal/cli/update.go:342`), so no stored description can carry leading or trailing whitespace. A read that returns the stored bytes exactly, written back through `tick update --description`, therefore lands the identical stored value — the trim is idempotent over anything that came out of storage.

The bar is: read the value out of `tick show`, write it back unchanged, and the stored value is byte-for-byte what it was. Nothing about the trimming behaviour has to change for that to hold, so the trim is out of scope as a defect.

---

## Toon Conformance Scope

### Context

The work arrived scoped to free text. Measuring the output showed that fixing free text alone changes nothing an agent can use: a standard TOON reader fails on the first line of `tick show` and never reaches the description. The malformed parts are the task header, the tags list, the refs list and the description; the blockers, children and notes lists are correct.

### Journey

The fork put to the user was whether to fix free text now and log the rest as a separate concern, or fix the format outright in this work. The argument for splitting: "the agent-facing format doesn't parse" is a broader claim than "descriptions are awkward to lift", and it spans sections that are not free text at all. The argument against: fixing a quarter of a broken format leaves the output exactly as unusable as before, so the free-text work would deliver nothing on its own.

### Decision

**Fix the whole format in this work.** The user ruled it one bug with several symptoms. Free-text encoding is no longer the deliverable in itself — it is one of the malformed sections, and the deliverable is output a standard TOON reader can read.

This brings three areas in that were previously out of scope: the single-object section headers (`tick show`'s task header, `tick stats`), the plain string-list sections (tags and refs), and whatever verification keeps the output conformant afterwards.

### Decision — which outputs this covers

#### 2026-09-17 — revised
*Trigger: review finding — `doctor` and `migrate` emit agent-facing output but appear in neither column of an inventory presented as complete.*

**`tick doctor` and `tick migrate` are out of scope, explicitly.** Both bypass the formatter entirely and print straight to the terminal — `handleDoctor` documents this in its own comment (`internal/cli/doctor.go:44-46`), and `RunMigrate` presents through `migrate.Present` rather than a `Formatter` (`internal/cli/migrate.go:127`). Neither honours the format flags.

The line this draws: the defect being fixed is output that *claims* to be machine-readable and is not — a header no reader accepts, a list missing its item markers. These two never claimed it. Bringing them in means building new formatter surface rather than repairing broken output, which is different work.

Cost accepted: an agent running the health check reads a paragraph and works out what to do from the words. The user ruled `migrate` out without hesitation as a command run by hand, and `doctor` out on the same footing.

#### 2026-09-16 — revised
*Trigger: review finding — `tick dep tree` answers in prose on its empty branches, inside a command the inventory below lists as output that must parse.*

**Settled by derivation** — not discussed. Determined by this block's own inventory, which places `dep tree` under output that must parse, together with the formatter's existing treatment of empty results (review-001 F2).

**A command in the must-parse table emits its structured form on every branch, the empty one included.** `tick dep tree` currently answers `No dependencies found.` when nothing in the project is blocked, and a title line plus `No dependencies.` when a named task has no dependencies either way — prose on the one branch an agent could not predict, from the formatter whose purpose is machine-readable output. Both go.

This is not an exception to the prose rule below, it is the rule's boundary. The prose exemption covers confirmations of a command the caller issued: the caller already knows what it asked for and the exit code says whether it worked. "No dependencies" is not a confirmation — it is the answer to a query, and it is the answer the caller ran the command to find out.

The formatter already has the shape: an empty task list comes back as a structured empty section, and so does an empty edge set. The two prose branches are the exception, not the pattern.

#### Initial

Not every command returns data. Dependency changes and removals answer in prose shared with the human-readable formatter (`internal/cli/format.go:211-241`) — `Dependency added: X blocked by Y`, `Removed tick-abc "Title"`. There is nothing to parse there: the agent knows what it asked for and the exit code says whether it worked.

Status changes are the opposite case. `tick done <id>` reports the change plus a line per task that changed as a knock-on effect, and an agent acts on that — it needs to know what else just closed.

**Structured output that must parse:**

| Output | Commands |
|---|---|
| Task detail | `show`, `create`, `update`, `note add`, `note remove` — the four mutating commands via `outputMutationResult` (`internal/cli/helpers.go:16-30`), `show` rendering the same detail inline (`internal/cli/show.go:52-64`) |
| Task list | `list`, `ready`, `blocked` |
| Stats | `stats` |
| Dependency graph | `dep tree` |
| Transition / cascade | `start`, `done`, `cancel`, `reopen` |

**Prose, unchanged:** `dep add`, `dep remove`, `remove`, `init`, and the general-purpose messages.

Trade-off accepted: wrapping a one-line confirmation in a data format costs tokens to restate what the caller already knows, and introduces a new way to fail. Left as prose deliberately.

### Decision — which formatters move

*Raised by the final review (review-002 F3): three decisions here are expressed as toon shapes but land in code the pretty and JSON formatters share, and the document never said whether those formatters move with them.*

**Pretty is unchanged. Everywhere.** What a terminal prints today is what it prints after this work — the single transition line, the box-drawing cascade tree, the indented description block. It is the human surface; this work is about the agent surface, and nothing in pretty is broken by the standard being applied: it never claimed to be machine-readable, and a human reads it fine.

Two candidate changes were put up and both declined:

- **Replicating the table shape in pretty.** Rendered in pretty's aligned-column house style for comparison, it loses what the tree does better — the current cascade nests by which task caused which, so a grandchild closing because its parent closed shows as three levels of indentation. Flattened into rows, every knock-on looks equally directly caused. The toon table drops that too, but an agent holds the parent/child links and can reconstruct the chain; a human reading a terminal cannot, which is why the tree exists.
- **Adding the task's title to the single transition line**, so a human learns what they closed as the agent now does (`tick-a1b2 "Add retry to the sync worker": in_progress → done`). A genuine improvement rather than a defect fix, and declined as out of scope.

The user's ruling was to leave it the same.

**JSON moves with toon.** It is a machine format, and a consumer parsing JSON deserves the same structured answer as one parsing toon — including the dep-tree empty case, where JSON currently hands back a `message` key carrying the English sentence. JSON's transition output today already carries the same split this work removed from toon (a singular `transition` object beside a `cascaded` list); it becomes the one `changed` list with the same `auto` flag, in JSON syntax.

Two places make this more than a statement of intent, because the code is shared:

- The single transition line comes from `baseFormatter.FormatTransition` (`internal/cli/format.go:211`), inherited by both the toon and pretty formatters, so they emit byte-identical text today. Restructuring the toon form requires splitting that method rather than editing it — otherwise pretty changes by accident.
- The dep-tree empty messages are not produced by a formatter at all. They are set on the result in the shared graph builder (`internal/cli/dep_tree_graph.go:177`, `:255`) and consumed by all three, so removing them at source would strip pretty's message too. Pretty keeps its sentence; only the machine formats take the structured empty form.

### A structural consequence found while inventorying

`create` and `update` do not emit one document. They print the full task detail and then, when a parent's status cascaded, append transition lines after it (`internal/cli/create.go:277-283`, `internal/cli/update.go:409-420`). A reader handed that whole stream sees a task-detail document with foreign lines stuck on the end. Making each section valid is not enough on its own — the stream has to be one document, or two clearly separated ones. This belongs to the conformance subtopics rather than to free text.

---

## Single Object Sections

### Context

Three places in the output describe one thing rather than a list of things: the task's own fields at the head of `tick show` (and of `create`, `update`, `note add`, `note remove`), the counts summary in `tick stats`, and the chains/longest/blocked summary in `tick dep tree`. All three go through the same helper and all three are malformed — this is the line a reader fails on before it sees anything else.

The cause is a hand-edit. `encodeToonSingleObject` marshals the value as a one-element array and then deletes the `[1]` from the header with a string replace to make it read as singular (`internal/cli/toon_formatter.go:294`, `:371-379`). The result is a table header with no table beneath it, a shape TOON has no equivalent for.

### Options Considered

Both were encoded and decoded back with the project's TOON library; both parse and return the original values.

**One-row table** — the library's own output, `[1]` left intact:

```
task[1]{id,title,status,priority,type,created,updated}:
  tick-abc123,Add retry to the sync worker,in_progress,2,feature,"2026-09-16T12:00:00Z","2026-09-16T12:00:00Z"
```

- Pros: three characters longer than the current broken output; minimal change.
- Cons: values are positional — a reader counts commas across to the matching name in the header.

**Named fields** — TOON's object scope:

```
task:
  id: tick-abc123
  title: Add retry to the sync worker
  status: in_progress
  priority: 2
  type: feature
  created: "2026-09-16T12:00:00Z"
  updated: "2026-09-16T12:00:00Z"
```

- Pros: every value sits beside its name; adding or reordering a field cannot break a positional read; a value containing a comma is safe without relying on quoting discipline.
- Cons: fifteen characters longer than the current output (163 → 181 for the example above; the one-row table is 166).

### Journey

The question raised against named fields was whether it is actually TOON or a new invention. It is not new: the form is what the project's own TOON encoder emits when given a nested object, and the decoder returns the original values from it.

The distinction that settled it — TOON is a compact way of writing JSON, and the two options are simply two different JSON shapes:

- An object inside an object (`{"task": {"id": …}}`) is written as the key with its fields indented beneath. That is the named-fields form.
- A list of same-shaped objects (`{"tasks": [{…}, {…}]}`) is written as a header plus rows. That is the table form, and it is what `tick list` should use.

Both are standard. What tick invented was neither — a table header with a single unnumbered row under it.

### Decision

#### 2026-09-17 — revised
*Trigger: user question while settling field selection — "what do we have the `task:` bit for anyway? seems unnecessary."*

**Named fields, with no wrapping key.** The task's own fields sit at the top level of the document, beside the collection sections rather than nested inside a `task:` scope:

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

Measured: 256 characters flat against 276 wrapped for the same content, both parsing and round-tripping.

Three reasons, the size being the least of them:

1. **It removes an inconsistency the wrapper created.** `description` is a task field and sits at the top level. `title` is a task field and sat nested. Same kind of thing at two different depths, for no reason beyond one of them being long.
2. **It mirrors storage.** The JSONL file already holds each task as a flat object — `{"id":…,"title":…,"status":…,"description":…}` — so the output stops inventing a grouping that exists nowhere else in the system.
3. **The field flag falls out of it.** `--field title,status` returns two lines with nothing wrapped around them, rather than a trimmed block.

The same applies to the other two single-object sites: `tick stats`' counts and the dep-tree summary become top-level fields beside their tables.

What is given up: a consumer can no longer grab "the task's own fields" as one object without naming them. Nothing identified wants that.

#### Initial

**Named fields, for all three single-object sections.**

The table layout earns its keep when many rows would otherwise repeat the field names — that is `tick list`'s case, not this one. With a single row it repeats nothing, so it compresses nothing, and it trades that for a positional read that can go wrong. Fifteen characters is not a real cost against a value sitting next to its own name.

The user's deciding factor was clarity on reading the output.

---

## Status Change Output

### Context

*Raised by the background review (review-001 F3): status changes sit in the must-parse inventory but no subtopic owned them, and their current shape was never measured.*

When an agent closes a task and other tasks move with it, what comes back is an arrow diagram:

```
tick-a1b2: in_progress → done
tick-9f3c: open → done (auto)
tick-77ab: in_progress → done (auto)
```

Reading it requires knowing that the ID precedes the colon, that the arrow separates old state from new, and that `(auto)` marks a knock-on rather than the requested change. It is a bespoke line format, and it is byte-identical in `--toon` and `--pretty` — both formatters share `baseFormatter.FormatTransition` (`internal/cli/format.go:211`), and `ToonFormatter.FormatCascadeTransition` (`internal/cli/toon_formatter.go:145`) is the same construction with ` (auto)` appended.

Two separate problems sit here. The first is the shape itself. The second is that `create` and `update` print the task's full record and then append these lines after it (`internal/cli/create.go:277-283`, `internal/cli/update.go:409-420`) — a complete document with foreign lines trailing it.

### Why a structural change produces a status cascade

Worth recording, because it was not obvious from the code. `create` and `update` emit cascades not because the edited task's status moved, but because *other* tasks' statuses moved as a consequence of the parent/child structure changing:

- **Adding work under a finished parent.** `tick create --parent <done task>` reopens that parent — it is no longer complete — and that reopen travels further up if its own parent was done (Rule 6, then Rule 5).
- **Moving a task to a different parent.** `tick update <id> --parent <other>` can fire two unrelated changes at once: the new parent reopens if it was finished, and the old parent may auto-complete if the moved task was the last unfinished thing under it (Rule 6 and Rule 3 together). This is why `update` carries two independent cascade blocks rather than one.

These tasks are elsewhere in the tree and are not in the edited task's record, which is why they cannot simply be folded into it.

### Decision

#### 2026-09-17 — revised
*Trigger: review finding — this section decided a singular `changed:` block heading a `cascaded[]` table, then two paragraphs later said the two-root re-parenting case likely wants one table with a column marking the requested change. Two incompatible documents for a reachable case.*

**Settled by derivation** — not discussed. Determined by this work's own governing principle — output a reader can read without a rule learned elsewhere — applied to its own shape (review-002 F2).

**One table, always.** Every task whose status moved gets a row, and a column says whether that row is the change the caller asked for:

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

Two reasons carried it. The first is that a reader must not have to branch on which document arrived before it can read either — an agent parsing status output sees one table whatever command produced it, and the count is always right.

The second is that the marking column is not new vocabulary. Every task's transition history already records each change with an `auto` flag — false when a user or agent asked for it, true when the system produced it as a consequence — stored per task in the JSONL and in the `task_transitions` table. Inventing a "requested" column instead would be exactly the move that produced the malformed output this work is removing: a shape someone wanted, built by hand, outside the vocabulary that already existed.

The table carries the title so no second lookup is needed to know what moved. The trailing `(auto)` marker of the old arrow lines disappears into the column that always meant it.

The split between commands, and the one-document rule below, are unchanged by this revision.

#### Initial

**Status changes become structured sections, and the existing split between commands is kept.**

Measured shape for a status change (encoded and decoded back against the pinned TOON build; parses and returns the original values):

```
changed:
  id: tick-a1b2
  from: in_progress
  to: done

cascaded[2]{id,title,from,to}:
  tick-9f3c,Parse the header,open,done
  tick-77ab,Validate fields,in_progress,done
```

The knock-ons take a table because there can be many, and the table carries the title so no second lookup is needed to know what closed. The `(auto)` marker disappears — membership of the cascaded section is what it meant.

**The split stands:** `done`, `start`, `cancel` and `reopen` return only what changed; `create` and `update` return the task's full record with the change sections appended to the same document. The deciding factor: `create` and `update` are edits and the caller wants the result of the edit — the new ID, the merged fields — whereas a status change is something the caller already knows it did, so a full record is tokens it did not ask for.

Where a command produces both, it is **one document** with the changes as sections inside it, never a document with loose lines after it.

**A third option was put up and declined: leave status output alone entirely.** When the user pushed back that `tick-a1b2: in_progress → done` is perfectly good output and asked why it was being changed at all, the honest concession was that the single-transition case is change for consistency rather than repair. The alternative offered was to treat `tick done` as a confirmation like `tick dep add` — prose, out of the must-parse list — with an agent running `tick show` afterwards if it needed to know what cascaded. The user declined it once the cascade case was rendered side by side: the multi-task output carries titles the agent would otherwise have to look up, and one command's output parsing while another's does not, depending on whether a cascade fired, is the branching rule this work exists to delete.

Sibling check: `auto-cascade-parent-status` specification — its CLI Display section fixes the toon cascade rendering as "flat lines with `(auto)` and `(unchanged)` markers for machine parsing" (`.workflows/auto-cascade-parent-status/specification/auto-cascade-parent-status/specification.md:146`). This decision supersedes that rendering. The correction owed to it is part of the documentation thread still open below, not settled here.

### Out of scope — unchanged terminal children

*(Amended 2026-09-17 — this section previously carried "whether the restructured output reinstates unchanged terminal children" as an open question for the specification phase. It was raised again by the final review, put to the user, and ruled out of scope: it is a pre-existing unimplemented requirement in another work unit's specification with no bearing on this work.)*

The new table lists what changed, exactly as today's output does. The `auto-cascade-parent-status` specification's requirement that unchanged terminal children be shown is not reinstated and not decided here.

---

## String List Sections

### Context

Tags and refs are lists of plain strings, emitted today as a header followed by one raw item per indented line:

```
tags[2]:
  has space
  plain
```

A TOON reader rejects this — an item written on its own line carries a leading `- ` marker, and without it the decoder reports a length mismatch. The items are also written raw, so a ref containing a comma comes back as two values rather than one, and a URL's colon goes unquoted where the format's own rules would quote it (`buildStringListSection`, `internal/cli/toon_formatter.go:320-328`).

### The pattern underneath

Checked across the whole of `tick show`, `tick stats` and `tick dep tree`: **every section tick assembles by hand is malformed, and every section it hands to the TOON library is correct.**

| Written by | Sections | Parses |
|---|---|---|
| The library (`encodeToonSection`) | blockers, children, notes, priority breakdown, dep-tree edges | yes |
| Hand-assembled string building | task header, stats summary, dep-tree summary, tags, refs, description | no |

The hand-written sections exist because each one wanted a shape the library does not produce directly — a singular object header, a list down the page, an unstructured text block. In every case the hand-rolled shape turned out to be invalid.

### Options Considered

**Inline** — the library's own output for a list of strings:

```
tags[2]: has space,plain
```

- Pros: produced directly by the encoder, so the hand-written list builder is deleted rather than corrected; quoting is handled by the library's rules, so a comma-bearing ref is safe by construction.
- Cons: a long refs list becomes a long line.

**Down the page with markers** — the same items, one per line, each marked `- `:

```
tags[2]:
  - has space
  - plain
```

- Pros: readable when items are long, as full URLs are.
- Cons: still hand-written, so the class of bug survives; the encoder does not emit this form and it would have to be constructed by hand.

### Decision

**Inline, for both tags and refs.**

The deciding factor is that it removes the hand-written builder entirely rather than fixing its output. Line length is the cost, and it is not a real one: the reader of toon output is an agent, and a human reading tags is reading the pretty output, which renders them separately.

---

## Description Block Encoding

### Context

The description is the field that triggered this work. Today it is emitted as `description:` followed by every line of the text prefixed with two spaces, with no count and no terminator (`internal/cli/toon_formatter.go:346-355`). The round-trip contract requires that an agent reading full `tick show` output can lift the description without a rule learned elsewhere.

### Journey — measurement first

Three candidate encodings were measured against the TOON library the project already depends on, each encoded and then decoded back, checking byte-identity against the source text. Source text used throughout:

```
Fix the parser.

Steps:
  - read the header
  - validate
```

**Candidate A — one quoted string.** `toon.MarshalString` of the description as a plain field value produces:

```
description: "Fix the parser.\n\nSteps:\n  - read the header\n  - validate"
```

Decoded back and compared: identical. One TOON unquote recovers the text, and it is the same rule note text already obeys.

**Candidate B — dash-list of lines.** TOON's expanded list form marks each item with `- ` (seen in the library's own array fixtures, e.g. `  - [2]: nested,list`). Encoding each line as an item:

```
description[5]:
  - "Fix the parser."
  - ""
  - "Steps:"
  - "  - read the header"
  - "  - validate"
```

Decoded back and rejoined with newlines: identical. The declared count says where the block ends, and the line structure of the text stays visible. Lines carrying leading whitespace, a colon, or anything else TOON quotes come out quoted; plain prose lines do not, so the block reads as a mix.

Note that toon-go's *encoder* does not produce this form — given a `[]string` it emits the inline form `description[5]: Fix the parser.,"","Steps:",…`, which round-trips identically but is a single line with no readability advantage over A. The dash-list form would have to be written by hand, as the tags and refs sections already are.

**Candidate C — keep the indented raw block, add a terminator or line count.** Not measured as conformant because it cannot be: it is a block form TOON has no concept of, so a standard reader fails on it however it is delimited.

### The finding that reframed the subtopic

Testing whether the candidates would let an agent parse the output turned up that the output cannot be parsed today at all. Feeding `ToonFormatter.FormatTaskDetail` output to `toon.Unmarshal` fails at line 1:

> `line 1: invalid unquoted key "task{id,title,status,priority,type,created,updated}"`

Section by section, decoded individually with `toon.Unmarshal`:

| Section | Parses | Why not |
|---|---|---|
| `task{…}:` | no | single-object scope is tick's own invention — `buildTaskSection` marshals a 1-element array and strips the `[1]` (`internal/cli/toon_formatter.go:294`) |
| `blocked_by[N]{…}:` | yes | — |
| `children[N]{…}:` | yes | — |
| `notes[N]{text,created}:` | yes | — |
| `tags[N]:` / `refs[N]:` | no | expanded list items are missing the `- ` marker (`buildStringListSection`, `internal/cli/toon_formatter.go:320-328`); decoder reports `list length mismatch` |
| `description:` | no | `missing colon after key` on the first indented line |
| `stats{…}:` | not measured | same `[1]`-stripping hack via `encodeToonSingleObject` |

Measured against `github.com/toon-format/toon-go@v0.0.0-20251202084852`. Whether the TOON specification itself permits a single-object scope header was not verified — the claim here is only that the reference Go implementation rejects it, and that the form is hand-constructed by tick rather than produced by the library.

The tags and refs sections also emit raw item text: a ref containing a comma renders as `ref, with comma` and a URL renders with its colon unquoted, both of which TOON's quoting rules would require to be quoted.

This changes what the subtopic is choosing between. Making the description "valid TOON" does not let an agent run a TOON parser over `tick show` output, because the document is already invalid before the description is reached.

### Measured against a real description

*(This section replaced an earlier "Open question" on 2026-09-16 — it asked whether the goal was a stated rule for lifting free text or a parseable document, a fork the Toon Conformance Scope decision settled in favour of fixing the whole format. Candidate C fell with it: it cannot be conformant.)*

Deciding between A and B was done on an actual task description from a live project rather than the toy sample above — 13 lines, 1090 characters, the shape tick descriptions really take: bold headings ending in colons, bullet lists, markdown checkboxes, fenced identifiers.

| | Characters | Output lines | Lines needing quotes |
|---|---|---|---|
| A — one quoted value | 1117 | 1 | n/a |
| B — dash-list of lines | 1185 | 14 | 13 of 13 (100%) |

B's premise is that it preserves the visible shape of the text. On real content it does not: every line needs quoting — for a colon in a heading, a leading dash on a bullet, leading spaces on an indented line — so the structure it was meant to show is buried under quote marks, and the result is larger than A as well.

A's overhead on the same text is 27 characters, about 2.5%, all of it newline escapes. On a 4500-character description it is roughly a hundred characters and one very long line.

### Decision

**The description is emitted as one TOON-quoted value.**

```
description: "Retry the sync worker on transient failures.\n\nCurrent behaviour: a single 500 …"
```

Three reasons, in the order they carried:

1. **It is produced by the library, not hand-assembled.** `toon.MarshalString` emits this form directly from a string. Candidate B is not a form the encoder produces — it would have to be built by hand, line by line, with our own quoting rules. That is precisely the mechanism behind every malformed section this work is removing. Choosing B would mean finishing the work having reintroduced its cause.
2. **B's advantage evaporates on real content**, as measured above.
3. **It is the same rule note text already obeys.** One decoding rule for all free text in the output, which is what the reader needed and never had.

Trade-off accepted: a long description is one long line, and unpleasant to read in a terminal. The user weighed this against a real 4500-character description and took it — a human reading a description reads the pretty output, which this work does not touch.

The user's deciding input: an outright rejection of the list form, and confirmation that descriptions in practice run to thousands of characters.

---

## Field Extraction Flag

### Context

The companion to the format repair: a way to ask for one field's value and get it with nothing around it — no header, no indentation, no quoting. This is the case that started the work, where an agent needed a task's description as a plain string and went to the raw data file instead.

*The background review (review-001 F5) raised that the flag's behaviour over anything that isn't a single string was undefined, while the notes decision had already promised it would reach note text.*

### Journey

The opening position was that the flag should always yield exactly one string and never a joined list — a flag that sometimes returns something needing to be split apart has handed back the problem it exists to remove. Two ways to honour that were put up: reach a single note by position, or put list fields out of the flag's reach entirely.

The user took neither, and reframed the flag instead. Asking for the notes table is a legitimate thing to want — editing and writing back is not the only use for reading a field, and sometimes you just want to see the notes. From there the flag stopped being a single-value extractor and became a projection: a comma-separated list of fields, returning the normal document with only those sections in it.

### Decision

**`--field` takes a comma-separated list, and `--fields` is an alias of it.** Both spellings work; the plural exists so the flag reads naturally when selecting several. The same flag serves both jobs, split by how many fields were asked for:

**One field — the bare value.** `tick show tick-a1b2 --field description`:

```
Fix the parser.

Steps:
  - read the header
  - validate
```

**Several fields — the normal document, filtered.** `tick show tick-a1b2 --field description,notes`:

```
notes[2]{index,text,created}:
  1,Retried twice before it stuck,"2026-09-14T10:02:00Z"
  2,"multi\nline\nnote","2026-09-16T08:30:00Z"

description: "Fix the parser.\n\nSteps:\n  - read the header\n  - validate"
```

Identical to a full `tick show` minus the sections not asked for. **Sections keep their usual output order**, not the order they were typed, so the shape does not shift with how the flag was written.

**List fields can be reached by position.** `notes.2` selects the second note. In a multi-field selection the section renders as normal, its count following the selection while each row carries its real position — `tick show tick-a1b2 --field description,notes.2`:

```
notes[1]{index,text,created}:
  2,"multi\nline\nnote","2026-09-16T08:30:00Z"

description: "Fix the parser.\n\nSteps:\n  - read the header\n  - validate"
```

*(Amended 2026-09-17 — this paragraph first said the filtered section renders "so a reader need not know it was filtered", with no position on the rows. The final review showed that property to be a trap, since position is how a note is deleted; see the index column below.)*

Asked for alone, `--field notes.2` prints that note's text bare, by the one-field rule.

### The notes section carries its positions

*Raised by the final review (review-002 F5): a filtered notes section renumbers, and the number is how notes are addressed.*

An agent asks for the third note, sees `notes[1]{text,created}:` with one row, decides the note is wrong, and runs `tick note remove tick-a1b2 1`. It deletes the first note on the task. Nothing in the output said the row it read was note 3.

The renumbering was deliberate — the decision above rendered a filtered section as normal so a reader need not know it was filtered — and that property is exactly what makes the trap. Position is the only handle a note has: there is no note ID, `note remove` takes a 1-based index (`internal/cli/note.go:89-130`), and Notes Free Text Handling keeps notes as an append-and-retract log, so nothing else identifies one.

**The notes section carries an `index` column, present whether the section is filtered or not:**

```
notes[1]{index,text,created}:
  3,"multi\nline\nnote","2026-09-16T08:30:00Z"
```

One shape either way, so there is no rule about when the column appears. It also retires a smaller oddity nobody had raised: in full output today an agent must count rows to work out what to pass to `note remove`.

The alternative considered and rejected was to refuse filtering on notes altogether — `notes.3` would return the whole table, leaving position implicit in row order. That keeps the output minimal at the cost of the selector the caller asked for.

**The split between the two kinds of answer is deliberate and was locked in knowingly.** `--field description` and `--field description,notes` return different kinds of thing — a raw value versus a document — so an agent building the flag from a variable must know which it will get. The sharp edge was put to the user explicitly and accepted: it is the honest split between *fetch me this value* and *give me a trimmed record*, and collapsing them would cost the bare-value case that the work exists to serve.

*(Amended 2026-09-17 — this parenthetical previously called the description shape a leaning candidate not yet settled; Description Block Encoding has since decided it.)* The description section in the examples above is shown in the one-TOON-quoted-value shape that Description Block Encoding settled on.

### Selecting the task's own fields

*Raised by the final review (review-002 F4): every worked example above selects something that is a section, but Single Object Sections moved the task's own scalar fields inside a `task:` named-field object, so a multi-field selection naming them had no defined answer.*

**The task's own fields are selectable individually, exactly like sections.** `tick show tick-a1b2 --field title,status`:

```
title: Add retry to the sync worker
status: in_progress
```

Refusing — on the grounds that only whole sections are selectable — would make the grammar depend on which side of a boundary a name happens to sit, which is a rule to learn rather than read.

*(Amended 2026-09-17 — this section first showed the selection as a trimmed `task:` block. The question it prompted retired the wrapper entirely; see the revision under Single Object Sections. The selection rule is unchanged, and the result now has nothing wrapped around it.)*

**Nothing rides along unasked, including `id`.** The opening position was that `id` should always be present, so a filtered document identifies the task it describes. The user's question broke it: `--field description` prints the bare value with nothing around it, so an `id` riding along would wreck the case the flag exists for. Scoping the rule — `id` present in the document form, absent in the bare form — was available and rejected: it is a second rule to learn, and the argument against is simpler than the argument for. The caller passed the task's ID on the command line to make the request; handing it back tells them something they just typed.

The rule is therefore uniform across both forms: you get exactly the fields you named.

### Empty values and unrecognised names

**Settled by derivation** — not discussed. Determined by the project's existing stance on unknown flags, which refuses rather than silently ignoring.

**An empty field prints nothing and exits successfully. An unrecognised field name is an error with a non-zero exit.** A task legitimately having no description is a fact about the task rather than a failure of the command, and it takes the same shape as an empty notes table in full output. A field name that is not a field at all is a caller mistake, and gets what every other unrecognised flag value already gets.

**A note position that does not exist is an error too.** Selecting `notes.4` on a task carrying two notes fails with a non-zero exit and a message naming the range, rather than printing nothing and succeeding. A selector that resolves to nothing is not a field that happens to be empty — the position is a claim about the data that is false. `tick note remove` already answers this for the same 1-based addressing, reporting the index as out of range and naming how many notes the task has (`internal/cli/note.go:127-128`); giving the same grammar a different answer under a different command would be a second rule for a reader to learn.

### Interaction with the format flags

**Settled by derivation** — not discussed. Determined by this subtopic's own split between a raw value and a filtered document.

**A single-field request ignores `--json`, `--pretty` and `--toon`; a multi-field request honours them.** A one-field answer is a raw value, so there is no document for a format flag to act on, and honouring one would re-quote the very string the flag exists to hand over unquoted. A multi-field request does produce a document, and the resolved format applies to it exactly as it applies to a full `tick show`.

### Combining with `--quiet`

**Settled by derivation** — not discussed. Determined by the project's stance on unknown flags, which refuses a contradictory invocation rather than guessing at intent, and by the same reasoning that makes an unrecognised field name an error rather than empty output.

**Passing `--quiet` and a field selection together is refused.** `--quiet` prints a bare task ID and nothing else; a single-field request prints that field's bare value and nothing else. Two different single values have been asked for, and silently picking one hands back something the caller did not ask for.

---

## Write Side Input

### Context

*Raised by the background review (review-001 F4): the byte-identity bar was derived from the description write paths only, and the note write path does not meet it.*

An agent reads a note off a task, corrects a typo, and writes it back. If the note begins with a dash — `- read the header`, the shape a bulleted note naturally takes — the command refuses it:

```
unknown flag "- read the header" for "note add"
```

Measured, and wider than notes: `tick create "- some title"` is refused identically. `ValidateFlags` inspects every argument beginning with `-` that is not numeric and not a global flag, and rejects any it cannot find in the command's flag set (`internal/cli/flags.go:116-145`). Free text passed as a bare argument — note text, task title — is inspected alongside real flags. `--description` escapes only because its value follows a registered value-taking flag, so validation skips it.

The check itself is deliberate and worth keeping: it exists so `tick update tick-a1b2 --prioirty 3` refuses rather than silently reporting success. The defect is that it is applied to arguments that are free text by definition.

### Journey

The question raised against the obvious fix — supporting `--` as an end-of-flags marker — was whether it constitutes a breaking change. It does not. Measured: `--` is currently rejected on every command (`unknown flag "--" for "note add"`), so no existing invocation uses it. Adding support is purely additive — everything that works today works identically, and inputs that currently fail begin to succeed.

The cost that does exist is ergonomic rather than compatibility-shaped: `--` only helps a caller who knows to reach for it. That led to a second half of the fix. `note add` registers no flags at all (`"note add": {}`, `internal/cli/flags.go:76`), so once the task ID is consumed every remaining argument is text by definition and nothing dash-leading there could be a flag the check would have caught. Flag inspection can simply stop. `create` cannot do the same — its title shares the argument list with real flags (`--priority`, `--description`), so a dash-leading title is indistinguishable from a mistyped flag without a marker.

### Decision

**The free-text argument problem is fixed as part of this work, on both halves.**

- `--` is supported as the end-of-flags marker, and becomes the canonical documented way to pass free text that may begin with a dash. Purely additive.
- Flag inspection stops after the task ID on `note add`, where the command has no flags to confuse text with. A dash-leading note then works with or without the marker.
- **The existing bare-argument form keeps working.** Nothing that works today stops working — `--` is the recommended form, not a required one.

The deciding factor: this is the one place this work's own round-trip guarantee has a hole. There is text an agent can read out of tick and cannot put back. Leaving it means shipping the contract with an exception nobody wrote down.

### No alternative input path

**Settled by derivation** — not discussed. Determined by measurement of the argument limit together with the absence of any observed description approaching it.

**Descriptions are passed as command-line arguments; no stdin or file input path is added.** The open question was whether very large descriptions strain an argument list. Measured: `getconf ARG_MAX` → `1048576`, and passing a 200 KB argument through a process call succeeds. A real task description taken from a live project runs to roughly 4.5 KB — under half a percent of the limit. Descriptions carry no length cap of their own (unlike note text, capped at 2000 characters in `internal/task/notes.go`), so an arbitrarily large one remains possible in principle, but building an input path for it would serve a case that does not occur.

---

## Notes Free Text Handling

### Context

Discovery scoped the work to free text generally, naming notes as carrying the same problem as descriptions because both reach output through the same formatter. Measuring the two showed they do not share a problem, and measuring the commands showed notes have a different one entirely.

### Journey

On the read side, notes already satisfy the round-trip contract. Note text is emitted through the TOON library's tabular encoder, which quotes and escapes any string containing a newline, carriage return or tab (`grep -n "case '\\\\n':" "$(go list -m -f '{{.Dir}}' github.com/toon-format/toon-go)/internal/format/format.go"` → `QuoteString` maps them to two-character escapes; `NeedsQuoting` fires on all three). A multi-line note comes out as `"multi\nline\nnote"` — lossless, unambiguous, and decodable by any standard TOON reader.

On the write side there is nothing. The `note` command has exactly two subcommands (`internal/cli/note.go:28-30`):

`grep -n 'case "' internal/cli/note.go` → `case "add":`, `case "remove":`

`note add` appends a new entry stamped with the current time; `note remove` splices one out by 1-based index. Editing a note therefore means removing it and adding it back, which gives the corrected text a fresh `created` timestamp and moves it to the bottom of the list. An agent that reads a note, fixes a typo, and writes it back records the correction as if it were written today, and silently reorders the annotation log.

So "notes survive an agent's read-edit-write round trip" was unreachable regardless of the formatter — fixing the output gets the text out cleanly, and there is still no way in.

### Options Considered

**Make notes editable** — a `note edit <id> <index> <text>` preserving the original `created` and the note's position.
- Pros: closes the round trip for notes symmetrically with descriptions; an agent can correct its own typo without destroying the record of when the observation was made.
- Cons: changes what a note is.

**Read-side only** — notes stay append-and-retract; the work guarantees only that note text can be read out cleanly and reached by field extraction.
- Pros: preserves the append-only character of the annotation log; keeps the feature's surface to the formatter and the read path.
- Cons: a typo in a note has no remedy short of deleting it and losing its timestamp.

### Decision

**Read-side only. No note edit command in this work.**

The deciding factor is what a note is. It carries a `created` stamp and sits in a positional log you retract from by index — an append-only record of what was observed when, not a mutable field. Adding an edit would turn it into a list of editable strings, and would do so as a side effect of a formatting fix rather than as a decision about the annotation model. If notes should become editable, that is its own piece of work with its own reasoning.

Trade-off accepted: correcting a note still costs its timestamp and its position. The counter-argument — agents write these notes and agents typo — was weighed and did not carry, because the remedy it asks for changes the data model to serve a convenience.

What this leaves in scope for notes: their text must be readable out of `tick show` without a rule the reader had to learn elsewhere (already true, via TOON quoting), and field extraction must be able to reach it.

---

## Conformance Verification

### Context

Every other decision here is a shape. Nothing in them stops the next change adding a hand-built section and breaking the output again — which is exactly how it broke the first time.

The existing suite cannot catch it. Its assertions compare output against a string written down alongside the code, so a malformed header passed for the tool's entire life: the test compared a wrong string to the same wrong string. Every one of those assertions has to be rewritten regardless, since every shape this work touches changes. The question is what they become.

### Decision

**Three parts, all agreed.**

1. **Every structured command's output is decoded by a real TOON reader in the suite, and the test fails if it will not parse.** This alone catches the entire class of defect this work exists to fix — a section nobody can read, whatever its content.

2. **One deliberately awkward task becomes a permanent fixture, round-tripped end to end.** Free text carrying newlines, quotes, commas, a leading dash, trailing spaces, and a line that looks like a section header. Write it in, read it out, decode it, assert the text is identical to what went in. That single test would have caught the original description defect, the tags item-marker defect and the refs comma defect — and it is the only test that checks the guarantee this work actually made, which is the round trip rather than parseability.

3. **Rewritten assertions check decoded values, not output text.** "The notes section has two rows and the second row's text is X", not "the output equals this blob".

**No byte-level pinning is kept in the machine formats.** The trade was put explicitly: golden strings pin the exact output shape, so a future change cannot reshape a section without a test noticing, but they are the mechanism that rotted into the defect this discussion spent its length undoing. Decoded-value assertions survive harmless reformatting while still failing when a section goes missing or a value is wrong. The user took that trade for toon and JSON.

*(Amended 2026-09-17 — this rule was first written as "no byte-level pinning anywhere", which was too broad. Pretty output has no parser, so a decoded-value assertion does not exist for it; read literally the original wording removed pretty's only form of assertion and replaced it with nothing. **Pretty keeps golden-string assertions.** Raised by the final review, review-002 F3.)*

---

## Published Documentation Owed a Correction

### Context

*Raised by the background review (review-001 F6): the correction thread recorded in this document was scoped to the description alone, having been written before scope widened to the whole format.*

Three published documents describe output this work replaces:

- **README's worked output samples** — the agent-format output it prints is not confined to the Output Formats section, and reaches further than the two commands first named. `tick show`'s full detail (`README.md:430-450`: the malformed header, the tags and refs lists, the indented description block), the dep-tree summary header (`:307`, inside `### dep`), the arrow transition (`:473-475`), the JSON `{id,from,to}` transition (`:481-486`), and the cascade sample carrying the `(auto)` and `(unchanged)` markers (`:501-504`) all show output this work replaces. The `tick list` table (`:396-401`) is library-written and its shape is untouched, though its printed row misrenders an empty `type` as a bare trailing comma where the formatter emits `""` (`sed -n '31p' internal/cli/toon_formatter_test.go` → golden row `  tick-a1b2,Setup Sanctum,done,1,""`).
- **`v1` / `tick-core` specification** — states "long text fields get their own unstructured sections" as a principle and prints the indented description block as its worked example (`.workflows/v1/specification/tick-core/specification.md:693-714`). Work unit status: `completed`.
- **`auto-cascade-parent-status` specification** — fixes the arrow-and-`(auto)` lines as the machine-readable cascade form and requires unchanged terminal children to be shown alongside them (`.workflows/auto-cascade-parent-status/specification/auto-cascade-parent-status/specification.md:117-162`). Work unit status: `completed`.

### Decision

**The README is updated as part of this work, not as a follow-up.** It is live documentation someone reads to learn the tool rather than a record of a past decision, so leaving it describing output the tool does not produce is shipping a defect.

**The specifications are corrected selectively, by judgement, through the corrigendum facility — not as a blanket rewrite.** The user's reasoning: specifications are forever documents that do not churn out of the knowledge base, and the facility for amending them exists, so a correction can be made wherever something is obviously wrong. But the specification this work produces supersedes those decisions regardless, so correcting them is not obligatory. Where a point is plainly and load-bearingly wrong, amend it; otherwise let supersession carry it.

Both specifications belong to completed work units, so the correcting route is the one that presents each proposed correction and confirms before editing another unit's record.

Execution belongs to the specification phase rather than here: the corrections cannot be drafted until the replacing shapes are fixed in a specification, and the correcting route requires each proposed amendment to be presented and confirmed before another unit's record is edited.

### Candidates the specification phase should weigh

- The `tick-core` unstructured-long-text principle and its worked `tick show` example — the most obviously wrong, since it states as a rule the exact thing this work removes.
- The `auto-cascade-parent-status` toon cascade rendering — superseded by the structured change sections decided here.

---

## Summary

### Key Insights

1. The toon output is not lossy for free text — it is undeclared. Both the description indent and the notes escaping are reversible; what is absent is anything in the output telling the reader which rule applies to which field.
2. The two free-text fields reached their current encodings by different routes and do not agree. Descriptions follow the v1 principle "long text fields get their own unstructured sections"; notes gained a timestamp and so became a tabular section, inheriting the TOON library's string quoting instead.
3. Every section the formatter assembles by hand is malformed, and every section handed to the TOON library is correct. Each hand-rolled section exists because it wanted a shape the library does not produce — a singular object header, a list down the page, an unstructured text block — and in every case the invented shape turned out to be invalid.
4. The defect is not confined to free text. `tick show` output fails a standard TOON reader on its first line, so no amount of free-text repair would have made the output parseable on its own.

### Open Threads

- The work unit's own description still reads as a free-text fix ("Make free-text fields survive an agent read-edit-write round trip… with a field-extraction flag"). Scope has widened well past it — the carrier now understates the work.
- Which corrigenda, if any, are raised against the two completed specifications — recorded under Published Documentation Owed a Correction as a judgement for the specification phase, with candidates named.

### Current State

Resolved:

- Both reading paths are in scope — the single-field fetch and the whole-task read — with byte-identity as the fidelity bar.
- The format is repaired whole rather than free text alone: data commands and status changes must parse; one-line confirmations, `doctor` and `migrate` stay prose; a must-parse command is structured on every branch including the empty one.
- The task's own fields become named fields at the top level of the document, with no wrapping key — the same treatment for `tick stats` and the dep-tree summary. Tags and refs use the library's inline list form. The description becomes one TOON-quoted value, the same rule note text already obeys.
- Status changes become one `changed` table carrying every task whose status moved, with an `auto` column marking the change the caller asked for. The existing per-command split is kept, and each command emits one document rather than a document plus loose lines.
- Notes are read-side only, with no edit command. The notes section carries an `index` column so a row's real position survives filtering.
- Free text beginning with a dash becomes writable, via `--` as the canonical marker plus flag-inspection passthrough on `note add`; the existing bare-argument form still works. No alternative input path is added. Descriptions and titles are trimmed on import, so the no-edge-whitespace invariant the fidelity bar rests on holds for every stored task rather than only CLI-authored ones.
- The field flag becomes a projection: `--field`/`--fields`, comma-separated, bare value for one field and a filtered document for several, list fields reachable by position, and nothing riding along unasked.
- Pretty output is unchanged everywhere; JSON moves with toon.
- Verification is decode-and-assert for the machine formats, with a permanent awkward-task round-trip fixture and no byte-level pinning there; pretty keeps golden-string assertions, having no parser to assert against.
- The README is updated as part of this work; the older specifications are corrected selectively through the corrigendum facility.

Uncertain: nothing material remains open on the decided ground; what is left sits in Open Threads above as work for the specification phase.
