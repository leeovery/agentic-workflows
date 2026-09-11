A feature mid-discussion: card payments at checkout, shaped in
discovery, its discussion in progress and ready to close. Three
subtopics sit on the map, every one decided: capture confirmation
(webhooks over polling), card-data handling (the gateway's hosted
fields), and failed-payment retries (three attempts with backoff).
The decisions are documented and committed — the file's only commit
is a plain decision write, no drain marker.

No review has ever read this document: the agent store is empty. The
one review this walk dispatches — the closing pass — comes back with
two gaps on decided ground, neither of which the user will walk.

Hours have passed. The context was cleared — this session opens cold at
the entry skill with nothing but the two arguments and what is on disk.
