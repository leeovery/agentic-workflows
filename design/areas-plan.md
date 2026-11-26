# Areas: the build plan

The plan for building `design/areas.md`. Approved by Lee on 26 Nov 2026.

## How it is built

- **Where it lands.** One long-running branch, `feat/areas`, cut from main. Each slice is a pull request into it. `feat/areas` is merged to main once, at the end, on Lee's word, and released once.
- **Who builds.** The session orchestrates: it briefs, reviews and decides. Implementer agents write the code, one slice each. Two fresh agents review every pull request independently, and what they find goes back to the slice's implementer.
- **The gates.** An implementer runs the tests of what it changed. The full gates (`npm test`, `npm run test:cli`, `npm run test:migrations`, `npm run typecheck`, and `npm run test:mod` for the gate mods) run once per pull request, on its final tree, one suite at a time.
- **Merging.** A pull request is merged into `feat/areas` by the orchestrator once it is reviewed and its gates are green. Questions that do not block go to Lee on the board while the work carries on.
- **The migration.** Migration 082 is one file that stays unreleased until the end; each slice that changes a stored shape adds its part. It is rehearsed on sandboxed copies of Lee's projects, one project at a time, each run taken to its end: Fumi and Portal for work mid-discussion, agntc and Mint for finished work.
- **How the code reads.** As if areas had been the design from the start. No comment, name, test title, fixture or guard says what a thing used to be, and no identifier is left half-renamed. The shapes of before are met only in migrations. "Topic" and "epic" are gone from the engine, the skills, the docs and the tests, except where the repo's rules keep them: released migrations and their suites, fixtures of old state, and the history.
- **The kinds.** The first conversation names the work a feature, a bugfix or a quick-fix (9.1.5). A feature is any piece of work, large or small, that is neither of the others. The line between a quick-fix and a feature does not move.

## Where the plan changes most if a proposal of Claude's falls
- **8.1.2 (mail goes).** Slice 11 would keep the mail code, and the directive would shrink.
- **3.1.3 (one owner per entry).** Labels would hold several areas, which reshapes the line format, the relabel and derived standing (slices 3 and 7).
- **6.4.1 and 6.3.5 (tracked point ids, the link check).** Slice 5 would shrink to a plain page file.
- **4.10.5 (experiments numbered per piece of work).** Slice 4 and the renumbering in the migration would drop.

## 1. Inventory

**Engine verbs** (`skills/ledger-engine/scripts/`)

