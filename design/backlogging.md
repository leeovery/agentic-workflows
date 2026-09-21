# Backlogging — one door in every phase, two backlogs

An idea that surfaces mid-session and is not this work's to build has two
homes: the product roadmap, when the person places it ("next", "once this
epic is done", a horizon by name), and the inbox, when they do not
("someday", "log it"). Both are the backlog. The person says where; the
session lands it in one verb and carries on. Opened 2026-09-21 from a
Folio implementation session where "put that on the roadmap under Next"
was met by invoking the roadmap skill, which opened the product session's
home mid-implementation with a task sitting at its fix gate.

## Motivation

- **Delivery had no door.** The park verb (`roadmap add --origin park:`)
  is reachable from discovery's scope-down, from the discussion and
  research off-topic flows, from the shared epic off-topic reference, and
  from the specification's gap exit. Planning, implementation, and review
  reach it nowhere; investigation and scoping neither. A session standing
  in one of those phases hears "roadmap" and improvises — the roadmap
  skill is model-invocable and its name matches the word.
- **The doors that exist disagree.** Discovery's tie-break sends an
  ambiguous placement to the inbox silently; discussion's off-topic menu
  carries a roadmap row and research's does not ("research has no roadmap
  route"); the horizon is confirmed in conversation where it is confirmed
  at all; no engine gate exists for a park anywhere.
- **The inbox and the roadmap are one instruction with two answers.**
  "Backlog it" means put it aside; which backlog is the only question, and
  the person's words usually answer it. Where they do not, the person is
  the only source, and the workflows have no prose gates.

## Rulings

- **R1 — Two doors, one act.** *Backlogging* is the person's instruction:
  "roadmap it", "inbox it", "backlog it", "push that back". *Off-topic* is
  Claude's judgement that a concern is not this topic's, whose answer on
  an epic is usually a sibling topic. The trigger decides the door: the
  person's words always take the backlogging door, in every phase,
  discussion included; the off-topic menus serve only the case where
  Claude raised the concern. This design builds the backlogging door. The
  five existing park sites stay exactly as they are, and folding their
  park mechanics onto the shared step is the follow-on.
- **R2 — The words route; ambiguity stops at a gate.** Roadmap words
  park: a named horizon, "next", "after this", "on the map". Inbox words
  capture: "inbox", "log it", "someday", "maybe never". Words that leave
  the home open ("backlog it", "later", "not now") stop at an
  engine-rendered gate with two rows — roadmap for next or soon, inbox for
  someday. Never decided silently, never asked in prose.
- **R3 — Every park confirms.** One engine-rendered gate before the verb
  states the item's name, its one-line summary, the horizon (flagged as
  new when an existing map does not hold it), that the roadmap itself is
  created when there is none, and the source pointer. A yes parks; a no
  records nothing; a comment changes the name, the horizon or the summary
  and re-renders. An inbox
  capture stays unconfirmed, as every capture is today — archive undoes
  it.
- **R4 — The horizon is the person's.** Named in the instruction → that
  one. Unnamed with horizons on the map → an engine-rendered pick over
  the existing horizons in their order, with a new-horizon row. Unnamed
  with no map → the person names it in prose (a name is content, not a
  choice), and the confirm gate says the roadmap is created with it.
