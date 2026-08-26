# Phase 2 — Gates

**Goal:** the thesis of the whole UI: a workflow gate rendered as a structured decision
card in the browser, answered there, and fed back into a live session — so a human can take
part in the process without the terminal. Includes the project lobby (pre-channel
sessions), the two-tier needs-you queue, the local trust boundary, and the chat surfaces
for the conversational phases.

**Duration:** 4–5 weeks (revised: headless session lifecycle with crash-resume parity,
gate reconstruction, and the security boundary are real work the first estimate hid).

**Entry criterion:** `specs/session-lifecycle.md` and `specs/gate-card-schema.md` agreed
(the sufficiency review found this phase unbuildable without them). Screens and
components per `specs/components-layouts.md`: S2 (queue), S4 (thread), the lobby's
session hosting, and the `GateCard`, `QueueRow`, `TopicThread`, `PresenceStrip`,
`SessionHealthBadge`, and `TombstoneCard` components.

## Deliverables

1. **Session manager** (`bridge/src/sessions.ts`) — drives workflow sessions headless via
   the Claude Agent SDK per `specs/session-lifecycle.md`: exact invocation for launch /
   adopt-from-replay / resume, entry prompt, **permission mode and tool allowlist**
   (scoped to what workflow skills actually call — never blanket bypass), cwd, and env:
   `WORKFLOWS_DISPLAY_WIDTH` pinned, and the presence identity variables verified by a
   **first-week spike** — launch an SDK session, assert the presence record carries
   pid/session-id and SessionEnd hooks fire; where they don't, the bridge sets the env
   itself and runs `presence cleanup` on teardown. Session ids persist in the Phase 0
   `sessions` table (blessed UI-native state); on restart each mapped session is resumed
   and its pending ask re-derived from the transcript tail — **gates are a projection of
   session state, never a table**.
2. **Gate detection & parsing** (`shared/gate-parser`) — two sources, in precedence:
   - **The tool-result channel (authoritative, bridge sessions only).** Engine and
     gateway calls run as Bash tools; their results carry the full demarcated
     `=== MENU … ===` sections byte-exact *before* the model relays them. The parser
     takes the section as ground truth and diffs the model's relay against it — which
     retires most of the relay-fidelity risk without any checksum-against-re-render
     machinery (dropped: it required a surface→command reverse index nobody can build).
   - **The option grammar (fallback).** ~43 reference files still carry prose-authored
     menus (the corpus converges file-by-file, per CONVENTIONS); these and
     terminal-relayed menus parse by the uniform option-row grammar shared by both
     worlds. Strict shape rules; any deviation → fallback chat.
   Ask-detection precedence (from the spec): parsed MENU → structured card; turn-final
   text in a live session → pass-through open ask (a queue member rendered as chat);
   clean session end → nothing.
3. **The gate card** — the product-terms ask on top, option rows as buttons (recommended
   row marked, never pre-selected), free text always available. Answer → ordinary user
   turn (the key string or prose — no second answer path). **Never-auto recognition** is
   by the schema's enumerated surface list; an unrecognised gate resembling that set
   defaults to typed confirm. Answering a card whose session has died triggers
   resume-then-inject with a visible "resuming…" state; failure surfaces as fallback
   chat. Cards and queue rows carry **session health** (live / stalled / errored, with a
   resume affordance) — an API outage must never leave a card silently lying.
4. **The project lobby** — hosts what exists before any channel: the start overview, the
   inbox working set (pickup/promotion rides its engine-rendered cards), and the
   **pre-durability shaping thread**, promoted into the newborn channel at the
   type-confirm commit (README channel model). Roadmap and baseline sessions are hosted
   here too; their dedicated surfaces come in Phase 4.
5. **Thread surface** — assistant-ui primitives for the conversational phases, wired to
   the AG-UI stream. We do not build message rendering.
6. **Needs-you queue, two tiers** — one list joining:
   - **Durable tier (all sessions, terminal included):** waiting-on-you state derived
     from the manifest — `reconcile_needed` flags, blocked specs, stale source rows,
     triage queues, the out-of-scope bank.
   - **Live tier (bridge sessions only):** open asks from session projections.
   Ordering per `specs/needs-you-ordering.md` (sort-key tuple; build order is per-epic
   and incomparable across units, so cross-unit ordering uses phase stage + flag age;
   tie-break oldest-ask-first). The tier split is honest UI: a terminal session's open
   ask is *not knowable* without the upstream outbox ([UPSTREAM.md](UPSTREAM.md) #1).
7. **Local trust boundary** — the attack surface opens the moment browser input becomes
   session turns: bind 127.0.0.1, per-install bearer token, origin allowlist, WS
   handshake validation. Phase 6 swaps token → OAuth; the boundary exists from day one.
8. **The bridge lease + answer serialization** (specs 1–2): the per-project single-
   instance lease (second bridge → read-only mirror with a banner), the per-session
   mutex on gate transitions (two tabs resolve visibly, never as a double injection),
   and the session journal that makes gates re-derivable after restart.
9. **The surface sweep** — enumerate the engine's rendered gate surfaces against the
   schema's surface→type mapping, the never-auto match keys, and the batch-screen pair;
   generate the tool allowlist from the skills' frontmatter. Both lists are Phase 2
   exit artifacts the attention phase builds on.

## Explicitly out of scope

- Notifications (Phase 3). The queue is pull; nothing pings yet.
- Multi-user anything (Phase 6). One human, all gates theirs.
- Presence beyond research/discussion — heartbeats exist only there
  (`domain/presence.cjs`); other-phase coexistence is best-effort activity signals
  (manifest lock mtimes, cache writes, commits), labelled as such.

## Done means

- A quick-fix runs end-to-end from the browser: captured by chatting the capture skill in
  the lobby thread, promoted from the inbox working set, shaped, scoped, implemented,
  reviewed — including at least one structured card, one typed-confirm card, and one
  free-text exchange.
- Kill the bridge with two gates open; restart; the queue shows the same two gates
  (re-derived from resumed sessions, not from a table).
- A deliberately malformed menu fixture renders as fallback chat; the parser test corpus
  (truncated menus, reordered rows, paraphrased labels, two menus in one turn) passes.
- A terminal discussion session and a bridge session on different topics of one epic
  coexist: the discussion's presence strike-through shows in the mirror; the
  spike's presence assertions hold for the bridge session.

## Risks

- **SDK behaviour is the open question** — permission prompts, env propagation, SessionEnd
  hooks. The week-one spike exists to convert unknowns into either configuration or
  bridge-side compensation before anything is built on them.
- **Prose-menu drift.** The fallback grammar tracks CONVENTIONS' option-row format; a
  format change upstream lands as a parser-fixture failure, not a silent misparse.
- **Cost.** Every gate answer resumes a model session; the Phase 0 cost counters surface
  per-session spend from the first day of this phase.
