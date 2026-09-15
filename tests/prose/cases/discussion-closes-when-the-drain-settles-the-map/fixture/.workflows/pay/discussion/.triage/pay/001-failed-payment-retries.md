### Failed Payment Retries
*From: pay · specification · 2026-01-01*

Extracting the retry decision hit a rule the discussion never
weighed. The gateway classes every decline as soft (issuer
unavailable, try again later) or hard (do not honour, card
reported lost or stolen, account closed), and its card-network
rules forbid re-presenting a hard decline — repeated attempts on a
hard-declined card are what gets a merchant account flagged for
review. The recorded decision — three attempts with exponential
backoff for every failed payment — would re-run a hard decline
twice more. The specification cannot pick the shape: whether the
retry policy applies to soft declines only and a hard decline ends
the attempt at once, or the three-attempt cap stands for every
decline with the account risk accepted, is a product decision this
discussion owns. What the spec established: the gateway's failure
response carries the decline class on every decline, so the split
costs nothing to read.
