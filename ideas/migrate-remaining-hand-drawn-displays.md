# Migrate the Remaining Hand-Drawn Displays

## The Idea

Move every templated display still hand-drawn in skill prose into the
engine, in one focused, considered pass. CONVENTIONS' "touching a file
adopts its displays" converges the corpus file by file; this finishes it
deliberately instead of waiting for each file to be touched.

## Where They Are

The authoritative list is the conventions lint's ratchet,
`RATCHET_PINS` in `tests/scripts/test-conventions-lint.cjs` — every file
that still carries a templated menu or display fence, with its count
(47 files, 78 fences when this was logged). The ratchet only tightens, so
it never lists a site that no longer exists. Examples:

- `workflow-start/SKILL.md` — "Migrations Applied … {N} migration(s), {M}
  file(s) updated." and the two "All documents up to date." blocks.
- `workflow-start/references/inbox-working-set.md` — the `@foreach`
  full-content view.
- `workflow-implementation-process/references/analysis-loop.md` — the
  pre-analysis checkpoint's unexpected-files list.
- `workflow-legacy-research-split/references/dialog.md` — the `@foreach`
  warning list.
- `workflow-planning-process/references/author-tasks.md` — the aligned
  two-column display.
- `workflow-start/references/knowledge-gate.md` — the `@if` templates.

Prose-authored blockers and terminal messages stay prose, as CONVENTIONS
allows.

## Where It Came From

The function-hook gates review (2026-09-24). That programme's sweeps —
the per-marker wording normalization, the Step 0 renumbering — touched
most of these files with mechanical edits. Lee exempted mechanical sweeps
from the touch rule for that stack only, to keep its surface area down,
and asked for the displays to be tracked and migrated in a separate,
focused update.

## Shape

- One display surface per template, wording preserved; judgment content
  (a summary the model writes) through a validated payload file, state
  from the manifest.
- Each call site becomes the fetch and the emission; each ratchet pin
  shrinks to zero and its entry goes.
- Goldens and render-surface tests per surface; the simulation where the
  call sequence changes.
