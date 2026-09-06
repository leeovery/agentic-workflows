# Fixture — implementation-settles-a-preference-decision

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

The webhook module trusts every capture it is handed:
`handleCaptureWebhook` marks `event.intentId` paid without looking the
intent up, and nothing in the plan, the specification, or the
discussion says what a capture matching no order should do.

The checkout module refuses an empty or over-long order reference with
checkout's own message before the gateway SDK is called — `pay-1-1`'s
acceptance criteria record that refusal — and hands every other
`order.id` to the SDK unchanged. Pre-existing code the phase never
touched, `src/orders/reference.js`, is the one place an order reference
is minted: `ord_` followed by a ULID, nothing else. No import path, no
merchant-assigned reference, exists anywhere in the tree.

As in the sibling loop cases, the previous pass also left:

- `.workflows/.state/environment-setup.md` stating
  `No special setup required.`
- `project.defaults.project_skills` and `project.defaults.linters`
  both `[]`, routing Steps 3 and 4 to their skip-again gates.
