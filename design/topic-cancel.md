# Topic Cancel — one cancel per stage, over the thing the user sees

A topic on an epic is the row the dashboard draws. Cancel is "we are not doing this", said about that row. Where the engine keeps the fact — a status on a research item, on a discussion item, on a specification, or a marker on the map row itself — is storage, and the user never meets it. Opened 2026-09-16.

## Motivation

- **A never-started topic could not be cancelled.** Fumi's epic menu listed Data Export as one of nineteen topics with its own start row, then `a/cancel` omitted it. The cancel menu walks per-phase items (`epicCancelMenu` over `detail.phases`, which drops the discovery map at `epic-detail.cjs:226`); a map-only topic has none. Four of the seven fresh topics *did* appear, because rerouted concerns had parked `triaged` stubs on them — a discriminator nothing on screen shows. The route offered instead was a discovery session and the word "remove": a different verb (hard delete plus the dismissed list, no reactivate) behind a heavier door, for a one-line intent.
- **Cancel was per phase item, not per topic.** The same menu listed Onboarding And Permissions, Space Homing, and Platform Support twice each — research and discussion as separate rows — and asked which half to cancel. Cancelling research a discussion already read retracts a record the discussion absorbed, and the engine made it worse by removing the research's knowledge-base chunks while the discussion stood on them. Cancelling a discussion and keeping its research left a topic that read *ready for discussion* while `topic start` refused the cancelled item. Neither half ever had a product meaning the whole doesn't cover better.
- **The cascade rolled through a stage boundary.** Cancelling a discussion a specification sources refused bare, then `--cascade` cancelled the spec with it. A spec is a grouping of several discussions under its own name; taking it down from one source's cancel destroys work the other sources fed.

## Rulings

- **R1 — Cancel is topic-level, per stage.** The Discovery stage's unit is the map row with everything under its name: research, discussion, and the experiment series. The Definition stage's unit is the specification with its planning. Each unit cancels and reactivates as one. There is no phase-level cancel: not research alone, not discussion alone, not planning alone, not the experiment series.
- **R2 — A later stage locks the earlier.** A Discovery topic whose discussion a *started* specification sources is not cancelable; the refusal names the specification, and cancelling that first frees the topic. A *proposed* grouping never locks — it is a regenerable suggestion the analysis writes for every unaccounted discussion — and cancelling its source discards it, said in the receipt. Cancel never rolls through a stage boundary; `--cascade` is retired entirely.
- **R3 — Delivery never cancels.** Once an implementation or review item exists under a specification's name, the Definition unit above it is locked. Code in the tree is fixed forward through new work. The work-unit cancel stays for abandoning the whole epic. An install that cancelled a Delivery item under the per-item verb is repaired by migration, never listed.
- **R4 — Every topic is shown.** The cancel menu lists every unit, locked ones included. A locked row carries its reason inline and no pick key. Omission with an invisible cause is the failure this design starts from and must not recur.
- **R5 — A never-started topic carries its own marker.** `cancelled: true` on the map item, the mirror of `handled`. The lifecycle derivation reads it first. A started topic needs no marker — its items carry the status — and the every-item-cancelled reading stays as the fallback for manifests cancelled per phase before this design.
- **R6 — Remove stays a discovery operation for never-started topics.** It is for mistakes and duplicates: hard delete plus the dismissed list. Cancel means "not doing this" and keeps the row as the record that the topic was raised and declined.
- **R7 — Concluding research covers every "stop the research" case.** Mid-research and it didn't need researching: conclude with what you have. Reopened beneath a decided discussion and the concern isn't worth digging: conclude it as considered and set aside. Parked by a peer under a discussion in session: enter it and conclude. The engine's held-discussion clause stops suggesting a cancel.
- **R8 — Presence is a cue, never a lock.** A unit a live session is working shows the in-session age on its row, as the epic menu's rows do. The cancel gate is the confirm; nothing else gates.
- **R9 — A specification comes back only over sources it can hold.** Its reactivate is refused while a source topic is cancelled (reactivate the topic first) and while another *started* specification has taken a source since the cancel (regroup at the specification entry — the old grouping is not revived over discussions now owned elsewhere). The reactivate menu shows the locked row with the same reason, keyless.

