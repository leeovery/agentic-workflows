# Discussion: Sub-Level Specials

Fixture for sub-level `special_sections` matching. The chunker's split
level is H2, but `Discussion Map` appears here as an H3 nested inside a
regular H2 section. The `own-chunk` rule says the match fires
"regardless of heading level" — so the H3 Discussion Map should be
carved out into its own chunk.

## Context

Some framing content for the discussion. This stays in the Context
section as a normal H2 chunk — it does not match any `special_sections`
entry.

The content is padded so the overall file clears `keep_whole_below=50`
and the chunker must go through heading parsing rather than the
whole-file gate.

- context line 1
- context line 2
- context line 3
- context line 4
- context line 5
- context line 6
- context line 7
- context line 8
- context line 9

## Plan

This H2 section intentionally contains a `### Discussion Map` child so
we can prove sub-level extraction works. Before the child, there is
some introductory content that should remain under the `## Plan`
chunk.

Plan intro paragraph one. Describes the overall approach and the
constraints that shaped it.

Plan intro paragraph two. Lists the sub-goals and their order.

### Discussion Map

- **Option A** `decided` — Pick A because reason.
- **Option B** `rejected` — Rejected because reason.
- **Option C** `exploring` — Still open.

This is the body of the Discussion Map. When the chunker fires the
sub-level `own-chunk` rule, this content becomes its own chunk with
the `### Discussion Map` heading as its semantic anchor.

### After The Map

Content under this H3 lives inside the Plan section but after the
extracted Discussion Map. It should end up in a separate "tail" chunk
of the Plan section (or — depending on how boundaries fall — its own
regular H3 chunk).

tail line 1
tail line 2
tail line 3
tail line 4

## Summary

Final section at H2. Unrelated to the sub-level special handling —
just here to prove regular H2 splitting still works alongside
sub-level extraction.

summary line 1
summary line 2
summary line 3
