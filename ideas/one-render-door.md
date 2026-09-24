# One Render Door — Schema In, Surface Out

## The Idea

One central place renders every screen the workflows show, and it is
dumb: a surface is handed data in its prescribed shape and gives back the
rendered sections. It never reaches into a manifest. Reading the state,
deriving from it and arranging the result into the surface's shape is
the job of the skill's adapter — the gateway beside the skill — at the
edge of the onion, where the skill-specific knowledge belongs.

## Why

Two kinds of orchestrator draw the screens today, and both know far more
than drawing needs:

- **The render catalogue** (`domain/render.cjs`, about 60 surfaces).
  Each takes an address, loads the manifest, derives, calls a
  projection, and assembles its sections — skill-specific orchestration
  at the centre (the postpone gate, the spec confirm, the defer gate).
- **The skill gateways** (`skills/*/scripts/gateway.cjs`). Each loads
  manifests through the engine's reads, derives, calls the same
  projections, and assembles its sections — the right place, but a second
  copy of the job.

What that costs:

- **Two section builders** — the gateway's `dataBlock`/`menuBlock` and
  the surfaces' `section()`/`dataSection`, the marker text in both.
- **Two test entries** — the engine has an in-process door
  (`engine.run`), so the pipeline simulation audits every render surface
  after every step; the gateways' views are reachable in tests only by
  spawning (one pass per verb, not per step).
- **Derivations in two places** — spec entry's gateway derived its
  source rows itself and the spec confirm gate had to re-derive them.
- **Positional quirks** — a work unit named like a gateway verb
  (`select`, `view`) collides with it.

## Shape

- **Kernel** — generic layout and IO. Unchanged.
- **Domain** — the reads and derivations: the workflow's knowledge, which
  the adapters call.
- **Render (the centre)** — one door. Each surface declares the shape of
  data it takes, refuses data not in that shape, and draws; one section
  builder (TITLE, DISPLAY, MENU, DATA, GATE); one in-process test entry
  the simulation audits every step. The projections are already most of
  this; the address resolution and derivation now inside `render.cjs`
  move out.
- **Adapters (the skills)** — read, derive, arrange the data into the
  surface's shape, call render. Every screen a skill shows is fetched
  through its own adapter.

## Also in Scope

- **The menu alone, on demand.** A put-back after a question at a gate
  fetches the menu without the display above it (R19 of
  `design/function-hook-gates.md`). Today a surface that draws a display
  above its gate has no menu-only form unless it was given one by hand
  (the help card, the walkthrough, the phase tree): in the lab, the epic
  menu came back with its whole map after a question (2026-09-24).
- The verb/unit-name collisions go with the positional forms.

## Where It Came From

Lee, 2026-09-24, in the function-hook gates review: first asking why a
menu comes from `engine render` in one place and a skill gateway in
another, then, in the lab pass, setting the direction — "schema in,
renderable surface out", the centre handed its data and never reaching
into the manifest, retrieval the gateway's job. Possibly part of a deep
review of the code side of the system.

## Trigger

After the function-hook gates stacks land and release. Its own design
pass first.
