# Inception Phase and Discovery Map

A multi-phase initiative to add an **inception phase** at the start of every epic and a manifest-backed **discovery map** spanning inception, research, and discussion (the "discovery process"). Replaces the current open-mode research and the discoverability gap in cross-discussion gap analysis.

## Design Reference

- **[Design](design.md)** — canonical reference for behaviour, data model, conventions, and rationale. Implementer must read end-to-end before starting any phase.

## Phases

Each phase is its own PR off the previous phase's branch (stacked PRs — see *Branching Strategy* below). Each phase is planned individually via plan mode when implementation begins.

1. **[Manifest Foundations](phase-01-manifest-foundations.md)** — `inception` phase + `imports` field validation in manifest CLI. **Status:** Done (PR #264)
2. **[Inception Entry Skill + Bridge Plumbing](phase-02-inception-entry-bridge.md)** — entry skill scaffold + bridge continuation + discovery.cjs awareness. **Status:** Review (PR #267)
3. **[Inception Process Skill](phase-03-inception-process.md)** — the conversational inception session itself (initial-session flow). **Status:** Review (PR #268)
4. **[Wire start-epic to Inception](phase-04-wire-start-epic.md)** — collapses the research/discussion menu; user-visible flip. **Status:** Review (PR #269)
5. **[Discovery Map Render](phase-05-discovery-map-render.md)** — continue-epic display + menu collapse + auto-routing. **Status:** Review (PR #270)
6. **[Refinement Session](phase-06-refinement-session.md)** — re-entry path, map editing operations, safety-by-destructiveness. **Status:** Review (PR #271)
7. **[Self-Healing Re-point](phase-07-self-healing.md)** — research-analysis and gap-analysis re-point to map at continue-epic boot-up. **Status:** Review (PR #272)
8. **[Imports](phase-08-imports.md)** — `imports/` directory, manifest tracking, KB indexing, behaviour change for features. **Status:** Review (PR #273)
9. **[Topic Splitting and Elevation](phase-09-topic-splitting-elevation.md)** — write inception items alongside; name collision validation. **Status:** Review (PR #274)
10. **[Direct-Entry Auto-Add](phase-10-direct-entry-auto-add.md)** — `d`/`discuss` and `r`/`research` for unmapped topics auto-create map items. **Status:** Not started
11. **[Migration](phase-11-migration.md)** — seed inception items for existing in-progress epics. **Status:** Not started
12. **[Drop Explore Mode](phase-12-drop-explore-mode.md)** — remove research's `e`/`explore`; collapse start-epic's `route-first-phase`. **Status:** Review (PR #277)
13. **[Documentation Cleanup](phase-13-documentation.md)** — CLAUDE.md, README, phase tables, compliance checks. **Status:** Review (PR #278)
14. **[Two-Tier Provenance](phase-14-provenance.md)** — add `description` field to inception items; every write surface populates it; entry skills load it as session opening context; direct-entry derives summary + description from the opening question. **Status:** Not started
15. **[KB Index Analysis Caches](phase-15-kb-index-analysis.md)** — index `.state/research-analysis.md` and `.state/discussion-gap-analysis.md` so the analysis content is searchable via knowledge queries. **Status:** Not started
16. **[Final Review and Cleanup](phase-16-cleanup.md)** — catch-all for behavioural gaps and stale wording surfaced during phase reviews (absorption + imports, continue-feature display, rebuild error wording, inception KB query). **Status:** Not started
17. **[Entry UX & Inception Unification (Exploratory Design)](phase-17-entry-ux-redesign.md)** — captures the in-flight design conversation about reshaping entry UX (universal inception, conversation-first start, project-level imports). **Nothing decided.** May become its own successor initiative rather than ship as a single phase. **Status:** Exploratory

## Dependencies

```
Phase 1 (manifest foundations)
   │
   └──▶ Phase 2 (inception entry skill + bridge plumbing)
        │
        └──▶ Phase 3 (inception process skill)
             │
             └──▶ Phase 4 (wire start-epic to inception)
                  │
                  └──▶ Phase 5 (map render)
                       │
                       └──▶ Phase 6 (refinement)
                            │
                            └──▶ Phase 7 (self-healing)
                                 │
                                 └──▶ Phase 8 (imports)
                                      │
                                      └──▶ Phase 9 (split/elevation)
                                           │
                                           └──▶ Phase 10 (direct-entry)
                                                │
                                                └──▶ Phase 11 (migration)
                                                     │
                                                     └──▶ Phase 12 (drop explore mode)
                                                          │
                                                          └──▶ Phase 13 (docs)
                                                               │
                                                               └──▶ Phase 14 (two-tier provenance)
                                                                    │
                                                                    └──▶ Phase 15 (KB index analyses)
                                                                         │
                                                                         └──▶ Phase 16 (final cleanup)
                                                                              │
                                                                              └──▶ Phase 17 (exploratory — design only, not queued)
```

Each phase's branch is based on the immediately preceding phase's branch. PRs merge to main bottom-to-top of the table.

## Branching Strategy — Stacked PRs

To keep `main` clean of incomplete-feature work until the whole initiative is ready, phases use **stacked PRs**:

- **This planning branch (`idea/inception-discovery-map`)** is the base. Once all phase docs are reviewed and committed, this branch merges into `main`. That gives every feature branch a clean common base with the planning artefacts already on main.
- **Phase 1** branches off `main` (after the planning branch has merged).
- **Phase 2** branches off Phase 1's branch (not main).
- **Phase 3** branches off Phase 2's branch.
- And so on through Phase 16.

Each phase's PR has its own scope and review. When the implementer is happy with all phases, the PRs merge in turn — Phase 1 first, then Phase 2 (rebased onto main if needed), then Phase 3, etc. — until the whole initiative lands.

This pattern means:

- No incomplete state ever sits on main.
- Earlier phases can be revised while later ones are still being built — rebases propagate the changes.
- The implementer should rebase later branches when an earlier branch changes during review.

### Branch Names and Merge Order

The merge sequence at the end of the initiative is **strictly bottom-to-top of this table**. Each branch's base is the row above it; rebase onto the new `main` as each lower row lands.

| Branch | Base | Phase | PR | Status |
|---|---|---|---|---|
| `idea/inception-pr-1-manifest-foundations` | `main` | Phase 1 — Manifest Foundations | [#264](https://github.com/leeovery/agentic-workflows/pull/264) | Done |
| `idea/inception-rephase` | Phase 1 branch | (doc-only meta change — phase rebalance) | [#266](https://github.com/leeovery/agentic-workflows/pull/266) | Review |
| `idea/inception-pr-2-entry-bridge` | rephase | Phase 2 — Inception Entry Skill + Bridge Plumbing | [#267](https://github.com/leeovery/agentic-workflows/pull/267) | Review |
| `idea/inception-pr-3-process` | Phase 2 branch | Phase 3 — Inception Process Skill | [#268](https://github.com/leeovery/agentic-workflows/pull/268) | Review |
| `idea/inception-pr-4-wire-start-epic` | Phase 3 branch | Phase 4 — Wire start-epic to Inception | [#269](https://github.com/leeovery/agentic-workflows/pull/269) | Review |
| `idea/inception-pr-5-map-render` | Phase 4 branch | Phase 5 — Discovery Map Render | [#270](https://github.com/leeovery/agentic-workflows/pull/270) | Review |
| `idea/inception-pr-6-refinement` | Phase 5 branch | Phase 6 — Refinement Session | [#271](https://github.com/leeovery/agentic-workflows/pull/271) | Review |
| `idea/inception-pr-7-self-healing` | Phase 6 branch | Phase 7 — Self-Healing Re-point | [#272](https://github.com/leeovery/agentic-workflows/pull/272) | Review |
| `idea/inception-pr-8-imports` | Phase 7 branch | Phase 8 — Imports | [#273](https://github.com/leeovery/agentic-workflows/pull/273) | Review |
| `idea/inception-pr-9-split-elevation` | Phase 8 branch | Phase 9 — Topic Splitting and Elevation | [#274](https://github.com/leeovery/agentic-workflows/pull/274) | Review |
| `idea/inception-pr-10-direct-entry` | Phase 9 branch | Phase 10 — Direct-Entry Auto-Add | [#275](https://github.com/leeovery/agentic-workflows/pull/275) | Review |
| `idea/inception-pr-11-migration` | Phase 10 branch | Phase 11 — Migration | [#276](https://github.com/leeovery/agentic-workflows/pull/276) | Review |
| `idea/inception-pr-12-drop-explore` | Phase 11 branch | Phase 12 — Drop Explore Mode | [#277](https://github.com/leeovery/agentic-workflows/pull/277) | Review |
| `idea/inception-pr-13-docs` | Phase 12 branch | Phase 13 — Documentation Cleanup | [#278](https://github.com/leeovery/agentic-workflows/pull/278) | Review |
| `idea/inception-pr-14-provenance` | Phase 13 branch | Phase 14 — Two-Tier Provenance | [#279](https://github.com/leeovery/agentic-workflows/pull/279) | Review |
| `idea/inception-pr-15-kb-index-analysis` | Phase 14 branch | Phase 15 — KB Index Analysis Caches | — | Not started |
| `idea/inception-pr-16-cleanup` | Phase 15 branch | Phase 16 — Final Review and Cleanup | — | Not started |
| TBD | Phase 16 branch | Phase 17 — Entry UX & Inception Unification | — | Exploratory (design not settled) |

**Conventions:**
- Branch slug = `idea/inception-pr-{N}-{short-slug}`. Whole numbers only — no `2a`/`2b`.
- Doc-only or meta branches (like `idea/inception-rephase`) skip the phase number.
- Update the *PR* and *Status* columns as each PR opens / merges.
- Each phase branches off the immediately preceding phase's branch. No parallel siblings — the stack is strictly linear.

## Other Conventions

- Each phase planned individually via plan mode when implementation begins. The plan-mode plan lives at `~/.claude/plans/{slug}.md`; the phase doc here is the durable scope reference loaded as context.
- Tests live alongside each phase where applicable.
- Compliance self-check passes on all touched skill files (`workflow-shared/references/compliance-check.md`).
- Standing project rules apply: never commit to main; branch first; commit and push after every change.

## Project-Wide Exclusions

**`workflow-explorer.html` is out of scope for every phase of this initiative.** The HTML visualisation is large, already out of sync with multiple parts of the codebase, and needs its own dedicated focus. It will be refreshed as a separate effort once the discovery-map work is fully merged — do not patch it in any phase between 1 and 16. If a phase surfaces a stale block in `workflow-explorer.html`, leave it untouched and flag it for the post-merge refresh.

## Planning Branch Plan

1. All phase docs in this directory get reviewed.
2. Once happy, this branch (`idea/inception-discovery-map`) merges into `main`.
3. Phase 1 branches off the new main and implementation begins.

## Status Legend

- **Not started** — phase not yet planned or built.
- **Planning** — plan-mode session in progress for this phase.
- **In progress** — implementation underway.
- **Review** — PR open, awaiting merge.
- **Done** — merged to main.
- **Exploratory** — design conversation captured but nothing committed; needs more discussion before any phase doc is finalised or work begins.

Update this index as phases progress.
