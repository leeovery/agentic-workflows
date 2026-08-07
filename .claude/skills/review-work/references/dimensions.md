# Review Dimensions

One finder agent per dimension. Each agent gets its dimension's checks
verbatim, the file and commit scope, and the design source.

Pick the dimensions the diff can actually violate — a change that touches
no engine code does not need **F**; a change that touches no prose does not
need **B** or **C**. When in doubt, dispatch it.

---

## A. Convention adherence

Read **CLAUDE.md and CONVENTIONS.md in full** before reading the diff. They
are dense, exact, and frequently updated; pattern-matching from sibling
files has repeatedly shipped silently non-compliant work.

- Display and output conventions — visual hierarchy, phase titles, step and
  sub-step markers, signpost blockquotes, list display, status terms,
  callout flags, dividers, menus, bullet characters, spacing.
- Structural conventions — stop-gate wording (`**STOP.**`, exactly),
  heading hierarchy, step numbering, navigation arrows, command preludes,
  reference file headers and structure, the zero output rule, auto-mode
  gates.
- Skill file structure — the backbone, the `## Instructions` load directive
  pointing at `framework.md`, load directive format, reference file naming.
- Prose economy — the exact words to describe the task perfectly. WHY cut
  where WHAT suffices, and no instruction, path, or distinction the agent
  needs removed in the name of brevity.
- Presentation register, and the line between it and stored artifact prose.
- Output format names appear **only** in the three sanctioned places named
  by CLAUDE.md. Anywhere else is a violation.
- No convention invented for the occasion. This project is mature and
  usually already has one. Where a genuinely new pattern seems needed, that
  is a finding for the user to agree, not a decision to make in the diff.

## B. Historical artefacts and meta-information

Skill and reference files are instructions Claude executes, not a record of
how they were built. Every file must read as though authored fresh, right
now, with the current behaviour the only behaviour it has ever had.

- Historical references — "formerly", "used to", "previously", "now
  changed to", "this replaces", "no longer", "as of", "renamed from".
- Change markers — "(new)", "(updated)", "note:" additions explaining that
  something changed, rationale bolted on to justify a shape against its
  predecessor.
- Migration backstory and changelog narration inside instruction prose.
- Dangling references to what was replaced — a pointer to a deleted
  section, a removed file, a renamed step, a retired manifest field, or a
  behaviour that no longer exists.
- Stale vocabulary a rename missed — the old term surviving in prose,
  headings, examples, engine strings, test fixtures, or golden snapshots
  while the code moved on.
- Commentary addressed to a human reviewer rather than to the executing
  agent.
- Guard piles: defensive prose stacked to protect against the old
  behaviour, where the new design already makes the case impossible.

## C. Routing, reachability, and dead ends

Walk the prose as a graph and prove every path terminates somewhere real.

- Every `Proceed to`, `Return to`, and load target exists and is spelled as
  the destination writes itself.
- Every section has at least one inbound edge. Unreachable prose is a
  finding regardless of how correct it reads.
- Every branch set covers its cases, first-match-wins ordering intact, no
  gap where none of the conditions hold.
- Every gate has an exit on each answer, including the refusal and the
  ambiguous answer.
- Every loop has a termination condition that the loop body can reach.
- A step reached from two callers reads correctly for both — a section
  edited for one entry path is the classic way this breaks.
- No step whose only exit is back into a step that routed to it.

## D. Behaviour, regressions, and the agreed design

Compare against the design source, not against plausibility.

- Everything agreed is implemented; nothing implemented was not agreed.
- Nothing removed silently. A capability, branch, option, or guard that
  disappeared from the diff without being discussed is a finding.
- Changes are additive or strictly better. A change that keeps behaviour
  identical is fine; a change that narrows it needs to have been agreed.
- No unexpected breakage in a surface the change was not aiming at.
- Ambiguities and false paths — instructions an agent could reasonably
  execute two different ways, and instructions that describe a path the
  system cannot take.
- Behaviour that only works because of a coincidence — an ordering, a
  leftover field, a default that happens to be right.

## E. Cross-surface consistency

A change lands in one place and is owed in several. Enumerate them.

- Prose in every skill and reference that names the changed thing, not just
  the one edited.
- Engine code, its render surfaces, and the strings it emits.
- Tests, fixtures, goldens, and the pipeline simulation.
- Prose-test cases — `case.json` invariants, `act.md`, `assert.md`,
  fixtures and state files.
- Migrations, where the change moves stored state.
- README, CLAUDE.md, and CONVENTIONS.md, where the change alters what they
  document. Documentation is owed where the user's primary action lives.
- Terminology consistent across all of the above, in both directions: the
  new term everywhere it is owed, and the old term nowhere.

## F. State, engine, and gate contracts

- State is engine-owned. Durable state in the work-unit manifest, ephemeral
  session machinery in the per-topic cache `state.json`. No state in
  frontmatter, none encoded in prose or headings, none in a file marker.
- Every manifest field the prose reads or writes exists in the engine's
  field surface, at the right access level for its dot-path depth.
- Every engine verb invoked exists, with the arguments and the response
  shape the prose then consumes.
- Values that zsh would interpret are single-quoted in every documented
  call.
- Gate modes are tracked in the manifest — every gate, no exceptions, so
  they survive a context refresh.
- Migrations read and write `manifest.json` directly and never call
  `engine manifest`. Shipped migrations are never edited; a correction is a
  new numbered migration.

## G. Test and gate coverage

- The pipeline simulation is updated for any new engine verb, changed prose
  call sequence, new phase ordering, or new manifest field. A red
  simulation is a decision to make, never something to paper over.
- A test lands alongside any change to engine scripts, adapters,
  migrations, or `src/knowledge/`.
- New `.cjs` migrations have a matching node:test suite, registered in
  `package.json`, covering happy path, skip, idempotency, content
  preservation, and every defensive guard.
- Snapshots regenerated through the runner, never hand-edited, with the
  display width pinned.
- The knowledge bundle is rebuilt and committed alongside any
  `src/knowledge/` change.
- Where a finding in any other dimension describes a failure the gates
  would not have caught, the missing case is itself a finding.