- **R5 — The source is the session's own document.** Research, discussion
  and investigation point at their file, planning at the plan, scoping and
  specification at the specification (the scoping document is written at
  the specification's path); implementation and review point at the
  specification, the record their work is built from. A session that
  keeps a running record (research, discussion, investigation) notes
  where the idea went; the other phases carry no note, the item's own
  `origin` and `sources` are its provenance.
- **R6 — From inside a phase the park is one verb.** The roadmap skill is
  the product session and is never invoked from a phase. This sentence
  lives in the shared reference; it is the Folio failure closed.
- **R7 — The laboratory has no door.** An experiment measures what its
  problem statement asks; an idea that surfaces there belongs to the
  research or discussion that spawned the record, and is backlogged from
  that conversation. Discovery keeps its existing door (scope-down and the
  stated-placement park) and gains no standing section until the
  follow-on.

## The settled shape

### The door

A standing `## Backlogging` section on each of the eight conversational
process skills — research, discussion, investigation, scoping,
specification, planning, implementation, review — in the shape of
`## Cancelling the Topic`: three sentences naming the trigger, loading
`workflow-shared/references/backlogging.md` with `work_unit`, `topic`, and
`phase`, and returning to the interrupted flow. The section is the
progressive disclosure: the reference loads only when the person says the
words.

### The reference

`workflow-shared/references/backlogging.md`, four lettered sections, always
entered at **A** by the standing section; every branch carries its own
routing, so nothing falls through.

**A. Which backlog.** Read the person's words against R2. A horizon named
→ **C** (B is skipped); placed without a horizon → **B**; inbox words →
**D**; open → write `{"idea": "…"}` to
`.workflows/.cache/{work_unit}/{phase}/{topic}/backlog.json` and render
`backlog-gate`, STOP, then **B** on `roadmap` and **D** on `inbox`.

**B. The horizon.** Read `roadmap state`. Horizons on the map →
`horizon-pick`, STOP; a number is the horizon, `n/new` asks for a name in
prose. No horizons (a never-born map answers `horizons: []`) → ask for a
name in prose, STOP. Every exit → **C**.

**C. Park.** Derive a kebab-case name and a one-line summary at capability
grain (the roadmap guidelines' bar: one thing a person would move around a
roadmap), take the source from R5's table, render `park-gate`, STOP. A
refusal is a name clash: derive another and render again. On yes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add {name} --horizon "{horizon}" --summary "{one-liner}" --origin park:{work_unit} --source {source}
```

The verb validates, births the map and any new horizon, and self-commits.
Note the park in the running record where the phase keeps one. Say in one
line where it went. → Return to caller. On no, nothing is recorded. On a
comment, rebuild the park with what it names and render again.

**D. Capture.** Invoke the matching capture skill (`workflow-log-idea`,
`workflow-log-bug`, `workflow-log-quickfix` — idea when unsure), then
commit it (`engine commit --inbox -m "workflow(inbox): capture {slug}"`),
the shape implementation's ad-hoc flow already uses. Note it in the
running record where the phase keeps one. → Return to caller.

### The surfaces

- `render backlog-gate {wu}.{phase}.{topic} --file <payload.json>` —
  payload `{idea}`; the statement names the idea and asks which backlog;
  rows `r/roadmap` (next, or soon after this work) and `i/inbox`
  (someday, picked up when it is picked up). The address is validated as
  every per-topic surface's address is.
- `render horizon-pick` — project-level; the map's horizons in their
  order as numbered rows, each with its waiting-item count, then `n/new`.
  Refused when no roadmap exists or it holds no horizons — the prose asks
  for a name instead, so the surface never renders an empty pick.
- `render park-gate --name <kebab> --horizon <h> --summary <text> [--source <path>]`
  — project-level; the statement in the shape of the cancel gate: the item
  and its summary, the horizon with `(new)` when an existing map does not
  hold it, `the roadmap is created with it` when there is no map, the
  source when given; rows `y/yes`, `n/no` and Comment. Refused when the name is already
  on the roadmap, with the add verb's own message, so a clash is met at
  the confirm rather than after it.

## Rejected shapes

- **Route "roadmap it" through the roadmap skill.** That is the product
  session — a conversation loop, a harvest, a document review, a
  conclusion. A park is capture-weight by the roadmap's own design and
  needs none of it. This is the failure the design starts from.
- **One reference replacing the off-topic flows.** Off-topic on an epic
  is mostly a reroute to a sibling topic through the triage queue, which
  is not a backlog; on a feature it carries the pivot. Collapsing them
  would put map operations into every phase. The two doors answer
  different questions and stay two; only the landing is shared, and only
  in the follow-on.
- **One "aside" row on the off-topic menus, entering the reference at A.**
  Trades a menu row for a second stop; the person picking from that menu
  has already chosen the home.
- **Decide an ambiguous placement silently.** Discovery's current
  tie-break (inbox, because a wrong horizon reads as someone's decision).
  The person is the only source, the question costs one exchange, and a
  silent inbox drop is how a "next" item is lost until grooming.
- **A conversational confirm.** The workflows carry no prose gates; the
  cancel gate is the shape.
- **Confirm the inbox capture too.** Captures are unconfirmed everywhere
  today and the archive lifecycle undoes one; a gate here would be the
  first, for the cheaper of the two homes.

## Consequences

- **Doctrine diverges until the follow-on.** Discovery's scope-down still
  decides ambiguity toward the inbox and confirms in prose; the off-topic
  roadmap rows still confirm the horizon in conversation; research's
  off-topic menu still carries no roadmap row. All five sites are named
  here as the follow-on's scope: each loads the shared reference at B or
  C for the act, the research variant of `off-topic-offer` gains its
  roadmap row, and discovery's tie-break line aligns with R2.
- **Concluded records are frozen.** `design/product-roadmap.md` names
  the park's doors as they were; this document is the record of the
  change.
- **The glossary** gains `backlog` as the umbrella over `park` and the
  inbox note; `park`'s entry stays.
- **`roadmap add` is unchanged.** JIT birth of the map and of a named
  horizon, the clash refusal, the confined self-commit — all as today.
- **Presence.** A park from a phase beats nothing: `roadmap add` is a
  project-level verb. The session's own topic is beaten by its next
  `commit --topic`, as today.

## Engine surface

| Surface | Change |
| --- | --- |
| `render.cjs` | `backlogGate` (payload-driven, per-topic address), `horizonPick` (project state, refusal on no map/no horizons), `parkGate` (flags, `(new)`/first-item states, clash refusal via the add verb's message); registered in the surface table |
| `engine.cjs` | three usage lines in `commands.md`'s form |
| `references/commands.md` | the three surfaces under the render section, one line each |

## Test plan

- `test-engine-render-surfaces.cjs` — `backlog-gate`: both rows, the idea in the statement, a missing or empty `idea` refused, a dead address refused. `horizon-pick`: rows in map order with counts and `n/new`; refused over no map and over a map with no horizons. `park-gate`: an existing horizon, a new horizon flagged, the first-item statement over no map, the source line present and absent, the clash refusal, each flag's absence refused.
- `test-pipeline-simulation.cjs` — from a live implementation item: `backlog-gate` renders; `horizon-pick` refuses over no map; `park-gate` renders the first-item state; `roadmap add --origin park:` births the map; `horizon-pick` then renders the one horizon; `park-gate` over the same name refuses; a second park under a new horizon flags it new; the audit holds throughout.
- Prose cases, authored with snapshots and not walked: `implementation-parks-on-a-named-horizon` (an empty map, "put that on the roadmap under Next", the confirm, the verb, the map born, `calls_exclude` the roadmap skill's gateway); `planning-backlogs-an-ambiguous-idea` ("backlog that for later", the gate, `inbox`, the capture and its commit); `specification-parks-through-the-horizon-pick` (a map with two horizons, no horizon named, the pick, the confirm, the source pointing at the specification).

## Build plan

Design doc standalone (PR0). Two implementation slices, each one agent, each reviewed against the tree before the next opens.

- **PR1 — engine.** The three surfaces, their usage and reference lines, the render-surface tests, the simulation permutation. Green on `npm test`, `npm run test:cli`, `npm run typecheck`.
- **PR2 — prose, docs, cases.** `backlogging.md`; the `## Backlogging` section on eight process skills; `CLAUDE.md` (the roadmap paragraph's list of park doors, the shared-references paragraph); `docs/capture-and-inbox.md` and `docs/roadmap.md`; the glossary entry; the three prose cases with their snapshots.

## Log

- 2026-09-21 — Built as stack #1257: #1252 the engine (three surfaces, tests, the simulation permutation), #1256 the prose (the reference in four lettered sections, the eight standing sections, CLAUDE.md, the two docs, the glossary entry, the three cases authored with snapshots). What the build settled against the opening record: the park gate carries `n/no` beside `y/yes` and Comment, the engine's consent invariant; `(new)` is spoken only over an existing map, the first-item statement carrying it alone; the scoping document is written at the specification's path, so the source table has three rows; the horizon fork is its own lettered section, since a converging fork inside a section body has no conventional shape. Walks owed on the user's word.
- 2026-09-21 — Opened from Folio (v0.7.29, forty releases behind main, though no release carries the door). Rulings R1–R7 agreed in conversation: two doors and one act, words route and ambiguity gates, every park confirms at an engine gate, the laboratory stays out, the existing doors are the follow-on.
