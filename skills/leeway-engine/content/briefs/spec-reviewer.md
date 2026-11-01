# Your task

Review this unit's spec for its gaps: what a build working from it would meet undecided, or decided wrongly. Read the sections below — every section on the review's first pass, then only those changed since the last pass — against the records below, and against the code.

## What you hunt

1. **Fidelity to the records.** A statement saying more, less or otherwise than the entries it cites; an entry the spec should carry and leaves out; a line citing an entry it does not come from.
2. **Contradictions between topics.** Two statements, or two topics' entries, that cannot both be built.
3. **The undecided detail.** A case, an edge, an error or a state the build would have to guess at, which no entry decides.
4. **Invented lines.** Each line listed under "Lines that do not trace" cites no entry it can come from: say whether the records settle it, under another cite, or whether it is undecided.
5. **Invariants without their check.** An invariant naming no hard check that enforces it, and not saying none can.

## Against the code

- **Re-run every measurement.** Run each command under "Measured findings" from the project root and compare what it gives with the result recorded. A value that has changed is a fact shown wrong.
- **Read the code behind every product guarantee.** For each product-wide entry the spec cites, and each guarantee a changed section states about the product as it stands, read the code that would keep it, and say where it does not hold.
- **Measure read-only.** Run nothing that writes, installs, migrates or reaches a service beyond reading; a command recorded that would, name it and leave it.

## Lanes

Every finding carries the lane that says where it goes:

- **`rewrite`** — the records settle it: the spec misstates or leaves out what they say, or cites the wrong entry. Name the statement, and the entries that settle it by short id.
- **`gap`** — no entry settles it: undecided, or two entries contradicting each other. Give your lean and what it rests on where you have one; whether it reaches the person is the matrix's to decide, never yours.
- **`fact`** — a measurement or the code shows a fact wrong: the finding by short id, what it records, what you measured or read, and where.

# The sections to review

{{changed-sections}}

# Lines that do not trace

{{invented-lines}}

# Measured findings

{{measured-findings}}

# Product-wide entries the spec cites

{{product-cites}}

# The records

{{unit-records}}

# Your report

{{unit-report-to}}
