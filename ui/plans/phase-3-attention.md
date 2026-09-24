# Phase 3 — The attention system

**Goal:** ping ceremony made mechanical. Every stop is already a gate in the needs-you
queue the moment it opens (Phase 2); this phase decides which of them *interrupt*, which
badge, and which wait for a digest — from the product's own classification where it exists,
and from a designed table where it doesn't. After this phase the UI can be left closed with
confidence.

**Duration:** 1–2 weeks.

**Corrected premise (from review):** lanes classify *background-agent findings only*, and a
batch screen is still a session-blocking STOP in the product — so lanes govern **ping
ceremony over pending screens, never disposition**. The UI never answers anything on the
human's behalf, and nothing is "silently logged" instead of surfaced: every stop is a queue
row immediately; the only question is whether it also pings.

## Deliverables

1. **The attention table** (implements `specs/needs-you-ordering.md`):
   - **Laned findings** (background-agent surfacing): a *walk drain* pushes **once per
     drain**, at the announce — never per finding (the walk is one seated conversation;
     six pushes for six findings pays its cold-start cost six times). Batch screens
     (apply / decide / route) badge and join the digest; they never push. Lane names are
     read as fixed `apply`/`decide`/`route` from the report markdown (gitignored cache —
     read via a fixture-pinned mini-extractor); any other name or an unlabelled finding is
     treated as walk — the product's own safe direction. In-session promotions toward the
     walk are invisible to file-watching, so the bridge also listens to its own sessions'
     surfacing events and re-applies policy on promotion.
   - **Laneless gates** (the majority of a real day): a designed gate-type → ceremony
     table, by card kind from the schema: conversational bootstrap asks ping only when
     the session is otherwise idle-blocked; task/fix-loop gates badge (they arrive in
     runs); the three-strike consult, replan verdicts, and typed-confirm gates push;
     conflict menus and acknowledgement gates push when they block a session with nothing
     else pending.
   - **Escalation:** any session idle at a STOP beyond a threshold escalates to a push
     regardless of kind — a stopped session is spent attention nothing is buying.
2. **Suppression, time-based** (revised from review — existence-based suppression starves
   every gate after the first): suppress a push while the human is *active* (defined for
   this phase as: WebSocket-connected with that channel focused within N seconds — Phase 6
   replaces this with real UI presence) or was pushed within M minutes; when the pending
   set grows or ages past M, send one **roll-up push** ("3 waiting across 2 work units"),
   not per-gate pings.
3. **Digests at natural breaks.** Assembled from workflow events — phase completions,
   conclude sweeps, session ends (observable only for bridge sessions and
   research/discussion presence; the digest scheduler treats terminal-session ends as
   best-effort) — with a daily fallback at most. Contents: what landed (commits and
   artifacts, linkable — commits live *here* and in threads, never on the spine), what
   waits (the queue's current rows), what's next (from the engine's own next-phase
   surface, never re-derived).
4. **Cursors and receipts** — the Phase 0 `stream_cursors` and `artifact_read_refs`
   tables go live: badge counts from stream cursors; artifact read-refs recorded on
   artifact view (HEAD-at-render) for Phase 4's diffs.
5. **The bridge watchdog** — escalation and push live in the bridge process, so a dead
   bridge is otherwise a silent attention outage. The SPA's service worker alarms when
   the WebSocket and a scheduled check-in both go silent past T_esc: "bridge unreachable
   since {t} — sessions may be waiting."
6. **The lobby digest strip + morning digest** — the cross-unit "what landed" surface
   (pure composition of channel digests) and the pinned daily digest hour that doubles
   as the overnight recap; quiet hours and the push ledger per spec 5.

## Explicitly out of scope

- Email. Push (web-push/VAPID) + digest only.
- Per-finding pushes of any kind, regardless of claimed criticality.

## Done means

- Fixture day (the multi-unit event script is built here as part of the test lane): three
  work units — discussion in flight, spec review pending, delivery running. The human
  receives ≤5 pushes, each opening onto an actionable card or drain; every other pending
  item is reachable in ≤2 clicks via queue or digest; and **no session sits blocked
  beyond the escalation threshold without a push having fired**.
- The overnight case: a background report returning at 2am produces no night-time push
  (quiet hours), one `report-pending` queue row, and one morning roll-up that opens onto
  the drain.
- Restarting the bridge mid-fixture-day re-pushes nothing (the push ledger holds).
- Turning all notifications off degrades to a purely pull UI that still works — the queue
  is the floor, notifications are acceleration.
- A finding with an unrecognised lane name pushes as walk (safe-direction test).

## Risks

- **Report parsing drift.** The lane mini-extractor reads model-written markdown in
  cache; it ships with golden fixtures and treats any parse failure as walk — degradation
  toward the human, mirroring the product.
- **Push delivery is not guaranteed.** "Left closed with confidence" is only as good as
  undelivered-push detection: the bridge tracks delivery failures and falls back to
  badge + digest prominence, surfaced on the observability floor.
