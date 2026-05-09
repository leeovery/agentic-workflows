# Inception Phase and Discovery Map

A multi-phase initiative to add an **inception phase** at the start of every epic and a manifest-backed **discovery map** spanning inception, research, and discussion (the "discovery process"). Replaces the current open-mode research and the discoverability gap in cross-discussion gap analysis.

## Design Reference

- **[Design](design.md)** — canonical reference for behaviour, data model, conventions, and rationale. Implementer must read end-to-end before starting any phase.

## Phases

Each phase is its own PR off main, planned individually via plan mode.

1. **[Manifest Foundations](phase-01-manifest-foundations.md)** — `inception` phase + `imports` field validation in manifest CLI. **Status:** Not started
2. **[Inception MVP](phase-02-inception-mvp.md)** — entry/process skills, bridge continuation, start-epic wiring. **Status:** Not started
3. **[Discovery Map Render](phase-03-discovery-map-render.md)** — continue-epic display + menu collapse + auto-routing. **Status:** Not started
4. **[Refinement Session](phase-04-refinement-session.md)** — re-entry path, map editing operations, safety-by-destructiveness. **Status:** Not started
5. **[Self-Healing Re-point](phase-05-self-healing.md)** — research-analysis and gap-analysis re-point to map at continue-epic boot-up. **Status:** Not started
6. **[Imports](phase-06-imports.md)** — `imports/` directory, manifest tracking, KB indexing, behaviour change for features. **Status:** Not started
7. **[Topic Splitting and Elevation](phase-07-topic-splitting-elevation.md)** — write inception items alongside; name collision validation. **Status:** Not started
8. **[Direct-Entry Auto-Add](phase-08-direct-entry-auto-add.md)** — `d`/`discuss` and `r`/`research` for unmapped topics auto-create map items. **Status:** Not started
9. **[Migration](phase-09-migration.md)** — seed inception items for existing in-progress epics. **Status:** Not started
10. **[Drop Explore Mode](phase-10-drop-explore-mode.md)** — remove research's `e`/`explore`; collapse start-epic's `route-first-phase`. **Status:** Not started
11. **[Documentation Cleanup](phase-11-documentation.md)** — CLAUDE.md, README, phase tables, compliance checks. **Status:** Not started

## Dependencies

```
Phase 1 (manifest foundations)
   │
   └──▶ Phase 2 (inception MVP)
        │
        └──▶ Phase 3 (map render)
             │
             ├──▶ Phase 4 (refinement)
             │    │
             │    └──▶ Phase 5 (self-healing)
             │         │
             │         ├──▶ Phase 6 (imports — also depends on Phase 2)
             │         │
             │         ├──▶ Phase 7 (split/elevation)
             │         │
             │         └──▶ Phase 8 (direct-entry)
             │
             └──▶ Phase 9 (migration)
                  │
                  └──▶ Phase 10 (drop explore mode)
                       │
                       └──▶ Phase 11 (docs)
```

Phases 6, 7, 8 can be parallelised after Phase 5. Phases 9-11 sequence after the rest.

## Branching Strategy — Stacked PRs

To keep `main` clean of incomplete-feature work until the whole initiative is ready, phases use **stacked PRs**:

- **This planning branch (`idea/inception-discovery-map`)** is the base. Once all phase docs are reviewed and committed, this branch merges into `main`. That gives every feature branch a clean common base with the planning artefacts already on main.
- **Phase 1** branches off `main` (after the planning branch has merged).
- **Phase 2** branches off Phase 1's branch (not main).
- **Phase 3** branches off Phase 2's branch.
- And so on through Phase 11.

Each phase's PR has its own scope and review. When the implementer is happy with all phases, the PRs merge in turn — Phase 1 first, then Phase 2 (rebased onto main if needed), then Phase 3, etc. — until the whole initiative lands.

This pattern means:

- Reviews can happen in parallel.
- No incomplete state ever sits on main.
- Earlier phases can be revised while later ones are still being built — rebases propagate the changes.
- The implementer should rebase later branches when an earlier branch changes during review.

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
