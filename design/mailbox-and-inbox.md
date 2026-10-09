# Mailbox and inbox — topics send messages; the inbox is triaged onto the roadmap

Two vocabularies were tangled. The per-topic "triage queue" is not triage:
the sending topic does the deciding, and the receiving topic only deals
with what arrived — it is a mailbox, and what it holds are messages. The
inbox, meanwhile, is a real triage queue in the established sense: things
captured before anyone has decided on them. Triaging it is the act of
deciding — start now, put on the roadmap, or decline — and the roadmap,
which already holds accepted-but-unscheduled work ordered by horizon, is
where the backlog lives. Opened 2026-09-23 from Lee's dislike of
"triage" for the topic queue; settled 2026-10-09 across one conversation.

## Motivation

- **"Triage queue" names the wrong act.** A topic's conversation judges
  that something belongs to another topic and sends it there; the
  receiver raises what arrived, folds it in, and cannot conclude while
  any waits. Nothing is triaged at the receiver. The engine already
  writes `*Addressed to: … *` and `*From: … *` headers — it is mail.
- **"Concern" is the wrong noun.** It reads as a worry, not an item that
  was sent. A message is the plain word; the obligation (a topic cannot
  conclude while its mailbox holds one) is carried by the conclusion
  gate, never by the word.
- **The inbox mixes undecided with decided-later.** An inbox item the
  person has decided to do, but not yet, has nowhere to go: the roadmap
  takes product capabilities only, so a bug wanted before launch cannot
  sit beside the features it competes with. It stays in the inbox, the
  inbox never empties, and its count stops meaning "decisions owed".
- **The archive mixes declined with groomed.** Grooming an inbox idea onto
  the roadmap archives the note and points the item's source at the
  archive, so `.archived/` holds both what was declined and what went on.
- **Starting work refuses mixed sets for no product reason.** A bug the
  person knows a feature will fix cannot be started with that feature;
  the working set refuses a mixed set outright.

## Rulings

- **R1 — Each topic has a mailbox; other topics send it messages.** The
  act is *send*, the item a *message*, the place a *mailbox*, and the
  menu cue *mail waiting*. "Triage queue", "concern" and "reroute" (in the
  sending sense) leave the vocabulary — prose, engine, glossary, docs.
  "Inbox" is never used for the mailbox: it stays the inbox's name, and
  "inbox it" stays a phrase that files something there.
- **R2 — The mailbox protocol is unchanged.** One engine-numbered file per
  message, one ask per message, the landing-phase judgement, the offer,
  the raise one at a time, the fold, the absorb, the move to the topic's
  other phase-side, the conclusion gate, the closed-target gate, the
  staleness hops, absorb carrying the mailboxes with their documents.
  This is a rename of everything that carries the old words, in code,
  in stored state, and in prose — nothing else.
- **R3 — The inbox keeps its name; triaging is the act of working it.**
  Each item, or a working set of items, is declined (archived), put on
  the roadmap under a horizon, or started now. Two places hold work
  before it starts — the inbox (undecided) and the roadmap (decided) —
  and no third.
- **R4 — The backlog is a horizon.** The roadmap holds accepted,
  unscheduled work ordered by horizon; a horizon the person calls
  "Backlog", "Later" or "Someday" is the backlog. The system names no
  backlog place. The backlogging door keeps its name: "backlog it" with a
  horizon named Backlog names that horizon, as the door's own words
  routing already reads it.
- **R5 — The roadmap holds every kind.** Ideas, bugs and quick-fixes, each
  item carrying its kind. Ideas stay at capability grain; a bug or a
  quick-fix is one fix. This reverses `design/product-roadmap.md` decision
  13 ("bugs bypass"): the roadmap is where work is picked up, whatever
  its kind.
- **R6 — Starting work takes the largest shape in the set; bugs and
  quick-fixes never add size.** From the roadmap's pull and the inbox's
  working set alike, mixed kinds allowed:

  | The set holds | It becomes |
  | --- | --- |
  | quick-fixes only | a quick-fix |
  | any bug, no idea | a bugfix |
  | ideas (with anything else) | a feature or an epic |

  Feature versus epic stays a judgement confirmed with the person, as the
  pull's shape step and discovery already make it — one broad idea can be
  an epic, two small ones one feature; the rule sets only the floor. A
  feature plus a bug is a feature, never an epic: bugs and quick-fixes
  ride along as material and are never counted.
