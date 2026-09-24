# Spec 5 — The needs-you queue and the attention policy

One list of everything waiting on a human, and the mechanical rules for what may
interrupt. Revised after the walkthrough/FMEA/consistency rounds — the major changes: a
`report-pending` durable kind (the overnight case), push-at-report-landing for walks,
two-level activity, quiet hours, a durable push ledger, and this spec being
**authoritative over phase 3's prose** wherever the two differ.

## Queue rows

```ts
type QueueRow = {
  tier: 'live' | 'durable';
  kind: GateKind                              // live tier (open gates, bridge sessions)
      | 'reconcile' | 'spec-blocked' | 'stale-source' | 'triage-waiting'
      | 'report-pending'                      // a background-agent report returned but not yet drained
      | 'out-of-scope-bank' | 'dep-blocked-plan';
  address: { workUnit?: string; topic?: string; phase?: string };
  stage: 0 | 1 | 2;         // Discovery | Definition | Delivery — lobby/roadmap/baseline/
                            // addressless rows are stage 0 (the cone's widest end)
  since: string;            // durable: the introducing COMMIT's time (the spine computes it;
                            // survives bridge restarts) — observation time only for live rows
                            // and uncommitted flags
  owner: HumanId;
  escalated: boolean;
  stuck?: boolean;          // owner-unresponsive (below)
  buildOrderPos?: number;
};
```

Durable sources, named: `reconcile` from `reconcile_needed`; `stale-source` from
`sources.*/consult_references.*` rows; `triage-waiting` from **both** the `status:
triaged` manifest stub and the `.triage/{topic}/` listing (EVENTS `triage.changed`);
`spec-blocked` and `dep-blocked-plan` from the engine's **`lib.cjs` derived views** (they
are render-time joins, not manifest fields — never re-derived by the bridge);
`report-pending` from agent-store rows in `pending`/`acknowledged` with an unwalked
remainder — this is what makes the overnight reviewer-return reachable from the queue,
per the floor guarantee. **Lifecycle join on absence:** a source file gone because its
work unit closed (cache purge) drops the row silently; a *present but unparseable* report
degrades toward the human (walk) — ENOENT is not a parse failure.

## Ordering

Lexicographic sort key:

1. `escalated` desc.
2. `tier`: live before durable.
3. `stage` asc (lobby rows are 0).
4. Within one epic at equal stage: `buildOrderPos` asc; **skipped across work units**.
5. `since` asc — oldest first, computed from commit time so restarts don't reshuffle.

Owner filtering (Phase 6): default view = "mine + unowned + **stuck**". A row is `stuck`
when it has been `escalated` with no owner activity in its channel for `T_stuck`
(default 24h): it then enters *every* member's default view with a "stuck — claim?" chip
and joins watcher digests. Routing, not authority — claiming is a human act.

## Attention policy

Ceremony levels: **push** (OS notification) · **alert** (in-app banner when the app is
connected) · **badge** · **digest**. Every row badges; policy decides the rest.
**This spec is authoritative**; phase-3 prose defers to these tables.

### Activity, two levels (replaces the old single "focused channel" rule)

- **App-connected**: WebSocket up + any interaction within 90s. While app-connected,
  would-be pushes downgrade to **alerts** — an open UI is never OS-pushed.
- **Engaged with the row's thread**: for epics, focus is scoped to the **topic thread**,
  not the channel — attention to topic B never suppresses topic A's ceremony.
- **Navigation grace**: a row whose session the human left within the last `T_grace`
  (default 5 min) — e.g. they jumped to handle a consult — does not escalate against
  them during the grace.

### Laned findings (background-agent surfacing)

| Situation | Ceremony |
|---|---|
| Report lands with walk-lane (or unlabelled/unknown-lane) findings | **push once, at report-landing** — the old "at the announce" was impossible for idle sessions (the announce is a session turn that only follows the human's next input). The push opens the `report-pending` row, whose card carries "resume the session to start the drain". Within the drain, raises are in-card turns — never further pushes |
| Report lands with only `apply`/`decide`/`route` findings | badge + digest |
| In-session promotion toward the walk | observable as the next `walk-raise` card in that session's stream — policy re-applies on card detection (the surfacing protocol holds promotions in-conversation; there is no file signal, and none is needed) |

Lane names are fixed `apply`/`decide`/`route`; anything else → walk. Lane source: the
report markdown in cache, via a fixture-pinned mini-extractor; parse failure on a
*present* file → walk.

### Laneless gates (by card kind + the surface→type mapping in spec 1)

| Gate type | Ceremony |
|---|---|
| conversational ask, human engaged with that thread | none |
| bootstrap / routing / shaping asks | badge; push only via escalation *(authoritative — phase-3's "ping when idle-blocked" wording defers here)* |
| `batch-screen` | badge + digest; **never pings on open — escalation applies** (the schema's old "never pings" was overbroad) |
| task-loop gates | badge |
| three-strike consult, replan verdict | push (alert if app-connected) |
| `confirm: 'typed'` | push (alert if app-connected) |
| conflict / acknowledgement gates blocking a session with nothing else pending for that human | push |
| `pass-through` | engaged → none; else badge + escalation |
| `comment.added` on an open gate (Phase 6) | badge on card + queue row, unread-comment indicator **on the confirm control** — a sign-off can't be finalised without passing the indicator; never push |

### Escalation, suppression, quiet hours

- **Escalation:** a live row `idle-at-ask` beyond `T_esc` (15 min) escalates and pushes —
  **once per attendance**: it re-arms only after the human is next active in the app, so
  an 11pm escalation doesn't silence a genuinely-stuck 9am, and doesn't repeat overnight.
- **Quiet hours** (config, Phase 0 schema; default 22:00–08:00 local): pushes accrue and
  fire as **one morning roll-up** at the window's end. Typed-confirm and consult pushes
  accrue too — nothing is so urgent it beats sleep; the queue has it either way.
- **Roll-up:** held or accumulating pushes collapse into one ("3 waiting across 2 work
  units") per `T_roll` (10 min) window.
- **Durable push ledger** (SQLite): every push/alert decision is recorded
  (row id → pushed-at, drain id → announced-at). Restart consults the ledger —
  **a bridge restart re-pushes nothing**; re-push only on escalation re-crossing or
  content change. At-least-once event redelivery never reaches the notifier directly.
- **Floor guarantee:** with all notifications off, queue + badges alone suffice — every
  pending act, including an undrained report, has a row.

### Digests

Per channel at observed natural breaks (phase completions, status changes, bridge session
ends; terminal session ends best-effort) — plus a **pinned daily digest at a configured
morning hour**, which doubles as the overnight recap. The **lobby carries a digest
strip** concatenating the channels' latest digests — the cross-unit "what landed today"
surface (pure composition, no new derivation). Contents per digest: what landed (commits
+ artifacts — their only roll-up; the spine never carries them), what waits (current
rows, stuck chips included), what's next (the engine's own next-phase surface, embedded).
