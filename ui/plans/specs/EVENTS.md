# Spec 3 — Domain events

The bridge's typed event vocabulary. Revised after the FMEA/consistency/sufficiency
rounds: the stream is now **two explicit layers** — a durable, commit-derived stream with
occurrence-unique ids, and an ephemeral live layer that is never sequence-numbered — under
a **stream epoch** that detects history rewrites.

## Envelope

```ts
type DomainEvent = {
  id: string;            // sha256(type, addressKey, discriminant)[0..16] — see identity rules
  seq?: number;          // durable layer only — persistent, monotonic per project
  epoch: string;         // the stream epoch this event belongs to (below)
  live?: true;           // ephemeral layer marker; live events carry no seq
  ts: string;            // durable: introducing commit's author date; live: observation time
  project: string;
  type: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  payload: object;
};
```

## The two layers (identity rules)

**Durable layer — commit-derived only.** Every durable event's `discriminant` **includes
the introducing commit sha**, making recurring transitions occurrence-unique: a topic
completed, reopened, and completed again yields two distinct `phase.completed` ids
(different shas). The durable stream is what `spine(repo)` reproduces, what sequence
numbers order, and what cursors track.

**Live layer — ephemeral, re-derivable, never persisted.** Between commits the watcher's
snapshot diff emits the same event shapes with `live: true` and a bridge-local nonce in
the discriminant. Live events are UI freshness only: no `seq`, never written to cursors,
never part of restart identity. When the state lands in a commit, the durable event
supersedes: clients drop any live event sharing (type, address, logical key) on arrival
of its durable successor — or on the next live diff showing the state gone (a transient
set-and-cleared-between-commits state is **live-only by design** and simply disappears;
the spine never contains it, and that is stated, not a bug).

Restart therefore reproduces the durable stream exactly and the live layer approximately
— the old "byte-for-byte by construction" claim applied to both layers and was wrong;
this split is the corrected claim.

## The stream epoch

`epoch = sha256(rootCommitSha, spineTipSha, spineContentHash)`, recomputed at boot and on
every non-fast-forward HEAD observation. On epoch change (rebase, force-push, squash of
the workflow branch, branch switch, backup restore): all `stream_cursors` for the project
are invalidated (clients full-resync), `artifact_read_refs` whose SHA is now unreachable
are marked `history-rewritten` (Phase 4 renders "diff base lost" — visible degradation,
never a wrong diff), and a mass-disappearance diff is **not** interpreted as removals
(no `workunit.removed` burst on a branch switch). Shallow, grafted, or partial clones
break `manifest@C-parent` at the boundary — detected at boot; the bridge degrades to
live-only mode with a banner.

Sequence numbers are assigned once, persisted in SQLite, and never re-assigned; a
restart continues the counter. Cursors are `(epoch, seq)` pairs.

## Event table

Discriminant column: `+sha` = the introducing commit sha (durable) / nonce (live).

| type | payload | discriminant | derived from |
|---|---|---|---|
| `workunit.created` | `{workType, name}` | name +sha | registry entry appears |
| `workunit.removed` | `{successor?}` | name +sha | registry entry disappears **and epoch unchanged** — successor inferred from the same commit's diff (absorb → the epic topic; promotion → the new unit) |
| `workunit.status-changed` | `{from, to}` | to +sha | `status` diff |
| `phase.completed` | `{phase, topic}` | phase.topic +sha | item status → `completed` |
| `phase.item-changed` | `{phase, topic, from, to}` | phase.topic.to +sha | other item transitions |
| `flag.input-moved` / `flag.cleared` | `{phase, topic, kind, upstream?}` | phase.topic.kind +sha | `reconcile_needed` appears/disappears; stale source rows likewise |
| `derived.spec-blocked` / `derived.dep-blocked` | `{topic, holders[]}` | topic.state +sha | **not manifest fields** — computed via the engine's own `lib.cjs` derivations (epic detail join); the watcher diffs the derived views for these two, raw manifests for everything else |
| `source.state-changed` | `{topic, source, to}` | topic.source.to +sha | `sources.{name}.status` / `consult_references.{name}.status` diff |
| `buildorder.changed` | `{ordering}` | hash(ordering) +sha | `order` fields diff |
| `commit.landed` | `{sha, subject, scope[]}` | sha | HEAD poll |
| `artifact.updated` | `{path, hash}` | path.hash | content-hash change (debounced) |
| `triage.changed` | `{phase, topic, count}` | phase.topic.count +sha | `.triage/{topic}/` listing diff **and** the `status: triaged` manifest stub — both named sources |
| `agent.dispatched` / `agent.returned` | `{agentType, id}` | agent id (+state) | agent-store `state.json` row transitions (live-layer only until the store lands in a commit) |
| `comment.added` | `{gateId?, artifact?, author}` | comment id | bridge (Phase 6) — UI-native, durable in SQLite not git; carries `seq` from the same counter |
| `presence.changed` | `{rows}` | scan hash | `scanPresence` poll — live-layer only, by nature |
| `inbox.changed` / `roadmap.changed` | counts / items | content hash +sha | listing / project-manifest diff |
| `gate.opened/answered/resolved` | card / `{gateId, via}` | gateId.state | session manager — live-layer; the ledger (SQLite) is their durable record |
| `session.started/ended` | `{address, sdkSessionId}` | bridgeSessionId.state | session manager |
| `digest.emitted` | `{channel, itemCounts}` | digest id | scheduler |

## The spine function — net-effect semantics

```
spine(repo) = for each first-parent commit C touching .workflows/**:
                diff(manifest@C-parent, manifest@C) → durable events, ts = C.authorDate
```

**Stated honestly:** under this repo's own branch-first workflow, a merge or squash
attributes the branch's net manifest evolution to one commit — intermediate transitions
observed live are collapsed or absent from the spine. The durable stream is a
**net-effect history**, and that is the accepted semantics; clients wanting finer grain
had the live layer at the time. (Walking all commits rather than first-parent was
considered and rejected: it double-counts across merge topologies.)

The channel spine (UI) renders {gates, `phase.completed`, `workunit.status-changed`,
`workunit.removed` (tombstones)}; everything else feeds threads, the drawer, digests,
badges.

## Delivery

Durable events: at-least-once, ids idempotent (occurrence-unique by construction),
totally ordered by `(epoch, seq)`. Live events: best-effort, unordered relative to the
durable stream, dropped freely. Push decisions are **not** re-derived from redelivered
events — the push ledger (spec 5) arbitrates.
