# Corrigendum Format Does Not Scale, and Ignores a File's Established Form

## The Idea

`workflow-shared/references/correcting-historical-artifacts.md` prescribes a single corrigendum shape — a one-line blockquote, "one entry per correction":

```markdown
> **Corrigendum {YYYY-MM-DD}** (from `{correcting_work_unit}`): {original claim, quoted} — corrected: {what is true}.
```

Two things are missing from it:

1. **Grouping guidance for large correction sets.** One entry per correction is right for a handful. It is wrong at scale, where the block becomes longer than the sections it annotates.
2. **A rule to match a file's existing corrigendum form.** When a file already carries corrigenda, a new entry in the protocol's shape sits beside them looking like a different kind of artifact.

## Why This Matters

The protocol is loaded precisely when a *completed* work unit's artifact is wrong. Completed units keep their knowledge-base chunks live at full confidence, so the correcting session is often the only one that will ever touch that file — which makes the corrigendum the durable record of what moved and why. A block that is unreadable, or that reads as inconsistent with the entries above it, degrades exactly the artifact the protocol exists to protect.

The scale case is not hypothetical. A feature that renames a shared vocabulary, moves a package, or deletes a setting falsifies clauses across a predecessor spec in bulk — the single amendment ("tokens renamed") lands as dozens of body edits spread over a dozen sections. One entry per *correction* produces a wall; one entry per *affected section* produces something a reader can use.

The established-form case is equally concrete: a file that has been corrected before has already solved this, and its existing entries are the local convention. Diverging from them for the third entry is worse than diverging from the protocol.

## Observed Case

`spectrum-tui-design`'s specification, corrected from `theming-system` (2026-08-07). Roughly 21 falsified clauses across ~15 sections, plus ~69 body lines carrying retired token names — a mechanical 1:1 substitution that is nonetheless a correction the corrigendum must record.

The file already carried **two** corrigendum blocks, both in a richer form the protocol does not describe:

```markdown
> **⚠ Corrigendum — {date} ({owning_unit} {phase}).**
> {lead paragraph: what was revised and why}
> - **§X.Y {short label}.** Superseded: "…" Current: **…** — {reason}.
> - **§X.Z {short label}.** …
> Bodies below were edited in place to match; this block is the only annotation. Original wording is recoverable via `git log -p`.
```

That form groups by section, carries a lead paragraph for the shape of the change, and closes by stating the edit-in-place discipline. It is strictly better at this scale, and it was arrived at independently — twice — by earlier sessions hitting the same wall.

## What the Protocol Should Say

Amend step 2 ("Corrigendum block") with:

- **Match the file's established form when it has one.** If the artifact already carries corrigenda, follow their shape rather than the template's. Consistency within the file beats consistency with the protocol.
- **Group by affected section when the correction set is large.** One entry per correction is the default; past a handful, one entry per section with a lead paragraph stating the shape of the change reads better and stays usable.
- Keep the template as the *minimum* form for a small correction, not as the only form.

## Design Consideration

The template's one-liner is load-bearing for small corrections — it is cheap enough that a session will actually write it rather than skipping the step. Any amendment must not make the small case feel heavy, or the protocol loses the corrections it currently gets. Framing the grouped form as an escalation ("past a handful…") rather than a replacement keeps that property.

Worth checking whether the same scale assumption appears elsewhere in the protocol — the re-index and commit steps are size-independent, but the "present the wrong claim, the evidence, and the proposed correction in the conversation" confirmation is not: presenting 21 findings inline is a different act from presenting one, and a session may need guidance on summarising for the gate while keeping the full list for the corrigendum.
