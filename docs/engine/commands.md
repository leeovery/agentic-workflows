# Engine Commands

The CLI door: `node .claude/skills/ledger-engine/scripts/engine.cjs <command> [args]`. This reference holds each verb's contract for its caller: its signature, what it does, what it answers, the refusals a caller acts on, and the state it writes. How a verb does it is its module's header comment. Each family's signatures are the engine's own usage, which `engine` with no arguments prints whole; a test holds each block here to it.

## Grammar

Every command follows six rules — new commands must too:

1. **Identity is positional, in containment order**: `{work-unit}`, then `{topic}`, then `{item}`.
2. **Required values with closed vocabularies are positional enums** (`topic cancel {wu} {stage} {topic}`, `workunit create {wu} {work-type}`).
3. **Payloads are always named flags, even when required** (`-m {message}`, `--file {path}`).
4. **Optional modifiers and alternate addressing are flags** (`--sweep`, `--take`, `--parent {E{n}}`).
5. **Mappings are `key=value` pairs** (`topic order {wu} {topic}={order} …`).
6. **A reserved word sharing a slot with user-named values must be a flag** — why `commit --inbox`, `--whole` and `--product` are flags beside a positional `commit {work-unit}`.

Two carve-outs. The **`render`** surfaces pass every value but the address as a flag, required closed vocabularies included. **`knowledge`** takes identity as flags (`--work-unit`, `--phase`, `--topic`), each a filter on the chunks a verb acts on, never an address; a query's positionals are its search terms.

**A topic the person names** is taken by its key or by the title a rename gave it, wherever their naming reaches: the map's verbs, `topic send`, `cancel`, `reactivate` and `postpone`, `enter`, `handoff topic`, and every render addressed at a topic. What a verb answers and writes names the key, and the calls after an entry take the key it answered. A name no topic goes by is refused, naming the live topics: `no topic "{name}" — the map's topics are {names}`.

## The response contract

- **Success** is one decision-ready JSON line on stdout, `{"ok": true, …}`, the derived state riding it so no follow-up read is needed.
- **Failure** is `{"ok": false, "error": "…"}` on stderr, exit 1, the error naming its way on; decision-ready fields ride beside it (`missing_imports`, `several`). A command the engine does not dispatch answers the usage; a verb a family does not know answers the family's usage as a refusal, `Usage: engine {family} …`.
- **`warnings`** carry what went wrong without blocking: the knowledge base's syncs, a failed push, a trust-log append that waits in the conversation.
- **`committed`** is the commit's short sha; `null` with `note: "nothing to commit"` on a clean scope; `null` with a note naming the retry, verbatim, where git refused the commit (the state write stands); `null` with `note: "held for the migration's commit"` while the migration runs. The code commit lists `[{repo, sha}]`.
- **`next`** is what follows, for the caller to do as it says: `{"kind": "engine", "argv"}`, `{"kind": "handoff", "skill", "args"}`, `{"kind": "invoke", "skill", "args"}` (in this conversation, nothing cleared), `{"kind": "continue"}`, or null.
- **Sections.** A surface, and a verb that draws a screen or a receipt, answers in sections after its JSON line: `DATA` for reasoning, never displayed; `DISPLAY`, `MENU` and `TITLE`, emitted verbatim per their markers and never parsed for decisions; `GATE`, `POSITION` and `HANDOFF`, for code alone (`skills/ledger-engine/SKILL.md`).
- **The exceptions.** `manifest` reads print bare stdout; `knowledge` answers in text; `code diff` prints the diff; the guards answer in Claude Code's hook terms — silent where the call goes through, the changed input on stdout, a refusal on stderr with exit 2.

**The state** is `.ledger/` in the repository's main checkout, a worktree of its own branch, `ledger-state`. A state commit is made there and pushed; a code commit on the branch checked out. A command's writes and commit hold the state's writer lock, `.ledger/.lock`; every engine commit is confined to the paths its action wrote.

**Made from inside the engine's own worktrees** — a quick-fix's, a one-line task's, a reader's scratch, under `.claude/worktrees/ledger-…` by a name only the engine gives: `ledger-{unit}` or `ledger-{unit}-{task}` for a unit the state holds, or `ledger-{kind}.{name}`; a worktree of your own by another `ledger-` name is none of these — a command runs from the same folder of the project's own checkout, or the nearest folder up it has where it lacks that folder or has a file there, so one that takes that worktree apart (the close, a cancel, a move, a task's done) never carries on in it; `commit`, `verify` and `code` run where they are made, their work the code there. A call but a guard run by the worktree's own copy of the engine, as the skills' relative command runs it there, is handed to the copy in the project's own checkout, where there is one: same arguments, folder and streams, its exit the call's — a copy that cannot start said on stderr, one ended by a signal ending the call by the same; a guard is answered by the copy that runs it.

**Until boot has run.** A command run with a session id (`CLAUDE_CODE_SESSION_ID`) refuses, writing nothing, until boot has stamped that conversation for the project at the installed version: `{command}: this conversation has not booted Ledger for {main checkout} on this version — invoke the start skill, /ledger, which runs engine boot before anything else`. The stamp is the conversation folder's `booted.json`. What goes through without it — boot, the banner the bare command opens on ahead of it, its stops' screens and answers, the hooks' and the gate mod's targets, capture — is `BOOT_EXEMPT` in `engine.cjs`. The keep skill's doors in the forms it uses (`KEEP_FORMS`) — `discovery-log … product`, `asset spike|import|add|status product`, `ledger find product.discovery`, `topic send … --from product`, `render send-report`, `roadmap state`, `roadmap add … --origin park:product`, `roadmap archive` of an item no unit stands behind, `inbox archive`, `environment show|set` — go through too while the checkout owes no migration on this version: its migrations record holds the installed migrations' highest id as the state branch holds it, so a migration waiting on its review's yes is owed, and the reshape waits on no commit. While one is owed they refuse, in a conversation boot stamped too where the review or the reshape waits: `{command}: this checkout owes Ledger's migration on this version — on the person's yes, run boot's migration, then this again`. Like the capture line, they mark no conversation as one that runs Ledger, nor does any command boot's stamp lets through, and every commit they make takes its own paths alone. Capture goes through a migration owed or not, committing its item alone; in its own project with no state yet it refuses with the migration owed. A command with no session id is no conversation's, and nothing refuses it.

## Boot and setup

### `boot`

```text
boot [--start-again]               (the person's words on stdin)
```

The entry pipeline, run first on every entry, the person's bare command and Claude's alike, the person's words on stdin (none for the bare command). In order: the git floor (`GIT_FLOOR`) and the repository; the state worktree put in place, made where the project is being set up, or the catch-up with the remote (**`state-merge`**); the migrations; the stamp that lets this conversation's verbs run; the knowledge base brought in line, and the late one-decision check launched where a decision landed unchecked, never one the migration carried. How each step runs is `domain/boot.cjs`'s header; the migrations' contract is `ledger-migrate/scripts/migrate.cjs`'s.

