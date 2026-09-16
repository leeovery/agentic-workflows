# Topic Cancel — one cancel per stage, over the thing the user sees

A topic on an epic is the row the dashboard draws. Cancel is "we are not doing this", said about that row. Where the engine keeps the fact — a status on a research item, on a discussion item, on a specification, or a marker on the map row itself — is storage, and the user never meets it. Opened 2026-09-16.

## Motivation

- **A never-started topic could not be cancelled.** Fumi's epic menu listed Data Export as one of nineteen topics with its own start row, then `a/cancel` omitted it. The cancel menu walks per-phase items (`epicCancelMenu` over `detail.phases`, which drops the discovery map at `epic-detail.cjs:226`); a map-only topic has none. Four of the seven fresh topics *did* appear, because rerouted concerns had parked `triaged` stubs on them — a discriminator nothing on screen shows. The route offered instead was a discovery session and the word "remove": a different verb (hard delete plus the dismissed list, no reactivate) behind a heavier door, for a one-line intent.
- **Cancel was per phase item, not per topic.** The same menu listed Onboarding And Permissions, Space Homing, and Platform Support twice each — research and discussion as separate rows — and asked which half to cancel. Cancelling research a discussion already read retracts a record the discussion absorbed, and the engine made it worse by removing the research's knowledge-base chunks while the discussion stood on them. Cancelling a discussion and keeping its research left a topic that read *ready for discussion* while `topic start` refused the cancelled item. Neither half ever had a product meaning the whole doesn't cover better.
- **The cascade rolled through a stage boundary.** Cancelling a discussion a specification sources refused bare, then `--cascade` cancelled the spec with it. A spec is a grouping of several discussions under its own name; taking it down from one source's cancel destroys work the other sources fed.

## Rulings

- **R1 — Cancel is topic-level, per stage.** The Discovery stage's unit is the map row with everything under its name: research, discussion, and the experiment series. The Definition stage's unit is the specification with its planning. Each unit cancels and reactivates as one. There is no phase-level cancel: not research alone, not discussion alone, not planning alone, not the experiment series.
- **R2 — A later stage locks the earlier.** A Discovery topic whose discussion a *started* specification sources is not cancelable; the refusal names the specification, and cancelling that first frees the topic. A *proposed* grouping never locks — it is a regenerable suggestion the analysis writes for every unaccounted discussion — and cancelling its source discards it, said in the receipt. Cancel never rolls through a stage boundary; `--cascade` is retired entirely.
- **R3 — Delivery never cancels.** Once an implementation or review item exists under a specification's name, the Definition unit above it is locked. Code in the tree is fixed forward through new work. The work-unit cancel stays for abandoning the whole epic.
- **R4 — Every topic is shown.** The cancel menu lists every unit, locked ones included. A locked row carries its reason inline and no pick key. Omission with an invisible cause is the failure this design starts from and must not recur.
- **R5 — A never-started topic carries its own marker.** `cancelled: true` on the map item, the mirror of `handled`. The lifecycle derivation reads it first. A started topic needs no marker — its items carry the status — and the every-item-cancelled reading stays as the fallback for manifests cancelled per phase before this design.
- **R6 — Remove stays a discovery operation for never-started topics.** It is for mistakes and duplicates: hard delete plus the dismissed list. Cancel means "not doing this" and keeps the row as the record that the topic was raised and declined.
- **R7 — Concluding research covers every "stop the research" case.** Mid-research and it didn't need researching: conclude with what you have. Reopened beneath a decided discussion and the concern isn't worth digging: conclude it as considered and set aside. Parked by a peer under a discussion in session: enter it and conclude. The engine's held-discussion clause stops suggesting a cancel.
- **R8 — Presence is a cue, never a lock.** A unit a live session is working shows the in-session age on its row, as the epic menu's rows do. The cancel gate is the confirm; nothing else gates.

## The settled shape

### Units and addresses

The verbs keep their positional phase argument with two valid values, because a single-discussion specification is commonly named after its discussion and the stage disambiguates:

```
engine topic cancel     {wu} discovery      {topic}
engine topic cancel     {wu} specification  {spec}
engine topic reactivate {wu} discovery      {topic}
engine topic reactivate {wu} specification  {spec}
```

