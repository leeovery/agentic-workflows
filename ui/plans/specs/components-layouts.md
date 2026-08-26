# Spec 6 — Components and layouts

The screen inventory and component catalog for the SPA. Unlike specs 1–5 this is not a
Phase 0 entry criterion — it is the **design contract** phases 1–6 build against, so the
same component means the same thing in every phase. Wireframes here are structural
(regions and responsibilities), not visual design; visual language is at the end.

## Intent traceability

Every screen region, component, and visual rule in this spec must cite one of the
README's intent commitments; **a design element that cannot is cut before it ships**.
The joins, stated up front:

| Intent commitment | The design decisions that serve it |
|---|---|
| 1 · Collaboration first | The queue-first phone layout (a gate decidable anywhere); comment threads with the confirm-control indicator; owner/stuck chips; the tombstone cards that keep a team's history navigable |
| 2 · Human-scale interaction | The three-surface split (process = cards/queue, system = health badges/banners/telemetry, artifacts = the viewer); **provenance typography** so the reader always knows who is speaking; gate deep-links that dock the card beside the section it concerns |
| 3 · Attention budget | The lobby's NEEDS YOU + TODAY strips as the morning answer; badge counts on the rail; the drain mode that holds one raise at a time; `EscalationChip` and quiet-hours accrual made visible rather than silent |
| 4 · The cone is the layout | Density as a **per-thread** token (`conversation` / `telemetry`); the shaping thread's conversation-dense lobby home; telemetry collapsed by default in delivery threads |
| 5 · Clean, minimal, distraction-free | The spine's three admissible item types; commits exiled to the drawer and digest; the one-reserved-accent rule (gold = gate, nothing else); the no-performance motion rule; resolved cards collapsing to one line |

The non-negotiables bind here too: `EngineEmbed` is never restyled (state renders come
from the engine); every degraded state is a named `BridgeBanner`, never a silent
absence; nothing in any layout answers, pre-selects, or auto-advances a gate.

## The app frame

Three regions, desktop-first (the terminal is the mobile story until Phase 3's push
targets make phones real):

```
┌──────────┬──────────────────────────────────┬───────────────┐
│ project  │                                  │  context      │
│ rail     │        active surface            │  panel        │
│          │  (lobby · channel · artifact     │  (collapsible)│
│ lobby    │   · queue)                       │               │
│ queue ●3 │                                  │               │
│ ──────   │                                  │               │
│ channels │                                  │               │
│  by type │                                  │               │
└──────────┴──────────────────────────────────┴───────────────┘
```

- **Project rail** (fixed): lobby entry, the needs-you queue entry with badge count,
  channels grouped by work type with per-channel badges and a gold dot for open gates.
  Archived channels behind a fold (tombstones render here with their successor link).
- **Active surface**: exactly one of the five screens below. Navigation is
  URL-addressable (`/lobby`, `/queue`, `/c/{wu}`, `/c/{wu}/t/{topic}`,
  `/c/{wu}/a/{artifact-path}`) so gate deep-links and digest links are plain hrefs.
- **Context panel** (collapsible, surface-dependent): the channel's open gates and
  presence; an artifact's outline/sources; empty on lobby/queue (which are their own
  context).
- **Breakpoint**: below 900px the rail becomes a top bar, the context panel becomes a
  sheet, surfaces go single-column. Phone layout is queue-first: the queue is the home
  screen, cards open full-screen.

## Screens

### S1 · Lobby (`/lobby`) — phases 1 (read-only) / 2 (sessions)

```
┌ project name · bridge health · knowledge state ─────────────┐
├ NEEDS YOU  (top queue rows, cross-unit)          → /queue   │
├ TODAY      (digest strip — concatenated channel digests)    │
├ WORK       feature cards · epic cards  (phase, waiting, ●)  │
├ START      shaping thread entry · inbox set (n) · roadmap   │
│            horizons row · baseline card                     │
└─────────────────────────────────────────────────────────────┘
```