- **R7 — A bug folded into a feature or an epic is said so.** It skips the
  investigation a bugfix would give it; its diagnosis happens inside the
  feature's own phases. Every roadmap and inbox bug is undiagnosed (a
  capture, or a park), so the shape confirmation names this whenever a
  set holding a bug becomes a feature or an epic. Pulling the bug alone
  stays the way to get its investigation.
- **R8 — Urgent work never passes through the roadmap.** The inbox's
  working set starts work directly, as today — the new unit and its seed
  are the record. Moving an item onto the roadmap is for work decided but
  not now.
- **R9 — A note travels with its item, and the archive holds declined
  items only.** An inbox item put on the roadmap moves its note to the
  roadmap's own notes, the item's source pointing there; the archive is
  never a roadmap source. A roadmap item removed while waiting sends its
  note to the inbox archive — declined, restorable. A pulled item's note
  stays where it is: the pull reads it as a source, as every pulled
  item's sources are read, and carries it whole into the unit's first
  session log.
- **R10 — Only an idea becomes a topic.** An epic grows by topics, and a
  topic is a thing to decide. Pull-forward into an in-flight epic takes
  ideas alone — a bug wanted with it is pulled as its own bugfix — and a
  bug or quick-fix that reaches an epic with ideas rides with the unit as
  material, never bound to a topic.

## The settled shape

### Part one — the mailbox

**Vocabulary map.** Every identifier below changes; nothing else does.

| Old | New |
| --- | --- |
| triage queue | mailbox |
| concern (a queued item) | message |
| reroute / triage (the act of sending) | send |
| `triage waiting` cue; gateway `triage=waiting`, `triage_waiting:` | `mail waiting`; `mail=waiting`, `mail_waiting:` |
| `.workflows/{wu}/{phase}/.triage/{topic}/NNN-{slug}.md` | `.workflows/{wu}/{phase}/.mailbox/{topic}/NNN-{slug}.md` |
| phase-item status `triaged` | `unstarted` |
| discovery map `source` tag `reroute:{origin}` | `message:{origin}` |
| `topic triage … --concern <file>` | `topic send … --content <file>` (`-m` stays the commit message) |
| `topic queue` | `topic mailbox` |
| `topic absorb` | `topic absorb` (unchanged — the topic absorbs the message into its record) |
| `topic requeue` | `topic forward` |
| response keys `concern_path`, `triage_moved` | `message_path`, `mail_moved` |
| computed `triage_phases`, `triage_queued`, `triage_parked` | `mail_phases`, `mail_queued`, `mail_waiting` (true for an unstarted item or any message waiting under a started one) |
| `render triage-announce` / `triage-offer` / `triage-block` | `render mail-announce` / `mail-offer` / `mail-block` |
| `render requeue-offer` | `render forward-offer` |
| `render reroute-offer` / `reroute-candidates` | `render send-offer` / `send-candidates` |
| `render triage-closed-target` | `render send-closed-target` |
| `render resume-gate --triage N` | `--mail N` |
| payload key `concern` (reroute, candidates, off-topic offers) | `title` |
| cache scratch `triage-offer.json`, `requeue-offer.json`, `concern-{slug}.md`, `gap-concern.md`, `reroute-offer.json`, `reroute-candidates.json` | `mail-offer.json`, `forward-offer.json`, `message-{slug}.md`, `gap-message.md`, `send-offer.json`, `send-candidates.json` |
| `workflow-shared/references/triage-landing.md` | `sending-a-message.md` |
| `workflow-shared/references/rerouted-concerns.md` | `reading-the-mailbox.md` |
| document record `Rerouted to {topic} triage ({date}).` | `Sent to {topic}'s mailbox ({date}).` |
| commit message `reroute concern to {target}` | `send message to {target}` |
| `composing-a-raise.md` source `reroute` | `message` |
| glossary **reroute** | **mailbox**, **message** (_Avoid_: triage queue, concern, reroute) |

Engine function and type names follow the map (`triageTopic` →
`sendMessage`, `absorbConcern` → `absorbMessage`, `requeueConcern` →
`forwardMessage`, `TRIAGE_PHASES` → `MAILBOX_PHASES`, and so on). The
five sites that build a mailbox path by hand become one helper.

**Out of scope, by name.** `discovery-map reroute` and `render map-op-gate
--op reroute` change a map row's routing — a different act that keeps its
word. `workunit absorb` folds a feature into an epic. "Concern" in its
other senses stays: a cross-cutting concern, review and complexity
concerns, concern areas. Frozen migrations 052 and 054 and every concluded
design doc are never touched. Documents already written keep their text:
a document is content, never state.

**Migration 071 — the mailbox.** Over every work unit, whatever its status:

