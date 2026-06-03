# Discovery Map: Legacy `exploration` Catch-All + Analysis Approval Gating + Past-Discovery Suppression

> **Status: proposed.** Three coupled fixes that emerged from a real consumer run where a fully-built epic (specced, planned, one topic implemented) *looked* like it regressed to discussion when re-opened. Direct continuation of **[#24 Inception Self-Healing on Legacy / Kitchen-Sink Research](inception-self-healing-on-legacy-research.md)** — this resolves #24's deferred **option D** ("what to do with the carved-out / seeded umbrella") and adds the approval gate + phase-suppression that #24's "Honest Errors" #1/#4 flagged as ambiguous-by-omission.

## The Idea

When `/workflow-continue-epic` (or `workflow-bridge`) boots a mature/legacy epic, two independent mechanisms combine to make a finished epic look like it fell back to discovery:

1. **The legacy `exploration` catch-all renders as an actionable `→ ready_for_discussion` node** forever, because `computeTopicLifecycle` matches research↔discussion 1:1 by name and a single umbrella research file fanned out into many *differently-named* discussions. Its content is already consumed, but the map can't see that.
2. **Gap-analysis (and research-analysis) auto-fire with no approval gate** the first time the epic is opened after the discovery phase shipped (the cache was never stamped → reported `stale`), silently writing brand-new candidate topics straight onto the map — on an epic that is past discovery entirely.

Agreed directions (all three decided with the maintainer in the session that produced this file):

- **Item 1 — terminal "handled" state** for a consumed catch-all, instead of `ready_for_discussion`.
- **Item 2 — approval gate** on both analyses: stage candidates → present (with overridable routing) → per-topic approve/decline → write approved, dismiss declined, stamp cache afterward.
- **Item 3 — suppress the auto-dispatch** of both analyses once discovery is quiescent **and** the epic has committed to planning; manual `/workflow-discovery` still runs them (gated).

## What Happened (Real Run)

Consumer epic `folio-ui-and-api`. State on disk was correct and advanced:

- `research`: `exploration` (completed) — the legacy single catch-all
- `discussion`: 5 items, all completed (`editor-architecture-and-technology-stack`, `template-data-model-and-rendering-pipeline`, `authoring-workflows-and-ux-patterns`, `api-surface-for-template-authoring`, `nuxt-frontend-auth-scaffold`)
- `specification`: 2 completed (the 4 template discussions → `template-authoring-system`; the auth discussion → `nuxt-frontend-auth-scaffold`)
- `planning`: 2 completed (tick format)
- `implementation`: `nuxt-frontend-auth-scaffold` completed (70 tasks)
- `discovery.items`: 6 entries, all `source: migration-seeded`, all `status: in-progress`, no `gap_analysis_cache`

A migration (038 seed → 040 rename) had projected one discovery item per legacy research/discussion file. The user ran `/workflow-start` → `/workflow-continue-epic folio-ui-and-api`. On boot:

1. **The map showed `→ Exploration [research complete · ready for discussion]`** as the recommended next action — because `computeTopicLifecycle` found `research/exploration.md` completed and no discussion *named* `exploration`. The five discussions matched same-named discussion items → `✓ decided`.
2. **Step 6 (Topic Discovery) dispatched gap-analysis** because `analysis_caches.gap_analysis.status === 'stale'` (reason: `"no cache exists"` — there were completed inputs but the cache was never stamped). It read all 6 completed docs, synthesised **3 brand-new candidate topics**, and wrote them **directly** to `phases.discovery.items` (`realtime-presence-and-broadcasting-integration` [discussion], `twig-sandbox-security-for-authored-templates` [discussion], `blueprints-and-from-scratch-authoring` [research]). The only surfacing was a post-hoc `⚑ 3 new topics added to the map from gap-analysis` line — **no yes/no, no preview of what or where it would route.**

Net effect: a finished epic presented "discovery in progress — 4 topics not yet decided" and recommended *starting a discussion*, despite specs/plans/an implementation all being complete. Nothing real had regressed — only the discovery-map *view* was polluted.

**Consumer-side repair applied** (so the project is usable now): removed the `exploration` projection and the 3 gap items from `phases.discovery.items`, added all four to `phases.discovery.dismissed[]`, stamped a valid `gap_analysis_cache` so it won't silently re-fire, reverted the knowledge-store writes. Map is now `5 decided · convergence: settled`; the menu correctly recommends *Start implementation of Template Authoring System* (and *Start review of Nuxt Frontend Auth Scaffold*). This manual repair is an end-state the generic fix below should reach on its own.

## Root Cause

| Mechanism | Assumes | Reality on legacy / mature epic |
|---|---|---|
| `computeTopicLifecycle` (research↔discussion match by name, 1:1) | A research topic and its discussion share a name | One umbrella `exploration` research fanned out to 5 differently-named discussions → no name match → perpetual `ready_for_discussion` |
| Migration 038 seed | Each research item is a per-topic file worth a `routing: research` map node | Legacy `exploration` is a consumed catch-all, not an open research topic |
| `computeAnalysisCacheStatus` ("no cache exists" ⇒ `stale`) | A missing cache means "needs analysing" | A never-stamped cache on an *already-built* epic always reports stale → analysis fires on boot |
| `topic-discovery-dispatch` / `discovery-gap-analysis` §D | Analyses run during discovery convergence; writing candidates straight to the map is safe | Runs on an epic past discovery; writes are unreviewed and read as a regression |

These are the same family as #24 (pre-discovery bleed-through), but the specific failure modes here — the *lifecycle* rendering of the seeded umbrella, the *absence of an approval gate*, and *no phase suppression* — were left open by #24 (its option D, and its "Honest Errors" #1/#4).

---

## Item 1 — Terminal "Handled" State for a Consumed Catch-All

**Decision: mark it handled, don't omit it.** A consumed catch-all stays visible on the map (preserving "this is what the discussions came from" provenance) but renders as a **terminal, non-actionable tier** — never `ready_for_discussion`, never a menu entry, never a recommendation.

**Detection signal (structural, not content-scan):** the catch-all is "consumed" when the epic already has completed discussions/specs. No need to parse `exploration.md` to prove its themes appear downstream — if discussions exist, a legacy umbrella research is by definition consumed.

**Where the determination is made — seed/migration, not a live heuristic.** Making `computeTopicLifecycle` infer "consumed" purely from "research completed + no same-named discussion + other discussions exist" would misfire on a *legitimate* per-topic research item that's genuinely awaiting its own discussion while sibling topics are done. So:

- A **heal-forward migration** (new, e.g. `042`) detects the legacy umbrella — `source: migration-seeded`, `routing: research`, name is the legacy catch-all (`exploration`), and the epic has ≥1 completed discussion — and converts that item to a terminal **`handled`** status (or a `consumed: true` flag). Only touches `source: migration-seeded` items; honours `dismissed[]`; no-ops on items the user has since removed/dismissed/edited (so the Folio manual repair stays a no-op).
- `computeTopicLifecycle` (and `computeNextAction` / `computeMapSummary` / `TIER_RANK`) gain a terminal tier for `handled` — rendered with its own glyph + label (e.g. `⊙ … [handled · consumed into discussions]`), `next_action: null`, excluded from menu and from the convergence "not yet decided" count.
- **New-flow epics never hit this branch** — a research topic shares its name with its eventual discussion, so the 1:1 match resolves normally.

Open sub-question for the implementer: whether `handled` is a new lifecycle value or reuses `decided` with a provenance label. New value is cleaner for menu/convergence exclusion; reusing `decided` is less surface area. Either is acceptable as long as it's terminal and non-actionable.

## Item 2 — Approval Gate on Gap-Analysis and Research-Analysis

**Decision: both analyses stage their candidates and require confirmation before anything hits the map.** Today `discovery-gap-analysis.md` §D ("Filter and Save") and `research-analysis.md` write directly, and the only feedback is the post-hoc `⚑ N new topics added` callout in `epic-display-and-menu.md` / bridge.

Required shape (mirror the implementation-analysis `synthesizer → staging file → orchestrator approval → task-writer` pattern that already exists):

1. **Stage** — analysis produces candidates (name, summary, description, proposed routing) to a staging structure, **does not write to `phases.discovery.items`**.
2. **Present** — a gate lists each candidate with its **proposed routing shown and overridable** (the user wanted to see "where it'll route us" — let them flip research↔discussion at approval time).
3. **Per-topic approve/decline** — not all-or-nothing.
4. **Write** — approved candidates created on the map (reuse `ensure-discovery-item.md` semantics so creation/`dismissed[]` handling stays consistent); **declined candidates added to `dismissed[]`** so a later re-run won't re-propose them.
5. **Stamp the cache once the gate resolves, regardless of outcome** — declining everything must still stamp, or the cache stays `stale` and re-fires next boot.

The gate must live on the **shared path** so it covers every entry: the boot-time auto-dispatch (`workflow-continue-epic` Step 6, `workflow-bridge` `epic-continuation.md`) *and* interactive `/workflow-discovery`. Put it in `topic-discovery.md` / the analysis references, not in any single entry skill.

## Item 3 — Suppress Auto-Dispatch Once Past Discovery

**Decision (the maintainer's nuance, captured precisely):** spec existing is **not** a stop — specs can be superseded and rebuilt when discussions change, so there's still value catching a gap before planning. **Planning is the line.** Suppress the **automatic** dispatch of gap + research analysis when **both** hold:

1. **Discovery is quiescent** — every `research` and `discussion` item is `completed` or `cancelled`, and the map has no `◐`/`→`/`○` topics (nothing researching, discussing, ready, or fresh). Nothing left to research or discuss.
2. **The epic has committed** — at least one topic has reached **planning or beyond** (a `planning` / `implementation` / `review` item exists).

Otherwise → run them (behind the Item 2 gate).

Why this captures the nuance:

- **Spec-only does not suppress** — value remains pre-planning. ✓
- **"Many discussions, one planned, others still being discussed"** → condition 1 fails (a discussion is still live) → analysis still runs. ✓
- **Everything done + planned** (the Folio epic; every fully-built legacy epic) → both hold → suppressed, zero noise. ✓
- **Self-correcting** — if a discussion reopens later (`in-progress`), condition 1 breaks and analysis resumes (gated), so suppression never blocks the legitimate "discussion updated → spec rebuilds" path. ✓
- **Escape hatch** — suppression applies to the **automatic boot-time dispatch only**. Running `/workflow-discovery` by hand still runs the analysis (gated), so a maintainer can always ask for it explicitly on a built epic.

Natural home: an early gate in `topic-discovery-dispatch.md` (B. Cache Status Check) that returns without dispatch when the suppression predicate holds — before the staleness check. The data needed (phase item statuses + map tier counts) is already in the discovery output the dispatcher consumes; `convergence-analysis` / `computeMapSummary` give condition 1, a phase-presence check gives condition 2.

The **"no cache = stale" trap** (`computeAnalysisCacheStatus` treating a missing cache as `stale`) is **deliberately not a separate item** — with Item 2 (gate makes any run safe) + Item 3 (no auto-run past planning) + Item 1's heal migration stamping caches, a never-stamped legacy epic stops triggering noise. Revisit only if a case slips through.

---

## Relevant Files

- `skills/workflow-shared/scripts/discovery-utils.cjs` — `computeTopicLifecycle` (~L293, the 1:1 name match), `computeAnalysisCacheStatus` (~L214, "no cache exists" ⇒ stale), `computeNextAction`, `computeMapSummary`, `TIER_RANK`. Item 1 terminal tier + Item 3 predicate inputs live here.
- `skills/workflow-shared/references/topic-discovery-dispatch.md` — the dispatch wrapper (loaded by `workflow-continue-epic`, `workflow-bridge/epic-continuation.md`, and `topic-discovery.md`). Best home for the Item 3 suppression gate.
- `skills/workflow-shared/references/topic-discovery.md` — orchestrates research-analysis + gap-analysis; surfaces `new_arrivals`. Best home for the Item 2 stage→present→approve flow.
- `skills/workflow-shared/references/discovery-gap-analysis.md` — §D "Filter and Save" writes directly today; convert to staging.
- `skills/workflow-shared/references/research-analysis.md` — sibling; same staging conversion.
- `skills/workflow-shared/references/ensure-discovery-item.md` — idempotent item creator + `dismissed[]` handling; reuse for approved-candidate writes.
- `skills/workflow-shared/references/routing-decision.md` — routing semantics shown/overridable at the gate.
- `skills/workflow-shared/references/convergence-analysis.md` — convergence/settled signal for Item 3 condition 1.
- `skills/workflow-continue-epic/SKILL.md` — Step 6 (Topic Discovery dispatch) + Step 7 (display/callout).
- `skills/workflow-continue-epic/references/epic-display-and-menu.md` — renders the map, tiers, and the `new_arrivals` callout; needs the Item 1 terminal tier + (if gate is interactive there) the approval UI.
- `skills/workflow-discovery/**` — the interactive entry that must share the gated path.
- `skills/workflow-migrate/scripts/migrations/038-add-inception-phase.sh`, `040-rename-inception-to-discovery.sh` — where the umbrella was seeded. A new heal-forward migration (`042`) implements Item 1's "mark handled," touching only `source: migration-seeded` items and honouring `dismissed[]`.

## Decision Log (maintainer reasoning, verbatim-ish)

- **Item 1:** "It shouldn't have been added to the discovery map, or if it is, it should be marked as handled somehow… there are a lot of projects that will have exploration, as it used to be recommended at the research stage (pre-discovery process)." → chose **mark handled (terminal)** over omit, detected structurally.
- **Item 2:** "If it finds topics, those need to be surfaced for confirmation. Then we can approve or decline anything to be added… at least we get to see and control what hits the discovery map and get an idea of where it's going to route us."
- **Item 3 (nuanced):** "If everything in the epic has moved through to spec and beyond… there's no value in any type of discovery analysis. Specification documents can be superseded and rebuilt if discussions update — the specifications phase is designed to handle that. So that's the nuance. But if it's moved through to planning, then probably it's over." → **planning is the cut**, with discovery-quiescent as the second condition; manual run always available.

## Notes for the Implementing Agent

- This is a **fix-forward** situation (tag-based distribution, like #24). The heal migration must be safe for consumers who legitimately added discovery-map items between the seed migration and this one — only convert `source: migration-seeded` umbrellas, never user-authored topics, and no-op on already-dismissed/removed items.
- Items 1–3 compose: on a built legacy epic, Item 3 suppresses the analyses, Item 1 renders the umbrella terminal, and Item 2 is the safety net for the in-discovery case. Land them together; each alone leaves a gap.
- The consumer that surfaced this (`folio-ui-and-api`) has already been hand-repaired to the target end-state, so it's a useful before/after reference but should *not* need the heal migration to touch it (it's in `dismissed[]`).
