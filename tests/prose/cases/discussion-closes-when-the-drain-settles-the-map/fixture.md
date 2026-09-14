A feature whose discussion — card payments at checkout, shaped in
discovery — was settled and concluded in earlier sittings. Four
subtopics sit on the map, every one decided and written: capture
confirmation (webhooks over polling), card-data handling (the gateway's
hosted fields), failed-payment retries (three attempts with backoff),
and webhook reconciliation (an hourly sweep for stuck orders).

Two background reviews ran while the discussion was live. The first
returned two findings, F1 and F2, which the user walked through — the
retry cap was pinned (F1) and the missed-webhook path got its
reconciliation sweep (F2) — and its row stands incorporated; that
engagement's write, committed with its drain marker, is the discussion
file's only commit. The second review fired on the movement that
followed, came back clean, and was acknowledged as such.

The user concluded the discussion. The specification pass over it then
found that the retry decision could not be built as recorded — the
gateway forbids re-presenting a hard decline, and the discussion never
weighed the soft/hard split — and routed the gap back through the
linear work type's own delivery: the discussion was reopened and the
concern installed as one file in its triage queue under the title
"Failed Payment Retries", kebab-identical to the decided subtopic it
challenges. The specification paused in progress with its extraction
flagged stale.

Hours have passed. The context was cleared — this session opens cold at
the entry skill with nothing but the two arguments and what is on disk.
