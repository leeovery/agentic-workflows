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
8. **[Imports](phase-08-imports.md)** — `imports/` directory, manifest tracking, KB indexing, behaviour change for features. **Status:** Not started
9. **[Topic Splitting and Elevation](phase-09-topic-splitting-elevation.md)** — write inception items alongside; name collision validation. **Status:** Not started
10. **[Direct-Entry Auto-Add](phase-10-direct-entry-auto-add.md)** — `d`/`discuss` and `r`/`research` for unmapped topics auto-create map items. **Status:** Not started
11. **[Migration](phase-11-migration.md)** — seed inception items for existing in-progress epics. **Status:** Not started
12. **[Drop Explore Mode](phase-12-drop-explore-mode.md)** — remove research's `e`/`explore`; collapse start-epic's `route-first-phase`. **Status:** Not started
13. **[Documentation Cleanup](phase-13-documentation.md)** — CLAUDE.md, README, phase tables, compliance checks. **Status:** Not started

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
                       ├──▶ Phase 6 (refinement)
                       │    │
                       │    └──▶ Phase 7 (self-healing)
                       │         │
                       │         ├──▶ Phase 8 (imports — also depends on Phase 4)
                       │         │
                       │         ├──▶ Phase 9 (split/elevation)
                       │         │
                       │         └──▶ Phase 10 (direct-entry)
                       │
                       └──▶ Phase 11 (migration)
                            │
                            └──▶ Phase 12 (drop explore mode)
                                 │
                                 └──▶ Phase 13 (docs)
```

Phases 8, 9, 10 can be parallelised after Phase 7. Phases 11-13 sequence after the rest.

## Branching Strategy — Stacked PRs

To keep `main` clean of incomplete-feature work until the whole initiative is ready, phases use **stacked PRs**:

- **This planning branch (`idea/inception-discovery-map`)** is the base. Once all phase docs are reviewed and committed, this branch merges into `main`. That gives every feature branch a clean common base with the planning artefacts already on main.
- **Phase 1** branches off `main` (after the planning branch has merged).
- **Phase 2** branches off Phase 1's branch (not main).
- **Phase 3** branches off Phase 2's branch.
- And so on through Phase 13.

Each phase's PR has its own scope and review. When the implementer is happy with all phases, the PRs merge in turn — Phase 1 first, then Phase 2 (rebased onto main if needed), then Phase 3, etc. — until the whole initiative lands.

This pattern means:

- Reviews can happen in parallel.
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
| `idea/inception-pr-8-imports` | Phase 7 branch | Phase 8 — Imports | — | Not started |
| `idea/inception-pr-9-split-elevation` | Phase 7 branch | Phase 9 — Topic Splitting and Elevation | — | Not started |
| `idea/inception-pr-10-direct-entry` | Phase 7 branch | Phase 10 — Direct-Entry Auto-Add | — | Not started |
| `idea/inception-pr-11-migration` | Phase 5 branch | Phase 11 — Migration | — | Not started |
| `idea/inception-pr-12-drop-explore` | Phase 11 branch | Phase 12 — Drop Explore Mode | — | Not started |
| `idea/inception-pr-13-docs` | Phase 12 branch | Phase 13 — Documentation Cleanup | — | Not started |

**Conventions:**
- Branch slug = `idea/inception-pr-{N}-{short-slug}`. Whole numbers only — no `2a`/`2b`.
- Doc-only or meta branches (like `idea/inception-rephase`) skip the phase number.
- Update the *PR* and *Status* columns as each PR opens / merges.
- For phases that branch from a non-immediate-predecessor (e.g., Phases 8/9/10 all branch from Phase 7; Phase 11 branches from Phase 5), the *Base* column records the actual divergence point.

## Other Conventions

- Each phase planned individually via plan mode when implementation begins. The plan-mode plan lives at `~/.claude/plans/{slug}.md`; the phase doc here is the durable scope reference loaded as context.
- Tests live alongside each phase where applicable.
- Compliance self-check passes on all touched skill files (`workflow-shared/references/compliance-check.md`).
- Standing project rules apply: never commit to main; branch first; commit and push after every change.

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

Update this index as phases progress.
