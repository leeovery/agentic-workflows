# Code Quality

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Apply standard quality principles. Defer to project-specific skills for framework conventions.

## Principles

### DRY: Don't Repeat Yourself
- Extract repeated logic after three instances (Rule of Three)
- Avoid premature abstraction for code used once or twice

### Compose, Don't Duplicate
When new behavior is the logical inverse or subset of existing behavior, derive it from the existing abstraction rather than implementing independently. If you have a query for "ready items," the query for "blocked items" should be "open AND NOT ready" — not an independently authored query that could drift. Prefer mathematical relationships (derived = total - computed) over parallel computations that must be kept in sync.

### SOLID
- **Single Responsibility**: Each class/function does one thing. Multi-step logic should decompose into named helper functions — each step a function, each name documents intent.
- **Open/Closed**: Extend behavior without modifying existing code
- **Liskov Substitution**: Subtypes must be substitutable for base types
- **Interface Segregation**: Don't force classes to implement unused methods
- **Dependency Inversion**: Depend on abstractions, not concretions

### Cyclomatic Complexity
Keep low. Fix with early returns and method extraction.

### YAGNI
Only implement what's in the plan. Ask: "Is this in the plan?"

### Concrete Over Abstract
Prefer concrete types over language-level escape hatches that bypass the type system. Use specific types for data passing between layers, not untyped containers. If you need polymorphism, define a named interface/protocol with specific methods — don't pass untyped values. If you find yourself writing runtime type checks or casts inside a function, the signature is too abstract.

## Testability
- Inject dependencies
- Prefer pure functions
- Avoid hidden dependencies

## Comments

The right number of comment lines is zero. Every line above zero earns its place against that bar, and a comment that earns it is as right as none. Code shows what; a comment carries only what the code cannot. Before writing one, make it unnecessary — rename, extract, simplify — and comment what survives.

A comment is bound to the code beside it and checked by no compiler or test. Code moves; the comment stays and turns false. Comment volume only grows as a project matures. Every stale or wrong comment is a finding the task reviewer or the review phase raises, and a loop the phase runs again to fix it — tokens, money, and time spent on text that did no work. Never writing the comment is the one fix that costs nothing.

Keep each one as short as it can be, written to outlive an edit: a comment that still holds when the code beside it changes, or that plainly goes with the line it names, is written right. A comment that restates the code is bound to it and stale on the first edit.

**A comment is warranted for** — each one an instance of the test above, never a licence beside it:
- **Opaque what** — behaviour not immediately obvious from the code and still opaque after refactoring: a regex, a bit trick, a dense algorithm, a pattern that is hard to follow
- **Deliberate-looking-wrong** — a mechanism that looks like a mistake, or like the obvious simplification, and is kept on purpose; surprising behaviour, consequences ("not thread-safe", "order matters: the read precedes the discard"). Name the trap in a line
- **Why** — a non-obvious reason the code is this way: a constraint imposed from elsewhere, an ordering the next line relies on. Stated as a fact, never as the reasoning that reached it
- **API doc** — on an exported symbol, per the language's own conventions, for what the signature cannot say: units, error behaviour, a contract the types do not encode. Being exported warrants nothing on its own; a symbol its signature already explains gets no doc

**Never in a comment:**
- What the code does — the code says it. Restated adjacent code, changelog narration, attribution, commented-out code
- Reasoning, history, or anything the specification or plan holds. State the conclusion the code needs ("sorted before dedup — dedup keys on adjacency"), never the argument that reached it; a wrong specification or plan is corrected there, through the corrigendum path — a comment is never the patch
- Links, URLs, issue ids, or any workflow vocabulary — task ids, phase numbers, spec-section citations. The comment must hold true for a reader with no knowledge of the process that produced the code, long after its artifacts are archived
- Claims about tests — what a test pins, catches, or proves. A renamed test or moved assertion turns the claim into a confident lie
- Cardinality claims — "the single caller", "the only site that…", "nothing consumes this yet". Falsified by ordinary additive change far from the comment
- Worked examples and hand-traced values. An example worth keeping is a test, where it executes

A comment count or share is never a target and never a win. A file whose comments are a visible fraction of its lines has failed the test somewhere; the remedy is deleting the comments that fail it, not reducing a number.

When a change makes a nearby comment false, fix it in the same edit — and prefer deleting the claim to re-arguing it.

### Comment corrections

Where an output format names a comment-correction shape, a finding whose entire remedy is comment text is reported there — the file and line, what is wrong, the OLD text verbatim, the NEW text (empty to delete) — never as a finding. A correction must itself clear the bar above: a comment earns its place only by carrying what the code cannot, and a comment that cannot is deleted, never reworded.

## Anti-Patterns to Avoid
- God classes
- Magic numbers/strings
- Deep nesting (3+)
- Long parameter lists (4+)
- Boolean parameters
- Untyped parameters when concrete types are known at design time
- Substring assertions in tests when exact output is deterministic

## Project Standards
Check `.claude/skills/` for project-specific patterns.
