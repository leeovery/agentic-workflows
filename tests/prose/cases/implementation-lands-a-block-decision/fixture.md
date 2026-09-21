# Fixture — implementation-lands-a-block-decision

The `pay` feature is mid-implementation. The single-phase
local-markdown plan holds three tasks — `pay-1-1` (Create Payment
Intent), `pay-1-2` (Handle Capture Webhooks) and `pay-1-3` (Surface
Checkout Errors). The first is complete: its source and test files
exist, its `impl(pay): T…` commit is in the git history, and the
manifest records it in `completed_tasks` with `pay-1-2` named next. The
other two are pending, so the phase still has work after the next task
and its consolidation boundary is nowhere near.

The implementation item exists from that previous session — `task init`
has run — and every gate reads `gated`.

The discussion concluded in the template's own shape: one decided
subtopic, Gateway Integration, which settles the existing gateway
account and webhook-only confirmation, and a summary. The
specification was extracted from it and concluded: card-only intents, a
gateway rejection surfacing as a user-visible checkout error, a
duplicate start reusing the existing intent, capture confirmed by
webhook and never by polling, duplicate deliveries idempotent, and a
capture naming an intent no order carries logged and ignored.

Neither document says what happens when a capture lands on an order the
shopper has already cancelled. A cancelled order still carries its
intent, so the logged-and-ignored rule does not reach it, and nothing
anywhere decides whether the order comes back or stays gone.

As in the sibling loop cases, the previous pass also left:

- `.workflows/.state/environment-setup.md` stating
  `No special setup required.`
- `project.defaults.project_skills` and `project.defaults.linters`
  both `[]`, routing Steps 3 and 4 to their skip-again gates.
