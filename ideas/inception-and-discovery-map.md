# Inception Phase and Discovery Map

## The Idea

Add a new phase — **inception** — at the start of every epic, whose job is curatorial: name the topics that make up the work unit, classify each as research or discussion, and produce a **discovery map** that drives all subsequent phase routing. The discovery map is a living artefact stored in the work-unit manifest; it spans inception, research, and discussion (collectively the "discovery process") and feeds specification.

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

The **discovery map** is the cross-phase spine — a list of topics with routing, summary, source provenance, and status. It is the user-facing artefact that solves the "what's still left to handle" problem.

## Naming

- **Inception** — the new phase. Curatorial-mode conversation that produces the map.
- **Discovery** — the conceptual process spanning inception, research, and discussion together.
- **Discovery map** — the artefact (manifest-backed list of map items).

Greenfield versus existing-project epics use the same inception shape. Scope emerges from the user's responses, not from a flag. There are no flavours — one skill, one shape, adapts naturally.

## Discovery Map — Data Model

The map lives in the work-unit manifest at `phases.inception.items.{topic}`. Each item carries:

- `name` — the topic identifier (kebab-case, used as filename for downstream phases)
- `summary` — one-line description of what the topic covers
- `routing` — `research` | `discussion` (mutable until per-phase work begins; locked thereafter)
- `source` — provenance: `inception`, `research-split:{parent}`, `discussion-elevation:{parent}`, `gap-analysis`, `research-analysis`
- `status` — `in-progress` | `cancelled` (the inception item's own status, for cancellation)
- `created`, `updated` — timestamps

**Lifecycle is computed, not stored.** The "where is this topic in the discovery flow?" is derived at render time by joining the inception item against `phases.research.items.{topic}` and `phases.discussion.items.{topic}` (and onwards into spec). Concretely:

```
   if routing == "research":
       if no research item exists           → fresh
       if research is in-progress           → researching
       if research is completed:
           if no discussion item             → ready for discussion
           if discussion in-progress         → discussing
           if discussion completed           → decided

   if routing == "discussion":
       if no discussion item                 → fresh
       if discussion in-progress             → discussing
       if discussion completed               → decided
```

Storing lifecycle on the inception item invites drift; computing it eliminates that risk.

**Topic name is the link** between inception and the per-phase items. No explicit foreign key. Same convention used today between `discussion/{topic}.md` and `specification/{topic}/`.

## Inception Phase — Behaviour

Inception is conversational like research and discussion, but operates in a curatorial mode distinct from both:

- **Macro view always.** Don't tunnel into one item. If the user goes deep, gently park the detail as a note on the topic and return to the map level.
- **Decomposition patterns.** Suggest groupings: "this could be three things, or one thing with two sub-concerns — which feels right?"
- **Missing-piece prompts.** "You haven't mentioned anything about [auth / payments / observability]. Out of scope, or just hasn't surfaced?"
- **Coarseness check.** "We have 15 topics; that feels granular for a first pass. Any worth consolidating?"
- **Routing as pragmatism.** "If you have an answer in your head, route to discussion. If you'd say 'I'm not sure how this works', route to research."
- **No decisions, no investigations.** Defer mechanism questions to discussion. Use what you and the user already know; don't go searching.

These behaviours belong in `inception-guidelines.md`, parallel to `research-guidelines.md` and `discussion-guidelines.md`. The guidelines load once at session start.

### Session structure

Initial inception session for an epic flows like:

1. **Read description** — already captured by `start-epic` in the work-unit manifest. No "brief" artefact.
2. **Decompose** — "what are the major moving parts?" The user lists items at whatever scope makes sense (whole product for greenfield, just the change for an existing-project epic).
3. **Refine** — consolidate, push back, prompt for gaps. Iterative.
4. **Classify** — research or discussion per topic. Items can stay unrouted ("not sure yet") and remain on the map.
5. **Confirm** — render the proposed map; the user approves or amends.
6. **Persist** — manifest writes (one inception item per topic), session log to disk, commit.
7. **Conclude** — optional suggestion of where to start ("AI image generation looks like the highest-uncertainty item; suggest research that first").

Re-entry sessions skip the description and decompose moves. They:

1. Read current map and recent research/discussion files.
2. Run self-healing — surface any proposed map updates from analyses (gap analysis, research analysis) one at a time via the existing two-phase surfacing protocol.
3. Open-ended refinement: user-driven additions, merges, re-routings (where allowed), cancellations.
4. Persist updates, write `session-NNN.md`, commit.

### Length

Length is bounded by completion, not by a brevity heuristic. The session ends when topics are surfaced and the map is documented to the user's satisfaction. Could be 10 minutes for a small feature epic; could be hours for a sprawling greenfield product. The convergence signal is "user confirms the map is seeded enough to start", not a length rule.

### Files on disk

```
.workflows/{wu}/
├── manifest.json                     ← phases.inception.items.* lives here
├── inception/
│   ├── session-001.md                ← initial framing record
│   ├── session-002.md                ← re-entry record
│   └── session-NNN.md
├── research/
├── discussion/
└── ...
```

Session logs capture the conversation: the description as-of-session, the decompose moves, why each topic was named, why each was routed. They have re-entry value ("how did we end up with these topics?") and audit value.

No `brief.md`, no `inception/manifest.json`, no per-item rationale files. Manifest is the source of truth for structured state; session logs are the journey-of-shaping record.

## Auto-Routing

When the user picks "Continue {topic}" from `continue-epic`, the system computes the next phase from `routing + per-phase progress`. The `continue-epic` menu collapses from per-phase entries (Continue X — research, Continue X — discussion, etc.) to a single per-topic entry that does the right thing.

```
   Topic state                            Menu entry
   ────────────────────────────────────────────────────────────────────
   routing=research, no research          Start research for "{topic}"
   routing=research, research WIP         Continue "{topic}" — research
   routing=research, research done        Start discussion for "{topic}"
   routing=research, discussion WIP       Continue "{topic}" — discussion
   routing=research, all done             (offer: add to a spec)
   routing=discussion, no discussion      Start discussion for "{topic}"
   routing=discussion, discussion WIP     Continue "{topic}" — discussion
   routing=discussion, discussion done    (offer: add to a spec)
```

Looping back into a phase that's already complete is impossible because the computation always checks per-phase completion before deciding "next".

## Re-Routing Rules

- Routing is **mutable** while no per-phase item exists for the topic. Re-entering inception can change routing freely for fresh items.
- Routing is **locked** once `phases.research.items.{topic}` or `phases.discussion.items.{topic}` exists, regardless of those items' statuses (in-progress or completed).
- To "re-route" an in-flight or completed item, the user **cancels** the current per-phase item and the inception flow advances or restarts. Cancellation is intentional and visible in the manifest; silent re-routing would lose history.

For an inception session re-entering to refine the map:

- Unrouted / fresh items: full editing, including routing
- In-flight items: edit summary and notes; routing locked
- Completed items: edit summary/notes; routing irrelevant
- Cancellation always available

## Self-Healing

The map stays current through self-healing analyses that propose updates at trigger points. The user always approves; nothing auto-applies.

**Triggers:**

- Entering inception (full reconciliation of map against research/discussion files)
- Concluding a research topic (research findings might have surfaced new map items)
- Concluding a discussion topic (decisions might have spawned siblings or merged items)
- On demand from `continue-epic` ("Refine map")
- Optional: notification at `continue-epic` display time when self-healing detects new content

**Mechanics:**

- The existing `research-analysis` (in `workflow-discussion-entry`) re-points to the map: instead of generating discussion topics directly, it proposes new inception items.
- The existing `discussion-gap-analysis` re-points the same way: gaps surface as proposed inception items, not as direct discussion topics.
- Both retain their cache mechanisms — input checksum, skip if unchanged. The expanded trigger set is cheap when nothing's changed.
- Output goes through the existing two-phase surfacing protocol: announce-then-raise, one finding at a time.

The current `pending_from_research` and `pending_from_gaps` concepts in `continue-epic` discovery collapse into "map items in `fresh` state, not yet started". One concept, one rendering.

## Topic Splitting and Elevation

Both existing mechanisms — research's topic-splitting and discussion's topic-elevation — write to the discovery map rather than directly creating siblings:

- **Research topic-splitting**: when a thread is promoted, creates a new inception item with `source: research-split:{parent-topic}`. The new research file is created against the new topic name as today.
- **Discussion topic-elevation**: when a subtopic outgrows its parent, creates a new inception item with `source: discussion-elevation:{parent-topic}`.

Asymmetry to enforce: research and discussion *spawn* new map items but never modify existing ones. Only inception sessions modify existing items (refine summary, change routing while unrouted). This discipline keeps the map authoritative.

## What Changes In Existing Skills

- `start-epic`'s `route-first-phase.md` collapses to "always inception" for epics. Research / discussion / import options move into inception's flow (import becomes "import existing files and seed the map from them").
- `workflow-research-entry`'s explore-vs-specific mode goes away. Research is always scoped to a map item; topic comes from the inception item.
- Research's `file-strategy.md` simplifies — no multi-file branching for epic. One item, one file.
- `workflow-discussion-entry` Steps 4 and 5 (research-analysis, gap-analysis) re-point to map proposals. The analyses run, but their output is "propose these map items" rather than "show these as suggested discussion topics". The cache mechanisms are preserved.
- `continue-epic`'s state display gains a Discovery Map section at the top. Per-phase entries collapse into per-topic entries with computed lifecycle.
- `continue-epic`'s menu gains "Refine map" as an entry to re-enter inception.
- `workflow-bridge` gains a continuation reference for "research-of-routed-item completed → discussion-entry next".
- The manifest CLI's phase validation table gains `inception` as a valid phase name.

## Migration

Existing in-progress epics need the inception phase added:

- A migration script seeds `phases.inception.items.{topic}` for every existing research and discussion topic in the work unit, using the topic name as the link.
- Routing is inferred: if a research item exists, set `routing: research`; otherwise `routing: discussion`.
- Source is set to `migration-seeded`.
- Summary is left empty (or pulled from the file's frontmatter / first heading if available); the user populates it on first inception re-entry.
- The user is prompted on first inception entry post-migration to review the seeded map.

The migration is non-destructive — existing files stay where they are; the map just registers them.

## Map-Level Convergence Signal

Today, "ready for specification" means "all discussions completed". Under the new model, the signal is richer: all map items either decided (have a completed discussion) or deliberately deferred / cancelled. The map provides a project-wide convergence read that doesn't exist today, where the only signal is per-phase completion counts.

Possible UX: when the map's settled state is reached, `continue-epic` proposes "ready to start specification — confirm or keep refining?".

## Open Questions

1. **Inception lifecycle states for items.** What discrete states should the *inception* item carry beyond `in-progress` and `cancelled`? Probably nothing else — richer lifecycle is computed.

2. **Hierarchical map (children) versus flat.** Lean canvas-style flat is simpler. Discussion's subtopic-with-children is a working precedent we could borrow if flat feels cramped. Start flat, add nesting if needed.

3. **`Refine map` versus implicit re-entry.** Should `continue-epic` only show "Refine map" as an explicit menu entry, or also prompt at display time when self-healing detects new content? Probably both — explicit always, prompt when there's something to surface.

4. **What `inception-guidelines.md` contains exactly.** The bullet rules above need to be expanded with worked examples for each move (decomposition pattern, missing-piece prompt, coarseness check, classify dialogue) so the skill has concrete patterns to copy. Mirrors how `research-guidelines.md` and `discussion-guidelines.md` are structured today.

5. **Map render in `continue-epic`.** Layout, grouping, status display, source-provenance display, cancelled/deferred handling. Worth mocking concretely before implementation to surface data-model questions.

6. **Notification UX.** When self-healing has new proposals visible at `continue-epic` display time, how prominent should the indicator be? A `⚑` callout above the map? Just a tooltip on the menu entry? Needs design.

## Files Affected (Estimated Scope)

This is a large change. Concrete blast radius:

- New: `skills/workflow-inception-entry/` (entry skill, references)
- New: `skills/workflow-inception-process/` (process skill, references including `inception-guidelines.md`)
- New: `workflow-bridge` continuation reference for inception → research/discussion handoffs
- New: migration script to add inception phase to existing epic manifests
- Modified: `start-epic` route-first-phase, name-check, gather-epic-context flow
- Modified: `workflow-research-entry` (drop explore mode for epic), `workflow-research-process/file-strategy.md`, `epic-session.md`, `topic-splitting.md`
- Modified: `workflow-discussion-entry` (research-analysis and gap-analysis re-point to map)
- Modified: `workflow-discussion-process/discussion-session.md` (topic elevation writes to map)
- Modified: `continue-epic` (display map at top, collapse menu, add Refine map)
- Modified: `continue-epic/scripts/discovery.cjs` (compute lifecycle from joined phase items)
- Modified: `workflow-bridge` (epic continuation reference handles new transitions)
- Modified: `workflow-manifest/scripts/manifest.cjs` (add `inception` to phase validation)
- Modified: CLAUDE.md, README phase model documentation

Most existing skills are unaffected (specification, planning, implementation, review unchanged).

## Status

Design phase — not yet implemented. This document captures the converged thinking from a long design conversation. Open questions remain (see above). Implementation should proceed only after those are settled and a worked example walkthrough has been validated against a real session.
