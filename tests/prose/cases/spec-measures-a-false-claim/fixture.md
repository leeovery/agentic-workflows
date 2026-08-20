A feature whose discussion is complete: card payments at checkout,
decided through — the existing gateway account, webhook-confirmed
capture, and no reconciliation job for v1. The no-reconciliation
decision rests on a recorded measurement: every webhook handler wraps
its work in withRetry (`grep -L withRetry src/webhooks/*.js` → no
output), and a Key Insight names that uniform wrapping as the reason no
sweeper is needed.

The world's tree says otherwise. Three handler files exist under
src/webhooks/ — charge and capture wrap their work in withRetry;
refund.js does not. The recorded command, re-run today, prints
src/webhooks/refund.js. The discussion's claim was false when written,
and the decision leaning on it has never been re-weighed.

No specification exists anywhere and no phase beyond discussion has
run. The context was cleared at the phase boundary — this session opens
cold at the entry skill with nothing but the two arguments and what is
on disk.
