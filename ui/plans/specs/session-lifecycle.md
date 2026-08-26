# Spec 2 — Session lifecycle

How the bridge drives workflow sessions headless. Revised after the review rounds:
invocation model pinned, allowlist generated not enumerated, `CLAUDE_PID` restored,
permission-prompt fallout defined, the bridge lease added, and the session journal made
explicit. `[spike]` marks SDK behaviours verified in Phase 2's first week, each with a
named compensation.

## The bridge lease (single instance)

Before driving anything, a bridge takes a per-project lease —
`.workflows/.cache/.bridge-lease` (gitignored), O_EXCL create with
`{pid, pid_start, host, bridge_id}`, the engine's own stale-break discipline
(dead pid+start → break). A bridge that cannot take the lease runs as a **read-only
mirror with a banner** ("driven from {host}") — no sessions, no pushes, no ledger writes.
Every session env carries `bridge_id`; a bridge never resumes a session whose recorded
`bridge_id` is not its own unless it holds the lease and the owner is provably dead.
This kills the two-bridge fork (FMEA #4).

## Invocation model — pinned

**One `query()` per human turn, answers submitted via `resume`.** Turn-complete = receipt
of the SDK `result` message. (The held-open streaming-input model is the [spike]
alternative; if it proves better the journal and ask-detection semantics are unchanged —
only the transport swaps.)

```ts
query({
  prompt,                          // entry prompts below, or the answer text on resume
  options: {
    cwd: project.root,
    resume: sdkSessionId,          // continuation turns
    permissionMode: 'default',
    allowedTools: ALLOWLIST,       // generated — see below
    env: {
      WORKFLOWS_DISPLAY_WIDTH: '65',
      CLAUDE_PID: String(process.pid),        // [spike] presence keys held/live on it
      CLAUDE_CODE_SESSION_ID: bridgeSessionId, // [spike] must match what SessionEnd hooks see
      BRIDGE_ID: bridge_id,
    },
    settingSources: ['project'],   // [spike]
  }
})
```

**Presence [spike], sharpened:** assert the presence record carries pid/start/session-id
*and* that hook-side cleanup matches the same session id the record holds (the harness's
hook stdin id may differ from an env override — if so, the bridge stops setting
`CLAUDE_CODE_SESSION_ID` and instead sweeps via `presence cleanup <session-id>` itself
on teardown, with the id read back from the presence record).

**Allowlist — generated, not remembered.** Built mechanically at bridge start by
sweeping `skills/*/SKILL.md` frontmatter `allowed-tools` across the installed product
(the review found hand-enumeration verifiably incomplete: cache `rm -rf`/`mv`, `ls`,
`grep`, `rg`, `wc`, `find`, `git bisect/blame/rev-parse`, the legacy-split scripts).
Union + the SDK basics (`Read/Glob/Grep/Write/Edit/Skill/Task`).
**Prompt fallout rule:** a permission prompt firing headless is **denied**, the session
pauses, and the card/queue row flips to `errored` health with the denied command shown
and a "retry after allowlist fix" affordance — never silently auto-approved, never a
hang. Each such event is an allowlist bug logged on the observability floor.

## Entry prompts

| Mode | Prompt |
|---|---|
| Lobby / start anything | `/workflow-start` |
| Continue a work unit | `/workflow-start`, then the session's own continue row key |
| Capture | the capture phrasing as a single turn |
| Adopt-from-replay | **[spike]** — see spec 4; primary strategy is a fresh session re-primed from the journal, not SDK resume |

## The session journal

The bridge tees every SDK event per session to an append-only journal
(`bridge-state/journals/{bridgeSessionId}.jsonl` — same record shapes as the fixture
transcript, spec 4). The journal is UI-native state and the **single source for
re-derivation**: ask ordinals, gate identity, restart recovery, and answer-while-dead all
read the journal tail (SDK resume does not re-stream history). Fixture transcripts are
journals with a world attached.

## Ask detection

Applied at turn-complete, in precedence:

1. A `Bash` tool result carried a demarcated gate/`MENU:` section **whose header
   instruction says STOP** → structured card (`source: 'tool-result'`, relay diffed).
   Sections carrying the auto-mode *"do not stop; continue"* instruction are context,
   never asks — auto-run implementation turns emit menus they immediately sail past, and
   carding one injects a stray key later (the phantom-gate bug).
2. No engine section, but turn-final text parses under the option grammar → structured
   card (`relay`/`prose`).
3. Turn-final text otherwise → pass-through open ask.
4. `result` indicates completion/error → no gate; `session.ended`.

Multiple STOP menus in one turn: the last is the ask, earlier ones render as context.

## Answering

An answer is an ordinary user turn, submitted under the session mutex (spec 1's
serialized state machine): card → `answering` (CAS — a concurrent submit sees "already
answered by …") → `query({resume, prompt: answer})`. **Answer-while-dead:** resume, let
the stream settle, re-derive the tail gate id from the journal; match → inject; mismatch
→ card flips to `resolved-externally`/`stale` and shows the new state. Injection happens
with the session loop held; the turn is tagged with the gate id so post-hoc divergence
resolves visibly.

## Health states

| State | Definition | UI |
|---|---|---|
| `live` | stream active within T_live (30s) **or a tool call is in flight** | quiet |
| `idle-at-ask` | open gate awaiting input | escalation clock runs (spec 5) |
| `stalled` | no events for T_stall (120s) **between messages, with no tool call in flight** — agent dispatches legitimately run minutes and never trip this | spinner + elapsed |
| `errored` | SDK error / rate limit / denied permission | card + row show it, resume affordance |
| `dead` | process gone, resumable | resume-on-demand |

## Lifecycle rules

- One live session per (workUnit, topic) activity; **the lobby holds at most one shaping
  session per human, with an explicit end-shaping affordance** (zero-residue by design)
  **and an idle-timeout** (default 4h) that retires the session and frees the slot — the
  thread stays readable until replaced. Parks/inbox notes confirmed mid-shaping persist
  per the product's own exceptions.
- Presence consulted before entering a topic (research/discussion heartbeats;
  lock-mtime/commit heuristics elsewhere, labelled best-effort), confirm-gated exactly
  as the epic view does.
- `sessions` table: `{bridgeSessionId, sdkSessionId, bridge_id, address, startedAt,
  lastEventAt, state}`. Restart: verify lease → resume open-gated sessions → re-derive
  asks from journals → rebuild the live queue tier. Unresumable sessions are surfaced,
  never dropped.
- Cost counters per session on the observability floor; daily budget warning is config.
- Teardown: run compensations ([spike] results permitting), close the journal, emit
  `session.ended`.