Responsibilities: the morning answer ("what happened, what needs me, where's my work");
hosting pre-channel sessions (shaping thread lives here until the type-confirm commit
promotes it — S3 takes over); the knowledge-gate not-ready state; failed-capture retry
rows; the empty state for a repo with no `.workflows/`.

### S2 · Needs-you queue (`/queue`) — phase 2

Full-height list, ordered by spec 5's sort key. Sections render in order — escalated,
live, durable — with no headers when empty. Selecting a row opens its gate card **in an
overlay with channel context behind it** (never a bare modal: the card's story may need
the thread). Row anatomy is one line:

```
[kind-glyph] work-unit · topic     ask preview…        owner  age  [stuck?]
```

### S3 · Channel (`/c/{wu}`) — phases 1–2, threads phase 2, telemetry phase 5

```
┌ #payments-overhaul  [epic]  phase-state (engine)  presence ─┐
├──────────────────────────────┬──────────────────────────────┤
│ SPINE                        │ context panel:               │
│  · gates (gold)              │  open gates here (cards)     │
│  · phase completions         │  build-order mini-map (epic) │
│  · tombstones                │  activity drawer toggle      │
│  — grouped by topic thread   │   (commits · artifacts)      │
│    ▸ thread: retry-policy    │                              │
│    ▸ thread: idempotency ⚑   │                              │
└──────────────────────────────┴──────────────────────────────┘
```

The spine is gates + phase completions + tombstones, nothing else — commits and
artifact updates live in the activity drawer and digests. Epic topics are threads with
**per-thread density** (conversation-dense in Discovery/Definition, telemetry-quiet in
Delivery); feature/bugfix/quick-fix channels have one main thread. The header's phase
state is engine-computed, rendered in mono (see provenance typography).

### S4 · Thread (`/c/{wu}/t/{topic}`) — phase 2, drain mode phase 3, telemetry phase 5

The conversation surface (assistant-ui primitives). Interleaved, in turn order:
prose messages (serif), engine-render embeds (terminal-framed mono blocks, verbatim),
gate cards inline at their turns (resolved cards collapse to one line: glyph + answer +
who). Three modes the same surface adopts:

- **Conversation** (default): full history, input box live when the session is.
- **Drain** (a walk in progress): the current raise's card is pinned; prior raises
  collapse; a progress line ("finding 3 of 5") replaces the spine noise.
- **Telemetry** (delivery threads): the loop surface replaces the message list header —
  current task, attempt count, gate mode, commits — updating in place; the message
  history collapses beneath it. Consolidation gates interrupt as cards.

### S5 · Artifact viewer (`/c/{wu}/a/{path}`) — phase 1 Read, phase 4 full

```
┌ retry-policy · specification   [golden]  [Read|Structure|History] ┐
├───────────┬───────────────────────────────────────┬───────────────┤
│ left rail │  lens content                         │ what-moved    │
│ (by type) │  Read: typeset document               │ ribbon (only  │
│  spec:    │  Structure: the type's register       │ when unread   │
│  sources+ │  History: timeline + diffs            │ changes)      │
│  consults │                                       │               │
│  claims   │                                       │               │
│  disc.:   │                                       │               │
│  map rail │                                       │               │
└───────────┴───────────────────────────────────────┴───────────────┘
```

The left rail is type-specific: spec → sources + consult references (manifest-joined
status chips) + claim chips; discussion → the subtopic map rail with lifecycle chips;
review → verdict + finding buckets; brief → the three panels; research → outline only.
A gate deep-link scrolls to and highlights the concerned section and docks the card
bottom-right — deciding and reading share one screen.

### S6 · Digest — phase 3 (a card, not a route)

