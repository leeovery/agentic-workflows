# Read Specification

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This reference defines how planning agents must read the specification. It is passed to every agent alongside the specification path.

**This is a full-ingestion protocol, not a summarisation guide.**

---

## Read the Entire Specification

Read the specification file from top to bottom. Every section, every decision, every edge case, every constraint. If the file is large, read it in sequential chunks until you have consumed the entire document. Do not stop early. Do not skim.

The specification is a verbatim, user-approved artifact. Every detail was explicitly agreed — treat nothing as filler or boilerplate.

---

## What to Absorb

As you read, internalise:

- **Decisions and rationale** — what was decided and why
- **Architectural choices** — patterns, technologies, structures chosen
- **Edge cases** — boundary conditions, unusual inputs, failure modes
- **Acceptance boundaries** — what constitutes "done" for each requirement
- **Constraints** — performance, compatibility, regulatory, or scope limits
- **Dependencies** — what this feature needs from other systems or topics

---

## Cross-Cutting Specifications

If cross-cutting specification paths are provided, read each one in full using the same protocol. Cross-cutting specs contain architectural decisions (caching, rate limiting, error handling) that influence how features are built — they inform implementation approach without adding scope.

Note where cross-cutting decisions apply to the work you are designing.

---

## What NOT to Do

- **Do not summarise** — your job is to use the spec directly, not to create a derivative
- **Do not skip sections** — even sections that seem irrelevant may contain constraints or edge cases that affect your work
- **Do not reinterpret decisions** — the spec contains validated decisions; translate them into plan structure, don't second-guess them
- **Do not reference other source material** — the specification is the sole input; it already incorporates prior research and discussion
