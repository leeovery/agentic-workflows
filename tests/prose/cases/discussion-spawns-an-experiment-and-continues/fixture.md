The `pay` feature, mid-discussion. Retry policy is decided and
documented; webhook timing is still exploring — how long the checkout
waits on the capture webhook before surfacing a pending state to the
buyer.

The number underneath that question is empirical: the gateway vendor
claims sub-second webhook delivery, the wait-window design leans on
whether that claim holds against the real sandbox, and nobody has
measured it.

No experiment series exists, no review has ever run, the triage queue
is empty, and no other session is mid-flight. The context was cleared
at the phase boundary — this session opens cold at the discussion entry
with its two arguments and what is on disk.