## The settled shape

### Units and addresses

The verbs keep their positional phase argument with two valid values, because a single-discussion specification is commonly named after its discussion and the stage disambiguates:

```
engine topic cancel     {wu} discovery      {topic}
engine topic cancel     {wu} specification  {spec}
engine topic reactivate {wu} discovery      {topic}
engine topic reactivate {wu} specification  {spec}
```

Any other phase is refused: `cancel is topic-level per stage — discovery (the map row with its research, discussion, and experiments) or specification (with its planning)`. `--cascade` is not parsed; the usage line carries no such flag.

**Discovery unit** — keyed by the map row's name. For a legacy manifest whose research or discussion item has no map row, the unit is the name and the marker is simply not written.

**Definition unit** — keyed by the specification's name; planning is the same-named item when one exists.

**Started** is one reading everywhere — `specIsStarted`: status `in-progress` or `completed`. A `proposed` grouping is a regenerable suggestion; a status-less item (an augment against a mistyped key creates one) neither locks nor lists. **Groups sources** is the other — `specGroupsSources`: every status but `cancelled` and `superseded` (a promoted specification keeps its sources grouped in its cross-cutting unit). The epic detail's unaccounted-discussion count, the spec-entry gateway's individual-spec read, the continue-epic gateway's all-done filter, and the cancellable list all read through these two.

### What a cancel takes

One derivation, `cancelPlan(manifest, stage, name)`, is the reading the transactions execute and the cancel gate renders: the unit's live items (a status that is not terminal), every open experiment record — top-level and sub, in register order — and the `proposed` groupings sourcing the discussion. A Definition unit's plan is its items alone. A plan that takes nothing refuses the cancel: `"{topic}" has nothing to cancel — no live item under its name and no map row` / `specification "{spec}" has nothing to cancel — it carries no status`.

### Cancel, discovery unit

Refused when: no map row and no research/discussion item of that name; the unit already reads `cancelled`; a started specification sources the topic's discussion (`cancelling "{topic}" is refused while the specification "{spec}" sources its discussion — cancel the specification first`); the plan takes nothing.

In one locked write, in this order:

1. Release every experiment wait the topic's research and discussion hold (`releaseExperimentWaits`, all ids), so the `reconcile_needed: "experiment"` flag lands on the holders while they are still non-terminal and is carried inertly, surfacing at the conversation's next entry after a reactivate. Abandon the plan's records with `reason: "topic cancelled"`, then `settleItemStatus` the series — a series a legacy per-series cancel closed is left as found.
2. Every item in the plan: `previous_status = status`, `status = 'cancelled'` — `triaged` stubs included.
3. Every proposed grouping in the plan is deleted from the manifest and named under `discarded`.
4. The map row, when it exists: `cancelled = true`; `order` stashed to `previous_order` and deleted, once.

After the lock: `knowledge remove` for each research and discussion item that existed (warn, never block); the cancel-revert hop (`revertJoins`), since the lifecycle now reads `cancelled`; one confined commit `workflow({wu}): cancel {topic} (discovery)` — the manifest alone, so a commit failure degrades to the generic `commit pending` note.

Response: `{ok, topic, phase: "discovery", status: "cancelled", cancelled: [{phase, previous_status}…], discarded[], abandoned[], released_waits[], roadmap_reverted[], committed, warnings}` — the three arrays always present.

### Cancel, definition unit

Refused when: no specification item; status `proposed` (`a proposed grouping is not started — cancel its source topic to discard it, or let the grouping walk regroup`); status terminal; an implementation or review item of the name exists, any status (`"{spec}" is locked — implementation has started; code in the tree is fixed forward, and the work-unit cancel abandons the epic`); the plan takes nothing.

