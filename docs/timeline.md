# Timeline

The arc, dated from `git log` (author dates) and the engine design log. Headline numbers at this head: **3,454 commits**, **310 merged pull requests** in commit subjects, **68 release tags** (`v0.1.0` 2026-03-22 → `v0.5.13` 2026-07-16), first commit 2025-11-23.

A sourcing note, stated rather than papered over: everything through PR #347 (2026-06-05) is verifiable from merge commits in git. The engine re-platforming that follows was built as a *stacked* series, rebased rather than merged, so its PR numbers (#380, #383–#435, #442–#460) come from the design log (`ideas/deterministic-tree-and-menu-renderer.md` on `feat/renderer`), cross-checked against author dates and branch names in git. No "Merge pull request" commit exists for any of them at this head; the last merge commit in the tree is #347.

## The prose era

| Date | Event |
|---|---|
| 2025-11-23 | Initial commit; `technical-planning` skill added; renamed `technical-discussion` (three-phase workflow) the same day |
| 2025-12-08 / 14 / 17 | `technical-review`, `technical-specification`, `technical-research` join the family |
| 2026-01-14 | Commands renamed to the `workflow:` prefix |
| 2026-01 (603 commits, PRs #30–#72) | Cross-topic dependencies, multi-source specs, planning progress tracking, plugin packaging |
| 2026-02 (690 commits, PRs ~#120–#150) | Unified entry point + work-type architecture (#137); review wired into the pipeline (#127); auto-mode gates |
| 2026-02-24 | Install switches to agntc (#138) |
| 2026-02-27 | Skills flattened to top-level `workflow-start` / `workflow-bridge` directories |

## State, memory, discovery

| Date | Event |
|---|---|
| 2026-03-02 | **Manifest CLI**: work-unit state leaves prose (`7ec28765`) |
| 2026-03-13 / 14 | Processing skills renamed `workflow-*-process`; dot-path syntax (#193) |
| 2026-03 (948 commits, the peak month) | Inbox capture (#205, #211), compliance self-check, project defaults (#219) |
| 2026-03-22 | First release tag `v0.1.0` |
| 2026-04-07 | Knowledge-base design specification |
| 2026-04-11 → 04-27 | **Knowledge base ships** in phases 1–7 (#243–#256) |
| 2026-05-04 | "Inception phase and discovery map" idea recorded |
| 2026-05-22 | Inception lands as a ~18-PR stacked batch (#264–#281), follow-ups #284–#290 |
| 2026-05-28 | **Renamed inception → discovery** (#293), with migration |
| 2026-06-05 | KB temporal model (#347): the last merge-commit PR at this head |

## The engine design sessions

| Date | Event |
|---|---|
| 2026-06-04 | Renderer design decisions locked: one render library, caller owns the data, two surfaces from one object, display is write-only |
| 2026-06-10 / 11 | Engine architecture sessions: the three-ring model (kernel / domain / gateway), "Claude consults code", typed state moves to the manifest ("judgment decides, code records") |
| 2026-06-12 | Boundary ratified: durable state → manifest, ephemeral single-flow state → context/cache. Session lifecycle model agreed (index / data / view verbs, action-key routing) |

## The re-platforming waves (stacked PRs, design-log numbering)

| Date | PRs | Wave |
|---|---|---|
| 2026-06-12 | #383, #384 | Engine skeleton; epic-dashboard beachhead, ratified in a live sandbox the same day (`epic-display-and-menu.md` 848 → 411 lines; the 16-row label-matching route table dies) |
| 2026-06-12 | #385–#389 | First write wave: discussion-map transitions, cancel/reactivate/inbox transactions, workflow-start read path, `engine boot` |
| 2026-07-07/09 | #399 | Rebase onto main; navigation read paths normalised (four 50-line adapters) |
| 2026-07-10/11 | #401–#403 | `engine task` verbs (format-blind by ruling); **engine API locked**: noun taxonomy, six grammar rules, response contract |
| 2026-07-12/13 | #404–#406 | Waves 4–5: investigation/scoping/research, then specification and planning migrated |
| 2026-07-14/15 | — | Wave-5 live campaign: zero findings, renders byte-identical |
| 2026-07-15/16 | #407–#409, #411 | Review wave; `workunit create` (the work-type commit as one transaction); discovery-map operations; discovery session loop |
| 2026-07-17 | #412–#416 | Workunit lifecycle + bridge; closing transactions (supersede, pivot, absorb); hardening sweep closes the deferred ledger; reasoning surfaces thinned (~21 lines/epic → 4); island absorption (one manifest IO, lock coverage) |
| 2026-07-18 | #417–#420 | **Manifest CLI absorbed into the engine** (379 call sites re-pointed; 470 orphaned tests rescued); gateway rename + docs pass; `promote` + `discovery-session close`; conversational KB setup (and a review-found credential-leak fix: bearer redaction on error paths) |

## The review campaigns

| Date | PRs | Campaign |
|---|---|---|
| 2026-07-18 | #421–#424 | **Five-fleet deep review**: five parallel adversarial fleets (design conformance, prose↔engine, live drives, adversarial, test integrity). Zero blockers; fixes include a TOCTOU-safe lock break and a 200k-token indexer crash |
| 2026-07-19 | #425–#431 | Stack-review tweaks + codification wave: versioned banner, `topic reopen`, `discovery-session open`, strict fallbacks. After #431, no prose site performs a workflow-state write outside the engine |
| 2026-07-19 | #432–#434 | API design fixes: routing positional, `handle`/`unhandle` naming, read-side reorg. "Grammar has zero exceptions, no verb collides across nouns" |
| 2026-07-19 | #442–#447 | **Certification round** (nine agents): fix wave for mostly pre-existing defects (cross-cutting spec entry, bridge routes, scoping restart, honest lifecycle tags) |
| 2026-07-19 | #448–#451 | **Round-3 pre-existing-defect hunt**: ~65 findings, 1 blocker (edits-only discovery sessions couldn't exit), ~10 high, including a spec gate that never gated and structurally blind in-flight agent detection |
| 2026-07-19 | #458–#460 | **r4 re-review + menu codification**: cross-task `fix_attempts` contamination found and fixed with the lockstep invariant; task-gate and dynamic menus become engine-rendered sections. Final verdict recorded in the log: *"THE STACK IS COMPLETE AND CERTIFIED: 57 PRs"* |

The monthly commit shape tells the same story numerically: 34 (2025-11) → 603 (2026-01) → 948 (2026-03, manifest month) → 287/399 (Apr/May, KB and discovery) → 184 (June, design sessions) → 200 (July, all of it the engine stack and its reviews, zero merge commits).

---

*Next: back to the present, [introduction](introduction.md), or the system as it stands in [how it fits together](how-it-fits-together.md).*