**Every stop names what the start skill does there**, in its `stop`: `{marker?, surface?, args?, next}` — the marker said first, the screen fetched (`render {surface} {args}`), and `next`: null (the start ends there), `{kind: "gate"}` (the screen's gate takes the person's answer, whose next is run, then boot again), or `{kind: "load", reference, with?}` (the start skill's reference, then boot again). The stops, each `{state, stop, warnings}` and its facts:

| `state` | Why | Its facts |
|---|---|---|
| `git` | git older than the floor, or none | — |
| `repo` | the folder is in no git repository | — |
| `lost` | the state branch is gone here and on the remote; the gate's yes is `boot --start-again` | — |
| `merge` | the catch-up needs a pick (`state-merge pick`) | — |
| `guard` | the reshape's guard: another session live, or `.workflows/` uncommitted | `cause`, `unit`, `phase`, `topic`, `active`, `paths` |
| `checks` | checks earlier migrations handed back, made before the move (`migrate checked`) | `folder`, `verify` |
| `directive` | a directive the session carries out, closing its checklist: with none of its pieces done, or where its check cannot say, the migration at work (`directive-arrival`); with some done, the migration part-way, carried on (`directive-carry-on`) | `id`, `file`, `done`, `of` |
| `taken` | another live session carries the migration on | `at`, `active` |
| `finish` | the migration waits on its commit, reviewed by the start skill's `Migration` reference; its gate's yes is `commit --migrations` | `migrations` |

**Ready** answers `{state: "ready"|"restarted", migrations: {changed, ran, output, verify, notices}, knowledge: "ready"|"not-ready", indexed, compacted, migrations_committed, warnings, session_labels, label_repaired, session_hooks_installed, mod, effort, go, route?, pick?, gates, brownfield_offer, walkthrough, github_rule_offer}`:

- `go` is where the start goes from the words: `menu` (none), `route` (`{kind: "start"|"unit", …, next}`, `next` a skill to invoke in this conversation), or `pick` (`{surface: "work-pick", args, start}`, where the words name several pieces of work, or a closed unit; `start` is Start's move, which talk about the product that names work takes instead of the pick).
- `gates` lists the setup gates due, in order: `migration-review` (where `migrations` changed anything or carries `verify` or `notices` — `changed` too where the record already differed from the state branch's before boot ran, a migration another conversation ran waiting on its review), `claude-code-floor`, then where knowledge is `not-ready`, with `system_config: {status, provider, model}` beside it, `knowledge-adopt` where that configuration is valid — the project adopts it with `knowledge setup --from-system`, asking nothing — else `knowledge`; then, on the bare command alone, `mod-notice`, `effort`, `walkthrough`, `session-labels`, `brownfield` (and on any entry after a restart; with `brownfield_signal`, the project's history before Ledger arrived: when the project manifest's `arrived` says — a migrated project's old state first entering git — else at the state's first commit), and `github-rule`.
- `session_labels` is the label opt-in: `no-multiplexer`, `on`, `off`, or `prompt` (inside a multiplexer that labels a session, never asked: the `session-labels` gate).
- `mod` is `running`, `could` (installed but not loaded: show the notice) or `cannot`.
- `migrations.verify` are checks the calling skill makes before its migration gate, `{id, description, info, verify}`; `migrations.notices` lines for the person, `{id, description, notice}`.
- Knowledge failures land in `warnings`, never blocking.

A failing migration is a hard error (`ok: false`): migrations never half-run silently.

### `state-merge`

```text
state-merge pick <1|2> <choice>
```

The catch-up of `ledger-state` with the remote's runs at every boot, before anything writes the state: a fast-forward, a push of what a failed push left behind, or a merge of both sides path by path, never rewriting what was pushed (the rules are `domain/state-merge-rules.cjs`'s). A field both sides changed to different values stops it with nothing written, the stop kept beside the state worktree's git directory, and `render state-merge-gate` draws the one choice it asks.

- **`pick`** — the person's pick at that stop: `1` this machine's value, `2` the remote's (at names made on both machines, or a report set aside, `1` carries on), naming the choice the screen showed. The last pick finishes the merge. Answers `{action, reason, remote, commit, pushed, uncommitted: {kept, merged}, conflicts, warnings}`, `action` one of `nothing`, `unreachable`, `pushed`, `fast-forwarded`, `merged` or `stopped` (the choices still open in `conflicts`). A pick of another choice than the one asked now is not taken, said in `warnings`. Refuses where no merge waits on a pick.

### `github-rule`

```text
github-rule <yes|no>
```

The person's answer to setup's offer of a rule on `ledger-state` against deletion and force-pushes, made through the code host's driver on yes. The answer is recorded on the project manifest, `github_rule: {status, reason?}` (`set`, `declined` or `failed`), and committed, so it is never offered again. Answers `{github_rule, reason?, committed, note?, warnings?}`; a rule the driver could not set is a warning naming where to set it by hand. Refuses any answer but `yes` or `no`, a `yes` where no offer stands, and an offer answered already.

### `github-squash`

```text
github-squash <yes|no>
```

The person's answer to the offer of the squash default — a squash merge's commit made from the pull request's title and description, merge commits allowed beside it — drawn in ready to build's place at the project's first ready to build, made on yes on every repository the project lands in there. Recorded as `github_squash: {status, reason?}` and committed. Answers `{github_squash, reason?, committed, note?, warnings?}`. Refuses as `github-rule` does, but a `yes` given again is taken, setting any repository nested since.

### `brownfield`

```text
brownfield record <native|skipped|accepted|completed>
```

- **`record`** — writes the brownfield offer's answer, `brownfield_offer` on the project manifest, and commits that file alone: `native`, `skipped` or `accepted` while nothing is recorded, `completed` only after `accepted`, once the product researcher's findings have landed. Answers `{answer, committed}`, and for `accepted` `next`, the handoff into the product's conversation. Refuses any other value and any answer out of that order; the offer's own answers, all but `completed`, name carrying on with the start as the way on.

### `walkthrough`

```text
walkthrough record <walked|skipped>
```

- **`record`** — writes the answer to the one-time walkthrough offer, `walkthrough.status` on the project manifest (`walked` or `skipped`), and commits that file alone. Answers `{status, committed}`, and for `walked` `next: {kind: continue}`, the walk. Refuses once an answer is recorded, naming carrying on with the start as the way on.

### `migrate`

```text
migrate check <id>
migrate checked
migrate review
migrate join <work-unit> --directive <id> [--phase <N> --dry-run]
```

The migration's own verbs, for the session carrying out what boot stopped at.

- **`check`** — runs a directive's check against the project and its state. Answers `{directive, passed, done, of, counts: {one, many}, unfinished: [{name, problems, next?}]}` — `next` the one step the session takes on that piece next, where the directive's check names one (the records') — and once it passes `raise`, the points still to raise (`[{place, answers, text, answered?, candidates?, settled_on?}]`, `candidates` the questions other records mark to raise whose `at_odds` holds the same sections, each `{place, answers, text, raised?, answered?}` — `raised` where this conversation drew it, `answered` each answer it holds, `{id, text}` — for the session to judge whether they are the same point; `settled_on` each record the session marked as its own log's for the same sections, unless it marked the person's answer as agreeing, `{place, decisions: [{id, text}]}`, its decisions citing a side still current — such a point listed once answered, its own `answered` beside it, while any is, and no more once raised and left open; each question listed until it is answered or merged). Writes nothing.
- **`checked`** — records the checks before the reshape's move made, so the next boot carries on past that stop.
- **`review`** — what the migration review reads before the gate whose yes is `commit --migrations`: `{state, code}`, both absolute folders, and while the reshape finishes `reshape: {commits, units, records, files, corrections}`, `records` the records carried, a topic's and a unit's own. Writes nothing.
- **`join`** — joins the verified per-phase pieces of a building unit (`.cache/migrate/cut-and-merges/{wu}/phases/{N}.json`) into the plan its cut takes, written to `plan.json` beside them. Answers `{unit, plan, phases, built, scenarios, corrections}`. With `--phase <N> --dry-run` it checks one piece, answering `faults`, writing nothing. Refuses a piece missing, unread or not passed by its verifier, each fault named.

## State and the ledger

### `manifest`

```text
manifest get    <dotpath> [<field.path>]
manifest set    <dotpath> <field> <value>
manifest set    <dotpath> <field>=<value> [<field>=<value> …]
manifest push   <dotpath> <field> <value>
manifest pull   <dotpath> <field> <value>
manifest delete <dotpath> <field.path>
manifest apply  <work-unit> --file <ops.json>
manifest exists <dotpath> [<field.path>]
manifest list   [--status <s>] [--work-type <t>]
manifest key-of <dotpath> <field.path> <value>
```

The field surface: work-unit and project manifest fields read and written by dot-path, validated against the schema (`kernel/manifest-schema.cjs`). The path joins unit, phase and topic: `my-epic` (the unit), `my-epic.discovery` (a phase, `phases.discovery`), `my-epic.discussion.auth-flow` (a topic, `phases.discussion.items.auth-flow`); the field may itself be a dot-path. `*` as the topic collects from every item (`get` and `exists`). The prefix `project` addresses the project manifest, the field in the path (`get project.defaults.session_labels`).

**Reads print bare stdout**, for prose to substitute: a scalar raw, a subtree as indented JSON, a missing `get` path empty with exit 0. A read error is `Error: …` on stderr, exit 1, or exit 2 for an expected miss (`key-of` finding nothing).

- **`get`** — a field or subtree; with `*`, `[{topic, value}]`.
- **`exists`** — `true` or `false`, exit 0.
- **`list`** — the units' manifests, filtered by `--status` or `--work-type`.
- **`key-of`** — the key whose field holds the value.

**Mutations answer the engine's JSON** and commit nothing: the calling flow's commit covers them.

- **`set`** — one field, or several `field=value` pairs in one write; a value parses as JSON, else a string, `~` null (quote what zsh would eat). Answers `{path, set}`.
- **`push`**, **`pull`** — append to, or remove from, a list. Answer `pushed` or `removed`, and `length`.
- **`delete`** — answers `deleted: true`.
- **`apply`** — a batch of set and delete ops in one unit, from a file: `[{op: "set", path, fields} | {op: "delete", path, field}]`, every op validated before any is written.

Refused, nothing written: a value the schema refuses (the whole batch); a status write onto a cancelled or postponed item (reactivate it, or pull it forward); the engine's own fields, `project_id`, `landings` and `build.branch`; an empty path segment; and a unit-level field named like a phase.

### `ledger`

```text
ledger ask <work-unit>.<phase>[.<topic>] [--part-of <id>] [--relies-on <id> …] [--task <phase>.<n>]   (content as JSON on stdin)
ledger find <work-unit>.<phase>[.<topic>] [--relies-on <id> …] [--task <phase>.<n>]   (content as JSON on stdin)
ledger decide <work-unit>.<phase>[.<topic>] --answers <id> [--relies-on <id> …] [--task <phase>.<n>]   (content as JSON on stdin)
ledger replace <work-unit>.<phase>[.<topic>] --replaces <id> --reason <new-fact|other-topic|changed-mind|was-wrong> [--cause <id>] [--relies-on <id> …] [--task <phase>.<n>]   (content as JSON on stdin)
ledger hold <work-unit>.<phase>[.<topic>] --entry <id> --after <id>   (content as JSON on stdin)
ledger move <work-unit>.<phase>.<topic> --question <id> --to <topic|roadmap:<item>>   (content as JSON on stdin)
ledger merge <work-unit>.<phase>[.<topic>] --question <id> --into <id> [--duplicate <id>]   (content as JSON on stdin)
ledger record <work-unit> [<topic>]
ledger map <work-unit> <topic>
ledger product [<work-unit> [<topic>]]
ledger affected <work-unit> [<topic>]
ledger since <work-unit> [<topic>]
ledger shown <work-unit> [<topic>]
ledger earlier <work-unit> <topic>
ledger late-check   (the late one-decision check, which boot launches)
ledger carry <work-unit>.<phase>.<topic>|<work-unit>.discovery [--dry-run]   (the record as JSON, {"entries": [...], "description"?}, composed at .cache/migrate/records/{unit}/{topic}.json in the state, a unit's own at .cache/migrate/records/{unit}.json)
ledger settle <work-unit>.<phase>.<topic>|<work-unit>.discovery   (every finding of the round by its number as JSON on stdin, {"findings": [{"numbers", "settled", "why"}]}, settled fixed or ruled-out)
```

The project's stream of questions, findings and decisions, `.ledger/.ledger.jsonl`: one event a line, written by the engine alone (the events are `domain/ledger-events.cjs`'s). A line that is no entry, repeats an id, or comes from a newer release stops every read and write, drawn by `render ledger-stop`.

**The write verbs** each append one event and commit the ledger on the state branch. The place is `<work-unit>.<phase>.<topic>`, or `<work-unit>.<phase>` at the unit's level, or `product.discovery` for what is found of the product as a whole. Links are flags naming entries by a prefix of their id. Content is one JSON object on stdin:

| Verb | Content |
|---|---|
| `ask` | `{text, by, who_moved_whom, cites?, from_before?}` |
| `find` | `{text, by, who_moved_whom, cites?}`, with `how`, `known` (`measured`, `exploratory`, `documented`, `spike`, `read`), `command` and `result` (together, for a measured or exploratory finding), `product_wide?` |
| `decide` | `{text, why, rules_out?, product_wide?, sealed?, alternatives?, evidence?, given?, cites?, by, who_moved_whom}`, `given` one of `own`, `your-call`, `dont-care`, `carried` |
| `replace` | the content of the kind it replaces, with what it `drops` |
| `hold`, `move`, `merge` | `{by, who_moved_whom}` |

`cites` is `[{path, section}]`, a path from the state root. `--task <phase>.<n>` names the build task an entry is made for, at `<wu>.implementation` and `<wu>.review` alone. Each write answers `id` (short), `committed`, and where they apply `note` and `warnings`; a refused commit is `commit pending`, the entry standing and the next ledger commit taking it. Every write needs a session id.

- **`ask`** — a question; `from_before` the id of the point of the record from before it is, where it is one, by which every raise of it, in any of its wordings, always asks, and which only the person closes.
- **`find`** — a finding; discovery takes nothing else ("nothing is decided in discovery — carry it as input").
- **`decide`** — answers a current question of its unit (`--answers`). Before the lock a separate Claude call checks it is one decision: several rules refuse the write, naming each, so it is split; a check that cannot run lands it `unchecked` for the late check. A labeller call gives it `kind` and `hard_to_undo`.
- **`replace`** — replaces a current entry, `--reason` `new-fact` (`--cause` a finding), `other-topic` (`--cause` a decision on another topic), `changed-mind` or `was-wrong`. Claude replacing the person's decision is refused, naming the raise to make instead.
- **`hold`** — confirms an entry still holds after a replacement it was held against.
- **`move`** — a question to another topic of its unit, or to the roadmap as later (`--to roadmap:{item}`).
- **`merge`** — a question into a current decision that already answers it.

Refused for every write: a place not live; a topic past the unit's spec (settle it at `{wu}.specification`); a question onto a decided topic (send it as a message, `topic send`); a question waiting in the build (`raise draw <wu> Q{n}`); Claude closing a question an experiment still measures; and Claude closing a point from before with a call of its own — its decision of the question, or its merge into a decision standing as Claude's call — naming the raise to make instead.

**The read verbs** answer a projection of the ledger, current entries only, ids short, taking no writer lock (`shown` takes its mark's own). Each refuses a unit or topic the project lacks.

- **`record`** — the entries standing at a unit or topic, each with what it replaced folded beneath it, its confirmations and its linked files (`assets`, `{path, status, into}`): `{unit, topic, live, questions, findings, decisions, moved, merged, other_topics}`.
- **`map`** — a topic's questions as they stand (`open`, `answered`, `merged`, `later`, `moved-away`, `elsewhere`, `question-set-aside`) with their answers; one an experiment measures is marked `waiting_on`: `{unit, topic, live, questions}`.
- **`product`** — the product-wide findings and decisions; with no unit, `questions`, the product's own; `discovery`, what discovery found at the product, unit or topic named; and each list the product's logs keep that holds an entry, every session's in order: `not_taken` (`[{direction, why}]`), `views` and `spikes` (`[{spike, tool, link, showed}]`).
- **`affected`** — current entries a replacement changed under them, waiting to be confirmed or replaced: `{unit, topic, live, waiting, affected}`.
- **`since`** — Claude's current decisions no look on this machine has covered, with their linked files.
- **`shown`** — as `since`, marking each call it shows as looked at (`.ledger/.cache/.marks/{unit}.json`).
- **`earlier`** — the record a set-aside topic left, its entries as they stood, `earlier: true`.

**Boot's and the migration's own.**

- **`late-check`** — boot's detached job: judges each decision that landed unchecked, but none the migration carried (session `migration`), and records a `checked` event for it, committing the results 25 to a commit. Answers `ran: false` where another check holds the claim, else `{ran: true, checked, several, owed, cannot?}`.
- **`carry`** — the migration's: a topic's whole record, or a unit's own (`<wu>.discovery`), composed at `.ledger/.cache/migrate/records/{unit}/{topic}.json`, appended in one write once its verifier has passed it; its commit is held for the migration's. Every line it writes is tagged with the session `migration`, whoever made the entry: the mark of an entry from before Ledger. It needs no session handed. `--dry-run` answers `faults`, writing nothing; among them an empty record of a topic that draws on a spec, or whose own markdown files, but its mail, hold text past their headings, and an entry whose text, why, how, rules out, alternatives or evidence name another entry of the record by its ref. A refusal the composer must answer is also written beside the record, `{topic}.refused.md`. Answers `carried` and `ids` (`{ref: short id}`), and keeps the passing round, its findings, rulings and verdicts, in `{topic}.rounds.md` before it clears what is beside the record. Refused once the state branch has its first commit, for a topic the ledger already holds an entry on, while findings its composer handed back stand in `{topic}.handback.txt`, for a record changed since its verifier was briefed on it (`{topic}.verifying.json`: brief a fresh verifier), while that verifier's verdicts, `{topic}.checked.txt`, miss an entry its brief asked a verdict of or name one the record it read does not hold, and while its unit's records wait: a record of the unit sharing a source with it — an approved spec, a discovery session or an asset its records walk, its own record and a topic it promoted among them — not passed by its verifier or the session's settlement, or a section of those sources no record cites, or a contradiction a record names between them unnamed on another citing it, the refusal naming each record and how many sections and contradictions, and likewise for each unit a topic of its unit was promoted from.
- **`settle`** — the migration's: the session passing a record whose verifier's findings of the third round or a later one it settled, in place of a fresh verifier. Takes every finding of the round by its number — the findings file's list items in order, or its text one finding where it holds none — one entry naming several settled alike, `fixed` (the record amended to answer it) or `ruled-out`, and why; keeps the verifier's round in `{topic}.rounds.md` and a round of the session's after it, settling each; and notes the record as the session passed it in `{topic}.verifying.json`, so `carry` takes it as it stands, and refuses it changed since. Answers `round`, the session's, and `settled`, how many. Refused, nothing written, outside the migration, for a place `carry` refuses, while findings its composer handed back stand, while the session's own pass is the last (a finding written since is the session's, for a fresh verifier), where no findings stand (none written since the last brief, or a pass), for findings of the first or second round, while the verifier's verdicts miss an entry its brief asked a verdict of, for a settlement naming a finding the round lacks, one twice, or leaving one unnamed, and for a finding settled `fixed` on a record unchanged since its verifier was briefed on it.

### `asset`

```text
asset spike <work-unit|product> <slug>
asset import <work-unit|product> <path> …
asset add <work-unit|product> <path> --entry <id> [--status <canonical|reference>]
asset status <work-unit|product> <path> <canonical|reference> [--entry <id>]
asset lift <work-unit> <path> --into <path-in-project> --entry <id>
asset legacy [<work-unit|product>]
asset keep <work-unit|product> <path> [<work-unit|product> <path> …]
asset discard <work-unit|product> <path>
```

Spikes, the files the person shared, the links from the ledger's entries to the files that inform them, and the legacy files the migration kept. A link never moves a file: Claude writes it where it lives, and the link records where that is. A file enters the state with the first ledger commit after a link names it.

- **`spike`** — the unit's, or the product's, next spike folder, `{wu}/spikes/NNN-{slug}/` or `.product/spikes/…`, and its twin under the cache for dependencies and builds. Answers `spike` (`001-frame`), `path` (from the state root, the one a link names), `folder` and `cache` (absolute). Commits nothing. Refuses a slug a spike has already (carry on in it).
- **`import`** — lands the person's shared files in `{wu}/assets/` or `.product/assets/`, renamed to the landing's rules; a shared folder lands whole under its own name by those rules, never as `legacy`, its tree and the names in it kept, its dotted entries skipped, a name a filesystem refuses slugged, and a folder landing no file skipped. A `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md`, in any case, shared alone or in a folder, lands as `claude-md.md`, `claude-local-md.md` or `agents-md.md`. Answers `imports` (paths from the state root, a folder's its folder's), `skipped_imports`, `renamed_imports` (`{from, to}`, each name changed beyond the file rules) where any, and `folders` (`{path, files}`) where a folder landed. Commits nothing. A path naming no file or folder refuses the whole call, naming each in `missing_imports`, the payload for `render import-reprompt`; a folder holding a link, a file that cannot be read, a folder that cannot be listed, a name with a control character, or what is neither a file nor a folder refuses it, naming each with why.
- **`add`** — an entry's first link to a file under the unit's or product's `assets/` or a spike, with its `--status`; at `product`, the entry a finding standing at the product's place, `canonical` or `reference` (a spike's file defaults to `reference`). Refuses a path elsewhere, a file not on disk (save it there first), and an entry already linking it (change it with `status`).
- **`status`** — changes the status on every current entry of the unit, or of the product's place, linking the file, or the one named.
- **`lift`** — records a linked file lifted into the project at `--into`, a path from the project's root; a unit's alone.

The link verbs append `asset` events and commit the ledger with the files its links name; each answers `path`, `links` (`[{id, entry}]`), `committed`, and where nothing new was linked `committed: null` with a `note`.

- **`legacy`** — with no place, each place holding legacy files and its folders, `{places: [{place, work_type, status, in_discussion, count, folders}]}`; with one, its folders and files, how many things name each (`named`) and how many a discard would leave dead (`dead`), and `findings_at`, where findings from them go.
- **`keep`** — moves legacy files or folders into the place's `assets/`, every ledger line, document link and roadmap source naming them following. Answers `from`, `to`, `rewritten`, or `kept` and `places`, and `left`.
- **`discard`** — deletes one, on the person's word. Answers `discarded` and `left`.

Both commit on the state branch; each refuses a path below no legacy folder of its place.

### `commit`

```text
commit <work-unit> -m <message> [--discovery | --state | --topic <phase>/<topic> [--sweep]]
commit --paths <file> … -m <message> --task <work-unit> <N.M>
commit --state -m <message>
commit --inbox -m <message>
commit --product -m <message>
commit --whole -m <message>
commit --migrations -m <message>
```

The scoped commit door, one per side, and the retry every verb's pending note names verbatim. Every commit is confined to its own paths, another session's files left as they were (`domain/commit.cjs`).

**State commits**, on `ledger-state`, pushed wherever the project has a remote (a failed push is a warning, the commit standing). Each is held to the layout: a file the layout has no place for refuses it, named with the way on (remove it, or move it into the layout). Every changed log rides along, with the spike and asset files it links. While the migration runs, every state commit is held: `committed: null`, `note: "held for the migration's commit"`.

- **`commit <wu>`** — the whole unit folder. `--topic <phase>/<topic>`, the session's cadence form: the topic's log or experiments, its mailbox and the unit's manifest; `--sweep` marks a commit on a topic the session is not working. `--discovery`: the unit's discovery logs, each topic's brief and the manifest. `--state`: the files only the engine writes that differ from HEAD, in the unit and the project.
- **`--state`** — the project's engine-written files and the state's `.state`.
- **`--inbox`** — `.inbox`.
- **`--product`** — the product's sessions, its picture and the project manifest.
- **`--whole`** — the whole state.
- **`--migrations`** — the reviewed migration commit, on the person's yes at the migration gate: the whole state, and on the code branch the files Ledger owns (`OWNED_PATHS`: `.claude/settings.json`, `.worktreeinclude`, `.gitignore`) as the index records them. While the reshape finishes it makes the state branch's first commit, then the code branch's, taking out the drops the journal names. Answers `committed` and `code_committed`.

**The code commit**, `--paths <file> … --task <wu> <N.M>`, on the branch checked out in each repository the paths fall in — a nested clone's paths in that clone, deepest first — never in the state. The task must be in flight in this conversation, and the call made from where its branch is checked out (its worktree; a quick-fix's, the quick-fix's worktree on `fix/{unit}`). The project's checks run first, outside any lock: `environment.run.tests`, then each linter, by `sh -c` in the calling checkout's code root; the first failing refuses the commit with its exit code and output's last 40 lines, so give the Bash call a timeout to match. A bugfix's other tasks are refused until task 1.1's test proves the bug, and from then its command runs as a check of its own. Each commit carries `Ledger-Task: {id}`; a one-line task's also `Ledger-Additions: {n}`, how many additions the task holds, so one added to it at its gate is built only by a commit made since. A merge in progress in a repository (the chain's tip merged back) is finished by the commit, its paths the resolution. Answers `{committed: [{repo, sha}], left_dirty, task, checks: [{name, exit}]}`, `left_dirty` what the code still holds uncommitted. Refused, each with its way on: no task in flight (`task start`, again after a `/clear`), a task ended (make a task of its own), the wrong worktree or branch (named), a path in the state or outside the project, a repository mid-rebase or on a detached HEAD, an index holding what the door never commits (unstage it), and at a quick-fix a clock that would date the commit before the unit.

A verb's own commit degrades rather than aborts: its state write stands, the verb answers `ok` with a `note` naming the retry and git's error in `warnings`.

### `code`

```text
code log    --subject <prefix>
code diff   [--subject <prefix>]
code status
```

The code change, read across every repository in the project — the root and the clones nested in it — its paths the project's. Nothing is written.

- **`log`** — the commits whose subject opens with `--subject` (a fixed string): `{commits: [{repo, sha, subject}], files, repos: [{repo, base}]}`, `base` the parent of each repository's earliest selected commit.
- **`diff`** — the unified diff itself on stdout, never JSON, nothing when there is no change, one patch per repository with paths from the project. With `--subject`, the change those commits made; alone, the change not yet committed, untracked files as additions, `.ledger/` held out.
- **`status`** — every uncommitted file with its porcelain status: `{files: [{path, status}]}`, the same dirt `commit --paths` answers as `left_dirty`.

### `knowledge`

```text
knowledge <index|query|check|status|remove|compact|rebuild|fill|setup> … (engine knowledge --help)
```

The knowledge base: a local store of `.ledger/`'s knowledge in `.ledger/.knowledge/`, never committed, each clone building its own, searched by meaning and by word. What is indexed is each ledger record's rendered copy (`.knowledge/records/`, rendered at every ledger write and boot) and each quick-fix's `summary.md`; never a log, a seed, an asset, an inbox item or the spec. The mechanism is `kernel/knowledge/`, the domain side `domain/knowledge/`. Its full usage is `engine knowledge --help`.

**It answers in text, not JSON**, on both streams. A failure is said on stderr, exit 1. A query never fails for want of a vector: without one it runs keyword-only, exit 0, a note above its results saying why and the fix.

- **`query`** — searches the store, each positional term a search of its own, merged and cut to `--limit` (10). `--work-unit`, `--work-type`, `--phase`, `--topic` are hard filters; `--boost:<field> <value>` re-ranks, never filters; `--explain` shows how each result ranked. Prints `[N results]`, then per result `[phase | work_unit/topic | confidence | YYYY-MM-DD]`, its headings, the excerpt, and `Source: path:L3-39`. In a conversation it is kept as the last query, which `brief plain-search` draws. Branch on its exit code first, then its output.
- **`check`** — prints `ready`, `buildable` (set up, no store, and this machine can build one) or `not-ready`; always exit 0. Boot runs it at every start.
- **`index`** — with a file in the state, indexes that artifact by keyword at once and fills its vectors in the background: `Indexed N chunks from {file}`. Alone, brings the store in line with every artifact (`N new, N changed, N removed, N unchanged.`), waiting for vectors.
- **`fill`** — embeds the chunks awaiting vectors; what an index launches detached.
- **`remove`** — removes the chunks a filter matches; `--dry-run` counts them.
- **`status`** — the health report, for people.
- **`compact`** — removes units decayed past reach; boot runs it.
- **`rebuild`** — destructive and human-only: asks for `rebuild` typed back.
- **`setup`** — the system config and this clone's init. With no flag, the terminal wizard, human-only; the skills run its non-interactive forms, `--from-system`, `--keyword-only`, `--provider …` and `--key-only`. The API key never passes through a flag, a chat or stdout: it resolves from the provider's env var or `credentials.json`. A form that sets up prints `DISPLAY: knowledge ready`, the configuration the store was built with; one refused for a key missing or rejected names its way on, `render knowledge-gate --variant retry` over the same setup.

The transactions sync the knowledge base in process; a failure there is a warning, never a block.

## The person and their trust

### `gate`

```text
gate <name> (--pick <key> | --typed [<key>])   (free text's words on stdin)
```

The person's answer at a gate, logged to the trust log by the gate's name. Every MENU a command draws records its gate for the conversation as the gate shown (`gate-shown.json`); `gate` answers against that record and performs nothing.

`--pick <key>` answers a row, named by its key or its word — `y` or `yes` — and recorded by its key; `--typed <key>` a typed row such as a Comment; `--typed` alone free text, the person's words on stdin, read by a separate call for the row it takes, and never leading anywhere (`next` null). The name is the MENU's, up to its first ` — `, quoted or bare.

Response `{gate, picked, recommended, via, next}`: `via` is `pressed` where the gate mod's press named this row, else `typed`; `next` is the row's declared next step — `{"kind": "engine", "argv"}`, `{"kind": "handoff", "skill", "args"}`, `{"kind": "continue"}` — or null; do what it says. `warnings` where the trust log could not be appended to. Refuses, logging nothing, with no session id, no gate shown, another gate's name, a key the gate lacks, free text with no words, a gate already answered by a pick that left it (only the gate drawn again takes another), and at a gate set aside — by free text, or a typed row — anything but a row picked: the row the person picks in their own words answers it where it waits, never drawn again, logged under the showing's event as a pick after a draw again is.

### `raise`

```text
raise <work-unit>.<phase>[.<topic>] --answers <id> [--relies-on <id> …] [--parks <phase>.<n>] [--always design-problem|live-server]   (the call as JSON on stdin)
raise <work-unit>.<phase>[.<topic>] --replaces <id> --reason <new-fact|other-topic|changed-mind|was-wrong> [--cause <id>] [--relies-on <id> …] [--parks <phase>.<n>] [--always design-problem|live-server|built-otherwise]   (the call as JSON on stdin)
raise <work-unit>.<phase>[.<topic>] --answers <id> [--relies-on <id> …] --fact   (the fact's question as JSON on stdin)
raise show <id> [--technical]
raise answer <id> (--pick <key> | --own | --dont-care | --didnt-follow)   (a pick's or own words' answer as JSON on stdin)
raise draw <work-unit> <question>   (by its number, Q{n}, or its park's id)
raise aside <work-unit> <question> …   (each by its number, Q{n}, or its park's id)
raise waiting <work-unit>
```

A call Claude has a lean on, answering a question or replacing a decision, put through the decision point and drawn for the person where it asks; or a fact only the person holds, always drawn; and the person's answer. A raise is answered in the conversation that drew it, against its seal, `raise-shown.json` in the conversation's folder; it is no gate (`gate` refuses one).

**The draw** takes the place and links as `ledger decide` (`--answers`) or `ledger replace` (`--replaces`, `--reason`, `--cause`) does, and Claude's call on stdin: `{question, rows: [{key, name, text, notice}], lean, why, sort, mechanism, product_wide, stepped_back?}` — `sort` `one` or `several`, `stepped_back` lines of what stepping back found (refused where the raise parks, below). A replacement's screen adds the person's `keep` row, which under `--always built-otherwise` says keeping the decision has the build change the code to match; there the lean may be `keep`, so the person's keep agrees with Claude and a proposal picked stands over it. `--fact` takes no lean, why or sort, is always asked, and writes nothing to the trust log; while the migration runs it is drawn as a decision only the person can make, never a fact. `--always design-problem|live-server|built-otherwise` makes the call always ask: a design problem, testing against a live server, or code built otherwise than a decision from before Ledger, which a replacement alone takes, of a decision whose session is the migration's. A question asked as a point from before (`ledger ask`'s `from_before`) always asks, in any of its wordings, under no mark of Claude's; its raise event says so in its `from_before`, and the person's answer to it, and their later reversal of that answer, weigh nothing in the trust counts or a convergence run; the convergence forecast sends it to the person. Every row is judged by the one-decision check first; a row holding several rules refuses the raise, naming each (`payload.several`). The decision point then answers one of:

- `ask` — sealed and drawn: `{decision, reason, raise, redrawn}`, then the MENU. A conversation holding an open seal of the same question or decision draws that one again (`redrawn: true`).
- `blind` — drawn as `ask` is, Claude's answer held back until the person's is given.
- `proceed` — Claude's call lands as its decision or replacement: `{decision, reason, id, committed}`, no MENU.
- `check` — nothing drawn or written: find the answer out, and raise again only if that cannot settle it.

Refused, nothing sealed: no session id; a place or link the ledger write refuses; a question no longer open; fewer than two rows on a call; a key that is the screen's own word (`t`, `e`, `technical`, `explain`, `comment`, `keep`); `--always built-otherwise` on a question's answer, or on a replacement of a decision made in Ledger.

**In the build** (`<wu>.implementation` or `<wu>.review`), `--parks <phase>.<n>` names the task the raise is made in, never a one-line task, whose questions are raised with no `--parks`. A call that asks draws nothing in the conversation: it parks the task, or with no task waits in the build's queue, and answers `{decision, reason, parked: "Q{n}", task, id, committed, line}`, `line` the one line Claude says. At a quick-fix only a raise naming `--parks` parks, first setting aside the uncommitted work in the quick-fix's worktree (`set_aside`); one naming no task is drawn in the conversation as anywhere else, and takes `stepped_back`. The same question raised again while a park of it waits joins it; where it names no task, or a task parked on it already, it answers `already: true`. While a question waits it is answered through its raise alone: the ledger writes and other raises on it are refused, naming `raise draw <wu> Q{n}`.

- **`show`** — draws a raise the conversation drew again from its seal, `--technical` showing the mechanism. Answers `raise`, then the MENU. Refuses a raise this conversation never drew: after a `/clear` or a resume, raise the question again.
- **`answer`** — records the person's answer to a drawn raise. `--pick <key>` takes `{why}` on stdin (`who_moved_whom: "claude-moved-person"` where the person came round to the lean); `--pick keep` keeps the decision; `--own` takes `{text, why, rules_out?}`; `--dont-care` lands Claude's lean; `--didnt-follow` records only that the person did not follow, the raise staying open. Answers `{raise, id, committed}`; `already: true` and `answer` where the ledger held it already; `{raise, open: true}` for `--didnt-follow`. In the build it adds `receipt`, the one line Claude shows: what the answer freed, how many questions still wait, and the next: the first the board's discussion queue names, or else the oldest still waiting that this conversation has not set aside. It may add `care_drop` (propose dropping a care entry, **`person`**) and `convergence` (offer to settle the rest of the topic, **`convergence`**). A blind question's answer is followed by `DISPLAY: blind question revealed`. Refuses a question answered since the draw, and a replacement whose decision is no longer current, naming what is current to raise again on.
- **`draw`** — raises a question waiting in the build, by `Q{n}` or a park's id, sealed from its first park. Answers `{raise, question, parks, redrawn}`, then the MENU. Refuses a question no longer waiting, naming those that are.
- **`aside`** — sets questions aside, still waiting; writes nothing of the state, keeping them as set aside in the conversation's folder, so no receipt there names them next. Answers `receipt`, its next the queue's alone.
- **`waiting`** — the questions waiting, oldest first: `{unit, waiting: [{question, id, asks, about, parks, since, waited_minutes}]}`.

### `verdict`

```text
verdict queue
verdict give <entry> <nothing|fix|loss|skip> --at <decided|ready-to-build|conclusion|finish|close|queue> [--unit <unit>]
```

The person's verdicts on departures: their answer standing over Claude's lean, or their keep of a decision Claude proposed to replace, as this machine's trust log holds it.

- **`queue`** — every departure still owed a verdict, in the ledger's order, each its ledger line with `standing` and `lean`, Claude's lean beside it: `{departures: […]}`. Takes no argument.
- **`give`** — logs a verdict, `nothing`, `fix`, `loss` or `skip`, in the trust log, `--at` the point it was given (`decided`, `ready-to-build`, `conclusion`, `finish`, `close`, `queue`). A skip leaves the departure waiting. Answers `{entry, verdict, point}`, and given at the queue `next`: `render verdicts` while one still waits, else the start menu (with `--unit`, that unit's verdicts, else its epic menu). Refuses a skip at the queue, a departure logged on another machine, and one already given a verdict: correct it with `trust correct`.

### `person`

```text
person propose [--drop]   (a preference or a care entry's kind, Claude's why and examples as JSON on stdin)
person keep [--care <kind>]
person drop [--care <kind>]
person discard
```

The record of the person, `{config}/person.md`: their preferences and their care entries (a kind that always asks in a project), one record across every project on the machine. Only these verbs write it, and only on the person's answer as the gate last shown recorded it; each refuses otherwise, writing nothing. A care section that does not read refuses every verb reading care entries, naming the line to put right by hand.

- **`propose`** — Claude's proposal on stdin, `{"preference" | "care", why, examples}`, to keep, or with `--drop` to drop; held in the conversation's folder and drawn as `DISPLAY: record proposal` and its MENU (`record drop` with `--drop`). Answers `{proposed, entry}`.
- **`keep`**, **`drop`** — on the person's yes on that screen, the proposal held written into, or dropped from, the record; with `--care <kind>`, on the person's pick on the care screens, a care entry for this project added or dropped. Answer `kept` or `dropped`, and with `--care` `next`, the care screen again. A dropped care entry is logged as a `care-drop` event in the trust log.
- **`discard`** — the person's no: the proposal let go. Answers `discarded`.

### `convergence`

```text
convergence accept <work-unit> <topic>   (the person's yes on the convergence offer)
convergence decline <work-unit> <topic>   (the person's no on it)
```

The person's answer to Claude's offer to settle the rest of a topic under discussion (`render convergence` draws the offer; settling is no verb, Claude raising each open question as usual). Each writes only on the person's answer at the `convergence offer` gate, else refuses, writing nothing. Each answers `{convergence, unit, topic}`.

- **`accept`** — the yes: a `convergence` event in the trust log.
- **`decline`** — the no: kept in the topic's cache, `.ledger/.cache/{wu}/discussion/{topic}/convergence.json`, the run of agreements starting again from it.

### `trust`

```text
trust threshold <percent>
trust build-threshold <percent>
trust correct <entry> --kind <process|danger|contract|scope|look|words|behaviour|internals> | --verdict <nothing|fix|loss>
```

The person's trust settings, under `trust` in `{config}/config.json`, and their corrections. Nothing here writes the state.

- **`threshold`**, **`build-threshold`** — write the threshold, or the one mid-build, as a percent above 0 and below 100, only on the person's yes on that setting's replay (`render matrix-replay`); Claude never sets them. Answer the setting and `next`, `render matrix`.
- **`correct`** — logs the person's correction of a question's kind (`--kind`) or a departure's verdict (`--verdict`) as a `correction` event in the trust log. Answers `{entry, kind|verdict}`. A departure still waiting is given its verdict, never corrected.

## Work units, topics and their phases

### `workunit`

```text
workunit create <work-unit> <work-type> --description <text> --session-log-file <path>
                [--seed <path> …]
workunit cancel <work-unit>
workunit reactivate <work-unit>
workunit pivot <work-unit> --summary <text> [--description <text>]
workunit absorb <feature> --into <epic> --topic <name> --summary <text> [--description <text>]
workunit move <work-unit> --to feature|bugfix --file <payload.json>
workunit split <epic> --topics <a,b,…> --into <new-epic> --description <text> --session-log-file <path>
workunit retire <work-unit>
workunit position <work-unit> auto|step
```

Work-unit lifecycle. Each verb is one transaction: its manifest writes, the knowledge base's sync (a failure a warning) and a commit of what it touched. Each answers `work_unit`, `committed` and `warnings`, but `absorb`, `position` and `move`, whose answers are their own. `cancel`, `reactivate`, `pivot` and `absorb` print their receipt after the JSON line, drawn from what the verb answered and the state it left: `DISPLAY: confirmation`, and above it `DISPLAY: kb warning` where the answer carried `warnings`. The receipt is drawn before either is printed, so one that cannot be drawn leaves the one refusal.

- **`create`** — the work-type commit at start this work: writes `.ledger/{wu}/manifest.json` and the unit's row on the project manifest, moves each `--seed` (a live inbox path) into `{wu}/seeds/`, and installs the session log verbatim as `{wu}/discovery/session-001.md`. Answers `work_type`, `seeds` (`[{path, source}]`, `source` the inbox folder's tag) and `session_log`. A name a unit already holds is refused, nothing moved: derive another.
- **`cancel`** — sets `status: cancelled`. First it leaves the unit's code: a quick-fix's uncommitted fix set aside at `refs/ledger/aside/{wu}/{task}` and its worktree taken apart, every pull request open on the unit's branches closed (`closed_by_cancel`), the branches kept for a reactivate. It abandons open experiments, moves waiting mail to the inbox as ideas, returns joined roadmap items to waiting, and removes the unit's chunks and cache. Answers `status`, `pull_requests_closed`, and where they apply `abandoned`, `inbox`, `roadmap_reverted`, `roadmap_horizon_gone` and `next` (the horizon pick for each item put back on none, else `continue`). The calling conversation sitting in the unit leaves its place and the unit's tasks in flight, its session's own label back — a quick-fix's put back where its start was made, the product's conversation or a unit's phase and topic, its position, label and presence row there — and for any unit but a quick-fix `DISPLAY: ended` below the receipt says what waits on the person, the menu one `/ledger` away. Refused while a quick-fix's worktree holds uncommitted changes no fix holding it set aside, or the host cannot be reached: cancel again once settled.
- **`reactivate`** — a cancelled unit back to `in-progress`: rejoins the roadmap items its cancel put back where they still wait, and re-indexes the unit. Answers `previous_status`, and `roadmap_rejoined` / `roadmap_stayed` where any.
- **`pivot`** — an in-progress feature becomes an epic: its one topic goes on the map with Claude's `--summary` and `--description`, the map approved at the pivot. Answers `work_type: "epic"`. Refuses a unit that is no feature, not in progress, or past its spec (it carries on as work of its own).
- **`absorb`** — a feature becomes a new topic of an in-progress epic before its spec, then is deleted: its topic folder, experiments, seeds, assets and spikes move to the epic (renamed on a collision), its ledger lines carried by one `rehomed` line, its roadmap joins re-aimed; one commit. Answers `feature`, `epic`, `topic`, `discussion`, `committed`, `warnings`, `assets`, `renamed_assets`, `spikes`, `renamed_spikes`, `seeds`, and where they apply `experiment`, `mail_moved`, `roadmap_reaimed`, `roadmap_sources_rewritten`, `roadmap_sources_dropped`. Refuses a topic name the epic holds, a feature with no discussion, and an epic past its spec.
- **`move`** — stages a quick-fix's move to a feature or a bugfix, or a bugfix's to a feature, from inside the unit's own session: Claude's payload is `{"description", "reason", "brief"}`. Commits nothing; answers `{work_unit, from, to, warnings?}`, then start this work's screen, whose yes, `start-this-work yes`, makes the move. Refuses a unit not in progress, past its spec, a type that does not move there, a bugfix outside its investigation or whose root cause awaits its validation, and a quick-fix with a fix landed (finish it, then start the new type as work of its own).
- **`position`** — switches a begun build between `auto` and `step`: writes `build.position`, logs a `position-switch` in the trust log, commits the manifest. Answers `{unit, position, committed, warnings?}`. Refuses a quick-fix (no position) and a build not begun.
- **`split`**, **`retire`** — the migration's own, refused once the state branch has its first commit; their commits are held for the migration's. `split` moves topics of a building epic into a new epic, made as `create` makes one; `retire` takes a cross-cutting unit off the registry, its folder kept whole at `.product/assets/{unit}/`, its lines carried to the product's place. Each answers `carried` and `note`; `split` also `epic` and `topics`, `retire` `kept` and `promoted`.

Completed units are never reopened: `cancel`, `reactivate` and `pivot` refuse one (a later change is new work). Completion has no verb of its own: finish's yes runs it.

### `topic`

```text
topic add <work-unit> <name> --summary <text> --brief <draft> [--description <text>] [--from-roadmap <item>] [--re-add] [--source <tag>]
topic add-batch <work-unit> --file <topics.json>
topic edit <work-unit> <name> [--summary <text>] [--description <text>]
topic rename <work-unit> <old> <new>
topic remove <work-unit> <name>
topic order <work-unit> <topic>=<n> [<topic>=<n> …]
topic brief <work-unit> <name> --brief <draft>
topic send <work-unit> <topic> --from <sender> --content <file> --slug <kebab>
topic mailbox <work-unit> <topic>
topic answered <work-unit> <topic> <NNN-slug> --entry <id>
topic cancel <work-unit> discovery <topic>
topic reactivate <work-unit> discovery <topic>
topic postpone <work-unit> <topic> --horizon "<horizon>"
```

A topic's mail, an epic's map, and a topic's leaving. A topic phase's item is started by `enter` and closed by its phase's own door, never by a topic verb. A topic is named by its key or by the title a rename gave it; answers name the key.

**Mail.** One mailbox a topic, `{wu}/topics/{topic}/mail/NNN-{slug}.md`.

- **`send`** — lands a message from a scratch file under `.ledger/.cache/`, its first line the title; `--from` names the sender (a topic, `{unit}.discovery`, `{unit}.specification`, `{unit}.{topic}`, `product` for a conversation outside the unit, or `E{n}`). A decided topic goes back in progress (`reopened: true`); a postponed one keeps it for its return; a cancelled or removed topic, or a cancelled unit, gets it in the inbox as an idea. Answers `unit`, `topic`, `message_path` (or `inbox_path`), `committed`, `note?`. Refuses a quick-fix, a completed unit, and a unit past its spec.
- **`mailbox`** — what waits, in landing order: `count`, `files` (absolute paths). Takes no lock.
- **`answered`** — removes the message `NNN-slug` once `--entry` names the question it raised on this topic, or one a move brought here, and commits the removal. Answers `answered`, `entry`, `remaining`, `committed`.

**The map's verbs** change an epic's map at the person's word: each commits and answers its JSON line, then its one-line report (`DISPLAY: confirmation`). `add` and `add-batch` refuse an epic past its spec, whose map is closed (new work goes to the product's conversation). Their response is `{work_unit, op, name, title, lifecycle, map_total, committed}`, with each op's own fields below; a failed commit answers `committed: null` and a `note` naming the retry.