| Today (module, lines) | Fate |
|---|---|
| `topic add/add-batch/edit/rename/remove/order/brief` (discovery-map.cjs 860) | Delete; areas form by `ledger relabel` |
| `topic send/mailbox/answered` (mail.cjs 503, projections/mail.cjs 77, `render send-report`) | Delete |
| `topic cancel/reactivate` (transitions.cjs: cancelTopic, reactivateTopic, *DiscoveryUnit) | Delete |
| `topic postpone` (transitions.cjs postponeTopic) | Becomes `area put-off`; old verb kept migration-only (080 calls it) |
| `approve-map yes/strike/unstrike` (approve-map.cjs 743, projections/discovery-gates.cjs approve part) | Delete |
| `decided yes/strike/stage` (decided.cjs 943, projections/decided.cjs 127) | Changed into the close of the whole, a `close` family; reuses projections/closing.cjs 250 |
| `checklist decided <wu> <topic>` (checklist.cjs 798) | Becomes `checklist close <wu>`; `mailbox-empty` goes; ready to build loses `topics-settled` and `sweep-run` |
| `sweep take` (sweep.cjs 198, sweep-take.cjs 190) | Changed: may rerun, lands questions under areas, sends candidates to the close |
| `workunit pivot` (workunit-lifecycle.cjs 363) | Delete |
| `workunit absorb` (workunit-absorb.cjs 547) | Becomes `workunit fold` |
| `workunit split/retire`, `ledger carry/settle`, `cut --migrating` | Untouched (migration-only) |
| `enter discussion <wu> <topic>` (enter.cjs 737, topic-standing.cjs 250, topic-log.cjs 114) | Changed: `<wu>` opens the main thread, `<wu> <area>` a focused session |
| Epic level of `enter discovery`, `--move`, `discovery-session close`, `discovery-log *`, `discovery-log from-before` (discovery-entry 382, discovery-session 290, discovery-log 313, from-before.cjs 173) | Epic level deleted; product level untouched |
| `handoff topic` (handoff.cjs 309) | Becomes `handoff area` and `handoff main` |
| Places of `ledger ask/find/decide/replace/hold/merge` (ledger-write.cjs 1602) | Third part of the place becomes the area label; the "onto a decided topic" refusal goes; `--from-page` added |
| `ledger move --to <topic>` | Becomes `ledger relabel`; `--to roadmap:` stays |
| `ledger record/map/affected/since/shown/earlier` (ledger-read 409, ledger-fold 1251, topic-map 235, ledger-moves 87, ledger-units 231) | Read by area; `earlier` serves an area put off |
| `experiment * <wu> <topic> <id>` (experiment.cjs 748, -entry 240, -paths 33, -question 93) | Per piece of work |
| `verdict queue`, `verdict give --at decided\|…\|queue` (verdict.cjs 238, ledger-verdicts.cjs 321) | Queue goes; `--at moment`; a skip is final |
| `convergence accept/decline <wu> <topic>` (convergence.cjs 316) | Counted per conversation |
| `agent * <wu> <phase> <topic>` (agent-state.cjs 1086) | Keyed by area; the closing-pass kind becomes the fresh read, its mark kept in the manifest |
| `brief <role> <wu> <topic>` (brief.cjs 400, brief-names 175, brief-records 3009) | Area records, assembled area log, the page's part for the area, the whole; new page-reader role; `review-area` becomes `review-section` |
| `render map/discovery-map/approve-map(-strike)/decided(-strike)/wait-agents/convergence/epic-menu/verdicts/horizon-pick` | `map` reads by area; `discovery-map`, `approve-map`, `decided`, `verdicts` deleted; `epic-menu` becomes the discussion menu |
| `start-this-work` (start-this-work.cjs 421, workunit-create 269, discovery-gates) | `page` replaces a feature's brief and an epic's points; no epic type |
| `roadmap pull-forward`, postponed items (roadmap.cjs 1652) | Works on an area put off |
| `board` (board-model 570, board-unit 500, board-discussion 230, board-discovery 178, board-experiment 115, board-standing 195) | Changed; `BOARD_VERSION` raised |
| `investigation stage`, `investigation-log` | Mail refusal goes; otherwise untouched |

**Other engine code**
- Session machinery: presence.cjs 522, position.cjs 985, session-label.cjs 539, conversation.cjs 565, catch-up.cjs 178. All change to hold the two new places.
- Kernel and schema: manifest-schema.cjs (`epic`, `TOPIC_PHASES`), fields.cjs 1226, derivations.cjs 1477, transitions.cjs 796, waits.cjs 245, epic-detail.cjs 95, topic-leave.cjs 209, layout.cjs 284, `OWNED_PATHS` in commit.cjs. All change.
- Knowledge base: knowledge/artifacts.cjs 378, indexing.cjs 465 and the store's identity. Changed to index by area.
- The spec's top-level parts: spec-sections.cjs 733, review-phase 646, review-round 679, review-entry, review-verbs, board-review 381, board-spec 446, spec-page, the `{area}` placeholder in layout. Renamed to sections.

**Help files.** `epic-menu.help.md` becomes the menu's help. `verdicts.help.md` is deleted. `start-menu.help.md` and `manage-unit.help.md` change.

**Briefs** (`content/briefs/`). Change: sweep, closing-pass-reader, discussion-reviewer, deep-dive, perspective, synthesis, spec-writer, spec-reviewer, review-area (becomes review-section). New: page-reader. Untouched: the `migration-*` briefs.

**Agents.** Change: discussion-reviewer, closing-pass-reader, sweep, deep-dive, perspective, synthesis, spec-writer. New: a page reader.

**Skills' prose**

