# Workflow UI — intent and plan index

A web UI for the agentic-workflows process, built around channels. This document is the
**intent baseline**: every phase plan is reviewed against it, and a feature that cannot be
traced to one of these commitments should not be built.

> Revised after a five-dimension adversarial review (intent fidelity, technical ground
> truth, scope/sequencing, coverage, sufficiency). Findings and dispositions:
> [REVIEW.md](REVIEW.md).

## Intent

1. **Collaboration first.** The UI exists so humans can take part in the process — follow it,
   decide at its gates, read its artifacts, and eventually do so as a team — from wherever
   they are, not only the terminal that hosts the session.
2. **Human-scale interaction.** The human interacts with three things: the *process* (gates,
   phases, routing), the *system* (sessions, state, telemetry), and the *artifacts*
   (documents, plans, reports). Each gets a surface shaped for reading and deciding, not for
   watching machinery.
3. **Spend the attention budget wisely.** Every stop in the process is a gate and appears in
   the UI immediately; what the UI *derives* is ping ceremony, not disposition. Where the
   product classifies findings by the move owed (the lanes: apply / decide / route / walk),
   that classification drives interruption: walk-class engagement interrupts, batch screens
   badge and roll into digests, and nothing is ever answered by the UI on the human's
   behalf — batch screens are session-blocking stops in the product and stay stops here.
   For the many gates that carry no lane (bootstrap questions, task gates, sign-offs,
   conflict menus), a **designed gate-type → attention table** (phase 3) assigns ceremony,
   informed by the cone. Severity never drives interruption; the kind of act owed does.
4. **The cone of collaboration is the layout.** Early phases are conversation-heavy and the
   UI is conversation-dense; late phases run themselves and the UI goes telemetry-quiet.
   One screen density does not fit all phases.
5. **Clean, minimal, distraction-free.** No activity theater (no token streaming as
   spectacle), no per-event message firehose, no duplicated status. The channel spine
   carries gates and phase completions only; commits and machinery live in the topic
   threads and the digest, never on the spine.

## Non-negotiable constraints

- **Zero new workflow state.** `.workflows/` + git + the engine are the record. The UI is a
  veneer; anything it persists is UI-native only (cursors, read receipts, session-id maps,
  gate ownership, comments, digests). If the UI and the terminal ever disagree, the UI is
  wrong.
- **State renders come from the engine.** Displays are computed by the engine; the UI embeds
  engine projections (width-pinned — renders are terminal-width-sensitive) or rebuilds them
  from the engine's in-process data surface (`lib.cjs`), never from its own re-derivation.
- **Gates are never guessed.** A turn the bridge cannot confidently parse as a structured
  ask renders as the raw conversation tail with a reply box — pass-through chat, not a
  fabricated card.
- **Never-auto gates get typed confirmation.** The product's never-auto set
  (approved-content edits, spec deviations) is recognised by an enumerated list of engine
  surfaces maintained in the gate-card schema — single-sourced there, nowhere else — and an
  unrecognised gate that *resembles* the set defaults to typed confirm, never to one tap.
- **The product is not forked.** The prototype rides existing surfaces: engine CLI and
  `lib.cjs`, the Claude Agent SDK, files, git, presence heartbeats (research/discussion
  only — see phase 2). The bridge **never runs migrations**; on version skew or a
  pre-migration repo it degrades to read-only with a banner. Upstream proposals (an
  `engine gate` outbox, broader presence, a UI park origin token) are tracked in
  [UPSTREAM.md](UPSTREAM.md) and never assumed.

## Where we add value (and only here)

1. The **gate card** contract — structured decision cards parsed from the process's menus
   (authoritative source: the demarcated sections in the tool-result stream of
   bridge-driven sessions; the uniform option grammar elsewhere).
2. The **needs-you queue** — two tiers joined into one list: durable waiting-on-you state
   from the manifest (reconcile flags, blocked specs, triage queues, stale sources — all
   sessions, terminal included) and live open asks (bridge-driven sessions).
3. The **attention policy** — lane classification where it exists, the designed gate-type
   table where it doesn't; both mechanical, neither invented per notification.
4. The **artifact lenses** — Read / Structure / History views per artifact type, structure
   sourced from the manifest where the manifest owns it (discussion map, spec sources) and
   from template headings only where they are genuinely stable (investigation, review,
   brief); the firmness gradient as visual language.

Everything else — SPA shell, chat rendering, markdown, diffs, graphs, auth, push — is
off-the-shelf: AG-UI as the wire protocol, assistant-ui for thread surfaces, shadcn/Tailwind
for components, React Flow for graphs, the Claude Agent SDK for sessions.

## Channel model

**Channel = work unit**, born at discovery's shaping commit, archived at close. Epic topics
are threads. The channel spine is gates and phase completions; machinery lives in threads
and an activity drawer.

**Mixed-stage density.** The cone-as-layout is a **per-topic-thread** property, not a
channel one — an epic is routinely in Discovery and Delivery simultaneously (build-order
staggering guarantees it). The channel frame is stage-neutral; each topic thread carries
its own density; telemetry collapse applies per delivery thread; the drawer groups by
topic.

