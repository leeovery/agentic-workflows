# Phase 1 — The mirror

**Goal:** a read-only SPA that faithfully mirrors a project you are driving from the
terminal. No writes anywhere. This proves the read model (in-process engine adapter +
watcher + AG-UI stream) before any interaction depends on it, and forces the "zero new
workflow state" constraint to be real from the start.

**Duration:** 1–2 weeks.

## Deliverables

1. **Project lobby (read-only)** — the project-level home: work units joined from
   `startDetail` (name, type, phase, status, waiting-on-you count from the **durable
   tier** — manifest flags; the live tier arrives with Phase 2, and the column says so
   rather than showing a fake zero), inbox summary, roadmap horizons (rows only),
   baseline status — including the **knowledge-gate state**: a store that isn't ready
   renders as "memory not initialised — finish setup in a terminal session", in the UI's
   own words, not as a mystery-blocked project. An empty state for a repo with no
   `.workflows/` yet.
2. **Channel view (read-only)** — per work unit: the spine (gates-to-be and phase
   completions; **commits live in the topic threads and an activity drawer, never on the
   spine** — this product commits constantly, and a collapsed ticker is still a ticker),
   topic threads for epics. The spine renders from the Phase 0 pure function of
   (git log, manifest), live increments and historical reconstruction being the same
   function — restart-identity holds by construction.
3. **Artifact Read lens** — typeset markdown (react-markdown + remark-gfm + Shiki +
   mermaid) for every artifact type, with the firmness gradient as chrome. Section
   anchors. No Structure or History lens yet (Phase 4).
4. **Engine-render embeds** — dashboards and status displays embedded as the engine's own
   text (width-pinned via `WORKFLOWS_DISPLAY_WIDTH`) in terminal-styled blocks.
   Deliberately unstyled beyond the frame: the anti-drift mechanism. Terminal-vs-browser
   identity is **modulo width** — a 100-column terminal render wraps differently; the
   embed is canonical at the pinned width.
5. **Theme + shell** — Tailwind + shadcn/ui, light/dark, cmdk palette for navigation only.

## Explicitly out of scope

- Any button that causes a write. The palette navigates; it does not act.
- Notifications (Phase 3). Structure extraction (Phase 4). Live-session anything (Phase 2).

## Done means

- Drive a session in the terminal; watch the browser follow it live — phase completion,
  commit (in the drawer), artifact update — with no refresh, and with every *state* claim
  traceable to an engine value (spot-audit: pick three rows, confirm against `engine
  manifest get`).
- Kill the bridge mid-session; restart; spine and lobby rebuild byte-identically.
- A not-ready knowledge store and a no-`.workflows` repo both render their designed
  states.

## Risks

- **Re-implementing displays by accident.** Engine renders embed verbatim; anything
  re-skinned is built from `lib.cjs` data, and the terminal-styled embed stays available
  as the reference rendering.
- **Event-log-as-status creep.** If users read the spine to learn state, the pinned
  header has failed; treat that as a header bug, not a spine feature.
