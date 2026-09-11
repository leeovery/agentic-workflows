# Write Specification

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Write a lightweight specification directly. No agents, no review cycles — the change is mechanical and well-understood.

## A. Write the Spec

→ Load **[specification-body.md](../../workflow-shared/references/specification-body.md)** and follow its instructions as written.

Create the specification file at `.workflows/{work_unit}/specification/{topic}/specification.md` in the body's shape — four numbered sections beneath `## Specification`, `## Working Notes` empty:

```markdown
# Specification: {Topic:(titlecase)}

## Specification

### 1. Change Description

{What is being changed and why — 2-3 sentences}

### 2. Scope

{Files, directories, or patterns affected. Be specific:}
{- "All .go files in pkg/" or "grep -r 'interface{}' --include='*.go'"}
{- Include file counts or pattern matches if known}

### 3. Exclusions

{Anything explicitly excluded from the change, or "None"}

### 4. Verification

{How to verify the change is correct — typically:}
{- All existing tests pass after the change}
{- No occurrences of the old pattern remain in scope}
{- Any additional checks specific to this change}

---

## Working Notes
```

Confirm the spec was written:

> *Output the next fenced block as a code block:*

```
Specification written: .workflows/{work_unit}/specification/{topic}/specification.md
```

→ On return, proceed to **B. Register in Manifest**.

## B. Register in Manifest

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} specification {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
```

The `complete` call indexes the specification into the knowledge base. When the `complete` response's `warnings` is non-empty, fetch and emit the `DISPLAY: kb warning` advisory — the warning never blocks:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.specification.{topic} --verb complete --warn
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): quick-fix specification"
```

→ Return to caller.