| Skill | Fate |
|---|---|
| ledger-discussion-process (SKILL 146, refs 277) | Rewritten. Delete sending-a-message, cancelling-the-topic, moving-up. postponing becomes putting off; closing-pass becomes the close. |
| ledger-discovery (SKILL 138, refs 151) | Delete the epic's discovery, approving-the-map, changing-the-map, a-message-to-a-topic, and the feature part of writing-a-brief. Rewrite starting-this-work for the page. |
| ledger-continue-epic (28) | Renamed; draws the discussion menu |
| ledger-keep (43) | The "message to a topic" line becomes a point on the starting page |
| ledger-specification-process | The sweep moves to the close; sections; ready to build loses the feature's close and the verdicts |
| ledger-experiment-process, ledger-investigation-process | Per piece of work; mail goes |
| ledger-shared | Delete pivot-to-epic. Change raising-a-call (verdict at the moment), framework, the glossary, handing-off, backlogging |
| ledger (start skill) | absorb-into-epic becomes fold; the pivot row goes; the start menu loses its verdict rows |
| implementation, review, quick-fix | Verdict at the moment; review uses sections |

**Gate mods.**
- `hooks/views/unit.ts`, `discussion.ts`, `discovery.ts`, `experiment.ts`, `words.ts` change.
- The board fixtures (`board-epic`, `board-discovery`, `menu-epic`) and the mod's README change.
- The `npm run test:mod` gate applies.

**Docs.**
- Book chapters: discussion (96 lines), discovery (67), lifecycle-operations (69), work-types (52), how-it-fits-together, specification, trust, tracking, knowledge-base, agents, experiments, review.
- Also the README's pipeline table, commands.md (1273 lines), CLAUDE.md's map (The System, Paths) and CONVENTIONS.md (11 mentions).
- Walkthrough cards 01–03, 08 and 09.

**Tests.**
- Suites for features that go total about 13,700 lines. Among them: topic-mail 553, approve-map 374, roadmap-topic-verbs 541, workunit-pivot 246, decided-* 841, epic-menu* 714, board-epic 170, topic-titles 454, sweep 565.
- Simulations: epic, epic-doors, epic-map, epic-postpone, epic-spec, epic-sweep, epic-topics, discovery, feature, feature-spec, experiments, experiments-feature, questions, sessions and concurrency.
- The oracle (1376 lines) changes in its epic-menu audit, auditTrust and auditLedger. The world helper pipeline-world.cjs (1888) changes.
- The knowledge eval's corpora (`tests/fixtures/knowledge-eval/{fumi,portal,tick}`) are topic-shaped and need migrating, then a re-pin.

## 2. What is deleted outright

| Feature | Verbs, modules, prose, tests |
|---|---|
| The map and approve the map | `topic add…brief`, `approve-map *`, `render discovery-map/approve-map(-strike)`, approve-map.cjs, discovery-map.cjs, projections/discovery-map.cjs, the approve part of discovery-gates; discovery refs approving/changing-the-map; test-engine-approve-map, topic-titles, sim epic-map |
| Briefs | `topic brief`, `{unit}/topics/{topic}/brief.md` writes, writing-a-brief (feature part); test-engine-brief-discussion (rewritten). A bugfix keeps its brief |
| Mail | `topic send/mailbox/answered`, `mailbox-empty`, `DISPLAY: waiting mail`, the review refused while mail waits, `render send-report`, the experiment's `report_sent`; mail.cjs, projections/mail.cjs; sending-a-message.md, a-message-to-a-topic.md; test-engine-topic-mail |
| Reopen | `reopened` in send and `sweep take`, the void-a-close-by-message path in derivations (voidTopicClose), topic-standing's "decided, reopens by a message" |
| Pivot | `workunit pivot`, the manage-unit row, pivot-to-epic.md; test-engine-workunit-pivot |
| Remove a topic | `topic remove`, the `dismissed` writes (struck names kept as data) |
| Per-topic decided gate | `decided yes/strike`, `checklist decided`, `render decided`, `wait-agents` per topic; decided screen, yes and close suites |
| Verdict queue and verdicts at closes | `verdict queue`, the `--at` points, `--alone`, "a verdict still to ask" refusals at decided, ready to build, finish and the quick-fix close; verdict-page.cjs, verdicts.help.md, menu verdict rows, the glossary's "the verdict queue" (and its entry in test-glossary's `ADDED` list) |
| An epic's discovery level | Epic branches of `enter discovery`, `--move`, `discovery-session`, `discovery-log`, `discovery-log from-before`, `from-before.md`, `phases.discovery.items`, `approved_at`; board-discovery's epic view; discovery's "An Epic's Discovery"; epic parts of test-engine-discovery-*, sim discovery |

