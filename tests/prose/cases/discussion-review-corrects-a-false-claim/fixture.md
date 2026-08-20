A feature discussion in progress, fully decided in an earlier sitting:
card payments at checkout — the existing gateway account with
webhook-confirmed capture, and per-module payment telemetry across the
checkout flow. Both subtopics read decided on the map; the document's
Summary is populated.

One recorded measurement is false. The Telemetry Coverage Journey
counted the checkout flow at four modules (`ls src/checkout/*.js |
wc -l` → 4); the world's tree holds five files under src/checkout/ —
wallet-stub.js exists too. Nothing decisive leans on the exact number:
the telemetry decision is per-module, whatever the count.

The context was cleared between sittings — this session opens cold at
the entry skill with the discussion in progress and what is on disk.