- **`add`** — a topic and its brief, installed at `{wu}/topics/{name}/brief.md` from Claude's draft in the cache. The name is a lowercase slug no topic goes by; a struck name needs `--re-add`; a waiting roadmap idea's name needs `--from-roadmap`, which takes the item in. Adds `source`, `summary`, `description`, `brief`, `from_roadmap`, `prior`, `re_added`.
- **`add-batch`** — several as one transaction, each checked before any is written; answers `added`, `readded`, `map_total`.
- **`edit`** — a topic's summary or description; answers the values written.
- **`rename`** — an unstarted topic the ledger never named moves whole to the new key; any other takes the name as its `title`. Adds `renamed_from`, `renamed_to`, `was`, `moved`, `re_added`.
- **`remove`** — an unstarted topic the ledger never named leaves the map: its mail goes to the inbox as ideas, a roadmap item it took in goes back to its horizon, its name joins `dismissed`. Adds `inbox`, `roadmap_returned`, `roadmap_horizon_gone`, `next` (the horizon pick for an item whose horizon is gone). A topic started or named on the ledger is refused toward cancel.
- **`order`** — the topics' order; answers `ordered` and `titles`. A closed topic takes none.
- **`brief`** — rewrites an unstarted topic's brief; a started one is refused (what bears on it goes as a message).

