A feature's research in progress, largely concluded in an earlier
sitting: payment telemetry placement — per-module instrumentation over
a single funnel event, and gateway webhook payloads reused for
capture-side fields. Both threads carry conclusions.

One recorded measurement is false. The Instrumentation Surface thread
counted the checkout flow at four modules (`ls src/checkout/*.js |
wc -l` → 4); the world's tree holds five files under src/checkout/ —
wallet-stub.js exists too. Nothing leans on the exact number: the
conclusion is per-module, whatever the count, and says so.

The context was cleared between sittings — this session opens cold at
the entry skill with the research in progress and what is on disk.