In one locked write: the specification `previous_status`/`cancelled`, `order` → `previous_order`; the same-named planning item, when present and not terminal, `previous_status`/`cancelled`. After the lock: `knowledge remove` for the specification; commit `workflow({wu}): cancel {spec} (specification)`. Source discussions are untouched; they read as unaccounted again, so the next grouping analysis can regroup them and they are now free to be cancelled themselves.

Response: `{ok, topic, phase: "specification", status: "cancelled", cancelled: [{phase, previous_status}…], discarded: [], abandoned: [], released_waits: [], committed, warnings}` — the same shape as the discovery unit's, the arrays empty.

### Reactivate

**Discovery unit** — requires the unit to read `cancelled` (marker, or the legacy fallback). Clears the marker; every research and discussion item with `status: cancelled` is restored — a stash returns as the status (`assertLegalWrite`); an item cancelled with none returns to never-attempted, its `status` deleted and reported `{phase, status: null}`; the map `order` returns from `previous_order` only while no live row holds the number — the collision guard the specification side has — and `previous_order` is deleted either way, a taken number leaving the row unordered so `needs_sequencing` flips; `knowledge index` for each restored `completed` artifact. A unit that would still read cancelled after the restore is refused with nothing written — the backstop against a reactivate menu that round-trips forever. No roadmap re-join, no flag changes.

**Definition unit** — requires the specification `cancelled`. Refused while a source is unavailable, every offending source named (R9): a source topic whose lifecycle reads `cancelled` (`reactivating "{spec}" is refused while its source "{topic}" is cancelled — reactivate the topic first`), or a source another started specification's `sources` holds (`reactivating "{spec}" is refused while the specification "{other}" sources "{topic}" — regroup at the specification entry`); plural forms list every source. The lock facts are one derivation, `specReactivateLocks(manifest, spec)` → `[{topic, reason: 'cancelled'} | {topic, reason: 'held', by}]`, and one phrasing, `reactivateLockPhrases`, shared with the reactivate menu's locked rows. Then every `proposed` grouping over a returning source is discarded and named under `discarded` — the source is accounted for again, the mirror of the cancel's discard — and the specification and its same-named cancelled planning item are restored, the build-order restore collision-guarded, a `completed` specification re-indexed.

Response: `{ok, topic, phase, status: "reactivated", restored: [{phase, status|null}…], discarded[], committed, warnings}`.

### The lifecycle derivation

`computeTopicLifecycle` reads `discovery.cancelled === true` first → `cancelled` ⊘. The `handled` branch follows, then the rest, with the fallback last: every attempted item is terminal and at least one is `cancelled` → `cancelled` — so superseded research beside a cancelled discussion reads cancelled on a map-less legacy topic and can be reactivated, while a `triaged` sibling is not an attempt and keeps the topic fresh. A marker on a handled row reads cancelled; reactivate clears the marker and the row reads handled again. `handleItem` refuses a cancelled lifecycle; `unhandleItem` refuses it toward the reactivate (`"{name}" can't be reopened — it's cancelled; reactivate it from the epic menu first`); a dead-end close over a `triaged` stub names the drain path (`start the topic to drain them, or cancel the topic from the epic menu instead`).

### The closed row refuses a landing

`topic triage` on an epic checks the map row before any item handling: a `cancelled` lifecycle refuses `"{topic}" is cancelled — reactivate it from the epic menu first`, a `handled` one `"{topic}" is closed as a dead end — reopen it in discovery first`. The prose routes a closed target through its own gate before landing; the engine refusal is the backstop for a peer closing the target between the landing's read and its write, and the landing re-resolves so the gate takes over.

### The field surface