**Leaving.** An epic's topic, at `discovery`. Each prints its receipt after its JSON line, drawn from what it answered and the epic it left: `DISPLAY: confirmation` — the topic by its title; a cancel's waiting messages moved to the inbox, counted; the horizon a postpone left it under; the statuses a reactivate gave its items back, and each roadmap item its cancel put back that it left where it stands — with `DISPLAY: kb warning` above it where the answer carried `warnings`.

- **`cancel`** — marks the map row and its discussion `cancelled`, abandons its open experiments, moves its mail to the inbox, returns its roadmap joins to waiting, closes its agents still running, and commits the unit's manifest. Answers `topic`, `status`, `cancelled`, `abandoned`, `released_waits`, `roadmap_reverted`, `inbox`, `closed_agents`, `committed`, and `next`: the horizon pick for each item put back on no horizon, then the epic's menu from inside the topic's discussion, else `continue`. Refused past the unit's spec (abandoning the work is the unit's cancel) and for a postponed topic (pull it forward).
- **`reactivate`** — restores a cancelled topic, its order where the number is free, and the roadmap joins its cancel put back. Answers `restored`, and `roadmap_rejoined` / `roadmap_stayed` where any. Refused past the unit's spec.
- **`postpone`** — an epic's topic leaves whole for the roadmap under `--horizon`: marked `postponed`, a roadmap item joined, brought back or made, carrying `postponed_from` and the topic's brief and log. Answers `topic`, `status`, `postponed`, `roadmap` (`{name, horizon, born_map, born_horizon, reverted_join, from_archive}`), `closed_agents`, `next` (as a cancel's). Refused once the build has begun, while an experiment of the topic is open, and where a roadmap item of its name is another's. The way back is `roadmap pull-forward`.

### `enter`

```text
enter <discussion|discovery|specification|implementation|review|investigation|experiment> <work-unit|product> [<topic>] [--take] [--move] [--type-call] [--seeds <seeds>] [--record <record>]
```

The one call a phase is entered by. Discussion, investigation and the laboratory, experiment, are entered at a topic; discovery at an epic or at `product`, the product's conversation; specification, implementation and review at the unit. The entry starts what is not yet started, records where the conversation is working (its position, with the laboratory's experiment worked, its label, presence, and `.cache/{unit}/{phase}/{topic}/entered.json`), and answers in sections: any question owed first, then a `DATA` of `key: value` lines naming what to read — absolute paths and engine calls, never their contents.

- **Asks first.** Where another live session holds the place, but at the product, whose conversation several sessions share, the answer is `MENU: held topic gate` alone, nothing written; for implementation and review, where another session works in this checkout, `DISPLAY: code gate` and `MENU: code gate`. Each gate's yes enters again with `--take`. Discussion and investigation raise `DISPLAY: waiting mail` while messages wait. The laboratory, over several live experiments and none named, answers `DISPLAY: experiment register` and `MENU: experiment pick`, the register left out where the next experiment's gate drew it just above, nothing written: each row enters again with `--record` naming its experiment, carrying any `--take`; its back returns to the next experiment's gate where the conversation came from it, else to the unit's menu.
- **`--record`**, the laboratory's alone, names the live top-level experiment to work.
- **Starts.** A discussion or investigation item, a discovery session (its next log made empty, its marker set), the build's first entry (running the environment's steps for before the first task, `prepared` lines in its `DATA`), and a quick-fix's fixes (phase 1 written in the tracker); each commits the start. Implementation and review put the tracker's tasks in progress in flight on the position. The review phase's first entry brings the default branch into `feat/{unit}` and opens the unit's pull request where the driver lands through a host; a conflict refuses the entry, the merge begun in a worktree for the person to settle.
- **`--move`** carries the conversation on between discovery's levels — the product's conversation, an epic's discovery, a topic's discussion moving up — in the same session, leaving a pointer in the log it left.
- **`--type-call`**, discovery's alone, at `product`: a piece of work's type call, in no session of the product's conversation. Nothing is asked first, started, written or recorded, whoever holds the product's conversation; the `DATA` is the seeds' lines where it takes any, `picture` where the product's conversation has one, to read and never write, `roadmap`, `inbox`, the live inbox's folder, and `payload`, where this conversation writes start this work's payload. Refused at an epic, and beside `--move` or `--take`.
- **`--seeds`**, discovery's alone, takes in the seeds its handoff carried.
- **`DATA`** — per phase, what to read, each key naming it: for a build, `in flight` with where each task goes next, `waiting` questions, and `engine`, the engine's path for a call from a worktree. At the product's conversation, once the picture is written, a return reads `picture`, the conversation's picture of where the product stands, and `latest sitting`, the latest closed log holding talk by its closing line, in place of its `session log`s, the open log it carries on its one `session log`, and `started since`, each unit started on or after the day that sitting's first conversation began — with no sitting closed, the open sitting's — `{unit} {type} — {what it carries}`: an epic's points from before, else its first log, a feature's or a bugfix's brief, a quick-fix's description; a seeded entry and the type call read `picture` beside their seeds. An epic's entry reads `from before`, the points from before and shared files it carries. Every topic-level and discovery entry ends with `log`, a topic-level one then with `log header`, the line the conversation's next write to it opens with, where one is owed; a discovery entry writes that line into the log itself. The laboratory's keeps no log: its `experiment`, `status` and `folder`, the record's `problem`, `design` and `report` where written, a `split` line for each split (`{id} {status} {folder}`), and until the design is approved the spawning topic's `topic record` and `topic log`, its `brief`, and a unit's one topic's `discovery log` and `seed` lines.

Response `{phase, unit, topic?, entered, started, committed?, note?, warnings?}`: `entered: false` where it asked first; `started` true where this entry started the place; a failed commit leaves the start on disk, `committed: null` and a `note` naming the retry. Every refusal names its way on, nothing written: a unit cancelled or completed; a phase the unit's type lacks; a topic past the unit's spec, or cancelled, postponed or decided (it reopens by a message); a spec while a topic is still open; a laboratory whose topic has no experiment or none live, or a `--record` that is no live top-level experiment of the series; a build not begun (ready to build's yes begins it); a review before every phase of the cut has closed, or in step merged; a quick-fix's review before the person asked for one; a failed setup step, named with its exit code.

### `handoff`

```text
handoff <skill|/skill> [args …]
handoff topic <work-unit> <topic>
handoff unit <work-unit>
```

Every move into work, named by one call; the engine composes the continuation and the session writes none. The answer is sections, and nothing is written: `DATA` with `handoff: mod` (the gate mod carries handoffs, `LEDGER_HANDOFF=1`) or `handoff: inline`, then `skill:` and `args:`; `DISPLAY: handoff`, the line naming where the work goes (`→ Discussion · note-window`); and, under `mod`, a `=== HANDOFF … ===` section, `{skill, args, text, line}`, which the mod takes to clear the conversation and send `text` into the new one. Under `inline`, or where the mod did not take it, the session invokes the skill in place.

**`handoff <skill|/skill> [args …]`** names a skill from one table and its arguments: `ledger-discovery <work-type|start|none> <none|epic> [<seeds|none>]`; `ledger` (the start menu); `ledger-roadmap`; `ledger-continue-epic <epic>`; `ledger-quick-fix-process <quick-fix> <work-unit>`; each phase's `ledger-{phase}-process <work-type> <work-unit> [<topic>]`, the spec's, implementation's and review's at the unit alone, and the laboratory's taking after its topic a top-level experiment, `[<topic> [<record>]]`, as the spawn gate's yes names the one just spawned. Refused, before anything travels: a skill outside the table, arguments of the wrong number or shape (the error is the target's usage), a unit no longer in progress, and a character the invocation could not carry.

- **`topic`** — into the phase a unit's topics are talked through, a bugfix's investigation or any other's discussion, refused as that phase's `enter` would refuse it.
- **`unit`** — the start menu's Continue: an epic onto its menu, any other unit into the phase it has come to, or into the laboratory where an experiment is out. Refuses a closed unit (seen through the start menu, brought back through manage).

### `discovery-session`

```text
discovery-session close <work-unit|product> -m <message>
```

Discovery's sessions, at an epic (logs at `{wu}/discovery/session-NNN.md`, marker `phases.discovery.active_session`) or at `product` (logs at `.product/sessions/session-NNN.md`, marker `product_session` on the project manifest). `enter discovery` opens one.

- **`close`** — ends the open session: clears the marker and commits the place's scope with the caller's message, the log written by Claude beforehand. The product's drops the calling conversation's position there and its presence row, and clears the marker only where no other live session is still in the product's conversation: the last one out ends the session, and one before it answers `still_open: true`, its commit message saying the session stays open. Answers `session`, `session_log`, `committed` (null with a note when nothing was staged). Refuses where no session is open, or its log is missing.

### `discovery-log`

```text
discovery-log not-taken <epic|product> --direction "<direction>" --why "<why>"
discovery-log view <epic|product> --text "<view>"
discovery-log spike <epic|product> <spike> --tool "<tool>" --showed "<what it showed>" [--link <live link>]
discovery-log from-before <epic> --id "<id>" --point "<point>" --file "<file>"
```

The three lists in an epic's open discovery log, `{wu}/discovery/session-{NNN}.md`, that the board reads, and in the product's, `.product/sessions/session-{NNN}.md`, that `ledger product` reads. Each verb puts one line under its heading — `## Not taken`, `## Views of the product`, `## Spikes` — and never a conversation's line, so a keep from another conversation is never the log's last writer. At an epic it commits nothing, the log riding the next state commit. At the product it writes from any conversation: where no session is open it opens one, holding and closing nothing, and it commits the product's scope, a spike's line with the spike's folder. Each answers `log` (from the state root), `heading` and `line`, and at the product `committed` and `note?`.

- **`not-taken`** — a direction not taken, and why.
- **`view`** — a view of the product.
- **`spike`** — a spike the epic or the product holds (named as `asset spike` answered it), the tool it used and what it showed, `--link` a web address for the tool.
- **`from-before`** — a point from before the epic's discovery meets, kept in no log: its line, `- {id}: {point} ({file})`, joins the epic's points from before, `{wu}/discovery/from-before.md`, after the last and above its shared files, the file begun where it has none, and committed. Approve the map reads it there. Answers `file`, `line`, `committed` and `note?`. Refuses, writing nothing, at the product, whose points from before its picture holds, an id holding a space or a colon, and an id the epic carries already.

Each refuses, writing nothing, a unit that is no epic, an epic with no discovery session open, and a value that is empty or past one line; `not-taken` a direction holding ` — `; `spike` a tool holding ` — `, `[` or `]`, a `--link` that is no web address, and a spike the place does not hold.

### `experiment`

```text
experiment create <work-unit> <topic> --slug <kebab> (--from discussion --problem <file> --question <id> | --parent <E{n}>)
experiment advance <work-unit> <topic> <id>
experiment approve <work-unit> <topic> <id>
experiment amend <work-unit> <topic> <id> [--struck]
experiment runs <work-unit> <topic> <id> --file <runs.json>
experiment conclude <work-unit> <topic> <id> --verdict <one line>
experiment abandon <work-unit> <topic> <id> --reason <one line>
```

A topic's experiment series: records at `phases.experiment.items.{topic}.experiments.{id}`, documents at `{wu}/topics/{topic}/experiments/{id}-{slug}/`, which Claude writes. The record runs `conceived → designed → approved → running → concluded | abandoned`; the series' status follows its records. Every verb commits what it recorded with the record's folder, the design, report and data Claude wrote there riding along (`experiment({wu}/{topic}): …`), and a `conclude` that sends its report commits the delivery too. Each answers the record (`id`, `slug`, `status`, `dir`), `committed`, with a `note` naming the retry, `commit {wu} --topic experiment/{topic}`, where the commit failed, and `warnings`. Every step from `advance` to `abandon` refuses, writing nothing, while a frozen design it would commit, the record's or a split's, differs from its commit: `amend` records the change first, until results are visible — a run of the tally done; from then the design is frozen for good, to be put back, a flaw going in the report's Corrections. Each beats the presence of the phase of the topic the calling conversation sits in, and a top-level `conclude` or `abandon` answering the laboratory's way on releases it.

- **`create`** — the spawn, from a discussion: allocates `E{n}`, moves the problem statement (a cache scratch) in as `problem.md`, opens the series, and holds the discussion from closing until it ends (`awaiting`); commits the manifest and `problem.md`. `--question` names the open question on the topic's map it measures (`question`). `--parent E{n}` splits a running experiment into `E{n}.{m}`, which never split again, committed as a step. Refused past the unit's spec.
- **`advance`** — conceived to designed, approved to running; answers `previous`.
- **`approve`** — designed to approved, the person's yes at the briefing gate, the design frozen; answers `previous`.
- **`amend`** — commits the record's `design.md` alone: an amendment to a frozen design, or with `--struck` its strike, recorded there. Refused for a design not yet approved, which changes freely; for one with results visible, frozen for good; and for an ended record.
- **`runs`** — a running record's tally from a cache scratch, `[{condition, of, values, unit?}]`, kept as `runs: [{condition, of, done, median, unit?}]`.
- **`conclude`** — a running record's one-line verdict. A top-level one releases the discussion's wait (`released_waits`) and settles the series (`item_status`); where its question has left the topic, it sends `report.md` to the topic the question stands on now (`report_sent`). Answers `next`, the laboratory's way on where the calling conversation sits in the laboratory at the topic, working this record, one already ended, or none named: a split's `continue`; a top-level record's `render experiment-next-gate` while the series holds a live one, else `handoff unit {wu}`. From anywhere else, as the spawning discussion abandons one no one will run or the laboratory ends another record than the live one it works, `continue`. Refused while a sub-experiment is live; and where a report is owed, with no `report.md` written (write it first), or with the unit past its spec, where no topic takes a message (abandon it, and settle what it found in the spec).
- **`abandon`** — ends a record from any open status, `--reason` kept; releases the wait and answers `next` as a conclusion does.

### `investigation-log`

```text
investigation-log symptom <bugfix> --text "<the person's words>" [--body <file>]
investigation-log hypothesis <bugfix> --title "<title>" [--state suspected|confirmed|ruled-out|intended] [--by <decision>] [--body <file>]
investigation-log hypothesis <bugfix> H<n> [--title "<title>"] [--state suspected|confirmed|ruled-out|intended] [--by <decision>] [--body <file>]
investigation-log experiment <bugfix> --title "<title>" --showed "<what it showed>" --entry <finding> [--body <file>]
investigation-log root-cause <bugfix> --entry <decision> [--body <file>]
investigation-log validation <bugfix> root-cause|fix --found "<what it found>" --did "<what Claude did with it>" [--body <file>]
investigation-log fix-direction <bugfix> --question <question> [--body <file>]
```

The hunt a bugfix's investigation keeps in its topic's log, `{wu}/topics/{wu}/log.md`, which the investigation's gates read. Each verb puts one line under its fixed heading and commits nothing; the log rides the next state commit — but where the investigation has closed into its spec, the line voids the close, and the manifest is committed with the log. Each answers `log`, `heading`, `line` and `warnings`. `--body <file>` puts the file's lines beneath the entry for the board's pages. Claude's own prose goes under headings of its own.

- **`symptom`** — `## Symptoms`, in the person's words.
- **`hypothesis`** — `## Hypotheses`, `H{n} · {title} · {state}`, numbered as first logged; a later call naming `H{n}` restates it as it is now. `intended` takes `--by`, the person's decision.
- **`experiment`** — `## Experiments`, `E{n}`, resting on a finding (`--entry`).
- **`root-cause`** — `## Root cause`, resting on a decision.
- **`validation`** — `## Validation`, what the root cause's or the fix's validation found and what Claude did with it.
- **`fix-direction`** — `## Fix direction`, resting on a question; refused while the root cause rests on no current decision. Its body is the step back's evidence where the decision or the latest raise holds one, else `--body`.

Each refuses, writing nothing, an investigation not started (`engine enter investigation {wu}` starts it), a value empty or past one line, and an entry that is not a current entry of the kind the verb rests on, naming what it is instead.

### `investigation`

```text
investigation stage <bugfix> --file <recap.json>
```

A bugfix investigation's close into its spec, with no gate: ready to build concludes it.

- **`stage`** — marks the close at `checklists.conclusion.{wu}` with Claude's recap, `{hunt, fixes?, area?}` — the hunt told short, the unit whose code the bug is in, and the verify setup's area it sits in, respelt as the project's bugfixes first recorded it — and what it was drawn on, `root_cause` and `fix`, each by its full id. The mark holds `closed`; `voided` once a message reaches the investigation, a question is opened there, an entry is replaced there or put in its log, or it is entered again; `taken` by ready to build's yes. It commits the manifest and releases the place's presence. Before the spec, the recap is drawn on the root cause and the fix the log rests on; once the spec is written the investigation is frozen, and staged again the recap is drawn on the unit's current entries the kept root cause and fix lead to — a change to either being the spec's replacement — with no check of the hunt. A spec written while the close stood voided — the investigation going on while the spec's writer was out — is not yet written until it lands, which waits on the close: the investigation is entered again and closes as before the spec. Answers `{unit, closed, fixes?, area?, committed, next}`, `next` the handoff into the spec (`ledger-specification-process bugfix {wu}`) while it is not written, else `continue`. Each refusal opens `investigation stage: ` and names its way on: an investigation not started or concluded; and before the spec, a root cause or fix resting on no current entry, a validation not taken in since what it validates was logged (dispatch it, wait for it, or take its report in, as the refusal says), a question open at the place, or mail waiting; once it is written, a kept root cause or fix leading to another unit's entry alone, naming the replacement at the spec that makes it the unit's; and a recap out of its shape, a unit the project lacks or this one, or an area with no verify setup recorded.

## The gates and the spec

### `start-this-work`

```text
start-this-work yes
```

Discovery's authority gate at the work-type commit: the person's yes creates the unit. Its screen is `render start-this-work`; Claude's payload, written where the product's entry names its `payload`, `.cache/product/discovery/product/start-this-work-payload-{session}.json`, and staged with `--file` at `.cache/product/discovery/product/start-this-work-{session}.json`, each one for each conversation, is `{type, name, description, reason, shaped_by?, seeds?, roadmap?, brief?, from_before?, shared_files?, picture?}` — the type (`feature`, `epic`, `bugfix`, `quick-fix`), the name, the places in the product's sessions that shaped it, at least one where the conversation's place is the product's conversation, the inbox items and waiting roadmap items it starts from, a feature's or bugfix's one brief, a draft in the cache, an epic's points from before, each `{id, point, file}` in one line apiece, an id once and with no space or colon, and its shared files, each `{path, holds, kind}`, a path from the state root below an asset home and on disk, `kind` `reference` or `to read` — another type's refused — and, in the product's conversation, `picture`, the thinned picture's draft in the cache, refused from a type call. The screen lists an epic's points from before and shared files beneath the reason. A unit's move stages here too (**`workunit`**), and its yes makes the move.

- **`yes`** — creates the unit as `workunit create` does, copies each roadmap item's note into its seeds, writes the brief, writes an epic's points from before and shared files to `{name}/discovery/from-before.md`, whichever conversation started it, lands the thinned picture, joins the roadmap items, closes the product's open session where the work leaves the conversation — a feature, a bugfix, an epic started where the conversation's place is the product's conversation — and no other live session is in the product's conversation, a quick-fix's and a type call's yes leaving it open; removes the conversation's payload and its staged copy, and, for work that leaves the conversation, its presence row in the product's conversation — a quick-fix's keeping the place the conversation is in, for its close or cancel to put it back there; and commits. Answers `{work_unit, work_type, seeds, roadmap, session_log, brief?, product_session_closed, committed, next}`: `next` for an epic `enter discovery {name}`, with `--move` from the product's conversation, for a quick-fix its skill invoked in this conversation, for a feature or bugfix the handoff to its first phase. Refused with nothing staged (`render start-this-work --file <payload.json>` stages it), where the staged payload no longer holds against the project, and where the picture was rewritten after its thinned draft — draft the thinning again from the picture as it stands, then stage again; the stage refuses that too.

### `approve-map`

```text
approve-map yes <work-unit>
approve-map strike <work-unit> <n>
approve-map unstrike <work-unit> <n>
```

The authority gate at the end of an epic's shaping: the person's yes lands the map. Its screen is `render approve-map <wu>`; Claude's payload, staged with `--file`, is `{topics, parks?, binds?}` — every live topic in order, foundations first (one on the map by name alone, a new one `{name, summary, brief, description?, from_roadmap?}`), roadmap parks `{name, summary, horizon, sources, kind?}`, and binds of the roadmap items the epic started from to staged topics. The screen names each of the epic's points from before that nothing places by citing its id: no staged topic's brief, summary of a park staged or of the roadmap item an approval before parked (`origin` `park:{wu}`), direction not taken in the epic's logs, message waiting in a topic of the map, nor question asked as the point (`from_before`), answered or on a staged topic. After the sweep, `render approve-map <wu> --sweep` stages the map with the sweep's candidates instead.

- **`yes`** — writes each new topic and its brief, orders every topic from 1, parks and joins the roadmap items, closes the epic's discovery session, records `phases.discovery.approved_at`, and commits. Answers `{unit, topics, added, parked, bound, session_closed, committed, next}`, `next` the epic's menu; after the sweep it adds `candidates` and `struck`, and `next` is the epic's menu where a topic is no longer decided, else `continue`. Refused with nothing staged, and where the staged map no longer holds (a live topic left out, a struck name, a park with no horizon — the horizon is the person's, `render horizon-pick --park <name>`).
- **`strike`**, **`unstrike`** — strike the n-th of the sweep's staged candidates, or undo it. Answer `{unit, struck|unstruck, next}`, `next` the screen again.

### `decided`

```text
decided yes <work-unit> <topic>
decided strike <work-unit> <topic> <n> [--page]
decided unstrike <work-unit> <topic> <n> [--page]
decided stage <work-unit> <topic> --file <payload.json>
```

A topic's close, the person's yes at the decided gate. Its screen is `render decided <wu>.<topic>`, which stands once decided's checklist is closed, nothing new has come to the topic since, and the close is not yet taken. Claude's payload, staged with `render decided … --file`, is `{lines: [{text, why, widens}], withdraws?: [{line, why}], candidates: [{name, reason, brief, from_roadmap?}]}` — product-record lines each widening a decision on the topic's map, withdrawals of record lines, and new topics for an epic (for a one-topic unit each candidate `{name, reason, horizon}`, parked on the roadmap). A feature's topic has no gate: it closes into its spec through `stage`.

- **`yes`** — lands each line as a product-wide question and the person's decision at the unit's level, each withdrawal as the person's replacement of its line, each candidate not struck onto the map (or the roadmap), marks the discussion completed, and commits. Answers `{unit, topic, decided, lines, withdrawn, candidates, struck, committed, next}`: `next` the spec once every live topic is decided, else the epic's menu. Refused while a verdict is still to ask, while a record line widens a decision replaced since and nothing staged settles it, and where a staged line or candidate can no longer land (stage it again with `--file`).
- **`strike`**, **`unstrike`** — strike the n-th staged candidate, or undo it. Answer `{unit, topic, struck|unstruck, next}`, `next` the screen again.
- **`stage`** — a feature's close into its spec: stages the payload as `--file` does. Answers `{unit, topic, lines, withdrawals, candidates, next}`, `next` the handoff into the spec while none has landed — a spec written while the close stood voided among them — else `continue`.

Each refusal opens on its command, writing nothing: a topic not in progress, the checklist open, taken or voided since, and nothing staged, naming the call that stages it.

### `checklist`

```text
checklist show <checklist>
checklist done <checklist> <item>
checklist skip <checklist> <item> --reason "<text>"
checklist close <checklist>
  <checklist>: decided <work-unit> <topic> | ready-to-build <work-unit> | phase-start <work-unit> <N> | phase-close <work-unit> <N> | finish <work-unit> | directive <id>
```

The checklist of a closing point: Claude works its items in any order, each done or skipped with a reason, and closes it once none is open. The engine's items are worked out at every call and never kept; Claude marks the rest. The record sits on the manifest of the work it closes, under `checklists` (`decided.{topic}`, `ready-to-build`, `phase-{N}-start`, `phase-{N}-close`, `finish`; the project's `directive.{id}`). A mark counts only once made after the last close, so a checklist closed again is worked afresh.

