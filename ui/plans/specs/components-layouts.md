# Spec 6 — Components and layouts

The screen inventory and component catalog for the SPA — the **design contract** phases
1–6 build against. Revised after its own adversarial review (REVIEW.md round 5): the
traceability is now per-element, the batch screen has a surface, the duplication rules
are explicit, and the keyboard model exists.

## Intent traceability

Every screen region, component, and visual rule cites an intent commitment (README
1–5) or a non-negotiable (N1–5); **an element that cannot is cut before it ships**. The
catalog carries the citation per component; screens and visual rules cite inline. The
firmness gradient cites the README's value surface 4 (artifact lenses), noted as such.

Representative joins: the queue-first phone layout and comment ceremony (1); the
three-surface split and provenance typography (2); the NEEDS YOU strip, drain mode, and
badge discipline (3); per-thread density (4); the spine's admissible item types, the
one-interactive-card rule, and the motion rule (5).

## Duplication and badge discipline (commitment 5, made mechanical)

Three rules the review forced into writing:

- **One interactive card at a time.** An open gate is *interactive* only on the surface
  you are on; every other appearance — rail dot, lobby strip, queue row, spine item,
  channel panel — is a one-line reference that navigates. The channel context panel
  lists gate **rows**, never cards.
- **Badges are derived, never counted separately.** A channel badge = that channel's
  queue-row count (same derivation as /queue, no second counter); the gold dot = at
  least one live-tier gate; the rail's queue badge = total rows. Nothing else may
  badge, anywhere.
- **A digest rendered in the lobby suppresses its "waiting" section** (collapsed to a
  count linking to /queue) — NEEDS YOU already shows those rows one strip up.

## The app frame

```
┌──────────┬──────────────────────────────────┬───────────────┐
│ project  │        active surface            │  context      │
│ rail     │  (lobby · queue · channel        │  panel        │
│          │   · thread · artifact)           │  (collapsible)│
└──────────┴──────────────────────────────────┴───────────────┘
```

- **Project rail** (2): lobby, queue (badge), channels by type (badge + gold dot per the
  discipline above), archived channels behind a fold — `ArchiveCard`s and
  `TombstoneCard`s render there.
- **Context panel**: on a channel — gate rows + presence + drawer toggle; **on an
  artifact route the S5 left rail replaces it** (auto-collapsed) — the same data never
  holds two panels. Empty on lobby/queue.
- **Breakpoint** (<900px), owned by phases 2–3: rail → top bar; the queue is the phone's
  home; a card opens as a **sheet over its thread** — swipe down reveals the
  conversation it interrupted (never a bare modal; S2's context rule holds on phones).
  Drain mode on mobile: the pinned raise is the sheet, the progress line is its header,
  swipe-down peeks the session, advancing raises replace the sheet content in place.

## Keyboard model (2, N-never-preselect)

The product is keyboard-native and the SPA honors it: a focused `GateCard` accepts the
**typed option key** (`2`, `y`, `a`) as an answer; typed-confirm gates are unaffected
(the confirmation string is typed into the input, as designed). Initial focus is always
the **free-text input**, never an option — focus on the recommended row would be
pre-selection by focus ring. Tab order: input → options in rendered order → card
actions. On resolution the card collapses and focus moves to the next raise (in a
drain) or the next queue row (in the queue); focus is never dropped mid-walk.

## Screens

### S1 · Lobby (`/lobby`)

```
┌ project name · bridge health · knowledge state ── (P1) ─────┐
├ NEEDS YOU  (top queue rows, cross-unit)   → /queue    (P2)  │
├ TODAY      (digest strip, waiting-suppressed)         (P3)  │
├ WORK       feature cards · epic cards                 (P1)  │
├ START      shaping thread · inbox (n) · roadmap ·           │
│            baseline · failed-capture retries      (P2/P6)   │
└─────────────────────────────────────────────────────────────┘
```

The morning answer (3). Hosts pre-channel sessions; the knowledge-gate not-ready state;
the empty state. Regions carry their build phase, as annotated.

### S2 · Needs-you queue (`/queue`) — P2

Full-height list in spec 5's order. Two row anatomies (the review's fix — durable rows
carry a flag, not an ask):

