# Implementation Index

Overview of remaining PRs for the work-type architecture. PR 1 (Big Bang) is the current PR. Full design discussion and decisions in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](archive/WORK-TYPE-ARCHITECTURE-DISCUSSION.md).

## Revised Execution Order

| Order | PR | Focus | File |
|-------|-----|-------|------|
| ✅ | PR 1 | Big Bang — New Architecture | (current branch) |
| ✅ | PR 4 | Start/Continue Split | [Design](archive/start-continue-split/DESIGN.md) |
| ✅ | PR 5 | Phase Skills Internal | [PR5-PHASE-SKILLS-INTERNAL.md](PR5-PHASE-SKILLS-INTERNAL.md) |
| 4th | PR 2 | Bridge Always Fires | [PR2-BRIDGE-ALWAYS-FIRES.md](PR2-BRIDGE-ALWAYS-FIRES.md) |
| 5th | PR 3 | Bridge Epic Navigation | [PR3-BRIDGE-EPIC-NAVIGATION.md](PR3-BRIDGE-EPIC-NAVIGATION.md) |
| 6th | PR 6 | Processing Skills Pipeline-Aware | [PR6-PROCESSING-SKILLS-PIPELINE-AWARE.md](PR6-PROCESSING-SKILLS-PIPELINE-AWARE.md) |
| 7th | PR 7 | Work Unit Lifecycle | [PR7-WORK-UNIT-LIFECYCLE.md](PR7-WORK-UNIT-LIFECYCLE.md) |
| 8th | PR 8 | Skip Review | [PR8-SKIP-REVIEW.md](PR8-SKIP-REVIEW.md) |
| 9th | PR 9 | Normalise Terminal Status | [PR9-NORMALISE-TERMINAL-STATUS.md](PR9-NORMALISE-TERMINAL-STATUS.md) |
| 10th | PR 10 | Research Refactor | [Design Brief](research-refactor/DESIGN-BRIEF.md) |
| 11th | PR 11 | Session State Removal | [Design Brief](session-state-removal/DESIGN-BRIEF.md) |
| 12th | PR 12 | Feature Research Analysis | [PR12-FEATURE-RESEARCH-ANALYSIS.md](PR12-FEATURE-RESEARCH-ANALYSIS.md) |

## Why This Order

PR 4/5 moved ahead of PR 2/3 during the PR 1 review. The review kept hitting topic/work_unit conflation in discovery displays and dual-mode complexity — issues that the start/continue split and phase skills going internal eliminate entirely. Bridge logic is simpler when phase skills are already internal and the caller always provides context.

## Deferred Items

- **Natural language migrations** — viability for structural changes. Revisit when relevant.
- **Work type pivot** — manifest makes it technically trivial, but UX/workflow implications not discussed.
