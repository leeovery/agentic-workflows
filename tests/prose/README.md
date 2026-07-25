# Prose tests

End-to-end tests for the prose logic — natural-language cases a walker
agent executes through the real skills against a materialised fixture
world. Design and contract: [design/prose-tests.md](../../design/prose-tests.md).
Run via the `/prose-test` skill; everything deterministic lives in
`run.cjs` and `lib/`.

## Layout

- `{flow}/*.md` — case files (grammar: header comment in `lib/cases.cjs`)
- `fixtures/{name}/recipe.cjs` — builds the world with real engine calls
  under a frozen clock (`lib/fake-clock.cjs`)
- `fixtures/{name}/snapshot/` — the recipe's committed golden output;
  regenerate with `node tests/prose/run.cjs snap {name}`, never hand-edit
- `run.cjs` — `list · select · world · prompt · grade · snap · verify · destroy`

## Adding a case

Add a `## case:` block to the flow's file (or a new file for a long
walk). Scope `files:` tightly — diff-selection and the PR-end suggestion
run off it. `routing:` expects are agent-graded against the walk
transcript; `state:` expects are asserted in code and require a `world:`.

**Name behaviour, never coordinates.** Step numbers, arm letters, and
heading numbering in walk or expect text break on cosmetic renumbering —
failure for the wrong reason. Write "casing conventions load before the
boot pipeline", not "Step 0.1 before Step 0.2"; a behavioural claim
fails only when the behaviour changes, which is the failure the corpus
exists to catch. Anchors are substring fragments matched against heading
text (`#Boot` matches "Step 0.2: Boot") — pick the number-free part.
`npm test` validates the corpus (parse, paths, anchors, grammar) and
rebuild-compares every fixture — both token-free; only `/prose-test`
spends tokens.

## Snapshot escaping

Snapshots exclude `.git/` and `.workflows/.knowledge/` (the world
builder re-derives the store), and store `.gitignore` files as
`_gitignore.fixture` so the product-written `.workflows/.gitignore`
cannot ignore fixture content out of this repo; the world builder
restores them.
