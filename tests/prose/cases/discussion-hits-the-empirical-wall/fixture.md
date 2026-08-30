The `pay` feature, mid-discussion. Retry policy is decided and documented;
webhook timing is still exploring — how long the checkout waits on the
capture webhook before falling back to polling. The Summary's open thread
names it.

The number underneath that question is empirical: the gateway vendor
claims sub-second webhook delivery, and the wait-window design leans on
whether that claim holds against the real sandbox. Nobody has measured it.

No experiment item exists, no review has ever run, the triage queue is
empty, and no other session is mid-flight. The session opens cold at the
discussion entry with its arguments and what is on disk.
