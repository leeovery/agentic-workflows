# Spec Change Detection

*Reference for **[technical-planning](../SKILL.md)***

---

When resuming planning, check whether the specification or cross-cutting specifications have changed since planning started.

The manifest stores `spec_commit` — the git commit hash captured when planning began. This allows diffing any input file against that point in time.

## Detection

Run a git diff against the stored commit for all input files:

```bash
git diff {spec_commit} -- {specification-path} {cross-cutting-spec-paths...}
```

Also check for new cross-cutting specification files that didn't exist at that commit.

## Reporting

#### If no changes detected

> "Specification unchanged since planning started."

#### If changes detected

Summarise the extent of changes:

- **What files changed** (specification, cross-cutting specs, or both)
- **Whether any cross-cutting specs are new** (didn't exist at the stored commit)
- **Nature of changes** — formatting/cosmetic, minor additions/removals, or substantial restructuring

Return the summary for use in the resume prompt.
