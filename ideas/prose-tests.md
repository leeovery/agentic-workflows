# Prose Tests, If Any

## The Idea

Decide whether Ledger needs prose tests at all, and if it does, rebuild
them for Ledger's own model. The engine now owns the menus, the gates,
the state and the handoffs, and its node suites and the pipeline
simulation hold all of them. What no suite holds is whether Claude
follows the skills: reads what a phase says to read, asks what it says
to ask, takes the turns it describes. That is the one thing a prose test
would test.

## Where It Came From

Lee, 2026-11-17, during the reshape's residue sweep: the harness built
pre-Ledger worlds and its suites tested a stale model, so he ruled it
removed whole, with the question kept here.

## Questions

- Does following the skills fail often enough, or badly enough, to be
  worth walks that cost tokens on every run?
- If so, what does a case assert: outcomes on the state, the calls made,
  or what the person was shown?

## Starting Point

- Worlds are built from the state worktree and `.ledger/`: boot first,
  then the engine's own verbs, never a hand-written manifest. The test
  library's `copyWorld`, `codeProject` and `fixtureFrom` already build
  such projects.
- The reshape's residue sweep listed what the old harness got wrong
  against Ledger's model — snapshots that cannot be byte-identical over
  random ids, a stamp on the old manifest, no booted conversation, the
  walker writing the real `~/.config/ledger`, brief pointers unresolved,
  the project's guards never run — and is the place to start.

## History

The corpus was deleted at #1522. The harness — `tests/prose/`, its node
suites, the `/prose-test` skill and its three agents — was removed in the
commit that added this entry.