| Point | Items (the engine's in italics) |
|---|---|
| `decided <wu> <topic>` | *`questions-closed`*, `closing-pass`, `decisions-entered`, `replacements-checked`, `conflicts-read`, `findings-rerun`, *`mailbox-empty`*, `product-lines-shown` |
| `ready-to-build <wu>` | *`topics-settled`*, *`sweep-run`*, `replacements-checked`, *`statements-traced`*, *`review-settled`*, *`phases-complete`*, `invariants-checked`, *`sections-drawn`*, *`assets-linked`*, *`environment-recorded`* |
| `phase-start <wu> <N>` | *`tasks-written`*, `design-settled`, *`relies-on-done`* |
| `phase-close <wu> <N>` | *`tasks-passed`*, *`phase-review-passed`*, *`scenarios-reported`*, *`notes-consolidated`*, *`stack-merged`* |
| `finish <wu>` | *`review-passed`*, *`questions-answered`*, *`notes-answered`*, *`inbox-closed`*, `build-log-closed`, *`records-indexed`* |
| `directive <id>` | *`check`* |

An item applies only where the unit has its step: `sweep-run` with more than one live topic, `review-passed` where there is a review phase, `notes-answered` at a quick-fix with no review asked for, `records-indexed` where the knowledge base is set up.

- **`show`** — `{unit?, checklist, closed, items: [{key, text, by, state, reason?, at?, way?}], skips}`: `state` `done`, `skipped` or `open`; `way`, on an open engine item, what stands in its way and the way on; `skips`, those its gate shows. Takes no lock.
- **`done`**, **`skip`** — Claude's mark of an item; `skip` needs `--reason`. Answer `{unit?, checklist, item, state, reason?, at, committed}`. Refuse an item the engine checks.
- **`close`** — records the close, answering `{unit?, checklist, closed, branch?, committed}`. Refused while any item is open, naming each; phase 1's close until the verify setup is recorded; a decided close while an experiment of the topic is still out; ready to build's while `spec.md` holds changes not landed (`spec land {wu}`). A directive's close records the directive as run, so the next boot runs past it. The first close of a phase's start makes the unit's own branch, `feat/{wu}`, where an epic or feature builds two or more phases (`branch`); each later start's close brings the default branch into it. A conflict refuses the close, the merge begun in a worktree it names for the person to settle; close again once settled.

Each write commits the manifest it wrote, a phase's close with its folder's reports and settlement. Refused: a unit, topic or phase the project lacks, and a phase's start before the build has begun (ready to build's yes begins it).

### `sweep`

```text
sweep take <work-unit>
```

The sweep's report taken in, once, before an epic's spec.

- **`take`** — reads the report the sweep's agent wrote at `.cache/{wu}/specification/sweep.json`, `{candidates: [{name, reason, brief, from_roadmap?}], messages: [{topic, text}], builder_calls: [{call, why}]}`; sends each message to its topic (reopening a decided one), writes the sweep taken at `{wu}/sweep-taken.json` (each builder's call given its id, `call-N`, the cite a spec line left to the builder names), commits it, and stages the candidates for approve the map. Answers `{unit, sent, reopened, candidates, committed, next}`: `next` `render approve-map {wu} --sweep` where a candidate was staged, else the epic's menu where a topic is no longer decided, else `continue`. Each refusal opens `sweep take: `, nothing sent: a unit past its spec, a sweep taken already, a live topic not decided, one live topic alone (no sweep owed), and a report that does not read, every fault named.

### `spec`

```text
spec land <work-unit>
spec marks <work-unit> --file <marks.json>
spec page <work-unit>
spec published <work-unit> <url>
spec push <work-unit> --store <dir> [--reason <line>] [--from <ids>]
```

The unit's spec, `{wu}/spec.md`, which Claude writes and the engine reads, checks and commits. Its grammar — areas `## N. Title`, parts `### N.M`, statements `N.M.K`, scenarios `N.Sk` in each area's `## N-S.` block, screens, and the source bracket each line closes on — is `domain/spec-sections.cjs`'s. A line traces where each cite in its bracket resolves to a current decision or finding of the unit, or a builder's cite to a "don't care" decision or a call the sweep left to the builder.

- **`land`** — the one route by which the spec reaches the state branch: checks `spec.md` and commits it with the asset and spike files it links, recording the land's print (`.cache/{wu}/specification/landed.json`). Answers `{unit, statements, invented: [{number, why}], changed, committed}`: `invented` each line that does not trace (ready to build's `statements-traced` stays open until none), `changed` each section that changed. Each refusal opens `spec land: `, nothing committed: a concluded spec (a later change replaces its entry on the ledger), a unit `enter specification` refuses, an epic whose sweep is not taken or whose sweep's candidates wait at approve the map, a spec whose grammar does not read (every fault, a line each), and, while the review page is open, a number the page holds changed (a line added takes the next free number).
- **`marks`** — stores the marks read back from the open review page at `.cache/{wu}/specification/marks.json`. Answers `waiting`, the comments waiting for Claude: `[{number, id, doc, wording, conversation}]`. Refused for a page not published. Ready to build's yes writes the review's record, `{wu}/spec-review.json`.
- **`page`** — builds the review page and its store's first writes at `.cache/{wu}/specification/page/`, for Claude to publish as a private artifact. Answers `{unit, page, title, icon, capabilities, lines, batches}`; send each batch file in order with ArtifactData's batch writes. Refuses a document over the store's limit (split the section).
- **`published`** — records the published page's address, which opens it. Answers `{unit, url, at, read_back}`, `read_back` the file Claude reads the page's marks back to. Refuses a unit with no page built, and an address that is no URL.
- **`push`** — after a re-land, plans the writes that bring the change to the open page without republishing it, from `--store`, a folder holding the store's listing. Answers `{unit, url, change, resumed, batches, existing}`: `existing` the documents written with `if_version`. Refuses lines changed with no `--reason`.

None but `land` commits.

### `cut`

```text
cut <work-unit> [--file <cut.json>]
cut <work-unit> --migrating --file <plan.json>
```

The phase cut, written onto the unit's manifest as `cut`, its one writer. The file — where none is given, the one the cut's agent staged at `.cache/{wu}/specification/cut.json` — holds `{"phases": [{name, goal, scenarios, sections, relies_on}]}` in build order: `scenarios` by id (`N.Sk`), `sections` by address (`N` or `N.M`), `relies_on` an earlier phase's number or another unit's name. Every scenario of `spec.md` is placed in exactly one phase. A second cut replaces the whole cut until a phase has started, then only the phases after the last started. Commits the unit's manifest. Answers `{unit, phases, committed}`. Each refusal opens `cut: ` and names every fault, writing nothing: nothing staged (the cut's agent writes it at the path named), a scenario or section `spec.md` lacks, a scenario placed twice or not at all, a phase relying on itself or a later one, a started phase changed, and a spec whose lines do not read.

**`--migrating`** is the migration's cut of a unit whose building started, from a plan `{phases, scenarios, notes, corrections, answers}`: it adopts the tracker's phases, ends the tasks a correction ends, writes the scenarios into `spec.md` and the notes into `build/notes.md`, and writes the manifest's `cut` and `build`, its commit held for the migration's; last its mark, `.cache/migrate/cut/{wu}.json`. Answers `{unit, phases, built, adopted, typed, corrections?, ended?, scenarios, notes, committed: null, note}`. Refused outside the migration, for a unit cut already, for specs the move did not join, and where the plan, the tracker and the spec disagree, each fault named with its way on.

### `ready-to-build`

```text
ready-to-build yes <work-unit> --position auto|step [--marks <file>]
```

The spec's gate, raised once per spec. Its screen, `render ready-to-build <wu> [--page] [--calls] [--alone]`, stands on the landed spec, ready to build's checklist closed with nothing landed or cut since, and the drivers' tools fine (where one is not, the drivers' stop is drawn instead; where the project lands through GitHub and the squash default's offer was never answered, the offer, `github-squash`). A feature's carries its topic's close, staged by `decided stage`; a bugfix's its investigation's recap as its close keeps it, `investigation stage`'s — the symptoms from its log, the root cause and the fix in their entries' words — refused where either has been replaced since. Each departure among the spec's answers, a feature's topic's and a bugfix's investigation's first, at `decided` and `conclusion`, is asked its verdict first, the screen drawn whole once and, with `--alone` after a verdict, the next verdict or the gate alone; then the gate: `a/auto` (recommended), `s/step`, `r/review` (the review page, with `--page`), `c/calls`, Comment.

- **`yes`** — the person's pick of position: concludes the spec (`spec land` refuses from then on), writes `build: {position}` and any driver setting the project lacks, closes the map for good, and commits. While the review page is open it takes the page's marks (`--marks`, the read-back file) and refuses while a comment waits for Claude, listing each (Claude answers each beneath its line, then shows ready to build again); else it writes the review's record, `{wu}/spec-review.json`. A feature's yes takes its topic's close as `decided yes` does, adding `decided`, `lines`, `withdrawn`, `candidates`, `struck`, `parked`. A bugfix's concludes its investigation, adding `concluded`: it completes the investigation item, stamps `concluded_at`, records what the bug is in as staged (`fixes`, `area`, and `after_review` for the unit named), and records the close taken; what the bug is in no longer holding refuses it, naming the restage. Answers `{unit, position, record, committed, next}`, `next` the handoff into the build. Refusals open `ready-to-build yes: `: the screen's own, a driver's tool not fine, a verdict still to ask, an open page with no marks given, and marks given with no page open.

### `finish`

```text
finish yes <work-unit>
```

The authority gate after the review phase's report, and a quick-fix's close. Its screen, `render finish <wu> [--alone]`, stands on finish's checklist closed with every engine item holding, the review over where the unit has one; it draws no checklist skip. Each departure in the build and review is asked its verdict first, the screen drawn whole once and, with `--alone` after a verdict, the next verdict or the gate alone; then the gate: `y/yes`, Comment, and at a quick-fix `r/review` (`review ask`) while none is asked, and Ask.

- **`yes`** — lands every phase still standing as `land finish` does, the review's fix phases last, then the unit's own branch on the default branch (a quick-fix's one pull request squashed, its worktree taken apart, and `fix/{unit}` deleted in each repository where it holds nothing past the landing branch, or stands at a tip its landing records hold, and every commit past the landing branch that it or its reflog holds is a task's through the door — kept where a commit of the person's sits below that tip or a readying left one off; where the person's checkout has the landing branch out with uncommitted changes the landing touches, a landing through the code host stands, the line after its JSON naming that branch behind, what stops it there, and the call that brings it up, and the local driver's refuses, nothing moved; its branch conflicting with the landing branch refuses, nothing moved, naming a one-line task `merge {branch}` that runs `git merge --no-ff --no-commit {branch}` in the worktree — `git -C {folder}` for a nested repository, each settled file named under its folder — and commits the merge through the door, the task's own work), then completes the unit: `status: completed`, `completed_at`, its scratch layouts and cache taken apart. Answers `{unit, landed, completed_at, committed, next}`, `next` `continue`: the conversation leaves the unit's place and its tasks in flight, its session's own label back — a quick-fix's put back where its start was made, as its cancel puts it — and no menu is drawn. For any unit but a quick-fix, its receipt, after the JSON, is one line saying the work is done and what waits on the person — each unit's count, the verdicts, the inbox — with the menu one `/ledger` away. A refused landing leaves the unit in progress with what merged before it; the yes run again picks up where it stopped. Refusals open `finish yes: `: the screen's own (the review not over, the checklist open or failing since its close, a quick-fix's fix not ended or without its record, a question still open), a verdict still to ask, and a quick-fix's worktree holding uncommitted changes, nothing landed (what is the unit's goes in a fix of its own, the rest is put back).

## The build and the review

### `task`