A cancelled phase item takes no `status` write and no `delete` — the whole item or any field of it — through `manifest set`, `delete`, or `apply`: `{phase} item "{topic}" is cancelled — reactivate it instead (engine topic reactivate {wu} {discovery|specification} {topic})`, the reactivate addressed by the unit that frees the item. A reconcile's `delete items.{name}` would otherwise erase a cancelled specification with its stashes. The item's other fields stay writable.

### The menus

`selectionSubView` carries a locked row: `SubViewRow.locked` — the reason, in place of a pick label. A locked row renders in the DISPLAY tree with no number and the reason after a `·`, contributes no MENU option and no ACTIONS line; keys run continuously over pickable rows only. When rows exist and none is pickable, the menu opens on a statement in the question's place — cancel: `Nothing can be cancelled right now — each row names what holds it.`; reactivate: `Nothing can be reactivated right now — each row names what holds it.` — over `b/back` alone; zero rows keep the empty text.

**Cancel menu** (`gateway.cjs cancel-menu`), title `Cancellable Topics`, two groups:

- `Topics` — every discovery unit not reading `cancelled`, in map order: `handled` rows keyed (cancelling a dead end is harmless); a row whose discussion a started specification sources is locked `locked by specification "{Spec}" — cancel it first` (titlecased, plural `specifications … cancel them first`); a unit a live session holds carries ` · in session (last active {age} ago)` — the gateway passes the presence scan to the sub-view, and the laboratory counts toward its topic's hold (`UNIT_PRESENCE_PHASES`: research, discussion, experiment; specification, planning).
- `Specifications` — every started specification, in build order; locked `implementation started — fix forward` when an implementation or review item exists.

Row label `Cancel "{Title}"`; the tag after the title is the unit's state — the map lifecycle label for a topic, the spec status for a specification. The main menu's `a/cancel` reads `Cancel a topic` and shows whenever a unit exists, pickable or not (R4 — a locked-only board still shows its rows and their reasons); `e/reactivate` shows whenever a unit reads cancelled.

**Reactivate menu** (`gateway.cjs reactivate-menu`), title `Cancelled Topics`, the same two groups over cancelled units, the same presence cue. A row names what returns — `never started`, or `research [was completed] · discussion [was in-progress]`, a stash-less item `research (never started)`; a specification row `specification [was completed] · planning [was in-progress]`. A specification whose sources are unavailable is locked with the reactivate lock's phrasing — `locked — its source "Synonym Handling" is cancelled; reactivate the topic first` / `locked — the specification "Notes" now sources "Synonym Handling"; regroup at the specification entry` — and the all-locked statement applies.

### The surfaces

- `render cancel-gate {wu}.{discovery|specification}.{name}` — one MENU section, the confirm, rendered from `cancelPlan`. The statement names exactly what the cancel takes: for a never-started topic `Cancelling **Data Export** takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later.`; for a started one, the items by phase with their `[status]`, the open experiments that end abandoned — counted top-level, a split named with its parent (`1 open experiment (E2, with E2.1) ends abandoned on the register.`; `2 open experiments (E1, E2 with E2.1) end abandoned…`) — and any proposed grouping discarded; for a specification, `marks the specification and its plan cancelled and frees its source discussions ({Names}) to be regrouped or cancelled; it can be reactivated later`. A locked, already-cancelled, or nothing-to-cancel unit throws — the menu never offers it.
- `render topic-receipt --verb cancel|reactivate` resolves the two unit addresses: `Cancelled "{Title}".` / `Reactivated "{Title}". Restored research [completed] · discussion [in-progress].` — the restored list read from the live items, so a never-attempted return is absent from it; the knowledge warning callouts as today. The prose adds its one line for `discarded`, `abandoned`, and `released_waits` on a cancel, and for a `null` restore and `discarded` on a reactivate, each from the response when non-empty.
- `render triage-closed-target`'s `o/open` line reactivates the unit — the triage landing calls `topic reactivate {wu} discovery {target}`.
- `render direct-entry-gate` over a cancelled topic guides `Reactivate it from the epic menu (e/reactivate) — a cancelled topic carries no menu row.`; `render map-op-gate`'s remove/rename/reroute refusal over a cancelled row ends `— reactivate it from the epic menu first`.
- The held-discussion clause (`waitClauses`) reads `awaits research on the topic — conclude the research to release the wait`; the wait gate's guidance reads `Work the research first — concluding it releases its wait`.
- The spec-entry gateway's DATA carries `cancelled_specifications:` — one line per cancelled specification, `{name}: sources {a}, {b}` (or `(none)`) — excluded from `specifications:`; the grouping analysis reserves the key and notes resemblance from it, and the unify guard reads it for the reserved-key check.

