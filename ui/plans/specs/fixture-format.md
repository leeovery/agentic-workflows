# Spec 4 — Replay fixtures and the recording harness

Revised after the review rounds. Three corrections lead: the recorder no longer requires
Phase 2 components in Phase 0 (the circularity is resolved), adopt-mode's SDK-resume
assumption is demoted to a **[spike]** with a re-priming primary strategy, and `--moment`
is defined so it can actually capture a mid-session world.

**Doctrine:** recorded fixtures are regenerable, never hand-edited — with one carve-out:
the **authored-adversarial corpus** (deliberately malformed inputs a recorder cannot
honestly produce) is hand-written, lives apart under `fixtures/adversarial/`, and is
exempt. "Two menus in one turn" belongs there only to pin the *valid* last-wins
behaviour, not as malformed.

## Layout

```
fixtures/{name}/
├── meta.json          # {productVersion, recordedAt, width, entryPrompt, description,
│                      #  moments: [{gateId, world}]}        ← pause-point ↔ world pairing
├── worlds/{m}/        # one or more captured moments
│   ├── repo.bundle    # committed history
│   └── overlay.tar    # dirty tracked files + .workflows/.cache at the moment —
│                      #   a bundle alone cannot represent mid-session state
├── transcript.jsonl   # the session journal (spec 2's record shapes, verbatim)
└── answers.json       # {gateId: {answer, matchMode: 'exact' | 'key'}} for offline mode
```

World restore: clone the bundle to a tmpdir, untar the overlay over it. Restored
presence records are harmlessly dead-pid (`scanPresence` verifies pid start times).

## Transcript format

The session journal format (spec 2) — one JSON object per line: `meta`, `assistant`,
`tool-use`, `tool-result` (demarcated sections verbatim), `user`, `usage`, `turn-end`,
`result`. `turn-end.ask` carries `{gateId, kind}` when ask detection fired.

`turn-end.ask` markers are produced by the ask-detection pipeline — **at record time
when the recorder is the bridge (Phase 2+), or by an offline re-parse pass over the
journal (Phase 0)**. Either way, replay re-runs detection and the golden asserts the
same gate ids — parser drift lands as a fixture failure.

## Phase 0 vs Phase 2 recording (the circularity, resolved)

Phase 0 has no session manager or parser — so **fixture v0 is converted, not recorded**:
a real workflow session is driven from the *terminal*; the harness ingests the harness's
own session transcript (JSONL on disk) into journal format, snapshots the world manually
at chosen commits (bundle + overlay), and the ask markers are added later by the Phase 2
parser's offline pass (until then, `turn-end.ask` is absent and replay pauses at
`user`-record boundaries instead). Phase 0's replay done-criterion is restated
accordingly: pause-at-recorded-user-turn, not pause-at-detected-ask. The live
`bridge --record` (below) is a **Phase 2 deliverable** that supersedes the converter.

## Replay semantics

- Restore a world, point the watcher at it (real code paths, not mocks); stream the
  transcript with compressed pacing; pause at ask markers (v0: user-turn boundaries).
- **Offline mode (CI):** at a pause, the answer comes from `answers.json`; `matchMode:
  'exact'` asserts the recorded `user` record equals the scripted answer byte-wise,
  `'key'` asserts key-equivalence (the scripted `"2"` matches a recorded `"2"` or the
  option's word). Mismatch fails the run.
- **Adopt mode (dogfooding) — [spike], both mechanics:**
  1. Adoption is legal **only at a pause with a paired world** (`meta.moments` maps
     gateId → world). The recorder snapshots on exit, so an unpaired mid-transcript ask
     has a *future* world — adopting there re-answers a question the world already
     absorbed. Unpaired asks allow offline continuation only.
  2. Going live does **not** use SDK `resume` (the SDK's session store is keyed to the
     original cwd/machine and is not in the fixture). Primary strategy: a **fresh
     session re-primed from the journal** — the transcript-to-date supplied as context,
     cwd = the restored tmpdir. Fallback if re-priming proves unfaithful: capture the
     SDK session directory into the fixture with a defined cwd remap — the spike decides.
  3. **Path safety:** recorded tool results embed the original machine's absolute paths.
     An adopted session runs with Bash cwd pinned to the tmpdir and absolute paths
     outside it refused; the bridge refuses adopt entirely when the recorded project
     path exists on this machine, absent an explicit override flag. A replay must never
     be able to write the real repo.

## The recorder (Phase 2 form)

`bridge --record` tees the live session journal, runs ask detection for markers, and on
exit snapshots the final world. `--moment` snapshots mid-session — **legal only at a
turn boundary with no tool call in flight**: the recorder waits for the boundary,
bundles + overlays (the overlay is what makes dirty state capturable), records the
`{gateId, world}` pairing in `meta.moments`, then releases the stream. Snapshotting
mid-tool-call is refused — a half-written cache file poisons every golden downstream.

## Fixture set

| Fixture | Stage | First needed |
|---|---|---|
| `mid-discussion` | discussion in flight, pending gate, agent report with lanes in cache overlay | Phase 0 (converted) |
| `spec-pending` | sign-off gate open; sources + a consult reference in manifest | Phase 2/4 |
| `delivery-running` | mid-implementation; auto-mode menus in the journal (the phantom-gate regression test) | Phase 3/5 |
| `adversarial/` | authored corpus: truncated menu, reordered rows, paraphrased labels, NBSP variations, two-menus-per-turn (valid, last-wins) | Phase 2 |
| `fixture-day` | the worlds above + a scripted multi-unit event timeline | Phase 3 |

Goldens: `spine(world)` reproduces the committed event list (durable layer, per spec 3's
epoch rules); journal re-parse reproduces the committed card ids. Both regenerate through
the harness.