Any other phase is refused: `cancel is topic-level per stage — discovery (the map row with its research, discussion, and experiments) or specification (with its planning)`. `--cascade` is no longer parsed; the usage line drops it.

**Discovery unit** — keyed by the map row's name. For a legacy manifest whose research or discussion item has no map row, the unit is the name and the marker is simply not written.

**Definition unit** — keyed by the specification's name; planning is the same-named item when one exists.

### Cancel, discovery unit

Refused when: no map row and no research/discussion item of that name; the unit already reads `cancelled`; a started specification sources the topic's discussion — status not in `TERMINAL_STATUSES` and not `proposed`, `sourceRow(sources, topic)` present — with the message `cancelling "{topic}" is refused while the specification "{spec}" sources its discussion — cancel the specification first`.

In one locked write, in this order:

1. Release every experiment wait the topic's research and discussion hold (`releaseExperimentWaits`, all ids), so the `reconcile_needed: "experiment"` flag lands on the holders while they are still non-terminal and is carried inertly, surfacing at the conversation's next entry after a reactivate. Abandon every open record on the series (`abandonOpenRecords(item, 'topic cancelled')`), then `settleItemStatus` it.
2. Every research and discussion item of the name whose status is not terminal: `previous_status = status`, `status = 'cancelled'` — `triaged` stubs included.
3. Every `proposed` specification sourcing the discussion is deleted from the manifest and named under `discarded`.
4. The map row, when it exists: `cancelled = true`; `order` stashed to `previous_order` and deleted, once.

After the lock: `knowledge remove` for each research and discussion item that existed (warn, never block); the cancel-revert hop (`revertJoins`) as today, since the lifecycle now reads `cancelled`; one confined commit `workflow({wu}): cancel {topic} (discovery)`.

Response: `{ok, topic, phase: "discovery", status: "cancelled", cancelled: [{phase, previous_status}…], discarded[], abandoned[], released_waits[], roadmap_reverted[], committed, warnings}`.

### Cancel, definition unit

Refused when: no specification item; status `proposed` (`a proposed grouping is not started — cancel its source topic to discard it, or let the grouping walk regroup`); status terminal; an implementation or review item of the name exists, any status (`"{spec}" is locked — implementation has started; code in the tree is fixed forward, and the work-unit cancel abandons the epic`).

In one locked write: the specification `previous_status`/`cancelled`, `order` → `previous_order`; the same-named planning item, when present and not terminal, `previous_status`/`cancelled`. After the lock: `knowledge remove` for the specification; commit `workflow({wu}): cancel {spec} (specification)`. Source discussions are untouched; they read as unaccounted again, so the next grouping analysis can regroup them and they are now free to be cancelled themselves.

Response: `{ok, topic, phase: "specification", status: "cancelled", cancelled: [{phase, previous_status}…], committed, warnings}`.

### Reactivate

**Discovery unit** — requires the unit to read `cancelled` (marker, or the legacy every-item fallback). Clears the marker; every research and discussion item with `status: cancelled` and a `previous_status` is restored (`assertLegalWrite`); the map `order` returns from `previous_order` only while no live row holds the number — the collision guard the specification side already has — and `previous_order` is deleted either way, a taken number leaving the row unordered so `needs_sequencing` flips; `knowledge index` for each restored `completed` artifact. No roadmap re-join, no flag changes, as today.

**Definition unit** — requires the specification `cancelled`. Restores it and the same-named cancelled planning item; the build-order restore stays collision-guarded; re-index a `completed` specification.

Response: `{ok, topic, phase, status: "reactivated", restored: [{phase, status}…], committed, warnings}`.

### The lifecycle derivation

`computeTopicLifecycle` gains one branch, first: `discovery.cancelled === true` → `cancelled` ⊘. The `handled` branch follows, then the rest unchanged, the every-attempted-item-cancelled branch kept as the fallback. A marker on a handled row reads cancelled; reactivate clears the marker and the row reads handled again. `handleItem` keeps refusing a cancelled lifecycle; its message and `lifecyclePhrase`'s stop saying "phase work".

### The menus

`selectionSubView` learns a locked row: `SubViewRow.locked?: string` — the reason. A locked row renders in the DISPLAY tree with no number and the reason after a `·`, contributes no MENU option and no ACTIONS line; keys run continuously over pickable rows only.

**Cancel menu** (`gateway.cjs cancel-menu`), title `Cancellable Topics`, two groups:

- `Topics` — every discovery unit not reading `cancelled`, in map order: `handled` rows keyed (cancelling a dead end is harmless); a row whose discussion a started specification sources is locked `locked by specification "{spec}" — cancel it first`; a unit a live session holds carries ` · in session (last active {age} ago)` — the gateway passes the presence scan to the sub-view as the view already does.
- `Specifications` — every specification not `proposed` and not terminal, in build order; locked `implementation started — fix forward` when an implementation or review item exists.

Row label `Cancel "{Title}"`; the tag after the title is the unit's state — the map lifecycle label for a topic, the spec status for a specification. The main menu's `a/cancel` reads `Cancel a topic` and shows when any pickable row exists; `e/reactivate` shows when any unit reads cancelled.

**Reactivate menu** (`gateway.cjs reactivate-menu`), title `Cancelled Topics`, the same two groups over cancelled units. A topic row names what returns — `never started`, or `research (was completed) · discussion (was in-progress)`; a specification row `specification (was completed) · planning (was in-progress)`.

### The surfaces

- `render cancel-gate {wu}.{discovery|specification}.{name}` — one MENU section, the confirm. The statement names exactly what the cancel takes: for a never-started topic `Cancelling **Data Export** takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later.`; for a started one, the items by phase, the count and ids of open experiment records that end abandoned, and any proposed grouping discarded; for a specification, `marks the specification and its plan cancelled and frees its source discussions ({names}) to be regrouped or cancelled; it can be reactivated later`. A locked or already-cancelled unit throws — the menu never offers it.
- `render cancel-cascade-gate` is deleted.
- `render topic-receipt --verb cancel|reactivate` resolves the two unit addresses: `Cancelled "{Title}".` / `Reactivated "{Title}".` with the restored statuses; the knowledge warning callouts as today. The prose keeps adding its one line for `discarded`, `abandoned`, and `released_waits` from the response.
- `render triage-closed-target`'s `o/open` line reactivates the unit — the triage landing calls `topic reactivate {wu} discovery {target}`.
- The held-discussion clause (`waitClauses`) reads `awaits research on the topic — conclude the research to release the wait`; the wait gate's guidance reads `Work the research first — concluding it releases its wait`.

## Rejected shapes

- **Roll the cancel down through the specification.** A spec groups several discussions; one source's cancel destroying the grouping and everything planned under it is the destructive move the stage boundary exists to prevent. Refuse and point at the spec instead.
- **Lock at the proposal.** Proposals persist for every unaccounted discussion after each analysis run; locking there would make no decided topic cancelable without first discarding proposals one by one. The commitment point is the confirm that starts the spec.
- **Route a never-started topic's cancel to the map remove.** Fills the hole but conflates two intents and leaves nothing to reactivate.
- **Keep the experiment series cancelable on its own.** A single record is abandoned inside the laboratory; the series belongs to its topic.
- **Omit locked rows.** The original failure, restated.

## Consequences

- **Legacy per-phase cancels.** A topic with one cancelled and one live item reads live; cancelling it takes the live item and reactivating restores every item carrying a `previous_status`. A topic whose every attempted item is cancelled reads cancelled through the fallback and reactivates. A legacy cancelled planning, implementation, or review item is listed nowhere; a legacy cancelled implementation item locks its Definition unit, since code may have landed before the cancel. No migration.
- **`superseded` items** are terminal and never listed as cancelable — today's menu lists them.
- **Dependencies another plan declares on a cancelled specification's plan** are unchanged from today's per-item spec cancel: out of scope here.
- **Roadmap** — the cancel-revert hop fires on the unit's lifecycle reading cancelled, as today; reactivate never re-joins.
- **Presence** — cancel and reactivate never beat or clear; the row cue is the only read (design/concurrent-phases.md).
- **Concluded design records** naming `--cascade` or the per-item menus (build-order.md, spec-side-coherence.md, concurrent-discussions.md, render-surfaces.md) are frozen and stay as written; this document is the record of the change.

## Engine surface