## Rejected shapes

- **Roll the cancel down through the specification.** A spec groups several discussions; one source's cancel destroying the grouping and everything planned under it is the destructive move the stage boundary exists to prevent. Refuse and point at the spec instead.
- **Lock at the proposal.** Proposals persist for every unaccounted discussion after each analysis run; locking there would make no decided topic cancelable without first discarding proposals one by one. The commitment point is the confirm that starts the spec.
- **Route a never-started topic's cancel to the map remove.** Fills the hole but conflates two intents and leaves nothing to reactivate.
- **Keep the experiment series cancelable on its own.** A single record is abandoned inside the laboratory; the series belongs to its topic.
- **Omit locked rows.** The original failure, restated.
- **Revive a specification over sources another has taken.** Two started specifications holding one discussion is the state the grouping analysis exists to prevent; the reactivate refuses and the way back is the regroup.
- **Refuse a reactivate over a stash-less item.** The per-item cancel of a status-less item stashed nothing; leaving it cancelled forever is a row no verb frees. The inverse of the cancel is the status's deletion.

## Consequences

- **Legacy per-phase cancels.** A topic with one cancelled and one live item reads live; cancelling it takes the live item and reactivating restores every cancelled item. A topic whose every attempted item is terminal with one cancelled reads cancelled through the fallback and reactivates. A legacy cancelled implementation item locks its Definition unit, since code may have landed before the cancel. Migration 058 restores every legacy cancelled planning, implementation, or review item to its stash, or to never-attempted when it stashed nothing — Delivery never cancels, and a row no menu lists and no verb frees is not left behind; specification, research, and discussion items are the unit verbs' own and are never touched.
- **`superseded` items** are terminal and never listed as cancelable.
- **Dependencies another plan declares on a cancelled specification's plan** are unchanged from the per-item spec cancel: out of scope here.
- **Roadmap** — the cancel-revert hop fires on the unit's lifecycle reading cancelled; reactivate never re-joins.
- **Presence** — cancel and reactivate never beat or clear; the row cue is the only read (design/concurrent-phases.md).
- **Concluded design records** naming `--cascade` or the per-item menus (build-order.md, spec-side-coherence.md, concurrent-discussions.md, render-surfaces.md) are frozen and stay as written; this document is the record of the change.

## Engine surface

