A feature whose discussion is complete: card payments at checkout,
decided through — the existing gateway account, webhook-confirmed
capture, and no queued backfill job for v1: recovery from missed
capture webhooks is a single synchronous pass. That conclusion rests
on a recorded measurement — the gateway client pages capture events
at 500 per request (`grep 'const PAGE_SIZE' src/gateway/client.js` →
`const PAGE_SIZE = 500;`) — and the arithmetic computed from it: a
heavy day of ~2,000 events is 4 requests, far inside the gateway's
60-requests-per-minute limit. A Key Insight restates the 500-per-page
batching as the reason no queue is needed.

The world's tree says otherwise. src/gateway/client.js pages at 250:
the recorded command, re-run today, prints `const PAGE_SIZE = 250;`.
The discussion's claim was false when written, and every figure
computed from it is wrong the same way.

No specification exists anywhere and no phase beyond discussion has
run. The context was cleared at the phase boundary — this session
opens cold at the entry skill with nothing but the two arguments and
what is on disk.
