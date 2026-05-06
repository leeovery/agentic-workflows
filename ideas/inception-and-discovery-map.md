# Inception Phase and Discovery Map

## The Idea

Add a new phase — **inception** — at the start of every epic, whose job is curatorial: name the topics that make up the work unit, classify each as research or discussion, and produce a **discovery map**. The map is a living artefact stored in the work-unit manifest; it spans inception, research, and discussion (collectively the "discovery process") and feeds specification.

This restructures how the early phases of an epic operate. Research and discussion remain as phases, but they become per-topic and routed-from-the-map rather than open-ended starting points.

## Why

In greenfield epics, research and discussion bleed into each other and into mechanism-thinking. Symptoms observed in real sessions:

- During open-mode research on a brand-new product (e.g. a white-label takeaway ordering app), Claude drifts from feasibility findings into design decisions ("we'll surface the image-generation queue via WebSockets") that should belong to discussion. The research file accumulates content the user didn't want there.
- The user has to mentally hold the map of "what topics need handling" — there is no system-level view of "we've covered admin, customer portal, kitchen hardware; we haven't talked about roles & permissions yet."
- `discussion-gap-analysis` already surfaces cross-discussion gaps, but only fires when the user enters `workflow-discussion-entry` without a topic. If they're resuming specific in-progress discussions, gaps stay invisible until they happen to start a fresh discussion.
- Research's open-exploration mode (`e`/`explore`) and the freeform `exploration.md` invite sprawl in greenfield, then defer the structuring work to reactive topic-splitting which only fires when convergence signals appear — too late for a sprawling product idea.