| Surface | Change |
| --- | --- |
| `transitions.cjs` `cancelTopic`/`reactivateTopic` | rewritten over units, executing `cancelPlan`; nothing-to-cancel refusals; stash-less restore to never-attempted; the specification reactivate's locks and discard; `assertTriageTargetOpen` before `parkConcernItem`; the generic commit-retry note; `--cascade` gone; map-order restore collision-guarded; `waitClauses` reworded |
| `derivations.cjs` | `computeTopicLifecycle` marker branch first, fallback over terminal siblings; `specIsStarted`, `specGroupsSources`, `cancelPlan`, `proposedGroupings`, `specReactivateLocks`, `reactivateLockPhrases`, `liveSeries` |
| `fields.cjs` | `assertNotCancelled` addressed by unit; `assertNotCancelledDelete` on `delete` and `apply` delete ops |
| `discovery-map.cjs` `handleItem`, `unhandleItem`, `lifecyclePhrase` | the triaged drain path; a cancel marker refused toward the reactivate; messages drop "phase work" |
| `epic-detail.cjs` | `cancelled` becomes units (`{name, stage, restores[], locked?}`); lock reasons computed here, titlecased, single-homed over the shared derivations |
| `projections/epic.cjs` | `selectionSubView` locked rows and the all-locked statement; `epicCancelMenu`/`epicReactivateMenu` over units with groups, `UNIT_PRESENCE_PHASES`; `[was …]` status terms; `a/cancel` label |
| `workflow-continue-epic/scripts/gateway.cjs` | sub-views receive the presence scan; the all-done filter reads terminal |
| `workflow-specification-entry/scripts/gateway.cjs` | `cancelled_specifications` in the result and its DATA section; the individual-spec read through `specIsStarted` |
| `render.cjs` | `cancelGate` over `cancelPlan`, experiments counted top-level; `cancelCascadeGate` deleted; `topicReceiptSurface` resolves unit addresses; `directEntryGate` and `assertMapOp` guidance over a cancelled row; `triageClosedTarget` wording |
| `projections/wait.cjs` | guidance line |
| `engine.cjs` | cancel branch loses `--cascade`; usage lines in `commands.md`'s form; reactivate through the same unit path |
| `migrations/058-restore-cancelled-delivery-items.cjs` | legacy cancelled Delivery items restored |
| `references/commands.md`, `library-and-gateway.md` | verbs, refusals, responses, surfaces |

## Test plan

- `test-engine-transactions.cjs` — discovery unit: never-started marker; research + discussion + triaged stub in one cancel; waits released with the flag landing before the holders close, records abandoned, series settled; proposed grouping discarded and named; started spec locks with its message; map order stashed once; knowledge removed per item; roadmap reverted; a cancel that takes nothing refuses; handled + cancel + reactivate round trip. Reactivate: marker cleared; items restored; a stash-less item returns to never-attempted; order restore refused over a taken number; knowledge re-indexed; legacy all-cancelled and superseded-beside-cancelled topics reactivate. Definition unit: spec + planning; implementation and review lock; proposed and status-less refused; order stash/restore; reactivate refused over a cancelled source and over a source another started spec holds (legacy array-form `sources` included), the proposed grouping over a returning source discarded. `topic triage` refused onto a cancelled and a handled row. Refusals: `research`, `discussion`, `experiment`, `planning`, `--cascade`. The wait clause's wording.
- `test-engine-epic-projections.cjs` — cancel menu groups, locked rows keyless with titlecased reasons, keys continuous over pickable rows, the presence cue over the laboratory, `a/cancel` whenever a unit exists, the all-locked statement; reactivate menu units with what returns in `[was …]` form, a never-started restore, locked specification rows; a superseded or status-less specification never listed; specifications grouped in build order.
- `test-engine-render-surfaces.cjs` — cancel gate over never-started, started with records (a split counted with its parent) and a discard, specification, nothing-to-cancel; receipts over both addresses with `[status]` terms; `triage-closed-target`, `direct-entry-gate`, and `map-op-gate` wording over a cancelled row.
- `test-reads-derivations.cjs` — marker first, marker over handled, the fallback over a terminal sibling, `cancelPlan`, `specReactivateLocks`, `specIsStarted`/`specGroupsSources`.
- `test-engine-manifest-fields.cjs` + `test-engine-manifest.sh` — the status and delete refusals addressed by unit.
- `test-gateway-for-specification.cjs` — `cancelled_specifications` in the DATA section.
- `test-migration-058.cjs` — each Delivery phase, stash-less deletion, untouched phases, no-op, idempotency, preservation, malformed manifest.
- `test-engine-build-order.cjs`, `test-engine-roadmap.cjs`, `test-engine-experiment.cjs`, `test-engine-commit-door.cjs`, `test-gateway-for-workflow-continue-epic.cjs` — every cancel leg re-pinned; the partial-cancel-keeps-the-join test retired with the partial cancel.
- `test-pipeline-simulation.cjs` — the sourced-discussion leg is refusal → spec cancel → source cancel; the experiment legs are unit cancels; after a spec cancel a grouping under a new name lands and one under the cancelled name is refused, a delete of the cancelled item is refused, the spec's reactivate is refused over a cancelled source and over a taken source and lands once both clear (the proposed grouping named under `discarded`), a landing onto a cancelled and a handled row refuses, a cancel that takes nothing refuses, a stash-less cancelled discussion reactivates to no status.
- Prose cases: `epic-menu-cancels-a-never-started-topic` (cancel from the epic menu, reactivate; the map remove's refusal is engine-tested); `epic-menu-cancels-a-specification-then-its-source` (the locked row, the spec unit's cancel freeing the topic, the topic's cancel discarding nothing and the receipt naming what went); `spec-grouping-reserves-a-cancelled-key` (the grouping analysis over a cancelled specification's freed sources names the grouping afresh, says it resembles the cancelled one, and never writes the reserved key). `start-cancels-a-sourced-discussion` retired, its fixture reused.

