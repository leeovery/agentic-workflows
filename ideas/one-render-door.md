# One Render Door

## The Idea

Move every navigation view the skill gateways compose — the start menu
and its sub-views, the five continue skills' views, the epic menu and
its sub-menus, spec entry's view, the roadmap home, the discussion and
discovery reads — into `engine render` surfaces, so engine output
reaches the model through one door.

## Why

The gateways (`skills/*/scripts/gateway.cjs`) came first, as per-skill
adapters that compose a navigation snapshot (DATA + TITLE + DISPLAY +
MENU) from engine calls. The render-surface programme came later and
moved gates to `engine render`, fetched where they are shown; the
navigation views stayed in the gateways. So there are two ways the
engine's sections reach the model, and they have drifted apart:

- **Two section builders** — the gateway's `dataBlock`/`menuBlock` and
  the surfaces' `section()`/`dataSection`, with the marker text in both.
- **Two test entries** — the engine has an in-process door
  (`engine.run`), so the pipeline simulation audits every render surface
  after every step; the gateways export only `discover`/`format`, their
  other verbs read `process.cwd()` and can `process.exit`, so their views
  are reachable in tests only by spawning (the gate-payload audit covers
  them with one spawned pass per verb, not per step).
- **Derivations in adapters** — spec entry's gateway parses the
  consult hints and derives its source rows itself; the spec confirm gate
  had to re-derive them.
- **Positional quirks** — a work unit named like a verb (`select`,
  `view`) collides with it.

## Shape

- Each view becomes a render surface addressed like the rest; its
  derivation moves into the engine's domain ring.
- The gateways reduce to nothing, or to DATA-only state reads that could
  themselves be engine verbs.
- Touches every navigation call site in the prose, the head-of-skill `!`
  inserts, the skills' allowed-tools, the prose-test invariants that pin
  gateway calls, and the simulation — a programme of its own with a
  design pass first.

## Where It Came From

Lee, 2026-09-24, in the function-hook gates review, asking why a menu
comes from `engine render` in one place and a skill gateway in another.