```text
task phase <work-unit> <N> --title <title>
task create <work-unit> <N> --file <path>
task create <work-unit> <N> --title <line> --type <type> --why <reason>
task add <work-unit> <task> --file <path> --by <orchestrator|person>
task type <work-unit> <task> <type>
task close-plan <work-unit> --parent <tracker-id>
task link <work-unit> <task> --after <task>
task unlink <work-unit> <task> --after <task> --file <plan.json>
task ready <work-unit> [<N>]
task start <work-unit> <task>
task done <work-unit> <task>
task close <work-unit> <task> --reason <reason>
task list <work-unit> <N>
task show <work-unit> <task>
task worktree <work-unit> <task>
task stopped <work-unit> <task>
task account <work-unit> <task>
task review <work-unit> <task> --reviewers <1|2> --file <why>
task settle <work-unit> <task> --file <why>
task settle <work-unit> --phase <N> --file <why> [--fixes <task>,…]
task note <work-unit> --file <note> [--phase <N>]
```

The build's tasks. **The tracker's verbs** are the only way Ledger touches a tracker, through the project's task driver (`drivers.task`, written as the default by the first verb needing it). A verb names a task `{phase}.{n}` beside its unit; its internal id, `{unit}-{phase}-{n}`, is the lasting one, in commit subjects, branch names and trailers. A verb that writes commits the tracker's store on the state branch. A tool the driver needs that is missing, too old or failing refuses the verb, naming it (**`drivers`**).

