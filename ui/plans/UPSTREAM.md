# Upstream proposals

Changes to the agentic-workflows product that would simplify the UI — reviewed for fit
against the product's own doctrine (see REVIEW.md round 4) and reshaped accordingly. The
plans never assume any of them. Ordered by proposal priority.

## Propose now

1. **Broader presence.** `docs/reliability.md` states the heartbeat guarantee
   universally; `domain/presence.cjs` implements it for research + discussion only, so a
   spec/planning/implementation session is invisible to the epic view's strike-through
   and entry gates — a product coexistence gap independent of any UI. Shape: extend
   `PHASES`, add `presence beat`/`clear` to the four remaining process skills' loops
   (the wiring points already exist — every process skill calls `session label` at Step
   0 and carries the SessionEnd hook), extend the epic-view join, simulation + prose-test
   coverage per CLAUDE.md. Cache-only; no migration.
2. **A read-only currency verb** — `engine version` (or `migrate --pending`) returning
   `{version, migrations_current, pending_ids}`, never running anything. Phase 0's
   version handshake currently has nothing to call: no version verb exists, releases
   live in git tags, and pending-migration detection would mean re-implementing the
   orchestrator's ID scan. Tiny, safe, useful as a product diagnostic. *The strongest
   un-made proposal from the review.*
3. **Never-auto enumeration export.** The stays-gated-over-auto set is already
   engine-encoded (the incoherence-gate variants, the resurface gate, choice-move
   finding gates — rendered with `AUTO_OVERRIDE_LINE`) but not exported. Shape: a
   `STAYS_GATED_SURFACES` list surfaced through `lib.cjs` with a test asserting it
   matches every surface that can render the override line — *not* output markup (which
   would churn every prose-test golden). Hardens a product invariant standalone;
   replaces the UI-maintained list in spec 1.

## Propose later, with prototype evidence

4. **Per-finding lane recording at `agent ack`.** `agent ack` already records finding
   ids; letting it accept the report's declared lanes (`--lanes apply:F1;walk:F3`) makes
   the declared classification durable engine state without touching report content
   files. Propose alongside Phase 3, when the cache-markdown mini-extractor's fragility
   is demonstrable.
5. **A render journal (the reshaped "gate outbox").** The open/close-verb outbox is
   unverifiable (the engine never observes answers; prose menus never journal) and was
   reviewed as against the grain. The acceptable shape is presence's pattern applied to
   renders: the render CLI journals `{surface, dotpath, ts, pid, pid_start, session_id}`
   to cache automatically; "answered" is derived (the session's next engine call
   supersedes); advisory, never authoritative. Gives terminal users a "session waiting
   at {gate}" overview row. Propose after Phase 2 shows the terminal-session blind spot
   in practice.
6. **A prose-menu inventory test + targeted conversions.** ~43 reference files still
   carry prose-authored menus (the parser's fallback surface). A sweep is against
   CONVENTIONS ("file by file, never in one sweep"), but a checked-in enumeration test
   lets both sides watch the surface shrink, and per-file conversion of the few
   high-traffic gate files the UI actually meets is within convention.

## Withdrawn

- ~~**UI park origin token.**~~ Unnecessary: the validator already accepts any
  whitespace-free `park:{origin}`, the suffix's meaning is pinned to the containing work
  unit (a session-side park uses `park:{work_unit}` today), and the product's own
  doctrine answers the gesture case — an unconfirmable capture is an inbox item,
  promoted later as `inbox:{slug}`, which is exactly Phase 6's implemented fallback.
- ~~**`engine tasks` read verb.**~~ Against the grain: `domain/tasks.cjs` is chartered
  format-blind, format names are deliberately confined, and Linear's backend is
  session-MCP-only — unreachable from the engine regardless. Phase 5's fixture-pinned
  TS readers are the honest cost. Revisit only as per-format reader *scripts inside the
  format directories* if a terminal-side use case emerges.
