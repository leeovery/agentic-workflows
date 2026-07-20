# Spec Change Detection

*Reference for **[workflow-planning-process](../SKILL.md)***

---

When resuming planning, check whether the specification or cross-cutting specifications have changed since planning started.

The manifest stores `spec_commit` — the git commit hash of the spec baseline the plan last reconciled against, stamped at plan initialization and re-stamped when the plan concludes. This allows diffing any input file against that point in time.

## Detection

Run a git diff against the stored commit for all input files:

```bash
git diff {spec_commit} -- {specification-path} {cross-cutting-spec-paths...}
```

Also check for new cross-cutting specification files that didn't exist at that commit.

## Reporting

#### If no changes detected

> *Output the next fenced block as a code block:*

```
Specification unchanged since planning started.
```

→ Return to caller.

#### If changes detected

Summarise the extent of changes:

- **What files changed** (specification, cross-cutting specs, or both)
- **Whether any cross-cutting specs are new** (didn't exist at the stored commit)
- **Nature of changes** — formatting/cosmetic, minor additions/removals, or substantial restructuring

These changes are unreconciled: fold them into the affected phases and tasks during the session. The baseline is re-stamped only when the plan concludes, so unreconciled changes keep being reported here.

→ Return to caller.