One card shape used in three places: pinned in a channel at a natural break, stacked in
the lobby's TODAY strip, and as the morning roll-up push's landing view. Sections:
**landed** (commits + artifacts, linked), **waiting** (queue rows for this scope, stuck
chips included), **next** (the engine's own next-phase line, embedded).

## Component catalog

One contract per component; phase = first built; states listed are the renderable ones.

| Component | Phase | Contract | States |
|---|---|---|---|
| `GateCard` | 2 | Renders spec 1's card: context, ◆ question, options (recommended marked, never pre-selected), free text, typed-confirm variant, comment indicator on the confirm control (6) | open · answering · resolved (collapsed) · resolved-externally · stale · orphaned; health strip when not live |
| `QueueRow` | 2 | One line per spec 5 row; opens card-in-context | live · durable · escalated · stuck |
| `EngineEmbed` | 1 | An engine render verbatim in a terminal frame; width-pinned; monospace; never restyled | static |
| `SpineItem` | 1 | Gate (gold) / phase completion / tombstone (with successor link) | — |
| `TopicThread` | 2 | S4's surface; owns its density mode | conversation · drain · telemetry |
| `PresenceStrip` | 2/6 | Humans viewing (avatars) vs sessions working (mono chips; research/discussion = held/live, elsewhere "inferred") | — |
| `SessionHealthBadge` | 2 | spec 2's states with resume affordance | live · idle-at-ask · stalled · errored · dead |
| `TelemetrySurface` | 5 | Manifest-sourced loop state, updates in place, collapsed by default | running · consult (gold) · consolidating |
| `ConsolidationCard` | 5 | The boundary sweep as one decide screen: bank, verdicts, staged tasks | — |
| `LensTabs` | 4 | Read/Structure/History; Structure absent on degradation, never an error | — |
| `SourcesPanel` | 4 | Manifest-joined rows: sources + consult references | incorporated · pending · stale · addressed |
| `ClaimChip` | 4 | Recorded `cmd` → result; "copy to verify in a terminal"; best-effort verification badge | — |
| `MapRail` | 4 | Discussion subtopics from the manifest; chips pending → decided | — |
| `WhatMovedRibbon` | 4 | Diff since the reader's last ref; "history rewritten — diff base lost" on epoch break | unread · none · lost |
| `VerdictBanner` | 5 | Review pass/fail + counts; findings by bucket beneath | pass · fail |
| `BriefCard` | 4 | Three panels; badged "regenerable — not a record" | — |
| `DigestCard` | 3 | S6's shape | — |
| `EscalationChip` | 3 | Idle-at-ask age; quiet-hours accrual marker | — |
| `OwnerChip` | 6 | Decider; claim/reassign affordance; "stuck — claim?" variant | — |
| `CommentThread` | 6 | On gates and artifacts; quote-into-answer affordance; never auto-injected | — |
| `CaptureRetryRow` | 6 | A failed capture, payload retained, retry/discard | — |
| `TombstoneCard` | 2 | Archived channel pointer: what became of this work | absorbed · promoted · completed · cancelled |
| `BridgeBanner` | 0/2 | The degraded states: version skew · pending migrations · read-only mirror (lease lost) · bridge unreachable (watchdog) | one per cause |

## Visual language

- **Provenance typography** — the load-bearing rule: **mono = engine truth** (state,
  menus, embeds, chips computed from the record), **serif = the conversation** (model
  and human prose), **display sans = the bridge's own chrome** (navigation, buttons,
  labels). A reader can tell *who is speaking* — the deterministic core, the dialogue,
  or the UI — from the letterforms alone, before reading a word.
- **Gold means gate.** The single reserved accent: gate cards, spine gate items, the
  queue's open-ask glyphs, consult moments. Nothing else may be gold. The bridge's own
  accent (steel blue) carries navigation and interaction; semantic status (ok / warning
  / blocked) is a third, muted family that never competes with either.
- **The firmness gradient** as chrome, carried from the field guide: research renders
  casual (paper ground, generous margins), discussion as a working session (panel
  ground, the map rail present), specification formal (ruled borders, tighter measure,
  the most typographic care on the surface). The reader feels the record hardening.
- **Density tokens**: `conversation` (message rhythm, large touch targets on cards) and
  `telemetry` (compact rows, tabular numerals, nothing animated) — set per thread, per
  the mixed-stage rule.
- **Motion**: one rule — state changes settle, they do not perform. Card resolution
  collapses with a single ease; telemetry updates swap with no transition; nothing
  pulses while working (the health badge is a static state, not a spinner theatre).
