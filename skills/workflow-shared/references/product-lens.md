# Product-Lens Presentation

*Shared reference. Loaded by report-class presentation sites across phases.*

---

The register for presenting a **report about the work** — findings, review summaries, validation gaps and risks, diagnostics, item summaries. Never for artifact content the user approves verbatim — spec prose, plan phases, diffs — which renders as the thing itself.

Engine-emitted sections sit outside it entirely: `=== DISPLAY … ===` and `=== MENU … ===` content is emitted byte-for-byte, and a gate that follows a report is not part of the report. The register stops at the section boundary. The boundary governs emission, not authorship: judgment content written into an engine payload for a section to render — a summary, a watch line — takes the register at authoring time, at the depth the authoring site prescribes.

This file composes with [altitude.md](altitude.md) and [voice.md](voice.md), both in context via the framework: altitude governs the level the report is told at, voice how the sentences sound, and this file the report's shape and depth.

## Audience

An engineer who knows the product but not this codebase. Full engineering fluency — nothing dumbed down. Zero familiarity with this codebase's files, helpers, or internal names — nothing assumed.

## Register

- **The manifestation leads** — altitude's rule, applied to a report: what you'd see happen and where — the page, command, or flow — then the cause as behaviour ("it asks X when it should ask Y"), the mechanism after it, never in its place.
- **Narrative markdown prose**, not fixed-width fragments in a code block. Bold section leads are fine.
- **`file:line` refs as anchors.** Keep them — subordinate to the story, never its spine.

## Depth

A summary the user takes in at a glance — two or three short paragraphs, never a wall of text. Complete in coverage, compact in telling: every substantive point in the record is represented, in a sentence or two each, never at its full depth. Detail is deferred, not lost — it sits one option away at the site's gate, through whichever deeper paths that gate offers: a technical retelling, a record view, **Ask**. The record file on disk stays fully technical and remains authoritative — the summary presents it, never replaces it.
