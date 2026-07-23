# Product-Lens Presentation

*Shared reference. Loaded by report-class presentation sites across phases.*

---

The register for presenting a **report about the work** — findings, review summaries, validation gaps and risks, diagnostics, item summaries. Never for artifact content the user approves verbatim — spec prose, plan phases, diffs — which renders as the thing itself.

## Audience

An engineer who knows the product but not this codebase. Full engineering fluency — nothing dumbed down. Zero familiarity with this codebase's files, helpers, or internal names — nothing assumed.

## Register

- **Lead with the manifestation, in product terms.** What you'd see happen and where — the page, command, or flow — before any code.
- **Narrative markdown prose**, not fixed-width fragments in a code block. Bold section leads are fine.
- **Causes as behaviour.** "It asks X when it should ask Y" beats a mechanism dump. The mechanism follows the behaviour, never replaces it.
- **`file:line` refs as anchors.** Keep them — subordinate to the story, never its spine.
- **Translate codebase-internal names.** Helpers, flags, and jargon are introduced on first use or replaced with what they do.

## Fidelity

A retelling, not a summary. Every substantive point in the underlying record appears; nothing softened, nothing dropped. The record file on disk stays fully technical and remains authoritative — the retelling presents it, never replaces it.
