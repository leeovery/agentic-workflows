# Write Specification

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Write a lightweight specification directly. No agents, no review cycles — the change is mechanical and well-understood.

## A. Write the Spec

Create the specification file at `.workflows/{work_unit}/specification/{topic}/specification.md`:

```markdown
# Specification: {Topic:(titlecase)}

## Change Description

{What is being changed and why — 2-3 sentences}

## Scope

{Files, directories, or patterns affected. Be specific:}
{- "All .go files in pkg/" or "grep -r 'interface{}' --include='*.go'"}
{- Include file counts or pattern matches if known}

## Exclusions

{Anything explicitly excluded from the change, or "None"}

## Verification

{How to verify the change is correct — typically:}
{- All existing tests pass after the change}
{- No occurrences of the old pattern remain in scope}
{- Any additional checks specific to this change}
```

Confirm the spec was written:

> *Output the next fenced block as a code block:*

```
Specification written: .workflows/{work_unit}/specification/{topic}/specification.md
```

## B. Register in Manifest

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} specification {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
```

The `complete` call indexes the specification into the knowledge base. If its response carries `warnings`, display them but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): quick-fix specification"
```

→ Return to caller.
