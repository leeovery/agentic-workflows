# Display: Block Scenarios

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Two terminal paths — the command stops and cannot proceed.

#### If no discussions exist

> *Output the next fenced block as a code block:*

```
Specification Overview

No discussions found.

The specification phase requires completed discussions to work from.
Discussions capture the technical decisions, edge cases, and rationale
that specifications are built upon.

The specification phase requires completed discussions to work from.
```

**STOP.** Do not proceed — terminal condition.

#### If discussions exist but none completed

> *Output the next fenced block as a code block:*

```
Specification Overview

No completed discussions found.

The following discussions are still in progress:

  • {discussion-name}
  • {discussion-name}

Specifications can only be created from completed discussions.
Conclude at least one discussion before proceeding.
```

List all in-progress discussions from discovery output.

**STOP.** Do not proceed — terminal condition.
