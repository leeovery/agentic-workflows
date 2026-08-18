A feature mid-discussion: card payments at checkout, four subtopics
on the map — capture confirmation and currency handling decided,
failed-payment retries exploring with two options and no decision,
card-data handling untouched. The discussion file holds the two
decided blocks, the retries options block, and a summary saying so.

A background review of that forming document returned two findings,
both open choices the topic owns, both in the ask lane: the
payment-intent story a retry needs (reuse the first attempt's intent
or mint a fresh one — with the decided webhook ground making a
fresh-intent rule a double-charge window), and the unstated retry
ceiling. The first finding's report section is deliberately rich: a
worked trace, per-option costs (idempotent-retry semantics, intent
expiry, orphaned-intent reconciliation), and a secondary consequence
(the refund path assumes one intent per order). A third candidate
failed the review's bar and sits in Observations.

The store row is acknowledged and announced. Nothing has been
surfaced.

Hours have passed. The context was cleared — this session opens cold
at the entry skill with nothing but the two arguments and what is on
disk.
