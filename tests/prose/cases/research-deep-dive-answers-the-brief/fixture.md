The `search-relevance` epic, three topics on the map. The
`relevance-measurement` research is mid-flight: NDCG@10 over
click-derived judgments is the working position, the file says so, and
the register carries three threads — the brief's question about what a
good harness looks like, which the file now answers; the user's question
about how often click-derived judgments need refreshing, still open; and
a thread the conversation opened when it noticed an aggregate metric can
climb while the rare product searches get worse — how evaluation
harnesses elsewhere handle that. The last was sent to a deep dive in the
previous sitting and the thread is marked as being dug.

The dive has come back. Its report is on disk where the store expects
it and the store lists it as landed; nothing has read it. The report
answers the brief's two questions in code — a guard function and the
exception it raises, a CI step, a slices file with a size floor, a
nightly rebuild job, a weights table — and opens two lines: a question
about labelling a slice too rare to accumulate clicks, and a number the
shop would have to count in its own query log before a slice floor is
even an option.

The other two topics have not started, the triage queue is empty, no
experiment exists for the topic, and no other session is mid-flight.
The context was cleared at the pause — this session opens cold at the
research entry with its three arguments and what is on disk.
