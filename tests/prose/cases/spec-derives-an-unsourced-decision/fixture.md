A feature whose specification stands at the review boundary.
Construction concluded in an earlier sitting: the card-payments
discussion is completed, its content extracted, the source row
incorporated, review not yet begun.

The specification pins one value its source never states. Its Intent
Creation Resilience section caps each gateway attempt at 2 seconds,
while the discussion decides the shape around the cap and never a
number: one retry fired immediately with no backoff, the whole attempt
sequence inside the checkout's 6-second interstitial budget, the cap
there so a hung first attempt never eats the retry's chance — and no
tighter than the budget forces.

The context was cleared between sittings — this session opens cold at
the entry skill with the spec in progress and what is on disk.
