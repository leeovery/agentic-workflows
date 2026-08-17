# Report Register

*Reference for **[task-loop.md](task-loop.md)***

---

The register for the task loop's report moments — the task brief, the findings summary, the result summary, the technical retells, and the show-me diagrams. A report is sectioned facts, not narrative: the user takes the state of the work in at a glance, and depth is pulled, not pushed — the technical retell and **Ask** sit one option away at the gate. The record files stay fully technical and remain authoritative — a report presents them, never replaces them.

The register governs report blocks only — within one, it composes with **[voice.md](../../workflow-shared/references/voice.md)** rather than competing: this file governs the report's shape and sentence form, voice governs the manner. Conversational turns inside the loop — Ask answers, comment exchanges, blocker discussion — follow voice.md alone. Engine-emitted `DISPLAY`/`MENU` sections sit outside it entirely, byte-for-byte. Agent reports and records are never written in it — the register applies when composing for the user, never to what lands on disk. The boundary governs emission, not authorship: judgment content written into an engine payload for a section to render — the brief's `summary` and `watch` lines — takes the register at authoring time.

## Rules

Every sentence in a report block follows these:

- **One fact per sentence.** State one thing, in under ~20 words. Never carry a second fact in a subordinate clause.
- **Active voice, named actor.** "The reviewer re-ran the suites", never "the suites were re-run".
- **One name per thing.** The name that introduces a thing is reused verbatim — never varied for style.
- **No narrative framing in sentences.** No "worth noting", "on the way", "three things". A fact sits under its section label — the fixed section labels are vocabulary, not framing.
- **Labeled sections; lists for parallel facts.** Enumerations go vertical. A section with nothing to say is omitted, never padded.
- **Cause before effect, both explicit.** "The preview rebuilds its DOM after each structural edit. That rebuild destroyed the browser's undo stack."
- **Numbers stay exact.** Measurements, counts, and versions appear as measured, with their conditions.

The audience is an engineer with full engineering fluency who knows the product but not this codebase — nothing dumbed down, nothing assumed. The lens sets the naming: the task brief, findings summary, and product summary translate codebase-internal names into what they do; the technical retell and the show-me diagrams use real names with `file:line` anchors.

## Task Brief

The brief's `summary` and `watch` payload fields (**[display-task-brief.md](display-task-brief.md)**) follow the rules in product terms — what the task is about to change, what to look at when it lands.

## Findings Summary

Markdown, not a code block. Issues in severity order. Per issue, a labeled short block: what is wrong in what was built, the risk it carries, and the proposed fix. Include the alternative or the reviewer's confidence only where it changes the call. Non-blocking notes: one line each.

## Product Summary

Markdown, not a code block. Bold section labels, in this order, each section omitted when it has nothing to say. Drawn from the executor's report, the review and its notes, the fix history, and the diff — never the executor's SUMMARY alone.

- **Changed since last gate** — leads, and only after a fix round: what the fix round changed.
- **Before** — what this part of the product did before the task.
- **Now** — what it does now; bullets when the facts are parallel.
- **Decisions** — calls made during the task that shape the result, each with its grounds in a sentence.
- **Fixed on the way** — bugs found and fixed inside the task's scope, cause and effect stated.
- **Watch** — what the executor or reviewer flagged and left: known limits, unrecorded costs, platform gaps.
- **Tests** — what proves it: counts, suites, independent probes, known unrelated failures.

Notes follow the sections, one line each, only when earned: comment corrections applied (naming any dropped), findings withdrawn by a challenge.

## Technical Retell

Markdown, not a code block. The same item decomposed from the code's side, under the same rules:

- **Structure** — the files and modules touched, each with its role.
- **Flow** — the runtime path as ordered steps, real names, `file:line` anchors.
- **Decisions** — the same calls as the product summary, with their technical grounds.
- **Costs and invariants** — measurements, complexity notes, what must stay true.

A perspective shift, not a dump — never raw file contents, never a jargon chain, and each mechanism ties back to what it produces in the product. A retelling, not a summary: every substantive point in the record appears, nothing softened, nothing dropped. On the fix gate, the same decomposition applies to the findings — the mechanism of each issue and where it sits.

## Show Me

The mechanism as a picture. On the task gate, diagram what was built; on the fix gate, where each finding sits in the flow.

- ASCII diagrams in a plain code block — topology, dataflow, sequence, or state, whichever exposes the mechanism at hand. One caption line above each diagram; a legend only when a symbol is not obvious.
- Diagrams stay under 60 columns — a fenced block never reflows.
- Nodes carry real names, with `file:line` where it helps. A sentence or two under the rules may connect the diagrams, never replace them.
- After the diagrams, one line notes that an interactive page of the same explanation is available on request — only when the session has a tool that can publish a browser page; without one the line does not render and the ASCII stands alone. Never pose it as a question — a dangling ask collides with the gate menu that follows. The diagrams are the deliverable.