**The project lobby.** A whole tier of the product lives outside any work unit and gets a
project-level home: the start overview, the inbox working set, the product roadmap
(horizons, items, sessions, the pull), the baseline assessment, and — critically — the
**pre-durability discovery conversation**. Shaping happens as a lobby thread; at the
type-confirm commit the thread is promoted into the newborn channel (the two pre-commit
exceptions — an inbox note or roadmap park confirmed mid-shaping — land in the lobby's own
record). An abandoned shaping thread simply ends, mirroring the product's zero-residue rule.

**Channel identity across reshaping.** The lifecycle operations must leave the abstraction
defined: **pivot** re-types the channel in place (same channel, new type badge, history
kept); **absorb** archives the feature's channel with a tombstone pointing at the epic
topic thread that continues it (git history remains the record, the tombstone is the
pointer); **quick-fix promotion** ends the quick-fix channel with a tombstone into the new
feature/bugfix channel; **spec promotion** births a new cross-cutting channel linked from
the originating topic thread. Tombstones are UI-native metadata, never workflow state.

## Spec pass before code

Five specification artifacts are written and agreed **before Phase 0 code** (the
sufficiency review found Phases 0 and 2 unbuildable without them). All five now exist:
[gate-card schema](specs/gate-card-schema.md) ·
[session lifecycle](specs/session-lifecycle.md) · [events](specs/EVENTS.md) ·
[fixture format](specs/fixture-format.md) ·
[needs-you ordering + attention policy](specs/needs-you-ordering.md).

1. **Gate-card schema + lifecycle** — fields, stable gate identity, state machine
   (open → answered → resolved / resolved-externally / stale), the kind taxonomy
   (structured / pass-through / batch screen / STOP), and the enumerated never-auto surface
   list.
2. **Session lifecycle** — exact SDK invocation for launch / adopt / resume (calls, entry
   prompt, permission mode and tool allowlist, cwd, env — including `CLAUDE_PID` /
   session-id so presence and width pinning work headless), ask-detection precedence, the
   answer-while-session-dead rule (resume-then-inject with a visible state), and session
   health states (live / stalled / errored).
3. **`EVENTS.md`** — every domain event with payload schema (work unit / topic / phase
   addressing), the manifest-diff → event derivation table, the agent lifecycle events
   (`agent.dispatched` / `agent.returned`), and the historical spine as a **pure function of
   (git log, manifest)** whose live increments the watcher emits.
4. **Replay fixture format** — snapshot layout, transcript record format with turn
   boundaries and ask markers (so Phase 2 can adopt a replayed session), pacing, and the
   recording harness that produces fixtures.
5. **Needs-you ordering + attention policy** — the queue's sort-key tuple with
   cross-work-unit comparability and tie-breaks (build order is per-epic and incomparable
   across units), the lane-name → policy-class table (fixed `apply`/`decide`/`route`;
   anything else or unlabelled → walk, the product's own safe direction), and the
   gate-type → ceremony table for laneless gates.

## Phases

| Phase | Name | Focus | Estimate |
|---|---|---|---|
| 0 | [Rails](phase-0-rails.md) | Specs, monorepo, bridge, events, fixtures, version handshake, observability floor | 2–3 wks |
| 1 | [The mirror](phase-1-mirror.md) | Read-only SPA: lobby + channels, artifacts (Read lens), engine embeds | 1–2 wks |
| 2 | [Gates](phase-2-gates.md) | Gate cards round-tripping; needs-you queue (two tiers); local trust boundary | 4–5 wks |
| 3 | [The attention system](phase-3-attention.md) | Ping ceremony from lanes + the gate-type table; digests | 1–2 wks |
| 4 | [Artifact lenses](phase-4-artifact-lenses.md) | Structure/History lenses, discussion map, spec panel (incl. consult references), roadmap surface | 2–3 wks |
| 5 | [Delivery telemetry](phase-5-delivery.md) | Manifest-sourced loop telemetry, plan DAG, review board | 1–2 wks |
| 6 | [Multiplayer](phase-6-multiplayer.md) | Auth, gate ownership (UI-side routing), capture gesture, presence | ~2 wks |
| 7 | [MCP Apps](phase-7-mcp-apps.md) | Gate cards distributed into Claude via MCP Apps (optional; authenticated) | ~1 wk |

Sequencing logic: the spec pass then 0→2 is the shortest path to the thesis (a gate
round-tripping without the terminal); 3 precedes 4 because attention policy matters more
than deep reading surfaces; 7 is last because it reuses rather than invents.

**Decision checkpoints:** end of Phase 2 — the `shared/` vocabulary and card schema
**freeze here**, after surviving contact with real menus (not in Phase 0), and the
assistant-ui vs CopilotKit call is made; end of Phase 4 — the live discussion-map decision,
judged on dogfooding evidence: if anyone drove a discussion from the browser and wanted the
rail live, build it; otherwise close it.