```
live:     [kind] work-unit · topic   ask preview…        owner  age
durable:  [flag] work-unit · topic   flag name · artifact  —    age  [stuck?]
```

Selecting a **card-bearing** row opens the card in an overlay with channel context
behind it. Selecting a **pass-through** row opens the thread tail with a reply box —
no card is fabricated (N3). Durable rows navigate to the surface that resolves them
(the flagged phase's entry, the report's drain, the artifact).

### S3 · Channel (`/c/{wu}`) — P1/P2, telemetry P5

```
┌ #payments-overhaul [epic]  phase-state (mono)  presence ────┐
├──────────────────────────────┬──────────────────────────────┤
│ SPINE (four item types):     │ context panel:               │
│  ◆ gate refs · phase         │  gate rows (not cards)       │
│  completions · unit status   │  build-order mini-map (epic) │
│  changes · tombstones        │  activity drawer ▸           │
│ THREADS: one-line previews,  │   (commits · artifacts)      │
│  density-neutral, → S4       │                              │
└──────────────────────────────┴──────────────────────────────┘
```

**Threads never expand inline.** S3 shows a density-neutral one-line preview per topic
(name, phase, last event, ⚑ cues); density lives on S4 — so the conversation/telemetry
seam never occurs in one scroll. The spine's admissible set now matches spec 3 exactly:
gates, `phase.completed`, `workunit.status-changed`, tombstones — a unit's completion
or cancellation is a lifecycle fact, not machinery (5).

### S4 · Thread (`/c/{wu}/t/{topic}`) — P2, drain P3, telemetry P5

The conversation surface; owns the density token (4). Three modes: **conversation**
(serif messages, mono engine embeds, cards inline; resolved cards collapse to one
line), **drain** (current raise pinned, priors collapsed, "finding 3 of 5" progress
line), **telemetry** (the loop surface replaces the header; history collapses beneath;
consolidation gates interrupt as cards).

### S5 · Artifact viewer (`/c/{wu}/a/{path}`) — P1 Read, P4 full

```
┌ retry-policy · specification [golden]  Read|Structure|History ┐
├───────────┬──────────────────────────────────────────────────┤
│ rail      │  lens content — minimum measure 60ch:            │
│ (replaces │  the Read lens is never squeezed below it;       │
│  context  │  the rail collapses first                        │
│  panel)   │           [what-moved chip ▸]   ← overlay, not   │
│           │           [◆ docked card]          a column      │
└───────────┴──────────────────────────────────────────────────┘
```

Rail by type: spec → sources + consult references + claim chips; discussion → map
rail; review → verdict + buckets; brief → three panels; research → outline. The
what-moved indicator is an **overlay chip** that expands to the diff — not a fourth
column. A gate deep-link scrolls, highlights, and docks the card; the docked card and
the expanded what-moved panel are mutually exclusive (one floating layer at a time).

### S6 · Digest — P3 (a card, not a route)

Sections: landed / waiting / next. In-channel and push-landing renders carry all
three; lobby renders suppress waiting per the duplication discipline.

## Component catalog

