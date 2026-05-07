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
3. **Open refinement** — conversational, following the discussion-process convention. The user names what they want to change; Claude validates, presents the change, STOP-gates for confirmation, applies, logs, commits. One change per gate. After each, "anything else?".
4. **Conclude** — when the user signals done, persist any final state and end the session.

### Convention — same conversational pattern as discussion-process

Inception is the second conversational phase in the system; discussion-process is the precedent. Both follow the same model:

- Conversation IS the work — the user expresses intent in free text.
- Writes are gated by explicit STOP-then-confirm prompts, the same way decisions land in a discussion session.
- One write per gate, per-change commits — matches existing convention.
- Menu-driven prompts only for finite-choice moments (start/conclude session, surface findings via two-phase protocol).

What this is **not**:

- No batch confirmations — even when the user names several changes in one message, Claude works through them one at a time, each with its own STOP gate.
- No menu-driven CRUD for editing operations — the operations are open-ended (rename WHAT to WHAT, add a topic with WHAT properties); free-text intent + STOP gate is lighter than nested sub-menus.
- No special "bulk mode" or `step` opt-in — the existing per-change pattern handles bulk naturally (the user just names multiple things in succession).

Example of multi-change interaction:

```
   User:   "Remove A, rename B to B2, add C."

   Claude: "Three changes — I'll work through them in order.

            First: remove A. A has no work started, safe to remove.
            Confirm? (y/n)"

   User:   y

   Claude: [removes, logs, commits]
           "Next: rename B to B2. B has no work started, safe to
            rename. Confirm? (y/n)"

   User:   y

   ... etc.
```

Same conversational feel from the user side; every write goes through its own gate.

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

Proposals surface in two places — both via the existing two-phase protocol, both with `add to map` / `dismiss` / `defer` choices per proposal:

**1. Inline at phase conclusion.** When research or discussion concludes and analysis identifies new proposals, the conclude flow asks: *"N proposed map updates from this {phase}. Review now or later?"*

- **Now**: walk through each proposal one at a time. Approved → manifest write. Dismissed → cache dismissed list. Deferred → stays in pending.
- **Later**: stays cached, surfaced at next continue-epic + refinement session.

This avoids forcing the user back through `f`/`refine` for proposals that surface at natural transition points. Context is fresh from the just-completed work; the user can quickly accept or dismiss.

**2. In refinement sessions** (`f`/`refine`). The user explicitly entered to curate the map. Self-healing check reads cache; any unsurfaced or deferred proposals are walked through before open refinement begins.

What does **not** surface proposals: in-flight research and discussion sessions. While the user is doing the work, we don't interrupt with map-level proposals. Those wait for conclusion or for a refinement session.

### Trigger pattern for analyses

- **Research-analysis** runs after research conclusion. Reads research files. Proposals enter the cache.
- **Gap-analysis** runs after discussion conclusion. Reads discussion files + the cached `research-analysis.md` state. Proposals enter the same cache.
- **Both run on inception entry** if their caches are stale.
- **Both feed the same proposal pool** — deduped at source-of-proposal level.

What this gives the user: as discussions complete and the product takes shape, gaps that weren't visible before become visible. Each conclusion is a moment to consider what just emerged.

### Content extraction at proposal acceptance

**No content extraction.** When a proposal is accepted, only an inception item is created — no file movement, no rewriting of the source research/discussion file.

The new map item carries `source: research-analysis:{parent}` (or `gap-analysis`, etc.) as provenance. When the user later starts research or discussion on the new topic, the entry skill can read the source file as reference context. The source research/discussion file stays as-is — it's a historical record of what was actually said in that session.

The exception is the existing in-session mechanisms (`topic-splitting` in research, `topic-elevation` in discussion) — those *do* extract content because they fire mid-conversation, before the source is concluded. Post-conclusion proposals don't extract.

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

Order: `→` first (ready to advance), then `◐` (in flight), then `✓` (decided), then `○` (fresh), then `⊘` (cancelled). Within each tier, sort alphabetically by `name`. Tier grouping handles most of the actionability prioritisation; alphabetical within a tier is stable and free. Revisit only if real use on large maps surfaces frustration.

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

For each in-progress epic without an inception phase, a migration script seeds the discovery map from existing state.

### Topic collection — discovery items only

