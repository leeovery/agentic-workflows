A feature mid-plan: the card-payments discussion is concluded, the
specification extracted from it and concluded, and the plan registered
on local markdown with its two-phase structure — payment intent core,
then webhook capture — designed and approved in an earlier sitting.
Phase 1 has no task table yet.

The discussion decides the gateway account and that capture is
confirmed by webhook, never by polling; the specification carries that
through and adds that a gateway rejection at intent creation surfaces
as a user-visible checkout error. Neither says what the shopper is
shown between submitting checkout and the capture webhook arriving.

The context was cleared mid-phase — this session opens cold at the
entry skill with nothing but the two arguments and what is on disk.