## 3. What is new

- **The ledger line, v3** (`ledger-events.cjs`, schema `version: 2` today).
  - The header's `topic` becomes `area`. v1 and v2 lines are read with their `topic` as the area, under the existing per-version reading.
  - A new `relabelled` event: `{by, who_moved_whom, entries, to: area|null}`.
  - `from_page` on questions and decisions.
  - A new `given` value, `discovery`.
  - `event-fields.cjs` must learn a field that ends at a version; today it only adds fields.
- **The starting page.**
  - `{wu}/start.md` is Claude's text, installed by start this work's yes.
  - The unit manifest holds `start.points.{id}: {kind, area, cites, dropped}` and `start.nothing: [log#section]`.
  - Verbs: `start-page label|drop|nothing|add|show`.
  - A point is taken up when an entry names it with `from_page`.
  - The link check compares every `shaped_by` section with the points' cites and the "carries nothing" marks, and lists the gaps.
  - Page-reader agents run before the yes.
- **The main thread and focused sessions.**
  - Places: `enter discussion <wu>` for the main thread, `<wu> <area>` for a focused session.
  - Presence and the held-place gate for both, including the main thread (4.8.5).
  - Session labels "Discussion · main thread" and "Discussion · {area}".
  - `handoff area|main`.
  - Logs at `{wu}/discussion/session-NNN.md`, registered as `phases.discussion.logs[{n, kind, area, path, session}]`.
- **Reads.** `ledger overview <wu>` is what the main thread opens on. `ledger record <wu> <area>` pulls one area's record. `render map <wu>[.<area>]` shows the map of the whole or one area, with the counts from discovery.
- **Derived standing.** Areas are worked out from the ledger's labels and the page's. An area is settled when no open question, no open question from discovery and no flagged entry stands under it.
- **The menu (4.11).** `render discussion-menu <wu>` and its help. Its rows: the main thread, recommended; each area with something waiting; experiments waiting; the close when nothing waits.
- **The fresh read per area.** A mark is kept in the manifest when the report is incorporated. "Changed since its last read" counts lines under the area after that mark: written, replaced, relabelled in or out.
- **The close of the whole.**
  - Verbs: `checklist close <wu>`, `render close`, `close yes|strike`.
  - Checks: engine items for questions closed, nothing from discovery open, areas read, the pass since the last decision, experiments ended; Claude's items for decisions entered, conflicts read, findings rerun, product lines shown.
  - The yes lands untouched leans (a question and a `given: discovery` decision each), product-record lines and roadmap parks, then takes the work into the spec.
  - Spec entry is refused until it lands.
