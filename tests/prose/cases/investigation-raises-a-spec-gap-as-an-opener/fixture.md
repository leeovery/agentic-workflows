A bugfix, crash-fix: checkout 500s at the payment step for an order
with no shipping address. The investigation concluded in an earlier
sitting — root cause found (the tax context treats the shipping
address as mandatory; digital-only orders legitimately have none),
findings signed off, and a fix direction agreed: build the tax context
from the billing address when the order has no shippable items.

The specification began from that investigation and stalled. Writing
the direction down as a requirement, the spec session checked what the
checkout guarantees about the billing address and found it guarantees
nothing — wallet payments carry no address, saved cards only sometimes
— so for a share of the very orders the bug affects the fall-through
has nowhere to land, and nothing in the record says what such an order
is taxed at. That is product intent a specification cannot invent, so
it routed the gap back to its source: one concern in the pinned shape,
landed by the engine in the investigation's triage queue, reopening
the investigation and pausing the specification with its single source
row still pending. The entry is deliberately exhaustive: background
with the wallet and saved-card shares, two options with their costs
itemised (a country prompt before payment; a location derived from the
payment method and the account, with an issuer lookup on its own
budget against the tax lookup's timeout and a retry count), a rejected
zero-rating alternative, the spec session's own lean with its
derivation, and the one ask it leaves crash-fix.

Hours have passed. The context was cleared — this session opens cold
at the investigation entry skill with nothing but the two arguments
and what is on disk.