- `{phase}/.triage/` renamed to `{phase}/.mailbox/` (staged; the migration
  commit records it);
- every phase item's `status` and `previous_status` reading `triaged`
  rewritten to `unstarted`;
- every discovery map item's `source`, split on commas, rewriting each
  `reroute:` segment to `message:`.

Idempotent; reports one update per changed unit. Frozen migration 054's
verification addendum still names `.triage/` for a straggler it could not
parse, and addenda are performed after every migration has run — so an
install behind at 054 would recover a straggler into a directory nothing
reads. Where a research or discussion document still holds content under a
Triage heading (an emptied `(none)` section never counts), 071 hands back
an addendum of its own, read after 054's, pointing the move at the
mailbox.

### Part two — the inbox and the roadmap

**The item.** `kind` joins every roadmap item: `idea`, `bug` or
`quick-fix`, required. `roadmap add` and `roadmap add-batch` take it
(`--kind`, an entry's `kind`), defaulting to `idea`; the postpone birth
writes `idea`. Displays that list items name the kind of a bug or a
quick-fix row; an idea row is unmarked.

**Notes.** A roadmap item's note lives at
`.workflows/.roadmap/notes/{ideas,bugs,quickfixes}/{date}--{slug}.md`,
the inbox's own filename and folder kept, and the item's `sources` name
it. Notes are never KB-indexed while they wait, as inbox items are not.

**Triage from the inbox.** The working set gains a roadmap row beside
work, add, drop, archive, view and back. It applies to the whole set:
the horizon is picked once (the shared `choosing-a-horizon.md`), Claude
reads each note and composes its entry — name (the note's slug,
re-derived more specifically on a clash with the roadmap or within the
set), one-line summary, the horizon, and the note's inbox path — into
one file. The confirm gate renders over that file and runs the verb's own
validation as a dry run, so it never offers what the verb would refuse,
showing each item's kind as its note's folder gives it; yes, no, and
Comment. On yes, `roadmap add-batch` lands the same file: each note moves
from the inbox to the roadmap's notes and its item is added (`origin:
inbox:{file stem}`, `sources: [the note]`), one confined commit. The
roadmap session's grooming (`session-loop.md`) uses the same transaction
instead of archive-then-add.

**No note goes missing.** A note is always in the inbox or named by an
item. Coming onto the roadmap, the manifest lands first and the notes
move after, put back with the manifest restored if a move throws; leaving
it (remove), the note moves first and comes back if the write throws.

**Only an idea becomes a topic.** One predicate holds R10 wherever an
item meets an epic: the harvest binds ideas alone (a pulled bug or
quick-fix rides with the unit as material for the topics it bears on),
pull-forward takes ideas alone, a feature absorbed into an epic re-aims an
idea's join at its topic and a bug's or quick-fix's at the epic alone,
the add gate offers delivery only into an epic underway, and discovery's
anti-twin flag counts waiting ideas alone. A postponed topic's re-waited
item is therefore always an idea.

**Start now from the inbox.** `w/work` is offered for any set. The
work-type pre-seed follows R6: ideas present → `none`, and discovery
decides from the ideas, the bugs and quick-fixes riding as seeds that
never set the type; no idea and any bug → `bugfix`; quick-fixes only →
`quick-fix`. The mixed-set blocker goes. Discovery's opener and detection
core read a mixed seed set as R6 reads it; every seed still moves into
`seeds/` with its own `inbox:{type}` tag.

**The pull.** The shape step applies R6 over the pulled set: a quick-fix
or bugfix shape is set by the rule, a feature or epic judged and
confirmed as today. The shape gate's statement names a bug folded into a
feature or epic (R7). Read the record (C) reads every source in full, a
note among them, and the backfill (D) carries each note whole into
Exploration — it is short, and it is the work's origin. Route (F) gains
the two shapes: a bugfix to `/workflow-bridge {wu} discovery
investigation`, a quick-fix to `/workflow-bridge {wu} discovery scoping`,
each with the feature's one-line signpost. The home menu's pull label
and the shape gate's adjust row stop saying "epic or feature".

**Remove.** `roadmap remove` of a waiting item whose source is a roadmap
note moves the note to `.workflows/.inbox/.archived/{folder}/` in the same
transaction — declined, restorable from the archive.

**Putting something aside mid-session.** The backlogging door is
unchanged in routing: placed words park on the roadmap, unplaced words
capture to the inbox, ambiguity asks. The park now carries a kind: a bug
or a quick-fix placed by the person parks as that kind (one fix, not a
capability), and the park gate states it. Discovery's scope-down and the
roadmap guidelines lose "bugs and quick-fixes never touch the roadmap":
placement decides the home, whatever the kind.

**Recognition at shaping.** A waiting roadmap item of any kind is matched;
the "epic- or feature-shaped reads only" limit goes.

**The names.** The engine and the prose meet on these:

| Surface | Shape |
| --- | --- |
| `roadmap add` | `--kind <idea\|bug\|quick-fix>`, `idea` when omitted |
| `roadmap add-batch` | an entry takes `kind`, and `note` — a live inbox path, in the form the inbox verbs take; with a note the entry's kind is the note's folder (a contradicting `kind` refused), its origin `inbox:{file stem}`, and its one source the note's new path; every note moves and every item lands under one commit, a clash refused before anything moves |
| notes | `.workflows/.roadmap/notes/{ideas,bugs,quickfixes}/{file}` — `sources` name it as `.roadmap/notes/{folder}/{file}` |
| `render inbox-roadmap-gate --file <entries.json>` | add-batch's own file, `[{"name","horizon","summary","note"}]`, one horizon; add-batch's validation run dry — a name on the roadmap or repeated, an illegal name or horizon, a dead note, a taken destination, a file name with a space all refused, nothing moved; each kind shown from its note's folder; the horizon flagged new, the roadmap's birth said where there is none; rows `y/yes`, `n/no`, Comment |
| scratch | `.workflows/.cache/inbox-roadmap.json` at the cache root — a folder named `inbox` would be a work unit's cache home |
| `roadmap bind` | refuses a bug or a quick-fix |
| `roadmap-add-gate`, `roadmap state` rows | delivery offered only into an epic underway; state rows carry the joined unit's `work_type` |
| the working set | `o/roadmap` beside `w/work` (key `o`: `r` is archive's); `w/work` for any set; `set_type` is `none`, `bugfix` or `quick-fix` — never `mixed` |
| `roadmap state` rows, `pull-set` DATA | carry `kind` |
| `roadmap remove` | a waiting item's roadmap note moves to `.workflows/.inbox/.archived/{folder}/` under the same commit |
| `roadmap pull-forward` | refuses an item whose kind is not `idea`, naming the pull as the way to start it |

**Migration 072 — the roadmap.** On the project manifest's roadmap node:
every item without a `kind` gains `kind: idea` (every item to date is an
idea — the roadmap refused the others); every item source under
`.inbox/.archived/{folder}/` moves to `.roadmap/notes/{folder}/` (the file
staged as a move) and the source is rewritten — whatever the item's
state, since a source is a pointer.

## Rejected shapes

- **"Concern" kept as the noun** (my first position: "message" collides
  with Claude Code's own session messaging and with commit messages).
  Lee: the workflow mechanism carries every send — nothing ever sends a
  message to a topic free-form — and context separates the rest. The one
  real collision, the engine's `-m/--message` commit flag, is met by
  naming the content flag `--content`.
- **The topic queue as the "inbox", the inbox renamed "triage".** Lee's
  opening proposal. A word swap has no safe rename order — a missed
  occurrence silently means the other thing — and "inbox it" is a live
  trigger phrase. Once the mailbox took the topic queue, the reason to
  rename the inbox went with it: GTD's inbox is exactly "captured,
  unprocessed, empty it", and triage is the act.
- **A separate backlog place beside the roadmap.** A second list of
  accepted work, and a "which one did I put it in" question; horizons
  already carry the ordering a backlog needs.
- **Urgent work routed through the roadmap** (add, then pull at once) so
  the roadmap records everything taken on. Lee: real life moves an urgent
  ticket straight to in progress; the unit and its seed are the record.
- **Notes moved into the unit's seeds at the pull.** The pull's own
  principle is that nothing is mirrored onto the unit — the record crosses
  as the backfill and the item's sources — and moving files at the pull
  breaks the cancel-revert (a reverted item's note would sit in a
  cancelled unit). The note stays the roadmap's; the backfill carries it.
- **Bugs pulled forward into an in-flight epic as topics.** A bug is not a
  thing to decide, and its note would need a home inside an epic whose
  discovery has run (R10).

## Consequences

- **Concluded records are frozen.** `design/product-roadmap.md` (decision
  13, its motivation and its brownfield-bug walk), `design/backlogging.md`
  and every design naming the triage queue keep their words; this
  document records the change.
- **Docs and glossary.** The glossary gains **mailbox** and **message**,
  loses **reroute**, and rewrites **roadmap**, **item**, **park**,
  **start work on**, **inbox** and **backlog** to this shape. The book
  (`docs/roadmap.md`, `docs/capture-and-inbox.md`,
  `docs/research-and-discussion.md`, `docs/discovery.md`,
  `docs/how-it-fits-together.md`), `README.md`, the walkthrough's topics
  03, 04 and 07 and screens 04 and 08, and their fixtures follow.
  CLAUDE.md and CONVENTIONS.md follow.
- **Prose tests.** Every case that names a renamed reference, verb,
  surface or path is updated and its snapshots regenerated; the walks
  that cover the protocol are owed a run on Lee's word.
- **The reshaping programme** (`design/workflows-reshaped.md` R11) builds
  on the mailbox; this rename lands before it, as that design schedules.

## Engine surface

| Area | Change |
| --- | --- |
| `domain/transitions.cjs` | the mailbox verbs renamed per the map; `unstarted` everywhere `triaged` was handled; one mailbox-path helper |
| `domain/derivations.cjs`, `specification.cjs`, `discovery-map.cjs`, `agent-state.cjs`, `workunit-absorb.cjs`, `workunit-detail.cjs`, `epic-detail.cjs`, `conventions.cjs` | status sets, computed fields, cue text, error strings per the map |
| `kernel/manifest-schema.cjs` | `triaged` → `unstarted` in the research, discussion and investigation vocabularies |
| `domain/render.cjs`, `projections/*` | the surfaces renamed, their strings rewritten; the legend's `unstarted` line; kind on roadmap rows; the inbox working set's roadmap row and the mixed-set rule; the confirm gate for moving inbox items onto the roadmap; the shape gate's R6/R7 statement |
| `domain/roadmap.cjs` | `kind` (validated, required), `--kind` on add and add-batch, the inbox-to-roadmap move transaction, remove archiving a note |
| `domain/inbox-set.cjs` | the R6 pre-seed over a mixed set |
| `engine.cjs`, `references/commands.md` | usage and catalogue for every renamed or new verb, flag and surface |
| migrations | 071 (mailbox), 072 (roadmap) |

## Test plan

- Engine suites re-pinned to the new names; nothing asserting old names
  remains outside the frozen migrations' own suites.
- `test-migration-071.cjs`, `test-migration-072.cjs`: happy path, no-op,
  idempotency, content preservation, a stashed `previous_status`, a
  comma-accumulated source, a completed and a cancelled unit, an archived
  source already moved.
- Roadmap: `kind` required and validated; add-batch with kinds; the move
  transaction (several notes, one commit, a clash refused before any
  move); remove archiving a note; pull of a bug set and a quick-fix set
  creating the right type.
- Inbox: a mixed set offers work with the R6 pre-seed in each of the
  three cases.
- Pipeline simulation: the mailbox scenarios under the new verbs; a
  scenario triaging inbox items onto the roadmap, pulling a bug set into
  a bugfix, and pulling an idea plus a bug into a feature.
- Prose cases: existing cases updated and re-snapped; new cases for the
  inbox's roadmap row, a bugfix pull, and a mixed inbox start.

## Build plan

Two PRs stacked, this design standalone and merged last.

1. **The mailbox rename** — engine, migration 071 and engine tests; prose,
   glossary, docs, CLAUDE.md and CONVENTIONS.md; prose cases and
   snapshots.
2. **The inbox and the roadmap** — engine (kind, the move transaction,
   remove, the mixed-set rule, the pull's shapes), migration 072 and
   tests; prose (the working set's roadmap row, the pull, backlogging's
   park kind, the roadmap guidelines and grooming, discovery's opener and
   detection core); glossary, docs, walkthrough, CLAUDE.md; prose cases.

## Log

- 2026-09-23 — Lee opens: "triage" is the wrong word for the topic queue.
- 2026-10-09 — Ruled: mailbox and message (R1); the inbox keeps its name,
  triage is the act, two places, bugs and quick-fixes on the roadmap,
  the backlog a horizon (R3–R5); the largest-shape rule (R6); the inbox
  keeps its direct start (R8). Derived: R2, R7, R9, R10, the vocabulary
  map, the notes' home.
- 2026-10-09 — Built as #1487 (the mailbox) and #1488 (the inbox and the
  roadmap). The reviews settled: 071's straggler addendum; one entries
  file the gate validates dry; the note-move ordering; R10 as one
  predicate. Left as they stand: a topic named like a waiting bug refuses
  a later postpone on the clash (the refusal names it; a rename
  recovers); two ideas bound to one topic re-wait only the first on a
  postpone — older than this design.
