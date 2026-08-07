A feature mid-discussion: card payments at checkout, shaped in
discovery, its discussion in progress and ready to close. Three
subtopics sit on the map, every one decided: capture confirmation
(webhooks over polling), card-data handling (the gateway's hosted
fields), and failed-payment retries (three attempts with backoff).
The decisions are documented and committed — the file's only commit
is a plain decision write, no drain marker.

No review has ever read this document. At a prior close attempt a
review was dispatched and the session died before the agent wrote
anything; the resumed close's in-flight check closed the abandoned
row. So the store holds exactly one review row — review-001,
incorporated, with no report file on disk — a corpse in the highest
slot, and the only slot.

Hours have passed. The context was cleared — this session opens cold at
the entry skill with nothing but the two arguments and what is on disk.
