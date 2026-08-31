# Fixture — implementation-settles-a-derivable-spec-gap

The `pay` feature is mid-implementation with nothing left to build. The
single-phase local-markdown plan holds two tasks — `pay-1-1` (Create
Payment Intent) and `pay-1-2` (Handle Capture Webhooks) — and both are
completed: their source and test files exist, their `impl(pay): T…`
commits are in the git history, and the manifest records both in
`completed_tasks` with `current_task` empty. Phase 1 has already closed
through its consolidation boundary: the manifest carries `1` in both
`consolidated_phases` and `completed_phases`.

The implementation item exists from that previous session — `task init`
has run, all four gates are `gated` — so this session's entry resumes
rather than creates. `analysis_cycle_total` and `analysis_cycle_session`
are both `0`: no analysis cycle has ever run. `bank` is absent — nothing
was ever deposited.

The concluded specification carries a `## Client call bounds` section:
the feature's two synchronous external calls — the checkout's intent
creation against the gateway, and the webhook consumer's order write
against the orders store — both run under explicit client timeouts,
configured once on the shared clients rather than at the call sites.
The section bounds intent creation at 4 seconds and records why — twice
the gateway's documented p99 of 2 seconds, so a healthy slow call never
trips the bound while a hung gateway cannot hold the checkout open. For
the order write it records the orders store's documented p99 of 250
milliseconds and states no bound; the same section notes the webhook
path is background work the shopper never waits on. The shared clients
are ambient — the modules reach `gateway` and `orders` as free
identifiers — so no file in this tree carries either timeout value.

As in the sibling loop cases, the previous pass also left:

- `.workflows/.state/environment-setup.md` stating
  `No special setup required.`
- `project.defaults.project_skills` and `project.defaults.linters`
  both `[]`, routing Steps 3 and 4 to their skip-again gates.
