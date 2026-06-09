# Plan: Spec groupings as first-class manifest items

A stacked-PR plan. This document is the shared context for the whole effort — read it first in
every clean session. It is deliberately **not** full-depth: each PR gets its own Claude planning
pass at implementation time. This sets out *what* we're building, *why*, what each PR owns, and how
the PRs relate. Append outcomes to the **Status log** at the bottom as each lands.

---

## Why this exists (the problem)

When an epic's discussions are all concluded, the user runs the specification grouping analysis: it
reads the completed discussions and proposes how they cluster into specifications. Today those
proposed groupings live **only in a cache** — `.workflows/{wu}/.state/discussion-consolidation-analysis.md`
plus a checksum on the manifest (`phases.discussion.analysis_cache`). A grouping only becomes a real
`specification.{topic}` manifest item when the user actually *starts* that spec.

Because the groupings are invisible to everything except the spec-entry skill, several things go
wrong (observed in real use, 3 concluded discussions → 3 groupings, 1 specced, 2 pending):

1. **Epic menu recommends planning instead of finishing specs.** With the discovery map all-decided
   (`convergence_state: settled`), a completed spec produces a `start_planning` entry in
   `next_phase_ready`, and the settled-state recommendation rule picks the first such entry. Planning
   always out-ranks remaining spec work — the opposite of intent. (The system's own advice text even
   says "completing all specifications before planning helps identify cross-cutting dependencies"; the
   recommendation engine contradicts it.)
2. **Pending groupings don't appear on the epic menu or tree.** The epic discovery script reads only
   created `specification.items`; it never reads the grouping cache. The only hint is the `s`/`spec`
   command option showing "N discussion(s) not yet in a spec" — a buried, discussion-granular count,
   never a numbered item, never recommended.
3. **Spec menu shows concluded specs above pending ones.** Neither spec-menu path sorts or hides by
   status; completed specs intermix with (or sit above) work still to do.
4. **Planning soft-gate is blind to uncreated specs.** The gate only fires when spec items are
   *in-progress*; pending groupings aren't items at all, so starting planning early triggers no
   warning.

The root cause of 1, 2, and 4 is the same: groupings live in a vehicle no downstream consumer reads.

## The core idea

Promote groupings to **real manifest spec items** the moment analysis produces them, carrying a new
`proposed` status. This is a *representation swap*, not new behaviour — the same grouping data, moved
into the vehicle the project already declares authoritative (`CLAUDE.md`: the manifest CLI is the
single source of truth for all workflow state).

What it unlocks, mostly for free:

- The epic side already reads `specification.items` → pending specs become visible in the tree, the
  map, and the menu with no second source of truth and no cache-parsing in the epic script.
- The recommendation and soft-gate logic can see proposed specs and rank/gate against them.
- The spec menu sorts and submenus over uniform manifest data instead of cache-file order.

## Data model

- **New status `proposed`** on specification-phase items — an analyzed grouping not yet actioned.
- **Item shape at analysis time:** `{ status: "proposed", sources: { <disc>: { status: "pending" }, ... } }`.
  No `specification.md` file, no `review_cycle`/gate fields (those are added when work starts).
- **Invariant:** `proposed` ⇒ no spec file on disk. Any item with a file is `in-progress` or beyond.
- **Staleness:** unchanged — `phases.discussion.analysis_cache.checksum` (already manifest-resident)
  compared against a fresh checksum of the discussion files.
- **Rationale prose:** the `.state/discussion-consolidation-analysis.md` file is kept, slimmed to the
  human-readable coupling/"why it belongs" notes only. The manifest holds the structured
  group→sources+status; the checksum handles staleness.

## Anchoring / reconcile rule (the regroup story)

When analysis or re-analysis runs:

1. Partition existing spec items: **anchors** = status ∈ {in-progress, completed, superseded,
   promoted}; **proposed** = freely mutable.
2. Preserve anchors as-is. If a newly-concluded discussion analyzes into an anchor, add it as a
   `pending` source — the existing "Continue — N new source(s)" / reopened-source path.
3. Reconcile the proposed set: delete proposed items no longer present in the new groupings, create or
   update the rest. Deletion is a plain manifest item removal — the invariant guarantees no file or
   downstream work exists to orphan.

This **replaces** today's `anchored_names` string-matching (`analysis-flow.md`,
`spec-entry/discovery.cjs`) with status-based identity: simpler and more robust. A `proposed` item is
never an anchor — there is nothing actioned to protect.

## Locked decisions

- Status name is **`proposed`** (not `pending` — `pending` is already the *source* status; don't
  overload it).
- **Epic-only producer.** Grouping analysis is the only thing that emits `proposed` items.
  Feature/bugfix/cross-cutting still create a spec directly. The schema permits `proposed` on the
  specification phase generally, but nothing else writes it.
- **Slim rationale file + manifest checksum** (decided above) — no new staleness vehicle.
- **Lazy reconcile, no migration script.** In-flight epics keep their cache; the next analysis run
  materializes proposed items. Trade-off: those epics won't show pending specs on the epic menu until
  they re-analyze once. Acceptable and self-healing.
- **`unaccounted_discussions` shifts meaning** (a consequence, not a choice): once proposed items
  carry sources, those discussions are "accounted", so the count becomes "discussions not yet
  *grouped*" rather than "not yet in a created spec". The `s`/`spec` entry shifts from "go create
  specs" toward "analyze / mop up ungrouped discussions".

---

## How the work is split

Three stacked PRs. Linear dependency: PR 2 needs the `proposed` items from PR 1; PR 3 needs PR 1's
manifest-driven spec menu. Each PR leaves the system coherent and shippable.

