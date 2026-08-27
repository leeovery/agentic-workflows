# Workflow Bridge UI

The web UI for the agentic-workflows process — a read-only-first veneer over a
project's `.workflows/`, git, and the engine's in-process `lib.cjs`. It adds no
new workflow state: everything renders from the engine, gates are never guessed,
and never-auto gates require a typed confirm. Plans and specs live in
[`plans/`](plans/) — start at [`plans/README.md`](plans/README.md) (the intent
baseline); the phase-by-phase review history is in
[`plans/REVIEW.md`](plans/REVIEW.md).

Implemented across phases 0–7: **rails** (event model, spine, watcher, version
handshake) · **mirror** (the read-only SPA) · **gates** (sessions, the needs-you
queue, threads) · **attention** (escalation, digests) · **artifact lenses**
(Read/Structure/History) · **delivery telemetry** · **multiplayer** (auth,
ownership, capture, presence, comments) · **MCP Apps** (the gate card inside
Claude).

## Design artefacts

Self-contained HTML design/presentation pages (open directly in a browser) —
snapshots of the visual language and screen designs the build follows:

- [`artefacts/the-workflow-bridge.html`](artefacts/the-workflow-bridge.html) —
  the overview: what the bridge is and the design intent behind it.
- [`artefacts/workflow-bridge-screens.html`](artefacts/workflow-bridge-screens.html)
  — the screen mockups (lobby, channel, queue, thread, lenses, and the rest).
- [`artefacts/agentic-workflows-field-guide.html`](artefacts/agentic-workflows-field-guide.html)
  — a field guide to the workflow system the bridge surfaces.

## Layout

- `bridge/` — the bridge daemon: turns the project's existing surfaces (engine
  `lib.cjs`, manifests, git, presence, the agent store) into a typed event
  stream, drives headless workflow sessions, serves the SPA, and hosts the MCP
  server (`bridge mcp`).
- `app/` — the SPA (React + Vite): lobby, channels, the needs-you queue, session
  threads, artifact lenses, delivery telemetry, and the multiplayer surfaces
  (identity, gate ownership, the capture gesture, presence, comments).
- `shared/` — the gate-card schema and event vocabulary as zod schemas, frozen
  at the end of Phase 2.
- `fixtures/` — replay fixtures per `plans/specs/fixture-format.md`. Recorded
  through the harness, never hand-edited (the authored `fixtures/adversarial/`
  corpus is the one carve-out).

## Running

Prototype distribution is a repo checkout. Build once so the bridge can serve
the SPA, then run it against a project:

```sh
cd ui && pnpm install && pnpm build     # build the SPA + packages

# Live mode — stream a real project's domain events and serve the app:
pnpm bridge -- --project /path/to/project

# Replay mode — stream a recorded fixture:
pnpm bridge -- --replay fixtures/mid-discussion

# Convert a terminal-driven session into a fixture (spec 4, Phase 0 form):
pnpm --filter @workflow-ui/bridge exec tsx src/cli.ts convert \
  --session ~/.claude/projects/<proj>/<session>.jsonl \
  --out ../fixtures/my-fixture --world-from /path/to/project
```

Open **http://127.0.0.1:4870/** for the app (it follows live over SSE); the
observability console is at `/debug`. During UI development, `pnpm --filter app
dev` runs Vite with HMR against a running bridge.

- **Engine discovery**: `<project>/.claude/skills/workflow-engine/scripts/`
  (dev-repo fallback: `<project>/skills/workflow-engine/scripts/`). Override
  with `--engine <path>`.
- **Width pin**: every engine invocation pins `WORKFLOWS_DISPLAY_WIDTH=65` —
  renders are terminal-width-sensitive; unpinned output encodes whatever width
  was detected.
- **Config file**: `~/.config/workflow-bridge/config.json` (override with
  `--config <path>`), schema in `shared/src/config.ts` — projects, width pin,
  notification settings (quiet hours, escalation, roll-up, stuck/grace), auth
  mode, port, daily budget warning. Argv flags override per run.
- **Bridge state**: UI-native SQLite lives OUT of tree at
  `~/.cache/workflow-bridge/<project>-<hash>/` (override with `--state-dir`).
  The bridge never writes into `.workflows/` — the one exception is a chat
  attachment, materialized into the gitignored `.workflows/.cache/` so the
  session's Read tool can pick it up (transient user-input-in-transit, not
  bridge state).
- **Debug console**: `http://127.0.0.1:4870/debug` — health/banner, event stream
  (live vs durable), structured logs, cost counters. `/health`, `/events` (SSE,
  `?since=<seq>`), `/costs`, `/logs` are named surfaces the SPA is built on.

### Sessions and API keys (Phase 2+)

The bridge drives headless workflow sessions — answering gates, the capture
gesture, resuming an interrupted session — one SDK query per human turn, with a
programmatic permission policy (allowlisted Bash, project-confined file writes,
non-Anthropic secrets redacted). The Anthropic API key resolves from the
environment (`ANTHROPIC_API_KEY`) or the OS keychain — **never the browser,
never this repo** — following the product's own credentials doctrine
(`~/.config/workflows/credentials.json`, mode 0600; keys never transit chat or
argv).

### Auth (Phase 6)

Single-user mode is **zero-config** — every request is the sentinel human
("You"), and the per-install bearer token is the whole trust boundary. Multi-user
mode (`auth.mode: "github"` in the config, with `auth.repo`) authenticates via a
GitHub login and treats **push access to the origin repo as membership**, checked
at login and cached per auth session. Gate ownership, comments, and capture are
**UI-side routing, never process authority** — the engine enforces none of it,
and a terminal answer bypasses the UI entirely (resolving the card as "answered
outside the UI"). The OAuth redirect flow is deployment wiring; the prototype
ships the identity + member-check contract it wraps (see `plans/REVIEW.md`).

### MCP server (Phase 7)

`bridge mcp` exposes the gate card and the needs-you queue to an MCP host (Claude
web/desktop) as a **third client of a running bridge** — no second card
implementation, the frozen `shared/` schema rendered as `ui://` resources:

```sh
WORKFLOW_BRIDGE_TOKEN=<install token from GET /api/token> \
  pnpm --filter @workflow-ui/bridge exec tsx src/cli.ts mcp \
  --bridge-url http://127.0.0.1:4870
```

In github mode also set `WORKFLOW_BRIDGE_COOKIE` (a per-user auth cookie).
Typed-confirm (never-auto) gates require a UI-origin gesture and render read-only
in the MCP widget with a deep link to the SPA — a plain model tool call answering
one is rejected at the bridge.

### Version handshake

The bridge reads the installed product's version from its git tag and declares a
supported range; outside it — or on a repo with pending migrations (diff of
`.workflows/.state/migrations` against the install's migrations directory) — it
degrades to **read-only raw-embed mode with a banner and no events**. The bridge
never runs migrations; that is `workflow-start`'s boot, in a session. Both
detection mechanisms are fragile by design and are replaced when the proposed
read-only currency verb lands (`plans/UPSTREAM.md` #2). Shallow/grafted clones
degrade to live-only mode (no durable spine).

## Tests

```sh
pnpm test        # all packages (vitest)
pnpm typecheck   # tsc --noEmit
pnpm build       # shared + the SPA
```

UI tests are self-contained — they never touch the product's `npm test` gates.
CI runs `.github/workflows/ui.yml` on every commit touching `ui/`.
