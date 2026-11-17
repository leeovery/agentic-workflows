# Prose Tests, If Any

## The Idea

Decide whether Ledger needs prose tests at all, and if it does, build
them for Ledger's own model. The engine owns the menus, the gates, the
state and the handoffs, and its node suites and the pipeline simulation
hold all of them. What no suite holds is whether Claude follows the
skills: reads what a phase says to read, asks what it says to ask, takes
the turns it describes, keeps what no door can refuse — a question asked
in plain prose in the build, an extra review round. That is the one
thing a prose test would test.

## Where It Came From

Lee, 2026-11-17, during the sweep of what the reshape left behind. The
old harness built pre-Ledger worlds and its suites tested a stale model:
its corpus had gone at #1522, and the harness — `tests/prose/`, its node
suites, the `/prose-test` skill and its three agents — was removed whole
in the change that added this entry. Git history keeps what it did.

## Shape

What a rebuild has to get right, each found true of Ledger when the old
harness was swept:

- **A world is a Ledger project.** Boot first, so the state worktree on
  `ledger-state` exists before any write; then the engine's own verbs,
  never a hand-written manifest. A write to `.ledger/manifest.json` needs
  an engine commit on `ledger-state`, so a choice is set through its
  verb: `brownfield record native`, `walkthrough record skipped`,
  `session label-config`. The test library's `copyWorld`, `codeProject`
  and `fixtureFrom` already build such projects. A project that holds a
  `.workflows/` folder boots into the migration and stops at its review.
- **No byte-identical snapshot.** `project_id` and every ledger, raise,
  decided and brief id come from `crypto.randomBytes`, unseeded, so two
  builds of one world never match byte for byte. A world is compared by
  structure, or built with minted ids as `fixtureFrom(…, {kept})` does.
- **The walker's conversation is booted.** Every verb that touches work
  refuses a conversation without boot's stamp, so a case entering at a
  phase skill, the epic's menu, discovery or the roadmap needs its world
  stamped for the walker's session as it is built. A peer's presence row
  needs the same, since `presence beat` is not boot-exempt.
- **Nothing reaches the developer's own config.** A walk writes the boot
  stamp, briefs, `trust.jsonl`, `person.md` and `decision-checks.jsonl`
  under `LEDGER_CONFIG_DIR`, so each world pins its own, and several
  walkers never share one conversation folder.
- **A dispatch is a brief pointer.** Agents are dispatched with
  `brief:{id}`: a recorder resolves the pointer as the brief guard does
  (`guardDispatch`), and keeps both, so a check on what an agent was told
  reads the brief, not the pointer.
- **The project's guards run.** Boot installs the layout, brief and shell
  guards; a walk that skips them is not the product's.
- **State writes are recognised under `.ledger/`,** in the state
  worktree, and `.ledger/.cache/` is judged for what in it is world state.
- **What no world can pin:** the effort notice shows whenever
  `CLAUDE_EFFORT` is set.

## Open Verification

- Whether following the skills fails often enough, or badly enough, to
  be worth walks that cost tokens on every run.
- What a case asserts: outcomes on the state, the calls made, or what
  the person was shown.
- A walker that records through hooks in its own agent frontmatter needs
  the workspace trust dialog accepted for the folder: until then those
  hooks fail silently.

## Trigger

After Lee's manual test of the reshape, once the skills stand as they
will ship.
