A feature mid-discussion: card payments at checkout, shaped in
discovery, its discussion in progress. Five subtopics sit on the map.
Four are decided and written up — capture confirmation (webhooks over
polling), card-data handling (the gateway's hosted fields),
failed-payment retries (three attempts with backoff), and webhook
reconciliation (an hourly sweep for stuck orders). The fifth, what the
shopper sees when the gateway declines a card, was opened at the end of
the last sitting and is still being explored — nothing about it is
written in the file beyond a line in the Summary noting it open.

Two background reviews have run. The first returned two findings, F1
and F2, which the user walked through in an earlier sitting — the retry
cap was pinned (F1) and the missed-webhook path got its reconciliation
sweep (F2) — and its row stands incorporated; that engagement's write,
committed with its drain marker, is the discussion file's only commit.
The second review fired on the movement that followed, came back clean,
and was acknowledged as such.

Hours have passed. The context was cleared — this session opens cold at
the entry skill with nothing but the two arguments and what is on disk.
