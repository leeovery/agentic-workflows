# Phase 0 — Rails

**Goal:** the skeleton every later phase stands on: the five specification artifacts, a
monorepo, a bridge daemon that turns the project's existing surfaces into a typed event
stream, the fixture/recording harness, and the operational floor (packaging, version
handshake, observability). Ship with replay so every later phase develops against recorded
sessions, not a live model.

**Duration:** 2–3 weeks (revised: fixture authoring means actually driving the product
through real sessions, and the watcher's semantic events are manifest-diffing work, not
chokidar wiring).

**Entry criterion:** the [spec pass](README.md#spec-pass-before-code) — the five documents
in `ui/plans/specs/` exist and are agreed. Phase 0 implements them; it does not invent
them.

## Deliverables

1. **Monorepo** — pnpm workspaces: `bridge/`, `app/` (empty shell), `shared/`.
   `shared/` holds the gate-card schema and event vocabulary as zod schemas implementing
   the spec docs — **provisional until the end-of-Phase-2 freeze**, not frozen here: the
   card schema cannot be right before the parser has met real menus.
2. **Engine adapter** (`bridge/src/engine.ts`) — **in-process**: loads the engine's
   `lib.cjs` (via a thin Node child that `require`s it and emits JSON — the bridge is
   Node, the typed read surface already exists as JS objects: `startDetail`,
   `scanPresence`, projections) and reads `manifest.json` files directly. CLI shelling is
   reserved for renders, and **every** engine invocation — CLI or SDK-session — pins
   `WORKFLOWS_DISPLAY_WIDTH` (renders are terminal-width-sensitive; unpinned output
   encodes whatever width was detected). Gateway text (DATA sections, ACTIONS tables) is
   never scraped.
3. **Watcher** (`bridge/src/watch.ts`) — chokidar on `.workflows/**` + git HEAD polling,
   emitting the events `specs/EVENTS.md` defines, via its derivation table
   (manifest-field diffs → `phase.completed`, `flag.input-moved`; commits →
   `commit.landed`; agent store → `agent.dispatched`/`agent.returned`). Debounce on
   quiescence. The **historical spine** is the same pure function of (git log, manifest)
   applied to the past — the watcher emits its increments, so a restart rebuilds an
   identical spine by construction.
4. **Version handshake + migration posture** — the bridge reads the installed product's
   version, declares a supported range, and outside it (or on a repo with pending
   migrations) degrades to read-only raw-embed mode with a banner. **The bridge never
   runs migrations** — that is `workflow-start`'s boot, in a session. Until the proposed
   read-only currency verb lands ([UPSTREAM.md](UPSTREAM.md) #2), version comes from the
   install's git tag and pending-migrations from diffing `.workflows/.state/migrations`
   against the migrations directory — fragile, flagged as such, replaced when the verb
   ships. The **stream epoch** (spec 3) is computed here too: history rewrites, branch
   switches, and shallow clones are detected at boot and degrade visibly.
5. **Packaging, discovery, config** — how a user runs this: distribution (repo checkout +
   `pnpm bridge --project <path>` for the prototype), engine discovery
   (`<project>/.claude/skills/workflow-engine/scripts/`), a config file schema (projects,
   width pin, notification settings), and Anthropic API-key handling for Phase 2's
   sessions (env or keychain — never the browser; the product's own credentials doctrine
   is the model).
6. **Replay + fixture converter** — implements `specs/fixture-format.md`'s Phase 0 form:
   fixture v0 is **converted from a terminal-driven session** (transcript ingest + manual
   world snapshots), since the live recorder needs Phase 2's session manager and parser —
   the circularity the consistency review caught. Replay v0 pauses at recorded user-turn
   boundaries; ask markers arrive with Phase 2's offline re-parse. One stage
   (mid-discussion); the set grows with later phases.
7. **Observability floor** — the debug console is a keeper, not scaffolding: structured
   log stream, `/health`, per-session token/cost counters. Named surfaces later phases
   extend.
8. **SQLite** (better-sqlite3 + drizzle) — schema per the spec docs, pinned now to avoid
   Phase 3/4/6 migrations: `humans` (with a single-user sentinel row Phase 6's auth maps
   onto), `stream_cursors` (per human per channel), `artifact_read_refs`
   (human, artifact, HEAD-at-render — Phase 4's diff base), `sessions` (session-id map —
   explicitly blessed UI-native state; workflow truth stays on disk), `gate_ledger`,
   `comments`, `digests`.

## Explicitly out of scope

- Any UI beyond the debug console. Any session driving (Phase 2). Any write to
  `.workflows/`.
- CI polish — but the skeleton (fixture goldens + extractor/parser test lanes) is set up
  here, because Phases 2–5 hang tests on it.

## Done means

- `bridge --project <path>` streams live domain events from a real repo; killing and
  restarting the bridge replays the identical historical spine (byte-equal event list).
- `bridge --replay fixtures/mid-discussion` streams the converted stage, ending paused at
  its final recorded user-turn boundary (ask-marker pauses arrive with Phase 2).
- A repo with pending migrations or an unsupported product version produces the read-only
  banner state, not events.
- `shared/` schemas validate every event both modes emit; `/health` and cost counters
  respond.

## Risks

- **AG-UI fit.** Decision criterion, owned here: if the mirror (Phase 1) would need a
  synthetic "run" per work unit to carry repo-scoped state, we drop to
  CUSTOM-events-over-AG-UI-transport and keep run semantics for live sessions only.
- **Watcher noise.** Engine commits land mid-transaction bursts; debounce plus
  manifest-diff (not file-event) semantics is the defence.
- **Fixture staleness.** Recorded fixtures encode a product version; re-recording after
  upstream changes is the harness's job — a fixture is regenerable, never hand-edited
  (the product's own snapshot rule, borrowed).
