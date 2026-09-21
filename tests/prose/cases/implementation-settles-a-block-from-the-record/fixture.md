# Fixture — implementation-settles-a-block-from-the-record

The `pay` feature is mid-implementation. The single-phase
local-markdown plan holds three tasks — `pay-1-1` (Create Payment
Intent), `pay-1-2` (Handle Capture Webhooks) and `pay-1-3` (Release
Abandoned Intents). The first is complete: its source and test files
exist, its `impl(pay): T…` commit is in the git history, and the
manifest records it in `completed_tasks` with `pay-1-2` named next. The
other two are pending, so the phase still has work after the next task
and its consolidation boundary is nowhere near.

The implementation item exists from that previous session — `task init`
has run — and every gate reads `gated`.

The concluded specification carries a `### 3. Abandoned Checkout`
section. A checkout the shopper never comes back to is abandoned and
the intent it opened is released, so no card is left holding an order
nobody placed. The checkout page is abandoned after 15 minutes and its
intent released at 30 — twice the window — so a shopper returning to a
still-open checkout inside the window always finds their payment where
they left it. A capture naming an intent already released names an
intent no order carries, and is logged and ignored. The saved-card
checkout reaches the same gateway by the same path and is abandoned
after 20 minutes — and the section never says when that intent is
released. No file in the tree carries either release time.

As in the sibling loop cases, the previous pass also left:

- `.workflows/.state/environment-setup.md` stating
  `No special setup required.`
- `project.defaults.project_skills` and `project.defaults.linters`
  both `[]`, routing Steps 3 and 4 to their skip-again gates.
