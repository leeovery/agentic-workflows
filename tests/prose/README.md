# Prose tests

End-to-end tests for the prose logic. A case arranges a world from a
committed fixture, an agent acts by walking the real skills as a live
session would, and a second agent asserts the resulting path and world.
Design and contract: [design/prose-tests.md](../../design/prose-tests.md).
Run via the `/prose-test` skill.

## A case is a directory

```
cases/{case-id}/
  case.json             the values code branches on
  fixture.md            optional — prose describing the starting world
  fixture-state.cjs     builds that world, in engine calls
  act.md                the coarse instruction given to the walker
  assert.md             the expected path, given only to the asserter
  assertion-state.cjs   optional — builds the world the walk should produce
  fixture/              generated snapshot
  assertion/            generated snapshot
```

**Nothing is parsed.** JSON is JSON, prose files are read whole and
relayed into prompts, recipes are `require`d as modules. There is no
format to mis-read: a value code branches on lives in `case.json`, and a
blob code merely relays lives in markdown.

`act.md` and `assert.md` are separate files because that is the
walker/asserter boundary — the walker must never see the expected path,
and a file boundary enforces that structurally rather than by convention.

A case whose end state only prose can describe sets `"world": "claims"`
in `case.json` and carries no `assertion-state.cjs`. The delta is then
computed against the **fixture** — expected to be non-empty — and judged
against the case's stated claims. Reach for it only where the
variability is genuinely the model's to decide: a discussion's subtopic
names are derived from context and differ run to run, so no recipe can
pin them. A world a recipe *can* build must be built.

`fixture-state.cjs` and `assertion-state.cjs` are separate because they
change for different reasons: the fixture when the precondition changes,
the assertion when the prose's *behaviour* changes. The assertion state
composes the fixture state plus whatever the walk should have done. A
case with no `assertion-state.cjs` expects its world back untouched — a
start that refuses, a menu that only hands off — and that is a strong
claim in itself.

