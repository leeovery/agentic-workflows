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

`fixture-state.cjs` and `assertion-state.cjs` are separate because they
change for different reasons: the fixture when the precondition changes,
the assertion when the prose's *behaviour* changes. The assertion state
composes the fixture state plus whatever the walk should have done. A
case with no `assertion-state.cjs` expects its world back untouched —
which is most entry-skill cases, and a strong claim in itself.

Shared pipeline stages live in `mainlines/{work-type}.cjs`, so a
fixture-state is usually three lines of composition. Worlds are per-case
and duplication is accepted: a case you can read in one directory beats
a deduplicated fixture library you have to chase across the tree.

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

**Scope `files` tightly** — selection and the PR-end suggestion run off it.

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

**A trigger names an observable event, not a narrative moment.** An
engine call with its arguments, a specific menu appearing, a named file
being created — something the walker can match with certainty and that
shows up in the transcript, so the asserter can confirm the substitution
fired where it should have.

**Whatever a stub covers is not under test in that case.** Stubbing a
discussion's session loop means some other case must walk that loop
unstubbed. The stub boundary is a scope decision, not a convenience.

## Assertion

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
the engine and knowledge sources, so an engine change invalidates every
hash and forces a full rebuild. Only `/prose-test` spends tokens.

Snapshots exclude `.git/`, `.workflows/.knowledge/` (the world builder
re-derives the store) and `.claude/skills|agents/` (copied into live
worlds, never part of a world's own state), and store `.gitignore` files
as `_gitignore.fixture` so the product-written `.workflows/.gitignore`
cannot ignore snapshot content out of this repo.