| Component | Phase | Intent | Contract | States |
|---|---|---|---|---|
| `GateCard` | 2 | 3, N3, N4 | Spec 1's card: context, ◆ question, options (recommended marked, never pre-selected), free text, typed-confirm variant, comment indicator on confirm control (P6) | open · answering · resolved · resolved-externally · stale · orphaned |
| `BatchScreenCard` | 2 | 3 | The lanes' batch shapes: the `DISPLAY: finding batch` section rendered above its approval menu — ≤5 numbered findings, approve/veto per screen; a stop, never auto-advanced | open · answering · resolved |
| `PassThroughAsk` | 2 | N3 | The thread tail + reply box, as a surface: what a pass-through queue row opens | — |
| `QueueRow` | 2 | 3 | Two anatomies (live ask / durable flag); opens card, drain, or resolving surface | live · durable · escalated · stuck |
| `EngineEmbed` | 1 | N2 | Engine render verbatim, terminal-framed, width-pinned, never restyled | — |
| `SpineItem` | 1 | 5 | Four variants: gate ref (gold) · phase completion · unit status change · tombstone ref | — |
| `TopicThread` | 2 | 4 | S4's surface; owns the density token | conversation · drain · telemetry |
| `PresenceStrip` | 2/6 | 1 | Humans viewing vs sessions working (held/live for research/discussion; "inferred" elsewhere) | — |
| `SessionHealthBadge` | 2 | 2 | Spec 2's states + resume affordance | live · idle-at-ask · stalled · errored · dead |
| `TelemetrySurface` | 5 | 4, 5 | Manifest-sourced loop state; in-place updates; collapsed by default | running · consult (gold) · consolidating |
| `ConsolidationCard` | 5 | 3 | The boundary sweep as one decide screen | — |
| `LensTabs` | 4 | 2 | Read/Structure/History; Structure absent on degradation, never an error | — |
| `SourcesPanel` | 4 | 2 | Manifest-joined sources + consult references | incorporated · pending · stale · addressed |
| `ClaimChip` | 4 | 2, N5 | Recorded `cmd` → result; "copy to verify in a terminal". The verification badge derives **only from the work unit's review-report artifact** (the product's own claims pass) — never bridge-side execution | — |
| `MapRail` | 4 | 2 | Discussion subtopics from the manifest | pending → decided chips |
| `WhatMovedRibbon` | 4 | 2 | Overlay chip → diff since last read; epoch break renders "history rewritten — diff base lost" | unread · none · lost |
| `VerdictBanner` | 5 | 2 | Review verdict + finding buckets | pass · fail |
| `BriefCard` | 4 | 2 | Three panels; badged "regenerable — not a record" | — |
| `DigestCard` | 3 | 3, 5 | S6; lobby renders waiting-suppressed | — |
| `EscalationChip` | 3 | 3 | Idle-at-ask age; quiet-hours accrual marker | — |
| `OwnerChip` | 6 | 1 | Decider; claim/reassign; "stuck — claim?" variant | — |
| `CommentThread` | 6 | 1 | On gates and artifacts; quote-into-answer; never auto-injected | — |
| `CaptureRetryRow` | 6 | 1, 3 | Failed capture, payload retained, retry/discard | — |
| `TombstoneCard` | 2 | 1 | A successor pointer only: absorbed → epic topic thread; promoted → new channel | absorbed · promoted |
| `ArchiveCard` | 2 | 1 | A terminal status (completed/cancelled), no successor; opens the archived view | completed · cancelled |
| `BridgeBanner` | 0/2 | N5 | Degraded states — a **closed list, extended whenever any spec adds a degradation**: version skew · pending migrations · read-only mirror (lease) · bridge unreachable (watchdog) · live-only (shallow/partial clone) | one per cause |

**The archived view**: opening an archived channel renders read-only S3 under a status
banner — spine and threads browsable, no input surfaces, the drawer intact.

## Visual language

- **Provenance typography** (2): **mono = engine truth**, **serif = the conversation**,
  **display sans = the bridge's chrome**. The reader knows who is speaking from the
  letterforms alone.
- **Gold means gate** (3, 5): the single reserved accent — cards, spine gate items,
  queue glyphs, the consult state. The bridge's steel blue carries navigation (its
  citation: 2 — interaction must read as the UI's, not the process's); semantic status
  (ok/warning/blocked) is a third, muted family (2) that competes with neither.
- **The firmness gradient** (README value surface 4): research casual, discussion a
  working session, specification formal — the reader feels the record hardening.
- **Density tokens** (4): `conversation` and `telemetry`, set per thread.
- **Motion** (5): state changes settle, they never perform — single-ease collapses,
  transitionless telemetry swaps, no pulsing; the health badge is a state, not a
  spinner theatre.