Discovery topics live in research and discussion. Spec onwards is downstream — spec topics may be *regroupings* of discussions (e.g., spec `authentication` merging discussions `auth-flow` and `session-management`), not standalone discovery topics. The map shows the underlying discussion items, not the spec name.

Walk research and discussion items + the two existing pending arrays:

```
   Source                                    Routing assigned
   ────────────────────────────────────────────────────────────
   topic in phases.research.items            research
   topic in phases.discussion.items only     discussion
   topic in phases.research.surfaced_topics  discussion
   topic in phases.discussion.gap_topics     discussion
```

If a topic has both research and discussion items, a single inception item with `routing: research` (the natural flow). The lifecycle computation later joins these against per-phase statuses to produce the rendered state, so a `decided` topic naturally shows up in spec when sourced — no phantom inception items needed.

### Source classification

```
   Origin                                Source value
   ──────────────────────────────────────────────────────────
   Has phase items                       migration-seeded
   In surfaced_topics only               migration-seeded:research-analysis
   In gap_topics only                    migration-seeded:gap-analysis
```

Sub-classification helps future self-healing avoid re-proposing items the user accepted via migration.

### Order of operations

```
   for each work_unit (epic only, in-progress):
     ensure phases.inception exists
     collect topic names from research and discussion items
     for each topic:
       skip if inception item already exists
       infer routing
       create inception item with empty summary, source: migration-seeded
     for each topic in surfaced_topics:
       skip if inception item already exists
       create with routing: discussion, source: migration-seeded:research-analysis
     for each topic in gap_topics:
       skip if inception item already exists
       create with routing: discussion, source: migration-seeded:gap-analysis
```

### Idempotency

Per-topic check: `manifest exists {wu}.inception.{topic}` → if true, skip. If false, create.

This handles partial migration gracefully (script crashed halfway, re-run completes the work). Migration log entry only writes on full success; re-running on a crashed migration runs the whole script again, which is safe due to per-topic idempotency.

### What migration does NOT do

- **Doesn't touch `surfaced_topics` and `gap_topics` arrays.** They become redundant after migration but removing them is part of the larger refactor (continue-epic, display-options need to read from inception instead). Migration leaves them in place; refactor cleans up in a follow-up migration.
- **Doesn't back-fill summaries.** Migration scripts are bash/node, not LLM sessions. Summaries are populated in the user's first refinement session post-migration.
- **Doesn't infer cancellation.** Even if a topic has all phase items cancelled, migration creates the inception item as `active`. The user explicitly decides during refinement whether to remove it from the map.

### Post-migration UX

First time the user runs `/continue-epic` post-migration, the discovery map renders with all empty summaries. To make the migration visible:

```
  Discovery Map (5 topics)
  ⚑ Migrated to discovery map. 5 items have no summary —
    open `f`/`refine` to populate.
```

The callout disappears once all items have summaries.

When the user opens `f`/`refine`, the refinement session detects empty summaries and prompts: "Some items don't have summaries yet — populate them now?" User says yes, the session walks through each empty-summary item asking for a one-line summary, with a `skip` option per item.

### Edge cases

- **Cross-cutting work units.** `cross-cutting` work_type is single-topic, project-level — no decomposition needed. Migration check: if `work_type != epic`, skip entirely.
- **Other work types.** Feature, bugfix, quick-fix don't get an inception phase.
- **Completed and cancelled epics.** Migration filter: `status: in-progress` only. Reactivation flow (if a completed epic is reopened post-deployment) triggers migration for that work unit at reactivation time.

### Migration is non-destructive

Existing files stay where they are; the map just registers them. No file moves, no content rewrites.

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

## Settled Decisions

The map is **flat, not hierarchical**. Source provenance lines cover the splits/elevations case; sub-domains belong in discussion subtopics (the existing Discussion Map handles within-topic structure). Nesting at the discovery layer would conflate two distinct levels of hierarchy and add real machinery — tree rendering, parent/child operations, cascade semantics, filesystem nesting questions — for cosmetic gain.

Migration path if real use surfaces a need we haven't anticipated: add a `parent` field, backward compatible, no data loss. Deferring this until evidence demands it.

## Open Questions

None blocking design. Items deferred to implementation:

- `inception-guidelines.md` content — worked examples for each curatorial move; figured out during build.

## Status

Design phase — not yet implemented. This document captures the converged thinking from a long design conversation. Open questions remain (see above). Implementation should proceed only after those are settled and a worked example walkthrough has been validated against a real session.