```
main ─ pr-0 (this plan) ─ pr-1 (data model + spec subsystem)
                            └─ pr-2 (epic menu intelligence)
                                 └─ pr-3 (spec menu reorder + submenu)
```

Discipline for every PR that touches a skill file (`skills/**/SKILL.md`, `skills/**/references/**`):
re-read `CONVENTIONS.md` in full first, run the compliance self-check on each touched file, and don't
start the next PR until the current one is clean. No `src/knowledge/` changes are expected, so no
bundle rebuild — but run the relevant `tests/scripts/` suites for every PR.

---

### PR 1 — Data model + spec subsystem

**Owns:** introducing `proposed`, making grouping analysis write/reconcile manifest items, and making
the spec-entry skill read groupings from the manifest instead of the cache file. Self-contained within
the spec subsystem plus read-only epic visibility.

**Why first:** everything else reads the items this PR creates. Until this lands there is nothing for
the epic menu or the reorder to act on.

**Surface (orienting, not exhaustive — full detail at per-PR planning):**

- `workflow-manifest/scripts/manifest.cjs` — add `proposed` to `VALID_PHASE_STATUSES.specification`;
  `workflow-manifest/SKILL.md` — document it.
- `workflow-shared/scripts/discovery-utils.cjs` — `phaseStatus` filters `proposed` like
  `cancelled`/`superseded` (a spec phase of only proposed items reads as "not started" for
  completion/next-phase logic; items still render).
- `workflow-specification-entry/references/analysis-flow.md` — the Save step writes/reconciles
  manifest proposed items + pending sources; rewrite the anchoring section to status-based; keep the
  checksum and a slimmed rationale file.
- `workflow-specification-entry/scripts/discovery.cjs` — read groupings from manifest items (incl.
  `proposed`); stop using file-existence as the "is-it-real" test; expose item status; keep checksum
  staleness.
- `route-scenario.md`, `display-groupings.md`, `display-specs-menu.md`, `display-analyze.md` — source
  groupings from manifest items; verbs: `proposed`→**Start**, `in-progress`→**Continue**,
  `completed`→**Refine**.
- `validate-phase.md` — handle a `proposed` item (no file): flip → `in-progress`, verb "Creating".
- `confirm-create.md` + `handoffs/create.md` — don't double-create; the proposed item already exists.
- `workflow-specification-process/references/initialize-specification.md` — **guard:** if the item is
  `proposed`, flip status + set metadata while **preserving the existing sources** (do not
  `init-phase`, which replaces the item object and would wipe sources).
- `epic-display-and-menu.md` + `display-epic-map.md` — read-only awareness only: render `[proposed]`
  + legend entry; map spec column shows proposed; proposed pipelines order last. (Menu/recommendation
  logic is PR 2.)
- Tests: `test-discovery-for-specification.cjs` (proposed items, no-file inclusion),
  `test-discovery-utils.cjs` (phaseStatus proposed), manifest validation accepts `proposed`, analysis
  reconcile (anchor preserve / proposed regenerate).

**Done when:** the spec menu is fully manifest-driven; running grouping analysis persists proposed
items; actioning one flips it to in-progress without losing sources; pending specs appear in the epic
tree/map. Epic recommendation/gating is unchanged (still recommends planning — fixed in PR 2).

**Hands to PR 2:** `proposed` spec items now exist in the manifest for the epic script to act on.

### PR 2 — Epic menu intelligence

**Owns:** making the epic menu act on proposed specs. Fixes problems 1, 2, and 4.

**Why second:** depends on PR 1's proposed items existing in `specification.items`.

**Surface:**

- `workflow-continue-epic/scripts/discovery.cjs` — surface proposed specs as actionable; recommendation
  precedence ranks proposed specs **before** `start_planning`; planning soft-gate aware of proposed
  specs; recompute `unaccounted_discussions` under the new "ungrouped" semantics.
- `epic-display-and-menu.md` — numbered menu entries ("Start specification: {grouping}"); mark a
  proposed spec `(recommended)` when present (settled-state rule); planning soft-gate when proposed
  specs exist; retain/relabel `s`/`spec` as the analyze/regroup gateway even when nothing is ungrouped.
- Tests: `test-discovery-for-workflow-continue-epic.cjs` — recommendation prefers proposed spec over
  planning; gating; menu entries; unaccounted shift.

**Done when:** with pending groupings present, the epic menu lists them as numbered items, recommends a
pending spec (not planning), and warns (non-blocking) if the user picks planning early.

**Hands to PR 3:** epic side complete; the remaining work is purely spec-menu presentation.

### PR 3 — Spec menu reorder + "manage completed specs" submenu

**Owns:** spec-menu presentation. Fixes problem 3.

**Why last:** depends on PR 1's manifest-driven menu; orthogonal to the epic-side work in PR 2.

**Surface:**

- `display-groupings.md` / `display-specs-menu.md` — sort proposed/in-progress first; move
  truly-concluded specs (the **Refine** state: completed with no pending sources) into a `c`/`completed`
  "Manage completed specs" submenu, mirroring the epic `c`/`completed` precedent
  (`epic-display-and-menu.md` §F). A completed spec that has *new/pending* sources stays in the primary
  list (it's still actionable).
- Tests: spec-entry display ordering / submenu gating.

**Done when:** the primary spec menu shows only actionable specs (pending/in-progress/completed-with-new-sources),
ordered work-first; finished specs live behind the submenu.

---

## Out of scope

- The single-discussion auto-create path (`display-single*`, `completed_count == 1`) bypasses grouping
  analysis and never produces `proposed` items — unchanged.
- No backfill migration (locked decision: lazy reconcile).

## Status log

- **PR 0 (this doc):** plan written, base branch `idea/spec-groupings-pr-0-plan`. Pending review.