What a snapshot cannot hold directly, a recipe declares in a **sidecar**
the snapshot carries and materialise turns into real world state, never
landing in the world itself: `.world-history.json` (layered commits),
`.world-presence.json` (heartbeats a peer session holds — presence files
are excluded from every snapshot as timing noise) and `.world-dirt.json`
(paths held out of the world's commits). `lib/worlds.cjs` states each
shape.

Shared pipeline stages live in `mainlines/{work-type}.cjs`, so a
fixture-state is usually three lines of composition. Worlds are per-case
and duplication is accepted: a case you can read in one directory beats
a deduplicated fixture library you have to chase across the tree.

## Where a case starts and stops

**A case starts where a session starts.** `entry` names a skill a
conversation opens on — one of the engine's `OPENING_SKILLS`
(`domain/handoff.cjs`): `workflow-start`, or a skill a handoff lands the
work on in a fresh context. Never a skill only ever opened in place (help,
the linear continue menu, the bridge, the legacy research split — a case
about help enters at `workflow-start` and picks `h/help`), and never a
reference: a walk begun mid-session lacks the context the prose was
written for (`lib/cases.cjs`).

**A handoff ends a walk.** The walker's `Bash` hook
(`lib/announce-handoff.cjs`) stands in for the gate mod, so `engine
handoff` answers `mod` and the prose ends the turn at the recorded call —
a walk never runs on into the skill a handoff names. A handoff is a fine
ending. What a case must never do is stop where only display claims
remain, since text put on screen is evidenced by no hook.

## Writing a case

**Never generate a case from a walk.** Recording what the prose did and
calling it the expectation turns the corpus into approval testing —
every case pins current behaviour, defects included, and a mummified bug
passes forever. Snapshots are generated because the engine authors them
and drift is visible; expectations are written by hand because only a
person can say what correct means. The reading-closely part is where
pre-existing defects surface.

**The act stays coarse — one instruction.** Where to enter, what to
follow, where to stop. Never a step-by-step script of the workflow: if
the case tells the walker which commands to run, the walker no longer has
to derive the path from the prose, and the case would pass with the skill
file deleted. That derivation is the thing under test.

**The assertion is granular.** A step-by-step expected path is what
catches a walker that silently course-corrected around broken prose —
the divergence shows up as a mismatch instead of relying on the walker to
confess it.

**Name behaviour, never coordinates.** Step numbers, arm letters and
heading numbering break on cosmetic renumbering — failure for the wrong
reason. Write "casing conventions load before the boot pipeline", not
"Step 0.1 before Step 0.2". Anchors in `case.json` are substring
fragments matched against heading text (`#Boot` matches "Step 0.2: Boot").

**Claims state the expected shape — they never defer to a file.** "The
file is shaped by the template" outsources the expectation to a document
the asserter cannot fully see: file *reads* are truncated in the record
(writes are kept whole), so template-equivalence is unanswerable from
the evidence. Enumerate the shape instead — "holding Symptoms, Analysis,
and Fix Direction sections, and no others" — which the write record
answers completely. Naming which
reference *fed* a step ("created from the template") is fine in the
path; it is the world claims that must carry their own expectations.

**Assert what actions and state can prove.** A claim about something
*displayed* — "offers the choice and waits", "emits the summary block" —
rests on the walker's show write: it puts every block it shows through
one Write to `.walk-shown.txt`, and the harness lifts each into the walk
as a `SHOWN` entry. The block is then on record whole, but what went into
it is the walker's own composition, the one piece of evidence it authors
itself. Most have a consequence that can be
asserted instead: the answer that was consumed, the arm that was taken,
the state that resulted. Prefer the consequence; keep display claims for
where the display genuinely is the behaviour under test, and expect them
to be the weakest line in the case.

**Scope `files` tightly** — selection and the PR-end suggestion run off
it. It names the prose the walk actually traverses, not everything
reachable: harvest it from a real run's scope-lint markers rather than
following Load links (a crawl includes branches the case deliberately
stops before), and treat it as a ratchet — walks vary between runs, so a
later run may surface a file the first did not. The lint reports files
*opened*; a file read only to decide a branch that was not taken is not
walked, and stays off the list.

## Playing the user

The walker plays the user, two ways, declared in `case.json`:

**`answers`** is a queue — one entry per question, consumed in arrival
order at discrete gates (menus, yes/no prompts, named questions). Use it
where each question has one right response.

**`conduct`** is a description of the *person* — used where the prose
explores open-endedly (interviews, shaping conversations) and there is no
fixed number of turns to script. The walker answers as that person would,
in their words, for as long as the prose keeps asking. Give them concrete
knowledge, honest gaps ("they do not know the file names"), and
dispositions ("takes the simplest option that adds no external
dependencies") — a disposition can carry a menu choice, but pin any
outcome the case depends on with an invariant rather than trusting the
roleplay.

**Never mix them when an open stretch precedes a scripted gate.** The
queue is consumed in arrival order, so an interview before a menu eats
the menu's answer. Prefer conduct-only in such cases.

**Conduct describes the user, never the walk.** It must not name an arm,
end a step, or hint at what the prose ought to do — that is the same
boundary that keeps `assert.md` away from the walker. A described user
who would happily stop talking is not permission for the walker to cut a
loop the prose has not ended.

A stub *replaces* prose, so what it covers goes untested in that case;
conduct keeps the prose live. Where the prose can genuinely run against a
played user, prefer conduct.

## Stubs

Prose that dispatches a background agent, or runs an unscripted
conversation, is walked with that part substituted. A stub is named
content in `stubs/{name}.md` — description above a `---` fence, exact
bytes below — and the case arming it owns the moment:

```json
"stubs": {
  "root-cause-validated": "when the engine records a dispatch of kind root-cause-validation"
}
```

The trigger belongs to the case, not the stub, so one stub serves many
moments — first dispatch versus re-dispatch, happy path versus recovery.
A stub with no trigger is a fixture in disguise, and validation rejects it.

**Every dispatch is held.** The walker makes the Agent call the prose
composes — the agent, the inputs in its prompt, the background flag —
and a PreToolUse hook in its definition (`lib/hold-dispatch.cjs`)
records the call whole into the world (`.walk-dispatches.jsonl`, plus a
`held` row in the action log) and refuses it, so no agent ever runs in a
world. The walker then applies the stub whose trigger names that moment,
or reads the agent's file and plays it where none does. What a dispatch
carried is claimed in `case.json`'s `dispatches` invariant — entries of
`{agent, nth?, count?, carries?, lacks?}` matched against the whole
recorded call, `carries`/`lacks` holding for every dispatch of the agent
or for the `nth` alone — and ordered by a `dispatch:<agent>` token in
`calls_in_order`, which stands for that agent's next held dispatch. A
held dispatch's refusal names its id; where the prose continues that
agent, the walker sends to the id with SendMessage and the same hook
holds the send — claimed by a `dispatches` entry carrying `send: true`
and ordered by a `send:<agent>` token. A dispatch or send the walker's
transcript shows with no held record is written `UNHELD` at its stop,
and `run.cjs assert` refuses to judge that world.

**A trigger names an observable event, not a narrative moment.** An
engine call with its arguments, a specific menu appearing, a named file
being created — something the walker can match with certainty and that
shows up in the transcript, so the asserter can confirm the substitution
fired where it should have.

**Whatever a stub covers is not under test in that case.** Stubbing a
discussion's session loop means some other case must walk that loop
unstubbed. The stub boundary is a scope decision, not a convenience.

## Assertion

Claims code can settle belong in `case.json`'s `invariants` —
`engine_before_write` (declared only where the walk writes),
`calls_include`, `calls_exclude`, `calls_in_order` (whose `write:<path>`
token stands for the path's first recorded write, and `dispatch:<agent>`
/ `send:<agent>` for that agent's next held dispatch or send), and
`dispatches`. They run before the asserter, and its verdict cannot
overturn theirs; `lib/invariants.cjs` states each.

Code computes the factual delta between the acted world and the expected
world; the asserting agent classifies every difference as volatile
(timestamps, git SHAs, engine-allocated ids) or material, and checks the
expected path against the transcript with quoted evidence. No
normalisation table, no expected-value literals: the expectation is a
whole committed world, built by a recipe, reviewable as a diff against
the world it started from.

## The gate

`npm test` validates the corpus and rebuilds every snapshot to
byte-compare it — both token-free, and this repo's only gate since there
is no automated CI. Rebuilds are skipped when nothing feeding a world has
changed; the hash covers each case's recipes, the shared mainlines, and
the engine's sources, so an engine change invalidates every hash and
forces a full rebuild. The hashes live in a gitignored local cache
(`tests/prose/.cache/`) the verify keeps itself — a byte-identical
rebuild records its hash, a drift records nothing — and rebuilds fan out
over a thread pool a core short of the machine (`lib/verify-pool.cjs`).
Only `/prose-test` spends tokens.

Snapshots exclude `.git/`, `.workflows/.knowledge/` (checkout-local — the
world builder sets it up afresh, never committed) and `.claude/skills|agents/` (copied into live
worlds, never part of a world's own state), and store `.gitignore` files
as `_gitignore.fixture` so the product-written `.workflows/.gitignore`
cannot ignore snapshot content out of this repo.

A rebuild that drifts means a world moved: CLAUDE.md's Prose tests rules
say how a world is regenerated.

## Running walks

Walks run through `/prose-test`; when to run them, and what a change owes
the corpus, are CLAUDE.md's Prose tests rules. Each orchestrator records
its verdict in the gitignored verdict store
(`node tests/prose/run.cjs verdict <case-id> --file <path>`,
`lib/verdicts.cjs`) before it hands back, and the skill collates from the
store.
