# Prose tests

End-to-end tests for the prose logic. A case is Given-When-Then: a world
is **arranged** from a committed fixture, an agent **acts** by walking the
real skills as a live session would, and a second agent **asserts** the
resulting trace and world. Design and contract:
[design/prose-tests.md](../../design/prose-tests.md). Run via the
`/prose-test` skill; everything deterministic lives in `run.cjs` and
`lib/`.

## Layout

- `{case-id}.md` — one case per file, filename = case id, flat. Nothing
  groups cases but their `files:` scope, which is what selection runs on.
- `stubs/{name}.md` — a named substitution: description above a `---`
  fence, exact bytes below. The **case** says when it fires.
- `fixtures/{name}/recipe.cjs` — builds a world with real engine calls
  under a frozen clock (`lib/fake-clock.cjs`)
- `fixtures/{name}/snapshot/` — the recipe's committed golden output;
  regenerate with `node tests/prose/run.cjs snap {name}`, never hand-edit
- `run.cjs` — `list · select · world · prompt · diff · assert · snap · verify · destroy`

## Writing a case

**The `when` stays coarse — one instruction.** Where to enter, what to
follow, where to stop. Never a step-by-step script of the workflow: if
the case tells the walker which commands to run, the walker no longer has
to derive the path from the prose, and the case would pass with the skill
file deleted. That derivation is the thing under test.

**The `then` is granular.** A step-by-step expected trace is what catches
a walker that silently course-corrected around broken prose — the
divergence shows up as a trace mismatch instead of relying on the walker
to confess. Plus `world_after`: a fixture name, or `unchanged` when the
walk should leave the project exactly as it found it.

**Name behaviour, never coordinates.** Step numbers, arm letters, and
heading numbering break on cosmetic renumbering — failure for the wrong
reason. Write "casing conventions load before the boot pipeline", not
"Step 0.1 before Step 0.2". Anchors are substring fragments matched
against heading text (`#Boot` matches "Step 0.2: Boot").

**Scope `files:` tightly** — diff-selection and the PR-end suggestion run
off it.

## Stubs

Prose that dispatches a background agent, or that runs an unscripted
conversation, is walked with that part substituted. A stub is named
content; the case that arms it declares the moment. Stubs sit in `when`
beside `answers:` — both are harness input consumed *during* the act,
and `given` is the world and nothing else:

```
### when
{the walk instruction}

answers:
1. yes — run root cause validation

stubs:
  - root-cause-validated: when the prose dispatches the validation agent
```

The trigger belongs to the case, not the stub, so one stub serves many
moments — first dispatch versus re-dispatch, happy path versus recovery.
A stub with no trigger is arrange in disguise, and validation rejects it.

**Whatever a stub covers is not under test in that case.** Stubbing a
discussion's session loop means some other case must walk that loop
without stubbing it. The stub boundary is a scope decision, not a
convenience.

## Assertion

Deterministic where it can be, judged where it can't. Code computes the
factual delta between the acted world and the expected world; the
asserting agent classifies every difference as volatile (timestamps, git
SHAs, engine-allocated ids) or material, and checks the trace against the
transcript with quoted evidence. No normalisation and no expected-value
literals: the expectation is a whole committed world, built by a recipe,
reviewable as a diff against the world it started from.

`npm test` validates the corpus (parse, paths, anchors, worlds, stubs,
traces) and rebuild-compares every fixture — both token-free. Only
`/prose-test` spends tokens.

## Snapshot escaping

Snapshots exclude `.git/`, `.workflows/.knowledge/` (the world builder
re-derives the store) and `.claude/skills|agents/` (copied into live
worlds, never part of a fixture), and store `.gitignore` files as
`_gitignore.fixture` so the product-written `.workflows/.gitignore`
cannot ignore fixture content out of this repo.
