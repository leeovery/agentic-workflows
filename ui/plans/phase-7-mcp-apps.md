# Phase 7 — MCP Apps distribution (optional)

**Goal:** put the gate card where some teammates already live — inside Claude (web and
desktop support MCP Apps / SEP-1865) — without building a second UI. A packaging exercise:
the frozen (end-of-Phase-2) card schema and the Phase 2 round-trip, delivered as `ui://`
resources from a workflow MCP server.

**Duration:** ~1 week. Optional; do only if there are real users who won't open the SPA.

## Deliverables

1. **Workflow MCP server** (`bridge/src/mcp.ts`) — a third client of the bridge (after
   the SPA and the debug console), exposing read tools (state snapshot, needs-you queue,
   open gate by id — stable identity from the gate-card schema) and the answer tool.
   **Authenticated as a named human**: a per-user token minted in the SPA (Phase 6 auth)
   is passed in the MCP server config, and the server acts as that human — owner routing,
   the ledger write, and typed-confirm requirements apply exactly as in the SPA. No
   unauthenticated answer path exists. **Typed-confirm gates additionally require
   UI-origin attestation** (the SEP-1865 user-gesture context): in an MCP host, tool
   arguments are model-produced unless a UI gesture originates the call, so a prompt
   injection anywhere in the host's context could otherwise synthesize the confirmation
   string. Where the host cannot attest origin, typed-confirm gates are read-only in MCP
   with a deep link to the SPA. Open-gate comments render on the card (read-only) so an
   MCP answer is never blind to a teammate's concern.
2. **Gate card app** — an MCP Apps UI resource rendering the card schema: the ask, option
   buttons, free-text input, the typed-confirm variant for never-auto gates.
3. **Needs-you queue app** — the two-tier queue as a compact widget; row tap opens the
   gate card; deep links out to the SPA for anything richer.
4. **Parity tests** — the same fixture gates rendered in SPA and MCP App resolve to
   byte-identical answers into the session, with identical ledger rows — **including the
   negative**: a plain model tool call answering a typed-confirm gate is rejected.

## Explicitly out of scope

- Artifact lenses, telemetry, channels inside MCP Apps. Deep surfaces belong to the SPA.
- Any second implementation of card logic — the app renders `shared/` schemas or it
  doesn't ship.

## Done means

- From Claude desktop with the server connected as human B: the queue shows B's watched
  gates; B answers an owned gate; the session resumes; SPA, terminal, and ledger agree —
  and a gate owned by A refuses B's submit in the app exactly as the SPA would (routing,
  not authority: the refusal is UI-side).

## Risks

- **Host variance.** Hosts differ in UI capability; the card degrades to plain tool
  output (text menu + typed answer) — which is, fittingly, the terminal rendering.
- **Scope creep.** Past gates, this phase is rebuilding the SPA in an iframe. The
  out-of-scope list is the phase's most important content.
