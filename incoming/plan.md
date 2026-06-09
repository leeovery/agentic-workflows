# Plan v2: Incoming — corrected & execution-ready

The original plan is preserved verbatim at **[plan-original.md](plan-original.md)** and remains the
authoritative spec for the locked design, hard constraints, and component details. The design log is
at **[design.md](design.md)**. This document is the corrected **delta**: what's done, what the first
attempt got wrong, the discipline for the redo, and the specific corrections to fold into the
original plan. Read all three before executing.

## Status

- **create-topic CLI + tests** — DONE (this PR). Atomic `create-topic` command in `manifest.cjs`,
  full test coverage, SKILL.md API entry. Verified by `tests/scripts/test-workflow-manifest.sh`.
- **Everything else** (shared `create-topic.md`, call-site migrations, Incoming substrate / landing /
  drain / conclusion gate) — TO DO, rewritten from scratch. The first attempt's skill-file work was
  binned for sloppiness; nothing from it is carried forward except the design knowledge below.

## What the first attempt got wrong — do not repeat

- **Inlined conditional branches into running prose** (`If it returns cancelled, … → Return … Otherwise
  continue`) instead of structured conditionals. This was pervasive and is the single biggest defect.
- **Coasted on memory** instead of re-reading CONVENTIONS.md per file — the exact thing the doc warns
  against.
- **Over-explained** — WHY where WHAT suffices; padded purpose, parameter, and case bodies.
- **Volume over correctness** — a five-PR blast with no per-file convention check before opening each.

## Execution discipline (mandatory for every skill-file PR)

- **Re-read CONVENTIONS.md in full before each PR.** Check every construct in every touched file
  against it. Do not pattern-match from sibling files.
- **Conditionals are never inline in prose.** Top-level branches in a lettered section use H4
  `#### If` / `#### Otherwise`. Nested or post-STOP branches use bold `**If …:**`. Every branch sits on
  its own line and carries its own `→` routing instruction. No `If X … → do Y. Otherwise Z` sentences.
- **Prose economy.** Cut WHY when WHAT suffices. No historical/migration notes. Write as if authored
  fresh. Keep every instruction the agent needs — and nothing more.
- **One PR at a time.** Run the compliance self-check (`workflow-shared/references/compliance-check.md`)
  on each touched file before opening the PR. Do not start the next PR until the current one is clean.

## Corrections to the original plan (apply these during the redo)

1. **No reopen-bridge guard.** The original plan's PR 6 "Known risk" called for detecting downstream
   work and warning before re-concluding a reopened topic. Resolved: **do nothing.** The reopen case is
   epic-only (single-topic never lands an Incoming entry), and the specification phase already treats a
   discussion that regressed to `in-progress` as a first-class `[extracted, reopened]` source and offers
   re-incorporation (`workflow-specification-entry` `display-groupings.md` / `display-single-grouped.md`).
   Re-firing the bridge into the epic menu is the designed path. No guard, no warning — at most a
   one-line note that re-conclusion is already handled downstream.

2. **Entry From-line drops `session {NNN}`.** Research and discussion track no session number anywhere,
   so the pinned shape is:
   ```
   ### {concern}
   *From: {origin} · {phase} · {date}*

   {concern as captured}
   ```
   Detection keys on the `## Incoming` heading, the `(none)` placeholder, and the `### ` subsections —
   not the From line.

3. **Target resolution skips `handled` and `cancelled` rows.** Those lifecycles have `current_phase:
   null` (verified in `discovery-utils.cjs` `computeTopicLifecycle`), so landing logic that dereferences
   `current_phase` for the artefact path breaks on them. The trigger sites (discussion §F, research §C)
   resolve a concern only to a live topic (or a new name); `incoming-landing` therefore only ever
   classifies new / fresh / actionable (`researching`, `ready_for_discussion`, `discussing`, `decided`)
   targets — all of which have a real artefact or are `fresh`.

4. **Shared-ref output variables avoid caller collisions.** `create-topic.md` returns `created_topic`
   (the validated name); `incoming-landing.md` returns `landed_topic`. Both avoid clashing with a
   caller's own `{topic}` (e.g. §F binds `{topic}` to the parent discussion).

5. **Drain owns its commit and runs once at the session-start step.** `drain-incoming.md` folds the
   `## Incoming` entries, clears the section to `(none)`, and commits
   `{phase}({work_unit}/{topic}): drain incoming`. Wire it into the session-start step (discussion
   Step 5 / research Step 6) — both the fresh and the resume/reopen paths funnel through there, so one
   invocation covers both; a fresh `(none)` artefact is a no-op.

6. **The refactor leaves one non-semantic diff.** Migrating the create sites onto `create-topic` changes
   the discovery-item key order (`status, routing, source, summary, description` from the CLI vs the old
   sequential `set` order). Values are identical. Call it out in the refactor PR so a reviewer doesn't
   read it as a behaviour change.

## Remaining PR breakdown (redo — each its own PR, in order)

Scope and behaviour-preservation requirements are unchanged from the original plan; apply the
corrections above as you go.

1. **`create-topic.md` shared ref + migrate full-spawn sites** — `discussion-session.md` §F (elevation),
   `research-process/.../topic-splitting.md`. Behaviour-preserving refactor.
2. **Migrate discovery-only sites** — `confirm-and-persist.md`, `ensure-discovery-item.md`,
   `analysis-approval-gate.md`. Behaviour-preserving refactor.
3. **Incoming substrate** — `## Incoming` (`(none)`) in both templates, `initialize-*` seeding,
   `drain-incoming.md` + `incoming-landing.md` (contracts), `CLAUDE.md` `incoming:{origin}` provenance.
4. **Incoming landing + trigger wiring** — full `incoming-landing.md` (correction #3), epic triggers
   (discussion §F, research §C), non-epic routing (`log` / `pivot` / `ignore`). Entry shape per #2.
5. **Drain + conclusion gate** — full `drain-incoming.md` (correction #5), conclusion gate in
   `conclude-{discussion,research}.md`, Incoming-consistency check in `document-review.md` (both).
   **No reopen guard** (correction #1).