- **`phase`** — writes a phase into the tracker as it starts. Answers `phase`.
- **`create`** — a task of a written phase from the task template in a file, every fault named at once; or, with `--title`, `--type` and `--why`, a one-line task, the orchestrator's own work, with no builder, reviewed by none by its shape, its `review.json` written with it, `--why` its reason for making it so. Answers `{task, id}`. Refused for a phase not written, naming `task phase`, which writes it first; and for a phase whose stack has landed, but a quick-fix's.
- **`add`** — an addition onto a task not yet ended, `--by` the orchestrator or the person. Once a round has been briefed it marks the task changed, so its reviewers read it again (or its builder is briefed again) before its account. Answers `{task, id}`.
- **`type`** — gives a task another type. Answers `{task, id, type}`.
- **`link`** — holds a task after an unfinished one of its phase or an earlier one. Answers `{task, after}`.
- **`ready`** — the tasks waiting with nothing before them and no question parking them: `{tasks: [{task, id, title}], back?}`, `back` (in step, or in a quick-fix's worktree) the freed task whose turn has come.
- **`start`** — puts the task in progress and in flight on the conversation's position. Refused before the phase's start checklist closes, and in step (or in a quick-fix's worktree) while another task is in flight or at its gate. A quick-fix's first start lays out its worktree, `.claude/worktrees/ledger-{unit}` of the main checkout, on `fix/{unit}`, nested repositories with it, and runs the setup's worktree steps once, outside the writer lock (`prepared`; they can take minutes — wait for a backgrounded call, never call again meanwhile); its close and its cancel take it apart, a park leaves it. Each start answers `branch` and `worktree`, and `put_back` or `cut_again` where it applies; the person's checkout never moves while the fixes are built. Answers `{task, id}`.
- **`done`** — ends the task done. Refused while a question parks it (`raise draw <unit> Q{n}`), before its account is taken — for a one-line task, which owes none, until its branch holds a commit of its own through the door, on a quick-fix's branch a merge counting only where everything it brings in is held by the branch the quick-fix lands on, here or as last fetched, or by the code host's copy of the quick-fix's branch as last fetched — for a bugfix's task 1.1 until its test proves the bug (`verify run … --unfixed`), and for a quick-fix's fix with no commit of its own, a merge read by that same rule (close it as met), not yet in the pull request (`land open`), or leaving the quick-fix's worktree uncommitted. Answers `{task, id, removed?, next?}`, `removed` the child worktrees taken apart, `next` (`render finish {unit}`) where the last fix task ends a quick-fix's review the person asked for: run it.
- **`close`** — ends the task without it being done, `--reason` kept; takes it off every question parking it (`unparked`). Never for a bugfix's task 1.1, nor a quick-fix's fix holding work of its own (its change is given up by a fix of its own that reverts it). A quick-fix's fix closed keeps its set-aside work, `kept_aside`. Answers `{task, id, removed?, unparked?, next?}`; `next` is the phase's mutation run where it ends its phase, and `render finish {unit}` where the last fix task ends a quick-fix's review the person asked for: run it.
- **`list`** — a phase's tasks: `{phase, tasks: [{task, id, title, status}]}`, status `open`, `in-progress`, `done` or `closed`.
- **`show`** — the task whole: `{task, id, title, status, type, text, additions, after, reason}`.
- **`worktree`** — the builder's, run in its isolation worktree: checks out the task's branch, child repositories with it, records the worktree on the position, and runs the setup's worktree steps (`prepared`; they can take minutes — wait for a backgrounded call, never call again meanwhile). Answers `{task, id, branch, worktree, repos, taken_over?, recorded, prepared?}`. Refused outside a task in flight in this conversation, in the project's own checkout, for a task with no type (`task type`), and where the branch is out in another worktree, naming it and the way on. For a one-line task, the orchestrator's, run from anywhere: lays the whole project out at `.claude/worktrees/ledger-{unit}-{task}` of the main checkout, prepared as an isolation worktree, taken apart as the task ends; refused for a quick-fix's.
- **`stopped`** — the orchestrator's, as a builder stops unable to build past a problem: holds the stop on the position until the next builder or fix brief, or a raise parking it. Writes nothing to the state. Answers `{task, id, stopped}`.
- **`close-plan`**, **`unlink`** — the migration's alone: `close-plan` closes the plan of a unit that built nothing, or of a cancelled one, whose done tasks stand (`{parent, closed}`); `unlink` takes off a link the migration's cut refuses (`{task, after}`).

**The build's records**, each committed with what it took:

- **`account`** — takes the task's account, `build/tasks/{task}.md` with every round's reports, `build/tasks/{task}/round-{N}-{letter}.md` (the formats `domain/task-account.cjs`'s and `domain/round-report.cjs`'s), and the task's figures, `build/tasks/{task}/figures.json`. Answers `{task, id, rounds, figures, settled?}`. Refused for a one-line task, while a question parks the task, while its last round neither passed nor was settled, where it changed after its last round passed (its reviewers read it again first), and where the account or a report does not read, every fault named.
- **`review`** — the orchestrator's choice of how many reviewers read the task, one or two, with why, at `build/tasks/{task}/review.json`; with none recorded, the kernel's two. One reads by `a` alone. Answers `{task, id, reviewers}`. Refused once the task's first round is briefed, for a count other than one or two, and for a one-line task, reviewed by none by its shape.
- **`settle`** — the orchestrator's settlement of a task's failed last round, written beside its reports (`{task, id, round}`); with `--phase`, of a phase's failed review, naming its fix tasks in `--fixes`, at `build/phases/phase-{N}/settlement.json` (`{phase, fixes}`). Refused where the round passed, or the review is not complete or passed.
- **`note`** — a note for later into `build/notes.md`, `## Note {k}`, held for a phase not yet written with `--phase`. Answers `{number, phase?}`.

### `land`

```text
land open <work-unit> <phase>.<task>
land chain <work-unit> <phase>.<task>
land phase <work-unit> <phase>
land finish <work-unit>
```

A task's change landed through the project's landing driver (`drivers.landing`; where unset the first verb writes the driver serving the project's remote, else the local one, and commits it). The names, one form for every driver (`domain/landing-names.cjs`): a task's branch `{type}/{unit}-{phase}.{n}-{slug}`, made by whoever makes the branch; a phase's `feat/{unit}-phase-{phase}`; the unit's own `feat/{unit}`; a quick-fix's `fix/{unit}`; a task's pull request and squash commit `{type}({unit}): {title}` with a `Task: {internal-id}` trailer. Work lands on the landing branch of each repository the task touches, children first: the unit's own branch where it has one (an epic or feature building two or more phases), else the default branch.

What has landed is read from git and the host every time, by content, one rule for every driver (`domain/task-landed.cjs`): a task's landing point, and whether its work holds a change past it. The unit's manifest keeps each task's landing as `landings` — the engine's alone, which `manifest` refuses. A task changed after its landing lands its change at the next `phase` or `finish`.

- **`open`** — opens the task's pull request in every repository its change touches (a local driver needs none). Answers `{task, branch, already?, repos}`, `already: true` once it has landed. Refused while a question parks the task, before its review's account is taken (`task account`), for a bugfix's task 1.1 until its bug is proven, for a branch that changes nothing, and for a branch that does not descend from its chain's tip. A quick-fix's `open` pushes its one branch and opens, or pushes to, its one pull request, titled `{type}({unit}): {description}`; it adds `cut_again`.
- **`chain`** — chains an opened task into its phase's stack. Answers `{phase, repos, next?}`, `next` the phase's mutation run (`verify mutants`) where the task is its phase's last. Refused for a task its reviewers have not passed (a one-line task until it is built), and for a quick-fix (no stack).
- **`phase`** — merges a phase whole, finishing any stack merged in part by hand. Answers `{phase, already?, repos}`. Refused, for a phase of the cut, until its phase review has passed and its fixes are done (a failed review needs `task settle {unit} --phase {N} …`); for a fix phase, while a task of it is neither done nor closed.
- **`finish`** — merges every phase still standing, the review's fix phases last, then lands the unit's own branch on the default branch by one merge commit (on GitHub through its pull request, merge commits allowed). Answers `{repos}`. Refused exactly as finish's yes refuses.

Each `repos` entry names its `repo` (`.` the project's own) beside what the driver answered; the answer itself carries `driver`, and `committed` and `warnings` where it has them. Every refusal opens `land: ` and names its way on, the git command to run where one is owed: a branch that moved apart from where its work landed (rebase it onto that commit), a merge past its landing (make the branch again without it), a conflict with the landing branch (merge or rebase, settle, land again), a host's copy holding work the branch lacks (`git pull --rebase`; for a quick-fix, where it conflicts, a merge of it in the quick-fix's worktree committed through the door, under the task in flight, else a one-line task of its own), a branch holding another task's work not landed (land that first), and a bring-up merge held in a worktree (settle it there, then the step that began it). Run again, a verb picks up where it stopped.

### `brief`

```text
brief builder <unit> <task>
brief reviewer <unit> <task> [--base <branch>] --letter <a|b>
brief fix <unit> <task>
brief product-researcher
brief deep-dive <unit> <topic> --question <id> --agent <id> --kind <survey|read|feasibility|landscape|verify> [--path <file>]
brief perspective <unit> <topic> --question <id> --agent <id>
brief synthesis <unit> <topic> --agent <id>
brief discussion-reviewer <unit> <topic> --agent <id>
brief closing-pass-reader <unit> <topic> --agent <id>
brief plain-search
brief migration-topic --topic <unit.phase.topic> --directive <id>
brief migration-verifier --topic <unit.phase.topic> --directive <id>
brief migration-phase <unit> --directive <id> --phase <N>
brief migration-phase-verifier <unit> --directive <id> --phase <N>
brief phase-cut <unit>
brief sweep <unit>
brief spec-writer <unit> [--wording <file>]
brief spec-reviewer <unit> --agent <id>
brief task-writer <unit> <N>
brief consolidation <unit> <N> [--base <branch>]
brief phase-review <unit> <N> [--base <branch>] --letter <a|b>
brief review-area <unit> --area <N> --base <branch> --letter <a|b>
brief test-surface <unit> --base <branch>
brief root-cause-validation <unit> --agent <id>
brief fix-validation <unit> --agent <id>
brief guard                        (hook before Agent and SendMessage; its JSON on stdin)
```

A brief for one of Ledger's own agents (`agent` in the answer names which), filled by the engine from its template (`content/briefs/{role}.md`) and the records the role draws on (each record's form is `domain/brief-records.cjs`'s), and stored in the conversation's folder, `briefs/{id}.md`, with `{id}.json` naming whose it is. The dispatch carries the pointer, `brief:{id}`, alone, as the Agent prompt or the SendMessage message; `brief guard` puts the brief in its place. A flag carries a name, an id or a path, never text: what else an agent should know goes onto the task (`task add`) or into the ledger.

Response `{id, role, agent, pointer}`, with `committed` where reading the tracker committed its set-up, and `warnings`. Refused, nothing stored: no session id; a flag missing, repeated or not the role's; a unit, topic or task the project lacks or has set aside; a task done or closed, or waiting behind the task in flight; a phase not yet written; a spec reference citing a section the spec lacks; and, per role, the record it cannot draw, each refusal naming its way on.

**The build's**, for a task (`<unit> <task>`, as `{phase}.{n}`) or a phase of the cut (`<unit> <N>`):

- **`builder`** — the task's builder. Takes a stop off the task. Refused for a one-line task, the orchestrator's own.
- **`reviewer`** — `--letter` one of the task's reviewers, for the round. Refused where that report is in already, once the task's review is over, for a letter beyond the reviewers `task review` recorded, and for a one-line task.
- **`fix`** — the last round's reports, sent to the builder by SendMessage. Refused where no builder was briefed in this conversation, or the task changed since (send the builder its brief first).
- **`task-writer`** — writes a phase's tasks.
- **`consolidation`** — the phase's notes against its tasks.
- **`phase-review`** — the phase's review; `verify mutants` runs first.

**The review phase's**, of the round under review:

- **`review-area`** — one area of the spec; a quick-fix's one area is the change.
- **`test-surface`** — every scenario against the change's tests.

**A topic's discussion**, each `<unit> <topic>`, `--agent` the dispatch `agent dispatch` answered:

- **`deep-dive`** — the dive's `--kind` (`--path` the file a `read` reads).
- **`perspective`**, **`synthesis`**, **`discussion-reviewer`**, **`closing-pass-reader`** — a lens on the question, its pair's synthesis, the topic's gap review, and the closing pass.

**The spec's**, each `<unit>`:

- **`sweep`**, **`phase-cut`** — the sweep before the map's approval, and the spec's phase cut.
- **`spec-writer`** — `--wording` the wording the person agreed. Refused while a gap waits on the person, naming the raise that puts it to them.
- **`spec-reviewer`** — the sections changed since the last pass. Refused where the spec has not changed since the last pass, or changed since it landed (`spec land` it).

**A bugfix's validations**, `<unit> --agent <id>`:

- **`root-cause-validation`**, **`fix-validation`** — the root cause, and the fix with the question it answers.

**Others**:

- **`product-researcher`** — drawing on nothing.
- **`plain-search`** — the conversation's last `knowledge query`.
- **`migration-topic`**, **`migration-verifier`** — the migration's agent and verifier for one topic's record (`--topic`, `--directive`): the topic, its specs and the unit's approved specs it does not draw on, the later answer to its points, each approved one with the date its old manifest gives it, the project's other units cancelled, a corrigendum one wrote no later answer, every file of the unit's assets but a dotfile and the topic's specs, with where it came from — those the record walks, its markdown files but its specs and legacy files, a split's research walked by the topic bearing its name alone, else by the unit's own record, apart from the rest, one its own files hold word for word among the rest, and the imports it owes a link — the other topics with what each is about, each of its sources holding a heading with text its own words name none of alone with those headings as a cite names each, the verifier's findings and every round's rulings, the carry's refusal, the points the session settled and the directive, every file it reads or writes named by its whole path; the verifier's its composed record, the walk sheet — each source's sections in order by heading path and lines, with every entry citing each, the topic's own markdown files but its mail, its specs, the discovery sessions, the unit's assets it walks and any other file an entry cites, of a file it does not walk only the sections cited, of a discovery session or an asset no section its own files hold word for word — a section whose text is one line under 40 characters never held so — that no entry cites, a file holding no section to walk left out; from the second round each entry marked passed unchanged, changed, new or not passed, a section an earlier round walked closed, every entry citing it passed unchanged and none that cited it then gone from it, and each entry removed since the last round listed with its cites — and every round of findings and rulings. The verifier's brief notes the record it reads, `{topic}.verifying.json`: its hash, the entries it gives a verdict on — those not passed unchanged — each entry hashed and its event, text and cites, the sections it walks and what the rounds before left, a round counting once its verifier has written its findings and an entry it names `see finding`, asked of or not, left unpassed. It, and the per-topic agent's after it, are refused while findings handed back stand, or once that verifier has written findings while its verdicts miss an entry it was asked of or name one the record it read does not hold.
- **`migration-phase`**, **`migration-phase-verifier`** — the same for one phase of a building unit's cut (`--phase`). The verifier's brief draws what changed in the piece since the last verifier to write its findings read it — each field of its phase, and each scenario, note and correction added or removed — keeping the piece it reads, `phases/{N}.verifying.json`, which becomes `phases/{N}.verified.json` once that verifier writes.

**The hook.**

- **`guard`** — Claude Code's hook before Agent and SendMessage. A call reaching a `ledger-*` agent must carry a pointer alone; the hook puts the stored brief in its place (`updatedInput`). It refuses (exit 2), logging a line to `{config}/brief-refusals.jsonl`, a call with no pointer, a brief this conversation never issued, a field holding anything beside the pointer, and a brief issued for another agent. Any other call passes, silent.

### `agent`

```text
agent dispatch <work-unit> <phase> <topic> --kind <kind> [--label <slug> …] [--set <NNN>] [--final]
agent scan     <work-unit> <phase> <topic>
agent ack      <work-unit> <phase> <topic> <id> (--findings <F1,F2,…> | --clean)
agent surface  <work-unit> <phase> <topic> <id> <finding>[,<finding>…] [--replaces <decision> --reason <reason> | --question <question>]
agent incorporate <work-unit> <phase> <topic> <id>
```

The background agents of a topic's phase, kept at `.ledger/.cache/{wu}/{phase}/{topic}/state.json` beside the files they write. A unit's own agents, the spec's, use `<phase> <topic>` as `specification <wu>`. An agent's report file, once it exists and is non-empty, is its completion. Kinds: `review`, `deep-dive`, `perspective`, `synthesis`, `root-cause-validation`, `fix-validation`, `closing-pass`, `spec-review`. `ack`, `surface` and `incorporate` answer `{work_unit, phase, topic}` and the agent's row: `status`, `set`, `created`, `findings`, `surfaced`, `remaining`, and for a spec review `for_writer`, its rewrite findings handed to the writer whole.

- **`dispatch`** — records the agents in flight and answers the report path each must write: one agent `{work_unit, phase, topic, kind, set, id, file}`; several `--label`s (a perspective pair among them) `agents: [{id, file}]` in place of `id` and `file`. A repeated `--label` dispatches one set under one number; a perspective is one polarity pair of lenses; a synthesis joins a finished perspective set by `--set`. A discussion review is refused while the topic's mailbox holds messages, and until enough moves have landed on the ledger since the last review (`scan`'s `review_arming` says how many); `--final`, a review the person asked for, waives the count.
- **`scan`** — moves finished agents to `pending` and answers the rows by status, `in_flight`, `pending`, `acknowledged` and `incorporated`, each a list of rows, and on a discussion topic `review_arming`: `{armed, cycles, moves_seen, moves_needed, reason}`. A spec review whose report does not read is closed and answered under `refused`, `[{id, refusal}]`: dispatch another pass, its brief carrying the refusal.
- **`ack`** — records the finding ids read from the report, or `--clean`, which closes the row. A spec review is acknowledged with exactly the findings its report holds; the refusal names them.
- **`surface`** — records findings surfaced to the person; the last closes the row. `--question <id>` links one finding to the question it was asked as; `--replaces <decision> --reason <reason>` raises one as that decision's replacement.
- **`incorporate`** — closes the row, findings not surfaced left as declined; from in flight it closes it unread. A row closed already answers as it stands, so every row is closed with `incorporate` whatever closed it first. A spec review whose report reads is refused until acknowledged.

### `verify`

```text
verify run <work-unit> <scenario>
verify run <work-unit> <scenario> --unfixed --test <command>
verify setup <work-unit> --file <setup.json> --scenario <scenario>
verify mutants <work-unit> <N>
```

The proof by running the product, through the verify setup recorded on the project manifest (`environment.verify`). Each verb runs the setup's parts by `sh -c` in the calling checkout's code root, with no timeout of the engine's own and no lock held while they run: give the Bash call a timeout to match. Every part gets `LEDGER_RUN`, a fresh folder outside the project; a scenario's run also `LEDGER_SCENARIO`. A run proves committed code: a checkout holding uncommitted changes, or files the parts leave behind, is refused, each file named (ignore it, have the cleanup remove it, or write it under `$LEDGER_RUN`).

- **`run`** — runs a scenario of the cut (a quick-fix's, one its fix owns): `launch`, `health`, `drive`, `evidence`, then `cleanup` whatever came before. The drive writes its verdict to `$LEDGER_RUN/verdict` — `pass`, `fail` or `skipped` — never its exit code; text evidence goes in `$LEDGER_RUN/evidence/` (64 KB a file), recordings in `$LEDGER_RUN/recordings/`. Records `{wu}/build/runs/{scenario}/run-NNN.json` (`{verdict, unfixed, at, checkout, commits, task, evidence, recordings}`), recordings kept in the unit's cache by hash, and commits the run. Answers `{unit, scenario, verdict, run, standing, committed}`, `standing` `proven`, `not proven` or `named, not run` at the commits it ran against.
- **`run … --unfixed --test "<command>"`** — a bugfix's proof of its bug: runs task 1.1's reproducing test on the unfixed code in a scratch worktree of the engine's own, up to five times, stopping at the first pass, recording each run. Answers `{unit, scenario, command, runs, proven, committed, way?}`: five failures prove the bug; `way`, where they do not, what comes next.
- **`setup`** — records the verify setup from a file outside the checkout, `{place, feature_map, launch, health, drive, evidence, cleanup, mutation?}`, once its parts run end to end for `--scenario` and the drive writes a verdict. The drive is an executable script under `place` with plain arguments (wrap a tool in a script there). Commits the project manifest. Answers `{unit, setup, committed}`.
- **`mutants`** — runs the setup's mutation tool over the lines phase N changed, at the phase's tips, in a scratch worktree of the engine's own: the tool gets `LEDGER_CHANGED`, `[{path, lines}]`, and writes `$LEDGER_RUN/survivors.json`, `[{path, line, mutant}]`, read whatever its exit code. Kept in the unit's cache for the phase review's brief; writes nothing of the state. Answers `{unit, phase, survivors}`.

Each refusal opens on its command (`verify run: `, …): no setup recorded (`verify setup` first), a scenario none of the cut's, a part that fails (named, with its exit code and output's last lines), a drive that wrote no verdict, a setup naming no mutation tool, and for `--unfixed` a unit that is no bugfix or no work on task 1.1's branch.

### `scratch`

```text
scratch lay <name> <commit> [<folder>=<commit> …]
scratch remove <name>
```

A reviewer's scratch worktree, where the build's reviewers and the review's readers run the tests, make a break and run the product, never in a checkout of the work. Each reader's brief names its two calls. Neither writes the state; the engine takes apart each layout its readers leave once they are done.

- **`lay`** — lays the project out afresh at `.claude/worktrees/ledger-scratch.{name}`, every repository at the commit given (each child `{folder}={commit}`), prepared as Claude Code prepares an isolation worktree, with the setup's worktree steps run there (it can take minutes). Answers `{name, path}`. Refuses a repository given no commit, a commit it lacks, and a step that fails.
- **`remove`** — takes it apart. Answers `{name, removed: true}`.

### `review`

```text
review ask <work-unit>
review round <work-unit> --file <round.json>
review notes <work-unit> --file <notes.json>
review reads <work-unit> <area|tests> [<area|tests> …]
review accept-tree <work-unit>
review restore-tree <work-unit> --listed <print>
```

The review phase's verbs, over its rounds at `{wu}/review/`. Round 1 reads every area of the spec and the test surface; a later round reads what `reads` names. Each refusal opens `review {verb}: `. `round`, `reads`, `accept-tree` and `restore-tree` refuse a unit whose review `enter review` refuses, and where no round is under review, naming why: the phase passed or was settled (finish is next, once its fix tasks and their builders' notes are answered), or the round before's fix tasks are not done (in step, their phase not merged).

- **`round`** — records the round under review from Claude's account, `{can_now, findings, settled?}`: each finding `{area, scope, call, text, from, fix|inbox|drop, ledger?}`, `from` the report items it answers (`{report}#{n}`, a note for later `{report}#n{k}`, a builder's note `notes#{k}`, and in a bugfix's round 1 whose test passed on the unfixed code again, `unfixed#1`), filed as a fix task of the round's fix phase, an inbox item (`inbox file`), or dropped; `ledger` Claude's filing or dropping call where one is owed. Every item of every report is answered by exactly one finding, at no lesser call. Writes `review/round-{N}.json`, its report `round-{N}.md`, and `round-{N}-checks.md`, and commits them with the reports. Answers `{round, passed, fixes, ends, fix_phase?, reads_at_least?, areas, committed, next?}`, `next` a quick-fix's close (`render finish`) where its review is over. Refused where a report is missing or does not read, an item goes unanswered or answered twice, a failing round has neither fixes nor `settled`, a bugfix's round 1 before its test has run on the unfixed code again (`verify run … --unfixed`), and where the working tree outside `.ledger/` changed since the round's snapshot, or no snapshot of it is held (`render review-tree {unit}` asks the person) — a HEAD that only fast-forwarded to landings the engine recorded, as another conversation's quick-fix closing leaves the checkout, is no change.
- **`reads`** — names a later round's reads, each area by its name or `tests`, from what the round before's fix tasks changed. Writes `review/round-{N}-reads.json` and commits it. Answers `{round, reads, committed}`. Refuses round 1, a name no area holds, and a set leaving out an area whose findings made fix tasks.
- **`notes`** — answers the builders' notes standing once the round that ended the review has its fix tasks done, findings as `round` takes them, of the area `notes`. Answers `{round, answered, committed, next?}`. Refused while a round is under review (`round` answers the notes among its items), while the ended round's fix tasks wait (build them first), and where no note stands (finish is next).
- **`accept-tree`** — on the person's word, takes the working tree as it is: the round's snapshot taken again. Answers `{round, snapshot: "taken"}`.
- **`restore-tree`** — on the person's word, puts back what changed under the round that its snapshot proves, copying what each path holds first to `.cache/.set-aside/{unit}/round-{N}/put-{k}/` (never removed by the engine). `--listed` is the change list's fingerprint, as the gate drew it. Answers `{round, restored, kept, set_aside}`. Refused where nothing listed can be put back (put it back by hand, or `accept-tree`).
- **`ask`** — a quick-fix's review asked for at its close: records `fixes.review_asked` and commits it. Answers `{unit, review_asked, next, committed?, already?}`, `next` the review phase's skill invoked in this conversation. Refuses a unit that is no quick-fix built as one, and where finish's own refusals stand, naming them.

### `quick-fix`

```text
quick-fix record <work-unit> <task> --file <record.md> | quick-fix notes <work-unit> --file <notes.json>
```

A quick-fix's own verbs.

- **`record`** — a fix's short record after the work, into the unit's `summary.md` under the fix's title: the file holds `## What changed`, `## Why`, `## Leaves out`, none empty. Records the fix in `fixes.recorded`, commits both, and indexes the summary where the knowledge base is set up. Answers `{unit, task, id, summary, committed}`, `summary` absolute. Refuses a fix closed, recorded already, or holding no commit of its own (write it once the change is committed through the door), and a file that does not read, every fault named.
- **`notes`** — answers the notes for later standing at the close of a quick-fix with no review asked, findings as `review round` takes them, of the area `notes`, each filed to the inbox or dropped by Claude's call. Kept at `{wu}/build/notes-answered.json` and committed. Answers `{answered, committed}`. Refuses a review asked for (`review notes` answers them) and no note standing.

### `environment`

```text
environment show
environment set <run|prepare|concurrency|linters>   (the part's JSON on stdin)
environment confirm [--from manage]
environment concurrency add <work-unit> "<what>"
```

The project's environment setup, `environment` on the project manifest: `run` (`{build?, tests?, run?}`, the commit door running `tests` and each linter before every code commit), `prepare` (steps `{name, when, command}` or `{name, when, note}`, `when` `first`, `worktree` or `both`), `concurrency` (what cannot run at once, `{what, at, by}`), `verify` (the verify setup, which only `verify setup` records), `linters` (`{name, command}`, and `fix`, the command that mends what it finds, where it has one), and `confirmed`, the instant of the person's yes at the setup's screen, `render environment-setup`. Until it is confirmed the engine runs none of the setup's tests, linters or steps.

- **`show`** — the setup whole, `{run, prepare, concurrency, verify, linters, confirmed}`; takes no lock.
- **`set`** — writes one part whole (`run`, `prepare`, `linters`, or `concurrency` as `[{what}]`), its JSON on stdin. Answers `{part, value, committed}`. Refuses `verify` (the task that builds it records it) and `confirmed` (`environment confirm`).
- **`confirm`** — the person's yes at the setup's screen. Answers `{confirmed, committed}`, and with `--from manage`, `next`, manage drawn again.
- **`concurrency`** — `concurrency add <wu> "<what>"` records what the unit's build learned cannot run at once. Answers `{unit, what, at, by, already?, committed}`, `already: true` where it was recorded before.

Each write commits the project manifest; run again over a write that stands it commits what a kill left, else `committed: null`. A setup that does not read is refused, each fault named.

### `drivers`

```text
drivers check
drivers set <task|landing> <name>
```

The project's drivers, `drivers: {task, landing}` on the project manifest; where none is set, its kind's default. A tool a driver needs stands `fine`, `missing`, `older` (below its floor) or `failing`.

- **`check`** — each kind's driver and how its tools stand, writing nothing: `{drivers: [{kind, driver, title, set, tools: [{tool, label, floor, update, found, state, error?}]}], stopped}`, `stopped` where any tool is not fine. Ready to build checks it at its screen and its yes.
- **`set`** — writes one kind's setting and commits it. Answers `{kind, driver, title, was, committed, next}`, `next` the drivers' menu again. Refuses a kind but `task` or `landing`, a driver not shipped, one that does not serve the project's remote, and a build in flight in any unit (change it once that finishes).

## Sessions and conversations

### `presence`

```text
presence beat <work-unit> <phase> <topic>
presence clear <work-unit> <phase> <topic>
presence scan [work-unit]
presence cleanup [session-id]
```

The per-topic heartbeat of the session sitting in a phase, `.ledger/.cache/{wu}/{phase}/{topic}/presence` (the product's at `product/discovery/product`, one for each conversation in it, `presence-{session}`; the migration's at `.cache/migrate/presence`). Awareness, never exclusion. The engine beats it as a side effect of the verbs a session runs on its own topic — the table is `domain/presence.cjs`'s header — so no prose issues a beat.

- **`beat`**, **`clear`** — stamp or drop a row by hand, for tests and repair; a beat needs `CLAUDE_PID`.
- **`scan`** — every row of a unit, or with no unit of the project (`scope: "project"`): `{held, sessions: [{phase, topic, age_seconds, held, session_id, pid, checkout}]}`. `held` means the owning process still runs, however long idle. An empty unit argument is refused (an unset shell variable).
- **`cleanup`** — the SessionEnd hook: drops every row the session owns, its id from the argument or the hook's stdin; never errors. Answers `session_id`, `cleared`.

### `session`

```text
session label <name> [<phase> <topic>]
session label-config <true|false>
session repair
session cleanup [session-id]
session resume [session-id]
```

The opt-in label on the terminal session, `{own} · {work-unit} · {phase} · {topic}`, and the conversation's position, which every `label` records whether labels are on or off. The multiplexer the session runs in labels it, one labeller each behind `domain/session-label.cjs`, in the order the configuration chapter's Session labels gives: the one whose session `$ZMX_SESSION` names, where its `current` command answers, else tmux where `$TMUX` is set. Inside the first, `{own}` is the label's base, the part before its first ` · `, set by its `rename` command; inside tmux it is the session's original name. Each keeps the original in `.ledger/.cache/.session-labels/` (the first's in a folder of its own, keyed by the session's name) and puts it back only while the label is exactly the one it applied, the first resetting to the session's name by `rename` with no text; a rename that fails puts the record back as it stood. A label is a courtesy, never state: inside no multiplexer, with labels off, or on any error of one it labels nothing and says so, never blocking a flow.

- **`label`** — labels the session on arrival at a place: a name alone (a work unit, `roadmap`, `product`), or a name, phase and topic. Answers `labelled`, and where it labelled nothing `reason`: `disabled`, `no-multiplexer`, `{multiplexer}-error` (`tmux-error`, …) or `stash-error`. A phase without its topic, an unknown phase, or a name that is no unit or project identity is refused.
- **`label-config`** — records the opt-in as `defaults.session_labels` and syncs the session hooks in `.claude/settings.json`; commits the manifest on the state branch and the settings file on the branch checked out, holding the settings back where the person has edits of their own there (a warning). Answers `session_labels`, and `warnings`.
- **`repair`** — boot's pass: drops the calling conversation's position (kept for tasks in flight) and puts back the original of a label this session, or a dead one, applied. Answers `repaired`.
- **`cleanup`** — the SessionEnd hook: restores the originals of the session's labels, every labeller's pass run, its id from the argument or stdin; never errors. A label read as the session's name where `$ZMX_SESSION`'s multiplexer applied one is kept for `repair`, since that multiplexer answers the name when it cannot read the session in time. Answers `restored`.
- **`resume`** — the SessionStart hook on `claude --resume`: re-applies the label of the conversation's position. Answers `resumed` on **stderr**, stdout empty, since Claude Code injects a SessionStart hook's stdout into the conversation.

### `conversation`

```text
conversation end
conversation position [session-id]
conversation builder <session-id> <agent-id> --brief <id>
```

The conversation's folder, `{config}/conversations/{session-id}/` beside the system config, found by `CLAUDE_CODE_SESSION_ID`. It holds what belongs to one conversation: the mark that it runs Ledger, its position, boot's stamp, the gates and raises it was shown, its briefs, the trust-log events waiting to be appended, and the gate mods' own files (the list is `domain/conversation.cjs`'s header). The position, `position.json`, is `{name, phase, topic, tasks}`, each task in flight `{task, builder, reviewers, worktree, stopped}`; `session label`, `enter`, `render epic-menu` and the task verbs write it.

- **`end`** — the SessionEnd hook: records the transcript path from the hook's stdin. Answers `recorded`; never errors. Boot deletes a folder once its transcript is gone and no trust-log event waits in it.
- **`position`** — what the conversation re-reads to carry on where it is working, writing nothing: a `DATA` section, the note the gate mod appends to a compaction (where it works, the skill and the files to re-read, how to catch the log up), and a `POSITION` section for the gate mod, `{session_id, position, place, skill, files, text}`. `skill: null` with no `files` is the empty answer: nothing to carry on from. Refused with no session id given or handed.
- **`builder`** — the gate mod's, as a builder or reviewer is dispatched: records the agent id against the task its brief was issued for, where that task is in flight. Answers `recorded`.

### `board`

```text
board <session-id> [--tab this|unit|all] [--unit <work-unit>] [--page <ref> [--page-unit <work-unit>]]
```

The board's one read, which the gate mod calls for the conversation after every engine call and press. It answers the board's view model, versioned — kinds, states, counts, times and the records' words, never a colour or a button — writing nothing and taking no writer lock. How each view reads the records is `domain/board.cjs`'s and `domain/projections/board-*.cjs`'s.

**The tabs**: `this` (the default) follows the conversation's position — the phase's own view, the unit's page at its menu, All work at no place; `unit` shows the unit `--unit` names, else the session's; `all` shows All work: every unit in progress by its phase, what waits on the person, the roadmap, the inbox and the units complete. **A page**, `--page <ref>`, is read against the unit it was opened in (`--page-unit`), else the tab's: `task:{N.n}` (with `:written`, `:round:{k}`, `:scenario:{id}`, `:scenario:{id}:evidence:{k}`), `entry:{id}`, `finding:{round}:{k}`, `check:{round}:{scenario}`, `section:{n}`, `pass:{k}` (and `:{finding}`), `topic:{topic}`, `message:{topic}:{file}`, `review:{topic}:{id}`, `spike:{folder}`, `report:{topic}:{id}`, `phase:{phase}`, `hunt:{item}`, `option:{key}`, and from All work `unit:{unit}`.

Response `{version, place: {unit, type, phase, topic}, banner: {name, state, facts: [{text, needs, waits?}]}, unit: {unit, title}|null, tab, view, beneath, questions, warnings}`: `view` one of the kinds `domain/board-model.cjs` types, or `{kind: "unavailable", reason}` where it cannot be drawn; `beneath` the view a page sits over; `questions` those waiting in the build and review, oldest first. Refuses no session id, a tab none of the three, a unit the project lacks, a ref naming no page, and `--page-unit` with no page.

### `layout`

```text
layout guard                       (hook before Write, Edit and NotebookEdit; its JSON on stdin)
```

The layout on disk: one table of every place Ledger keeps in `.ledger/`, each a file, a free folder, a file only the engine writes, or a log (`domain/layout.cjs`).

- **`guard`** — Claude Code's hook before Write, Edit and NotebookEdit. It refuses (exit 2) a path in the state the layout has no place for (scratch goes in `.ledger/.cache/`), a file only the engine writes, naming the verb that writes it, a concluded unit's `spec.md`, and at user level the trust log's sources, a conversation's sealed and stamped files and its briefs, and Claude Code's transcripts. A file place's `.txt` beside it passes as its staging. Everything else passes, silent.

### `shell`

```text
shell guard                        (hook before Bash; its JSON on stdin)
```

- **`guard`** — Claude Code's hook before Bash: reads the command as the shell would run it and refuses (exit 2), each refusal with its way on, the first command that would harm or bypass the state: removing or unlocking the `.ledger` worktree, deleting or force-pushing `ledger-state`, a raw `git commit` in the state worktree, while the conversation has a task in flight any git command that commits onto a task's branch outside the door (`engine commit --paths <file>… --task <unit> <N.M> -m "<message>"`, a merge made first with `--no-ff --no-commit`), and from any conversation a raw `git commit`, or any other git command that commits, in a checkout with out the branch of a quick-fix in progress, `fix/{unit}` — a nested repository's there among them, its state found beside the checkout enclosing it, past one of its own holding no such quick-fix — naming it and the way on (the command's own way through the door, the door, or a checkout of the caller's own), and a raw `git commit` whose folder the text cannot tell where the text names one of the engine's own worktrees, `.claude/worktrees/ledger-…` by a name only the engine gives (one of your own named like it never); any command naming a user-level file the layout hook guards, a read among them (use the Read tool); and a write onto a file only the engine writes, naming its verb. It decides from the text alone: an expansion, alias, script or `sh -c` is not seen, and a command it cannot read passes.

## Capture and the roadmap

### `inbox`

```text
inbox archive <path> [<path> …]
inbox restore <path> [<path> …]
inbox delete <path> [<path> …]
inbox file <work-unit> --file <item.json>
inbox close <work-unit|none> <path> [<path> …]
inbox capture <idea|bug|quick-fix> [--project <folder>]
```

The inbox, `.ledger/.inbox/{ideas|bugs|quickfixes}/`, its archived items under `.inbox/.archived/`. A name is taken across every kind, live or archived, and the product's notes. Each verb validates every path before anything moves and makes one commit.

- **`archive`**, **`restore`**, **`delete`** — move live items to the archive, back, or delete archived ones. Answer `archived`, `restored` or `deleted`, and `committed`, then the receipt, `DISPLAY: confirmation`: the archive names one item by its title and several by their count; the restore and the delete a line an item, the delete's title read from git's last copy of the file. `restore` takes the item's `Resolved:` line out of the build log of the unit that closed it, answering `unclaimed: [{path, unit}]`.
- **`close`** — archives live items and records who resolved each on the project manifest (`inbox_closed`): the unit whose work resolved it, or `none` for one the person fixed straight away. Answers `{closed, unit, committed}`.
- **`capture`** — the keep skill's way into the inbox: the item's text on stdin, titled by its first `# Title`, written at `.inbox/{folder}/{date}--{slug}.md`, committed alone, never a log another conversation changed, and pushed. `--project` captures into another project's folder. Answers `{captured, committed}`, then a one-line `DISPLAY`, `Logged {kind}: "{title}"`. A failed commit is noted with its retry, `engine commit --inbox`. Refuses a folder with no Ledger state — its own project naming the migration owed, which makes the state — and a text with no title.
- **`file`** — files a review finding out of scope, or a quick-fix's note at its close, from `{kind, text, call}`, `call` Claude's filing decision at `{unit}.review` (`{unit}.implementation` at the close). Answers `{filed, committed}`. Refuses an item filed already at that path (group the finding with it, or title it apart).

### `roadmap`

```text
roadmap state
roadmap add <name> --horizon <h> --summary <text> [--kind <idea|bug|quick-fix>] [--origin <tag>] [--source <path> …]
roadmap add-batch --file <items.json>
roadmap edit <name> --summary <text>
roadmap rename <old> <new>
roadmap move <name> --horizon <h> [--from <wu>|<wu>.discovery.<topic> [--then <item>,…]]
roadmap archive <name>
roadmap pull-forward <name> --into <epic> [--force-dismissed]
roadmap horizon add <name> [--position <n>]
roadmap horizon rename <old> <new>
roadmap horizon reorder <name> [<name> …]   (the complete order)
roadmap horizon merge <from> --into <to>
roadmap horizon split <name> --new <name> --items <a,b,…> [--position <n>]
roadmap horizon remove <name>
```

The product roadmap, the project manifest's `roadmap`: ordered `horizons`, and `items`, each `{horizon, summary, kind, origin, sources?, pulled_to?, postponed_from?}` — `kind` `idea`, `bug` or `quick-fix`; `origin` where it came from (`harvest`, `roadmap`, `park:{unit|product}`, `inbox:{stem}`, `postpone:{unit}`, `topic:{unit}/{topic}`); `sources` paths under `.ledger/` that must exist. An item's state is read, never stored: `waiting`, `in-flight`, `shipped` or `orphaned`, from its join to a unit. Every mutation commits the project manifest; the node and a named horizon are made as needed (`horizon_created`). A pulled item refuses `move` and `archive`: its way back to waiting is its topic's cancel or postpone, or the unit's cancel.

- **`state`** — the derived read: `{exists, horizons, items: [{name, horizon, summary, kind, origin, sources, state, work_unit?, topic?, work_type?, earlier?}], archived, totals, session_logs}`.
- **`add`** — an item on a horizon. Answers the placement, `kind`, `horizons`, `item_total`, and `said`, the line that reports it.
- **`add-batch`** — several at once, every entry checked first; an entry's `note` moves a live inbox item to `.product/notes/` as its source. Answers `added` (each with `said`) and `notes_moved`.
- **`edit`** — an item's summary.
- **`rename`** — every field carried, its join included. Answers `renamed_from`, `preserved_fields`.
- **`move`** — re-buckets a waiting item, or brings an archived one back (`from_archive`). With `--from`, an item a cancel or removal put back on no horizon, answering `next`: the horizon pick for the next of `--then`, else where the cancel goes. Answers `moved_from`.
- **`archive`** — takes a waiting item off its horizon, kept and its name still taken; a postponed item's archive cancels its epic's row too (`epic_row_cancelled`, `inbox`). Answers `{op, name, horizon, state, committed}`.
- **`pull-forward`** — an idea into an epic before its spec as a new map topic, joined; back into the epic that postponed it, it restores that row (`restored`). Prints its receipt after its JSON line, as a topic's leaving does: `Pulled "{Topic}" forward.`, and the statuses a return gave its items back. `--force-dismissed` passes a struck name the person asked back. Refuses a bug or quick-fix (it starts as work of its own), a joined item, and an epic past its spec.
- **`horizon`** — `horizon add`, `rename` (cascading to its items), `reorder` (the complete order), `merge`, `split` and `remove` (refused while a waiting item is on it, naming them). Each answers `horizons` and `items_updated` or `items_moved`.

Names hold no dot or slash.

## Screens and measures

### `render`

```text
render backlog-gate     <wu.phase.topic> --file <payload.json>
render experiment-approval-gate <wu.experiment.topic> --id <E{n}>
render experiment-next-gate <wu.experiment.topic>
render experiment-spawn-gate <wu.discussion.topic> --id <E{n}>
render cancel-gate       <wu.discovery.name> | <wu>
render postpone-gate     <wu.discovery.topic> --horizon "<horizon>"
render import-reprompt   --file <payload.json>   # {"missing": ["path", …]} — the re-prompt after a landing refused
render absorb-target     <feature>
render absorb-confirm-gate <feature> --into <epic> --topic <name> --summary <text> [--description <text>]
render archived-delete-gate --path <archived path> [--file <pick.json>]
render horizon-pick      <wu.discovery.topic> | --park <name>[,<name>…] | --back <name> --from <wu>|<wu>.discovery.<topic> [--then <item>,…]
render banner
render work-pick --matches <unit>[/<topic>],…
render brownfield-offer-gate
render walkthrough-offer
render walkthrough-screen --screen <1..8> --from <first-run|help>
render walkthrough-topic --name <slug> [--content-only]
render send-report <work-unit>.<topic> --sent <path>
render map <work-unit>.<topic>
render decided <work-unit>.<topic> [--file <payload.json>] [--calls] [--alone]
render decided-strike <work-unit>.<topic> [--page]
render wait-agents <work-unit>.<topic>   (empty when no agent of the topic is running)
render start-this-work [--file <payload.json>]
render approve-map <work-unit> [--file <payload.json> | --sweep]
render approve-map-strike <work-unit>
render ready-to-build <work-unit> [--page] [--calls] [--alone]
render build-headline <work-unit> --file <payload.json>
render task-landed <work-unit> <task>
render task-account <work-unit> <task>
render step-gate <work-unit> <task>          (step only)
render phase-merge-gate <work-unit> <N>      (step only)
render build-stop <work-unit>
render build-progress <work-unit>
render review-report <work-unit> [--round <N>]
render review-calls <work-unit>
render review-tree <work-unit>
render finish <work-unit> [--alone]
render investigation-plan <bugfix> --file <plan.json> [--revised]
render investigation-check-in <bugfix> --file <check-in.json>
render discovery-map <work-unit>
render migrations-applied --file <payload.json>
render migration-gate
render state-lost-gate
render git-floor-stop
render repo-stop
render github-rule-gate
render label-gate
render knowledge-gate [--variant deviate|wizard | --variant retry (--from-system | --provider <name> --model <name> [--base-url <url>] [--dimensions <n>])]
render knowledge-ask --provider openai|openai-compatible
render knowledge-done
render state-merge-gate
render ledger-stop
render directive-carry-on --directive <id>
render directive-arrival --directive <id>
render migration-guard-stop --cause live|dirty [--unit <unit> --phase <phase> --topic <topic> --active <seconds>] [--path <path> …]
render migration-checks-stop
render migration-taken-stop --at <directive id|checks> --active <seconds>
render migration-leaving <work-unit> --directive <id>
render help <menu> [<arg>] [--<name> <value> …]
render verdicts [--unit <unit>]
render start-menu
render epic-menu <epic>
render manage
render manage-unit <work-unit> [--from closed | --from pick --matches <matches>]
render closed
render care [--added <kind> | --dropped <kind>]
render care-kind
render care-drop
render triage [--file <pick.json>]
render archived [--file <pick.json>]
render archived-item --path <archived path> [--file <pick.json>]
render convergence <wu>.<topic> [--asked]
render roadmap
render roadmap-harvest --file <items.json>
render matrix
render matrix-replay --threshold <percent> | --build <percent>
render environment-setup [--from manage]
render drivers
render help-topics
render signpost <label> [--style step|substep] [--width N]     (dev aid)
render wrap <text> [--width N] [--prefix STR]                  (dev aid)
render tree [--width N]            (dev aid; JSON TreeNode array on stdin)
```

The surface catalogue: named surfaces answering sections (`DISPLAY`, `MENU`, `DATA`, `TITLE`), emitted verbatim per their markers. Values come from the state; Claude's judgment arrives as a JSON payload file (`--file`), validated per field. A surface commits nothing, and writes only beside the state: `map` moves the last-looked mark; `convergence`, due but with nothing of the topic Claude's to settle, starts the run again as a no does; `decided`, `start-this-work` and `approve-map` stage Claude's `--file` payload in the cache, what their gate's yes lands; and a menu drops or records the conversation's position. Every MENU row carries its `next`, recorded with the gate shown and returned by `gate`. While `LEDGER_GATE_SURFACE=1`, a `=== GATE … ===` section, one line of JSON for the gate mod, sits above the first MENU. A refusal opens `render {surface}: `.

**The menus** (`domain/menus.cjs`) share one frame: `TITLE`, what the menu shows, its `MENU` and question; the frame adds `h/help` (`render help <menu>`), a back row and a prompt row. The start menu and the project's menus reached from it drop the conversation's position; the epic menu and the roadmap record it there. **The learned process gates** — the plan gate, `wait for agents`, `experiment spawn gate` and `import reprompt` — may run their usual row as an automatic step where the person's answers have earned it: the MENU gives way to a `DATA` section (`automatic step: {gate}`, `ran: {key}`, `next: {json}`) and `DISPLAY: automatic step`, shown without stopping; do what `next` says.

Boot's stops and the setup gates, each the screen of the boot `stop` or setup gate it is named for: **`git-floor-stop`**, **`repo-stop`**, **`state-lost-gate`** (its yes `boot --start-again`), **`state-merge-gate`** (each row `state-merge pick`), **`ledger-stop`**, **`migration-guard-stop`**, **`migration-checks-stop`**, **`directive-arrival`**, **`directive-carry-on`**, **`migration-taken-stop`**, **`migration-leaving`** (the topics leaving a building unit), **`migrations-applied`** (the migration review's summary, from Claude's payload: `summary`, or while the reshape finishes its `parts` — `moved`, `records`, `corrections`, `checks`, `legacy`, `code`, each labelled, in that order, and no counts — closing, while its code commit is to make, on the branch it goes on, not pushed), **`migration-gate`** (its yes `commit --migrations`), **`label-gate`** (naming the multiplexer the session runs in, refused inside none; each row `session label-config`), **`knowledge-gate`** (with no variant, reuse where the system config is valid, else the provider choice; `deviate`, `wizard`, and `retry` over the setup it runs again; each row the setup it runs or the screen it draws), **`knowledge-ask`** (a provider's questions, answered in words; its DATA `the reply:` the setup they run), **`knowledge-done`** (the wizard's yes: the ready line where the checkout's knowledge base is ready, else that the wizard did not complete over the gate's opening again), **`github-rule-gate`**, **`brownfield-offer-gate`** (each row `brownfield record`), **`banner`**, and **`work-pick`** (the start's pick between the pieces of work the words name).

Help and the walkthrough: **`walkthrough-offer`**, **`walkthrough-screen`**, **`walkthrough-topic`** (one reference card), **`help`** (a menu's help, its back drawing the menu again as it was) and **`help-topics`**.

The menus: **`start-menu`**, **`epic-menu`**, **`manage`**, **`manage-unit`** (one unit's pivot, absorb, cancel or reactivate), **`closed`**, **`triage`** (with Claude's pick, `{picked, fits}`), **`archived`**, **`archived-item`**, **`roadmap`**, **`verdicts`**, **`care`**, **`care-kind`**, **`care-drop`**, **`matrix`**, **`matrix-replay`** (what a threshold proposed would have changed; its yes `trust threshold` or `trust build-threshold`), **`drivers`** and **`environment-setup`** (`--from manage`, the keep).

Discovery and the topics:

- **`discovery-map`** — an epic's map, `DATA` then its DISPLAY.
- **`map`** — a topic's questions and Claude's calls as the conversation shows them; drawing it moves the last-looked mark.
- **`send-report`** — where a sent message landed.
- **`horizon-pick`** — the horizon for a topic's postpone, a park (`--park`), or an item put back on none (`--back`).
- **`roadmap-harvest`** — a product session's items for the roadmap; its yes `roadmap add-batch`.
- **`backlog-gate`** — roadmap or inbox, where the words left it open.
- **`wait-agents`** — the gate over a topic's agents still running as it closes; empty when none runs.
- **`convergence`** — the offer to settle the rest of a topic; drawn as it comes due, or with `--asked` on the person's word. Where Claude would settle none of what is open, it draws nothing as it comes due and starts the run again, as a decline does, and on the person's word a line saying so.

The experiments: **`experiment-approval-gate`** (the briefing gate over a designed record: its yes `experiment approve`, its abandon `continue`), **`experiment-next-gate`** (after a top-level record ends with others live, under the series' register: its yes `enter experiment` again, its menu row the unit's menu) and **`experiment-spawn-gate`** (now or later, after a spawn). The pick among several live records is `enter experiment`'s.

The authority gates, each drawn from Claude's staged payload (`--file`), its yes its own family's verb:

- **`start-this-work`** — the work-type commit; its yes `start-this-work yes`.
- **`approve-map`**, **`approve-map-strike`** — an epic's map, after the sweep with `--sweep`, and the pick of a candidate to strike.
- **`decided`**, **`decided-strike`** — a topic's close, `--calls` listing Claude's calls, `--alone` after a verdict drawing the next verdict or the gate alone, and the pick of a candidate to strike.
- **`ready-to-build`** — the spec's gate: outline, phase cut, position; `--page` the review page's row.
- **`finish`** — finish's gate, or a quick-fix's close.

The confirms before a lifecycle verb, which prints its own receipt: **`cancel-gate`**, **`postpone-gate`**, **`absorb-target`**, **`absorb-confirm-gate`**, **`import-reprompt`** (after an import refused paths) and **`archived-delete-gate`**.

The investigation's, the plan a learned gate:

- **`investigation-plan`** — the plan gate, from `{order: [{hypothesis, check}]}`; `--revised` with `changed`.
- **`investigation-check-in`** — the check-in, from `{resolved, next}`: a display the hunt carries past.

The build, each reading where the build stands for the calling conversation: **`build-headline`** (as tasks start, from `{tasks: [{task, changes, watch}]}`), **`task-landed`**, **`task-account`**, **`step-gate`** (in step, after a task; its yes leads to `task done`), **`phase-merge-gate`** (in step, before `land phase`), **`build-stop`** (when nothing can go on without the person) and **`build-progress`**.

The review phase:

- **`review-report`** — a round's report, the last by default.
- **`review-calls`** — every call decided for the person across the unit.
- **`review-tree`** — the gate over a working tree changed under a round: put it back (`review restore-tree`) or keep it (`review accept-tree`).

Authoring aids, never called from a flow:

- **`signpost`**, **`wrap`**, **`tree`** — the kernel's render primitives.

### `measures`

```text
measures findings|bugs [--project <path>]…
```

The measures read over the projects named (the calling one where none is), never drawn on a gate the person reads. Each reads alone and takes no lock; a report or record that does not read is passed over and named in `unread`.

- **`findings`** — review findings per phase of the pipeline: `{projects, phases: [{phase, findings, calls?: {serious, bug, nit}, rounds?, failed?}], unread?}`, `phase` one of `discussion`, `specification`, `task-writer`, `build`, `review`.
- **`bugs`** — bugs found after review: every bugfix whose conclude named the unit it fixes with that unit's review already ended, grouped by area, then unit. Answers as `findings` does, with `bugs: [{project, area, count, fixed: [{unit, bugfixes}]}]` beside `phases`, so the two read together.

Each refuses a project with no Ledger state.