| Surface | Change |
| --- | --- |
| `transitions.cjs` `cancelTopic`/`reactivateTopic` | rewritten over units; discovery arm before `phaseItem`; lock refusals; `--cascade` gone; map-order restore collision-guarded; `waitClauses` reworded |
| `derivations.cjs` `computeTopicLifecycle` | marker branch first |
| `discovery-map.cjs` `handleItem`, `lifecyclePhrase` | messages drop "phase work" |
| `epic-detail.cjs` | `cancelled` becomes units (`{name, stage, restores[]}`); unit lock reasons computed here, single-homed |
| `projections/epic.cjs` | `selectionSubView` locked rows; `epicCancelMenu`/`epicReactivateMenu` over units with groups; `a/cancel` label |
| `workflow-continue-epic/scripts/gateway.cjs` | sub-views receive the presence scan |
| `render.cjs` | `cancelGate` rewritten; `cancelCascadeGate` deleted; `topicReceiptSurface` resolves unit addresses; `triageClosedTarget` wording |
| `projections/wait.cjs` | guidance line |
| `engine.cjs` | cancel branch loses `--cascade`; usage lines; reactivate through the same unit path |
| `references/commands.md`, `library-and-gateway.md` | verbs, responses, surfaces |

## Test plan

- `test-engine-transactions.cjs` — discovery unit: never-started marker; research + discussion + triaged stub in one cancel; waits released with the flag landing before the holders close, records abandoned, series settled; proposed grouping discarded and named; started spec locks with its message; map order stashed once; knowledge removed per item; roadmap reverted. Reactivate: marker cleared; items restored; order restore refused over a taken number; knowledge re-indexed; legacy all-cancelled topic reactivates. Definition unit: spec + planning; implementation and review lock; proposed refused; order stash/restore. Refusals: `research`, `discussion`, `experiment`, `planning`, `--cascade`. The wait clause's new wording.
- `test-engine-epic-projections.cjs` — cancel menu groups, locked rows keyless with reason, keys continuous over pickable rows, the presence cue, `a/cancel` label; reactivate menu units with what returns.
- `test-engine-render-surfaces.cjs` — cancel gate over never-started, started with records and a discard, specification; the cascade gate's suite removed; receipts over both addresses; `triage-closed-target` wording.
- `test-reads-derivations.cjs` — marker first, marker over handled, legacy fallback intact.
- `test-engine-build-order.cjs`, `test-engine-roadmap.cjs`, `test-engine-experiment.cjs`, `test-engine-commit-door.cjs`, `test-gateway-for-workflow-continue-epic.cjs` — every cancel leg re-pinned; the partial-cancel-keeps-the-join test retired with the partial cancel.
- `test-pipeline-simulation.cjs` — every scenario in the fact sheet's inventory re-pinned: the sourced-discussion leg becomes refusal → spec cancel → source cancel; the experiment legs become unit cancels.
- Prose cases (PR2): `epic-menu-cancels-a-never-started-topic` (cancel from the epic menu, reactivate, the map remove refuses it meanwhile); `epic-menu-cancels-a-specification-then-its-source` (the locked row, the spec unit's cancel freeing the topic, the topic's cancel discarding nothing and the receipt naming what went). `start-cancels-a-sourced-discussion` retires, its fixture reused.

## Build plan

Design doc standalone (PR0). Two implementation slices, each one agent, each reviewed against the tree before the next opens.

- **PR1 — engine.** Everything in the engine surface table, its unit tests, and the simulation. Green on `npm test`, `npm run test:cli`, `npm run typecheck`.
- **PR2 — prose, docs, cases.** `epic-display-and-menu.md` E and F over the unit addresses (the cascade branch gone, the receipt's one-liners kept); `triage-landing.md`'s reactivate call; `map-operations.md` lines 67, 91, 93, 106 (the phrases and the pointer); `validate-phase.md:51` and `correcting-historical-artifacts.md:41` where they name the old shape; `CLAUDE.md` Epic topic cancellation and the build-order paragraph; `CONVENTIONS.md:329-338`'s cancel-gate example re-quoted from the new surface; `README.md:108`; the two prose cases with snapshots regenerated (`node tests/prose/run.cjs snap`), `select --diff main` run and the intersecting cases named.

## Log

- 2026-09-16 — Opened from a Fumi epic session where `a/cancel` omitted the never-started topic data-export. Rulings R1–R8 agreed in conversation: cancel is topic-level per stage, a later stage locks the earlier, Delivery never cancels, every row shown; the proposal-does-not-lock ruling and the retirement of the experiment-series cancel are the user's acceptance of two push-backs.