- **Verdicts at the moment.** `raise answer` and `ledger replace` answer `verdict_owed`. `verdict give … --at moment [--from-words]`. Prose: ask once, record from the person's words where they make it plain, never from silence.
- **Experiments per piece of work.** One series per unit at `phases.experiment.items.{wu}`, folders at `{wu}/experiments/E{n}-{slug}/`, the record's directory registered. A result lands as a finding under its question.
- **Knowledge base.** Copies at `.knowledge/records/{unit}/{area}.md`, the whole's at `{unit}.md`. The store's identity becomes `(unit, phase, area)`.
- **Put off and fold.** `area put-off <wu> <area> --horizon` (the roadmap item's `postponed_from` names `{unit, area}`) and `workunit fold`.

## 4. Slices, in build order

**Strategy.** Every slice lands on `feat/areas` and nothing is released until the whole is merged to main. Migration 082 is one unreleased file. Each slice that changes a stored format adds its part to it, so runtime code never handles two formats. Migrations 083 (the directive) and 084 (its apply) come at slice 10.

| # | Slice | Tests and simulation | Depends on | Size |
|---|---|---|---|---|
| 1 | **Sections.** Spec and review "areas" become "sections" in code, screens, briefs and the `review reads <unit> <section>` grammar. The verify setup's feature map's areas become parts (10.1.17). A stored key that carries the old word is renamed with it and carried by migration 082, which starts here. Frees the word "area". | spec-sections, review-*, board-review/spec, spec-page; review sims' wording only | none | ~25 source files, ~35 suites, mechanical |
| 2 | **Verdicts at the moment** (section 2's rows; `--at moment`) | test-engine-verdict, ready-to-build-*, finish-*, quick-fix-close*, waits, start-menu; oracle auditTrust; sims ledger-trust, build-judged, review-* | none | ~15 files, −1,000 / +300 lines |
| 3 | **Ledger v3**, `ledger relabel`; the fold reads by area; `topic` renamed to `area` inside the ledger modules | test-engine-ledger-* (~25); oracle auditLedger and auditCopies; sims ledger, provenance, audit | none | ~15 files, ~1,500 lines |
| 4 | **Experiments per piece of work**; 082 gains its part (merge an epic's series, renumber, register directories) | experiment* (~1,400 lines), enter-experiment; sims experiments* | none | ~8 files, ~600 lines; migration ~150 |
| 5 | **The starting page** for features; 082 registers a feature's brief as a file to read | start-this-work, new start-page suite, enter; sims feature, discovery | 3 | ~7 files, ~800 lines |
| 6 | **Main thread and focused sessions** (places, hold, logs, handoff, overview, record, map); 082 registers logs (11.2.13) | enter, handoff, presence, position, session-label, catch-up, conversation suites | 5 | ~12 files, ~1,500 lines |
| 7 | **Standing, menu, fresh reads, the pass, the close**; ready to build sheds the feature's close; board and mod | decided-* become close-*, sweep, checklist, waits, board-*, spec-entry, `test:mod` | 6 | ~15 files, ~2,500 lines |
| 8 | **Discussion prose rewrite**, the menu skill, keep; agents and briefs | sims feature, feature-spec, experiments-feature, questions, sessions, concurrency; world helpers | 6, 7 | ~600 prose lines, ~1,500 sim lines |
| 9 | **Put off and fold**; start this work offers no epic | roadmap*, workunit-absorb (becomes fold), start-this-work; sim roadmap, workunit | 8 | ~6 files, ~1,000 lines |
| 10 | **Migration**: 082 finished (epic becomes feature; decided topics read; cancelled topics as decisions; postponed topics put off; struck names kept), 083 directive, 084 apply | test-migration-082/083/084, directives, migration-audit; corpora migrated, `knowledge-eval --pin`; sims migration, review-migrated-epic, build-migrated | 9 | ~800 migration lines, ~1,500 test lines |
| 11 | **Delete the topic flow** (section 2); `topic postpone` kept migration-only | about 13,000 suite lines deleted or rewritten; epic-* sims recast as features with areas; the oracle's epic audits | 10 | engine about −6,000 lines |
| 12 | **The word epic**: `VALID_WORK_TYPES`, pipelines, screens, board kinds, knowledge identity, skill rename, handoff table; `topic` identifiers to `area` across the rest of the engine; re-pin | broad, mechanical; test-docs, glossary, retired, commands-reference | 11 | ~170 engine files, ~300 suites; split 12a (epic) and 12b (topic) |
| 13 | **The book and the glossary**: chapter rewrites; glossary terms in (area, main thread, focused session, starting page, the close of the whole, put off, fold, section) and out (epic, topic, decided, mail, message, pivot, absorb, reopen, the verdict queue, brief) | test-docs, test-glossary | 12 | ~15 chapters |

**Forced and free order.**
- Slices 1–4 can go in any order. Slice 1 is best first, since it frees the word "area".
- 5, 6, 7, 8 must go in that order. Slices 6–8 must land together: the prose calls the verbs they change.
- 9, 10, 11, 12 must go in that order. After 10 no epic-shaped state is left, so 11 can delete freely.
- Each slice's own lines in commands.md move with it, because test-engine-commands-reference holds the reference to the engine.

## 5. Choices the design leaves to the build

1. **Areas' names.** Options: register them in the manifest, or derive them from labels. Pick: derive from ledger and page labels. The manifest keeps only facts keyed by label: put off, read marks, struck names.
2. **Places.**
   - Option: the main thread at the `{wu}.discussion.{wu}` cache slot, or at the folder's root. Pick the slot: presence, catch-up and agent-state keys are unchanged, and 11.2.13 comes for free. An area may not take the unit's name.
   - A focused session is at `{wu}.discussion.{area}`.
   - Entries about the whole stay at the unit level (topic null), as today.
3. **Logs.** Each log belongs to one conversation: a clear starts a new one; a compaction or a resume (same session id) carries on. Migrated logs keep their paths and are numbered by their first header date.
4. **A focused log after its area splits.** Options: rewrite its registration, or follow citations. Pick: it belongs to its registered area while that area exists, and to every area holding an entry that cites it. Its registration is never rewritten.
5. **The directive's ledger writes.** Options: let the verbs commit, widen the held-commit rule beyond the unborn branch, or stage and apply. Pick: stage and apply. 083 writes `.cache/migrate/areas/{unit}.json` and its check holds it complete; 084 appends the lines raw, uncommitted; the migration gate commits. Precedent: 076 then 077. A held commit only works while the state branch is unborn (`migrationRuns`).
6. **The board's pages.** `area:{area}`, `page:`, and a row for the main thread. `topic:` and `message:` go; `report:{id}` is per piece of work. `BOARD_VERSION` is raised.
7. **The knowledge base.** Copies by area. The whole set already renders after every ledger write, so a relabel re-renders both areas; an area put off loses its copy, as a postponed topic does today. Re-pin at slices 3, 10 and 12.
8. **One area and the pass across areas.** Today's sweep runs only with more than one live topic (`sweep-run` applies only then; `sweep take` refuses one). Pick: owed only with two or more areas.
9. **Folding.** One area named for the folded work (5.4.3), carried by the `rehomed` line today's absorb uses. Its logs become focused logs on that area, its page's points are appended with ids prefixed `{unit}.`, and its experiments are renumbered after the target's.
10. **The relabel event.** Options: reuse `rehomed`, or a new event. Pick a new `relabelled` event: `rehomed` re-phases lines carried within a unit.
11. **Where fresh-read marks live.** Options: the cache, as today's closing pass, or the manifest. Pick the manifest: the cache is gitignored and per machine, and 7.1.1 is an engine refusal.
12. **A single-topic unit's `topic = unit` lines.** Read as an area named for the unit, for finished work and bugfixes (11.2.1). 082 appends one relabel to the whole for a single-topic feature mid-discussion.
13. **A candidate accepted as a new area at the close.** It lands as a question under the new area, which holds the close again.
14. **The menu skill's name.** `ledger-continue-feature`.

**Where the design and the code disagree, unacknowledged:**
- 11.2.7: the frozen reshape directives call `topic postpone`, `workunit split --topics --into {epic}` and `ledger carry <wu>.<phase>.<topic>`.
- 10.1.16: "area" also names the verify setup's feature-map areas (the investigation's `area`, `measures bugs`, the glossary's "feature map").
- 7.1.3 has no one-area exception; today's sweep is skipped with one topic.
- 4.10.5: migrated epics' per-topic experiment ids collide (two E1s in one piece of work).
- 11.2.12 needs layout.cjs to keep the `{unit}/topics/{topic}/…` places for registered files.
- 6.3.5: a type call has no `shaped_by`, so its link check has nothing to check.
- 2.1.5: convergence's run and decline are read and stored per topic today.

## 6. Risks

1. **The reshape for projects still on `.workflows/`.**
   - Its frozen directives call verbs this change removes or reshapes, against 078's topic-shaped manifests.
   - 082–084 must also run in two contexts: inside the reshape, on an unborn branch and before its review, and on born projects such as Fumi and Portal.
   - Mitigation: test 072→084 end to end in migration-world.
2. **The session machinery in slices 6–8.**
   - enter, handoff, presence, position, catch-up and labels all change places.
   - A breakage there shows only at a resume, a compaction or a second window.
   - The oracle needs new audits for the place held, the log registry and the overview.
3. **Engine refusals resting on derived facts.**
   - These are the fresh read, "changed since its last read", standing, and what is excluded once an area is put off.
   - All are computed through relabel chains.
   - A miscount either blocks the spec or lets it through silently.
