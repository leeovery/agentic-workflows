# Workflow Bridge UI

The web UI for the agentic-workflows process. Plans and specs live in
[`plans/`](plans/) — start at [`plans/README.md`](plans/README.md) (the intent
baseline). This monorepo implements them phase by phase.

## Layout

- `bridge/` — the bridge daemon: turns the project's existing surfaces (engine
  `lib.cjs`, manifests, git, presence, the agent store) into a typed event
  stream. Phase 0.
- `app/` — the SPA. Empty shell until Phase 1 (the mirror).
- `shared/` — the gate-card schema and event vocabulary as zod schemas.
  **Provisional until the end-of-Phase-2 freeze.**
- `fixtures/` — replay fixtures per `plans/specs/fixture-format.md`. Recorded
  through the harness, never hand-edited (the authored `fixtures/adversarial/`
  corpus is the one carve-out).

## Running (phase-0 §5: packaging, discovery, config)

Prototype distribution is a repo checkout:

```sh
cd ui && pnpm install

# Live mode — stream a real project's domain events:
pnpm bridge -- --project /path/to/project

# Replay mode — stream a recorded fixture:
pnpm bridge -- --replay fixtures/mid-discussion

# Convert a terminal-driven session into a fixture (spec 4, Phase 0 form):
pnpm --filter @workflow-ui/bridge exec tsx src/cli.ts convert \
  --session ~/.claude/projects/<proj>/<session>.jsonl \
  --out ../fixtures/my-fixture --world-from /path/to/project
```

- **Engine discovery**: `<project>/.claude/skills/workflow-engine/scripts/`
  (dev-repo fallback: `<project>/skills/workflow-engine/scripts/`). Override
  with `--engine <path>`.
- **Width pin**: every engine invocation pins `WORKFLOWS_DISPLAY_WIDTH=65` —
  renders are terminal-width-sensitive; unpinned output encodes whatever width
  was detected.
- **Config schema**: `shared/src/config.ts` (projects, width pin, notification
  settings incl. quiet hours, port, daily budget warning).
- **Debug console**: `http://127.0.0.1:4870/debug` — health/banner, event
  stream (live vs durable), structured logs, cost counters. `/health`,
  `/events` (SSE, `?since=<seq>`), `/costs`, `/logs` are the named surfaces
  later phases extend.

### API keys (Phase 2+ sessions)

The Anthropic API key for bridge-driven sessions resolves from the
environment (`ANTHROPIC_API_KEY`) or the OS keychain — **never the browser,
never this repo**, following the product's own credentials doctrine
(`~/.config/workflows/credentials.json`, mode 0600, keys never transit chat
or argv). Phase 0 ships no session driving; the rule is stated here so no
later phase invents a weaker one.

### Version handshake

The bridge reads the installed product's version from its git tag and
declares a supported range; outside it — or on a repo with pending
migrations (diff of `.workflows/.state/migrations` against the install's
migrations directory) — it degrades to **read-only raw-embed mode with a
banner and no events**. The bridge never runs migrations; that is
`workflow-start`'s boot, in a session. Both detection mechanisms are fragile
by design and are replaced when the proposed read-only currency verb lands
(`plans/UPSTREAM.md` #2). Shallow/grafted clones degrade to live-only mode
(no durable spine).

## Tests

```sh
pnpm test        # all packages
pnpm typecheck
```

UI tests are self-contained — they never touch the product's `npm test`
gates. CI runs `.github/workflows/ui.yml` on every commit touching `ui/`.