The activity that's actually missing is a **curatorial conversation**: name the moving parts, classify which need investigation versus decisions, produce a topic map. This is not research (don't investigate yet), not discussion (don't decide yet) — it's a separate cognitive activity that real teams do under names like "inception", "framing", "discovery sprint", "domain mapping". The system has no place for it, so users currently dump it into research and let "themes emerge naturally" — which doesn't reliably work.

## Conceptual Model

**Discovery** is the umbrella process containing three phases:

```
                        DISCOVERY PROCESS
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   │   ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
   │   │ INCEPTION│───▶│ RESEARCH │───▶│  DISCUSSION  │          │
   │   │  (new)   │    │ (scoped) │    │  (per-item)  │          │
   │   └──────────┘    └──────────┘    └──────────────┘          │
   │        │               │                  │                 │
   │        └───────────────┼──────────────────┘                 │
   │                        │ all phases read & propose          │
   │                        ▼ updates                            │
   │                ┌────────────────┐                           │
   │                │ DISCOVERY MAP  │ (manifest-level artefact) │
   │                └────────────────┘                           │
   │                                                             │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  SPECIFICATION   │  (unchanged — regroups discussions)
                    └──────────────────┘
                              │
                              ▼
                       PLAN → IMPL → REVIEW
```

"Discovery" is a label that lives in displays and documentation, not in the manifest structure. Inception, research, and discussion remain sibling top-level phases. This avoids restructuring the manifest CLI's dot-path scheme.

The **discovery map** is the cross-phase spine — a list of topics with routing intent, summary, source provenance, and computed lifecycle. It is the user-facing artefact that solves the "what's still left to handle" problem.

## Naming

- **Inception** — the new phase. Curatorial-mode conversation that produces and refines the map.
- **Discovery** — the conceptual process spanning inception, research, and discussion together.
- **Discovery map** — the artefact (manifest-backed list of map items, rendered on display).

Greenfield versus existing-project epics use the same inception shape. Scope emerges from the user's responses, not from a flag. There are no flavours — one skill, one shape, adapts naturally.

## Core Principle

**The map reflects what's happening; it doesn't curate.**

Once a topic is in flight, the map updates automatically based on phase commands (cancel, start, complete). The user never has to manually sync the map with reality.

Map *curation* — adding new topics, removing not-yet-started topics, editing summaries, changing routing for not-yet-started topics — happens exclusively in inception sessions.

This separation collapses several earlier complications: no two-flavour cancellation, no re-routing locks for in-flight items, no "deferred" status alongside "cancelled". Phase commands are operational; inception is curatorial; the map is computed from the join.

## Discovery Map — Data Model

The map lives in the work-unit manifest at `phases.inception.items.{topic}`. Each item carries:

- `name` — the topic identifier (kebab-case, used as filename for downstream phases)
- `summary` — one-line description of what the topic covers
- `routing` — `research` | `discussion`. The *initial intent* set in inception. Source of truth for menu routing only when no per-phase items exist; otherwise the actual flow is determined by which phase items exist.
- `source` — provenance: `inception`, `research-split:{parent}`, `discussion-elevation:{parent}`, `gap-analysis`, `research-analysis`, `direct-start`
- `status` — `active` | `cancelled` (only used when a topic is removed from the active map)
- `created`, `updated` — timestamps

Inception items are **topic records**, not work artefacts. They carry metadata about a topic's place on the map. There is no work-in-progress state on an inception item — the work happens in research and discussion phase items.

**Lifecycle is computed, not stored.** The "where is this topic in the discovery flow?" is derived at render time by joining the inception item against `phases.research.items.{topic}` and `phases.discussion.items.{topic}` (and onwards into spec). Concretely:

```
   Topic state (computed)        Derivation
   ────────────────────────────────────────────────────────────────
   fresh                         routing set, no phase items exist
   researching                   research item in-progress
   ready for discussion          research completed, no discussion item
   discussing                    discussion item in-progress
   decided                       discussion item completed
   cancelled (work)              all relevant phase items cancelled
   cancelled (topic)             inception item.status = cancelled
```

When phase items contradict the original routing intent (e.g. `routing: research` but research was cancelled and discussion started), the computation reflects current reality and the original intent becomes historical metadata.

**Topic name is the link** between inception and per-phase items. No explicit foreign key. Same convention used today between `discussion/{topic}.md` and `specification/{topic}/`.

## Inception Phase — Behaviour

Inception is conversational like research and discussion, but operates in a **curatorial mode** distinct from both:

- **Macro view always.** Don't tunnel into one item. If the user goes deep, gently park the detail as a note on the topic and return to the map level.
- **Decomposition patterns.** Suggest groupings: "this could be three things, or one thing with two sub-concerns — which feels right?"
- **Missing-piece prompts.** "You haven't mentioned anything about [auth / payments / observability]. Out of scope, or just hasn't surfaced?"
- **Coarseness check.** "We have 15 topics; that feels granular for a first pass. Any worth consolidating?"
- **Routing as pragmatism.** "If you have an answer in your head, route to discussion. If you'd say 'I'm not sure how this works', route to research."
- **No decisions, no investigations.** Defer mechanism questions to discussion. Use what you and the user already know; don't go searching.

These behaviours belong in `inception-guidelines.md`, parallel to `research-guidelines.md` and `discussion-guidelines.md`. The guidelines load once at session start.

### Initial session

Initial inception session for an epic flows like:

1. **Read description** — already captured by `start-epic` in the work-unit manifest. No "brief" artefact.
2. **Decompose** — "what are the major moving parts?" The user lists items at whatever scope makes sense (whole product for greenfield, just the change for an existing-project epic).
3. **Refine** — consolidate, push back, prompt for gaps. Iterative.
4. **Classify** — research or discussion per topic. Items can stay unrouted ("not sure yet") and remain on the map.
5. **Confirm** — render the proposed map; the user approves or amends.
6. **Persist** — manifest writes (one inception item per topic), session log to disk, commit.
7. **Conclude** — optional suggestion of where to start ("AI image generation looks like the highest-uncertainty item; suggest research that first").

### Refinement session (re-entry)

Re-entry sessions skip the description and decompose moves. They:

1. **Read state** — load `phases.inception.items.*` and per-phase statuses from the manifest. Manifest is authoritative; no file reading required for state.
2. **Self-healing check** — if `research-analysis` or `gap-analysis` cache is stale, run the analyses (this is the only place file reading happens, and only when needed). Surface any new proposals one at a time via the existing two-phase surfacing protocol.
3. **Open refinement** — free-form conversation. The user adds, removes, renames, edits, or re-routes; Claude validates and confirms each change.
4. **Persist** — write `session-NNN.md` capturing what changed and why, commit.

### Map editing operations

What the user can do in a refinement session, gated by the topic's current state:

```
   Operation              Never-started   In-flight     Completed
   ──────────────────────────────────────────────────────────────
   Edit summary               ✓              ✓             ✓
   Add new topic              ✓              n/a           n/a
   Remove from map            ✓              ✗             ✗
   Rename topic               ✓              ✗             ✗
   Change routing             ✓              n/a (implicit) n/a
```

The restrictions exist because:

- **Remove from map (in-flight or completed)** — there are phase items and likely files. Use `a`/`cancel` in `continue-epic` to stop the work; the map then shows ⊘ for the cancelled phase, naturally reflecting the change.
- **Rename (in-flight or completed)** — the topic name is the link between phases (`research/{topic}.md` ↔ `discussion/{topic}.md` ↔ `specification/{topic}/`). Renaming would require moving files and updating `sources` references in specs. Possible but the kind of operation that should be deliberate, not casual. Easier rule: rename only when nothing's been touched yet.
- **Change routing (in-flight)** — routing is implicit from which phase items exist. To pivot research → discussion mid-flight, the user cancels the research item and starts discussion (`a`/`cancel`, then `d`/`discuss`). The map auto-updates.

### Length

Length is bounded by completion, not by a brevity heuristic. The session ends when topics are surfaced and the map is documented to the user's satisfaction. Could be 10 minutes for a small feature epic; could be hours for a sprawling greenfield product. The convergence signal is "user confirms the map is seeded enough to start", not a length rule.

### Files on disk

```
.workflows/{wu}/
├── manifest.json                     ← phases.inception.items.* lives here
├── inception/
│   ├── session-001.md                ← initial framing record
│   ├── session-002.md                ← refinement record
│   └── session-NNN.md
├── research/
├── discussion/
└── ...
```

Session logs capture the conversation: the description as-of-session, the decompose moves, why each topic was named, why each was routed, what changed in refinement. They have re-entry value ("how did we end up with these topics?") and audit value.

No `brief.md`, no `inception/manifest.json`, no per-item rationale files. Manifest is the source of truth for structured state; session logs are the journey-of-shaping record.

## Auto-Routing

When the user picks a per-topic entry from the `continue-epic` menu, the system computes the next phase from `routing intent + per-phase progress`. The menu collapses from per-phase entries (Continue X — research, Continue X — discussion, etc.) to a single per-topic entry that does the right thing.

```
   Topic state                            Menu entry
   ────────────────────────────────────────────────────────────────────
   routing=research, no research          Start research for "{topic}"
   routing=research, research WIP         Continue "{topic}" — research
   routing=research, research done        Start discussion for "{topic}"
   routing=research, discussion WIP       Continue "{topic}" — discussion
   routing=discussion, no discussion      Start discussion for "{topic}"
   routing=discussion, discussion WIP     Continue "{topic}" — discussion
```

Looping back into a phase that's already complete is impossible because the computation always checks per-phase completion before deciding "next".

**Direct entry on unmapped topics.** `d`/`discuss` and `r`/`research` for a topic *not* on the map auto-create a map item with `source: direct-start` and the corresponding routing, then proceed to the phase entry. The map stays honest without forcing the user through inception.

## Cancellation

Cancellation operates **only on phase items** through the existing `a`/`cancel` flow. The map then reflects the cancellation visually (⊘ for cancelled work).

Two scenarios in practice:

1. **Abandon specific work, keep the topic** — research went sideways, but the topic still matters. Cancel the research item; topic remains on the map; user can re-enter inception to re-route, or just start discussion directly (which auto-updates routing).
2. **Remove a topic from active consideration** — only meaningful for never-started topics. Done in inception via the refinement session. For in-flight or completed topics, the user cancels phase items via `a`/`cancel`, and the cancellation is visible in the map.

There is no separate "cancel inception item" action in `continue-epic`. The map is curated through inception sessions; phase work is managed through phase commands; cancellation lives in the latter.

## Spec Gating

Specification can start whenever at least one discussion is completed. The spec process already handles:

- Intelligent grouping of discussions into specs
- Re-analysis when discussions change
- Anchoring to existing specs and supersession when discussions shift
- Adding completed discussions to existing specs

So gating spec on full discovery settlement is overkill — keep the existing behaviour. The map's convergence signal (`⚑ Discovery in progress` / `✓ Discovery settled`) is **informational only**.

What changes is the recommendation logic in `continue-epic`'s menu:

- **During active discovery**: recommend the topmost discovery item (`→` first, then `◐`). Don't recommend `s`/`spec` even if it's available — keeps focus on completing discovery first.
- **Once discovery settles**: build-phase recommendations resume normally, including `s`/`spec` when applicable.

`s`/`spec` is always *available* when applicable, just not always *recommended*.

## Self-Healing

The map stays current through analyses that propose updates at trigger points. The user always approves; nothing auto-applies.

**State determination uses the manifest only** — fast, cheap. File reading happens only inside the analyses, which are cached against input checksums.

### Two distinct events

**Analysis runs** (writes to cache):

- At **phase conclusion** — when a research or discussion topic completes, the relevant analysis re-runs (research-analysis after research, gap-analysis after discussion). Input checksum is stale by definition; analysis re-computes and writes proposals to cache.
- At **inception entry** (`f`/`refine`) — checks each analysis cache; runs if stale, no-ops if current.

**Cache is read** (no analysis):

- At **`continue-epic` display time** — reads existing cache for the proposal count. Never triggers an analysis run. If cache is stale, the count is unknown and the indicator simply doesn't show.

This keeps `continue-epic` cheap (it's invoked frequently) while ensuring proposals exist before the user's next opportunity to act on them.

### Cache lifecycle

Each analysis cache holds:

- Input checksum at time of run
- Timestamp and list of input files
- **Pending proposals** — items proposed but not yet surfaced or dismissed
- **Dismissed list** — proposals the user explicitly rejected, so they don't re-surface

Cache invalidates on input checksum mismatch (new file content, new map items affecting grouping). When invalidated and re-run, proposals are reconciled — anything still relevant carries forward; previously-dismissed items stay dismissed.

The existing `analysis_cache` and `gap_analysis_cache` manifest fields extend rather than replace — same shape, plus the dismissed list.

### Surfacing mechanics

Proposals surface **only inside inception sessions**, never in research/discussion sessions. This keeps map-level curation contained to the curatorial phase.

Flow inside a refinement session:

1. Self-healing check reads cache.
2. If proposals exist: announce ("I have N proposed map updates from recent {phase}. Review now?").
3. If yes: surface each one at a time via the existing two-phase protocol — show the proposal, the source files, the rationale, then `add to map` / `dismiss` / `defer`.
4. Approved → manifest write, item joins the map.
5. Dismissed → added to cache's dismissed list.
6. Deferred → stays in pending, surfaces again next session.
7. After all surfaced (or user opts to defer all), continue with open refinement.

Existing analysis behaviour preserved:

- `research-analysis` (in `workflow-discussion-entry`) re-points to the map: instead of generating discussion topics directly, it proposes new inception items.
- `discussion-gap-analysis` re-points the same way: gaps surface as proposed inception items, not as direct discussion topics.
- Both retain their cache mechanisms — input checksum, skip if unchanged.
- Output goes through the existing two-phase surfacing protocol: announce-then-raise, one finding at a time.

The current `pending_from_research` and `pending_from_gaps` concepts in `continue-epic` discovery collapse into "map items in `fresh` state, not yet started". One concept, one rendering.

### Notification UX

At `continue-epic` display time, when cache shows pending proposals: a `⚑` callout above the discovery map plus a count on the `f`/`refine` menu entry.

```
  Discovery Map (8 topics — ...)
  ⚑ Discovery in progress — 6 topics not yet decided.
  ⚑ 3 proposed map updates from recent research/discussion.
    Open `f`/`refine` to review.

  ├─ →  Kitchen Hardware            ...
```

```
- **`f`/`refine`** — Refine map (3 proposed updates)
```

Both signals — neither blocks. When no proposals: callout disappears, menu entry shows just `Refine map`. The callout sits above the map for visibility (user reads top-down; proposals are time-sensitive).

### Dismissal persistence

A dismissed proposal stays dismissed forever, with an explicit "show dismissed proposals" option available in inception for the user who changes their mind. Avoids re-pestering by default while allowing recovery.

### Source-of-proposal deduplication

A topic surfaced by both research-analysis AND gap-analysis (same theme via two paths) is deduplicated in analysis output and surfaced once, with both source paths noted in the proposal detail.

## Topic Splitting and Elevation

Both existing mechanisms — research's topic-splitting and discussion's topic-elevation — write to the discovery map rather than directly creating siblings:

- **Research topic-splitting**: when a thread is promoted, creates a new inception item with `source: research-split:{parent-topic}`. The new research file is created against the new topic name as today.
- **Discussion topic-elevation**: when a subtopic outgrows its parent, creates a new inception item with `source: discussion-elevation:{parent-topic}`.

Asymmetry to enforce: research and discussion *spawn* new map items but never modify existing ones. Only inception sessions modify existing items (refine summary, change routing while not-yet-started). This discipline keeps the map authoritative.

## Map Render and Menu

### State display

```
●───────────────────────────────────────────────●
  Galley
●───────────────────────────────────────────────●

  Discovery Map (8 topics — 2 decided · 3 in flight · 1 ready · 1 fresh · 1 cancelled)
  ⚑ Discovery in progress — 6 topics not yet decided.

  ├─ →  Kitchen Hardware            research complete · ready for discussion
  ├─ ◐  AI Image Generation         researching
  ├─ ◐  Tenant Onboarding           discussing
  ├─ ◐  Print Server Protocol       researching · from kitchen-hardware
  ├─ ✓  Roles And Permissions       decided
  ├─ ✓  Payments                    decided
  ├─ ○  Customer Portal             fresh · routed to discussion
  └─ ⊘  Marketing Site              cancelled

  Specification (1 completed)
  └─ Roles And Permissions [completed]

  Key:
    →  ready for next phase   ◐  in flight
    ✓  decided                ○  fresh
    ⊘  cancelled
```

Order: `→` first (ready to advance), then `◐` (in flight), then `✓` (decided), then `○` (fresh), then `⊘` (cancelled). Stable sort within each tier (open: alphabetical or last-updated — see Open Questions).

Source provenance shows on a sub-line under the row when present.

When discovery settles: `⚑ Discovery in progress` becomes `✓ Discovery settled — ready for specification.`

### Menu

```
What would you like to do?

- **`1`** — Start discussion for "Kitchen Hardware" — research completed
- **`2`** — Continue "AI Image Generation" — research
- **`3`** — Continue "Tenant Onboarding" — discussion
- **`4`** — Continue "Print Server Protocol" — research
- **`5`** — Start discussion for "Customer Portal"

- **`f`/`refine`** — Refine map [(N proposed updates)]
- **`d`/`discuss`** — Start a discussion on a new topic
- **`r`/`research`** — Start research on a new topic
- **`s`/`spec`** — Start specification — N discussion(s) not yet in a spec
- **`c`/`completed`** — Resume a completed topic
- **`a`/`cancel`** — Cancel a topic (phase work)
- **`e`/`reactivate`** — Reactivate a cancelled topic
- **`m`/`map`** — View pipeline map
```

Numbered items follow the per-topic rule:

- `→` lifecycle → `Start {next_phase} for "{topic}" — {prev} completed`
- `◐` → `Continue "{topic}" — {current_phase}`
- `○` → `Start {routed_phase} for "{topic}"`
- `✓` and `⊘` → no entry

Build-phase entries (planning, implementation, review) follow the same pattern when applicable. `(recommended)` marker appears on the top discovery item during discovery; once settled, it appears on the top build-phase item.

`p`/`pending` (manage pending discussion topics) goes away — the map covers it. Pending-from-research and pending-from-gaps both render as `○` rows on the map.

`a`/`cancel` continues to operate on phase items only.

## What Changes In Existing Skills

- `start-epic`'s `route-first-phase.md` collapses to "always inception" for epics. Research / discussion / import options move into inception's flow (import becomes "import existing files and seed the map from them").
- `workflow-research-entry`'s explore-vs-specific mode goes away. Research is always scoped to a map item; topic comes from the inception item.
- Research's `file-strategy.md` simplifies — no multi-file branching for epic. One item, one file.
- `workflow-discussion-entry` Steps 4 and 5 (research-analysis, gap-analysis) re-point to map proposals. The analyses run, but their output is "propose these map items" rather than "show these as suggested discussion topics". The cache mechanisms are preserved.
- `continue-epic`'s state display gains a Discovery Map section at the top. Per-phase entries collapse into per-topic entries with computed lifecycle.
- `continue-epic`'s menu gains `f`/`refine`. `p`/`pending` is removed.
- `continue-epic`'s discovery script joins inception items with per-phase items to compute lifecycle.
- `workflow-bridge` gains a continuation reference for "research-of-routed-item completed → discussion-entry next".
- The manifest CLI's phase validation table gains `inception` as a valid phase name.

Most existing skills are unaffected (specification, planning, implementation, review unchanged).

## Migration

Existing in-progress epics need the inception phase added:

- A migration script seeds `phases.inception.items.{topic}` for every existing research and discussion topic in the work unit, using the topic name as the link.
- Routing is inferred: if a research item exists, set `routing: research`; otherwise `routing: discussion`.
- Source is set to `migration-seeded`.
- Summary is left empty (or pulled from the file's frontmatter / first heading if available); the user populates it on first inception refinement session.
- The user is prompted on first inception entry post-migration to review the seeded map.

The migration is non-destructive — existing files stay where they are; the map just registers them.

## Files Affected (Estimated Scope)

- New: `skills/workflow-inception-entry/` (entry skill, references)
- New: `skills/workflow-inception-process/` (process skill, references including `inception-guidelines.md`)
- New: `workflow-bridge` continuation reference for inception → research/discussion handoffs
- New: migration script to add inception phase to existing epic manifests
- Modified: `start-epic` route-first-phase, name-check, gather-epic-context flow
- Modified: `workflow-research-entry` (drop explore mode for epic), `workflow-research-process/file-strategy.md`, `epic-session.md`, `topic-splitting.md`
- Modified: `workflow-discussion-entry` (research-analysis and gap-analysis re-point to map)
- Modified: `workflow-discussion-process/discussion-session.md` (topic elevation writes to map)
- Modified: `continue-epic` (display map at top, collapse menu, add Refine map, remove pending menu)
- Modified: `continue-epic/scripts/discovery.cjs` (compute lifecycle from joined phase items)
- Modified: `workflow-bridge` (epic continuation reference handles new transitions)
- Modified: `workflow-manifest/scripts/manifest.cjs` (add `inception` to phase validation)
- Modified: CLAUDE.md, README phase model documentation

## Open Questions

These are the gaps still to push on before implementation:

1. **Migration approach detail.** Order of operations, idempotency, what happens if the user has a partially-migrated state, how summaries get back-filled. Worth a dry-run on a real existing epic.

2. **Sorting within tiers.** Alphabetical is simplest and stable, last-updated reads better for active sessions ("what was I just working on"). Adding `last_updated` on items is cheap. Pick before implementation.

3. **Bulk operations and safety.** Renaming six topics in one session, removing several items — fine? Confirmation per change for safety, with the user able to sequence them quickly. Worth confirming.

4. **Hierarchical map (children) versus flat.** Flat is current decision. Discussion's subtopic-with-children is a working precedent we could borrow if flat feels cramped. Revisit only if real use surfaces a need.

Items deferred to implementation (not blocking design):

- `inception-guidelines.md` content — worked examples for each curatorial move; figured out during build.

## Status

Design phase — not yet implemented. This document captures the converged thinking from a long design conversation. Open questions remain (see above). Implementation should proceed only after those are settled and a worked example walkthrough has been validated against a real session.