## Build plan

Design doc standalone (PR0). Two implementation slices, each one agent, each reviewed against the tree before the next opens.

- **PR1 — engine.** Everything in the engine surface table, its unit tests, and the simulation. Green on `npm test`, `npm run test:cli`, `npm run typecheck`.
- **PR2 — prose, docs, cases.** `epic-display-and-menu.md` E and F over the unit addresses (the cascade branch gone, the receipt's one-liners kept); `triage-landing.md`'s reactivate call; `map-operations.md`'s phrases and pointer; `validate-phase.md` and `correcting-historical-artifacts.md` where they name the old shape; `CLAUDE.md` Epic topic cancellation and the build-order paragraph; `CONVENTIONS.md`'s cancel-gate example re-quoted from the new surface; `README.md`; the two prose cases with snapshots regenerated (`node tests/prose/run.cjs snap`), `select --diff main` run and the intersecting cases named.
- **Review fixes, two stacked PRs.** PR A — engine, migration 058, tests: the one cancel plan, the nothing-to-cancel refusals, the stash-less restore, the specification reactivate locks and discard, the triage refusal, the delete guard, the started reading single-homed, the all-locked statement, the gateway's `cancelled_specifications`. PR B — prose, docs, cases, this record.

## Log

- 2026-09-16 — Review pass over the merged work (main `03fb2b544..5dbb12cca`), verified against the tree and a scratch world. What it found: a cancel that took nothing answered `ok` and committed nothing while the receipt threw; a reactivate refused a stash-less cancelled item forever; a cancel plan spelled three times (the gate, the transaction, the discard filter) and a "started" reading three times; the lifecycle fallback let superseded research beside a cancelled discussion read fresh; a reconcile's `delete items.{name}` erased a cancelled specification with its stashes; `topic triage` accepted a landing onto a closed row; the grouping analysis read a `cancelled_specifications` list the gateway never carried, so the resemblance rule was unreachable; the cancel gate counted sub-experiments as experiments; the menu never said why every row was locked. Two rulings from the user folded in: **a specification's reactivate refuses while a source is unavailable** — its topic cancelled, or another started specification holding it — with a proposed grouping over a returning source discarded (R9); and **migration 058 restores legacy cancelled Delivery items** rather than leaving them listed nowhere (R3's repair clause).
- 2026-09-16 — Opened from a Fumi epic session where `a/cancel` omitted the never-started topic data-export. Rulings R1–R8 agreed in conversation: cancel is topic-level per stage, a later stage locks the earlier, Delivery never cancels, every row shown; the proposal-does-not-lock ruling and the retirement of the experiment-series cancel are the user's acceptance of two push-backs.
