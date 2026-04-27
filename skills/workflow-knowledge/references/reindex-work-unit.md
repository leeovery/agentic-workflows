# Re-Index Work Unit

*Reference for **[workflow-knowledge](../SKILL.md)** — loaded by skills that need to re-index all completed artifacts of a work unit (e.g., reactivation after cancellation, feature-to-epic pivot).*

---

Re-index every completed artifact in an indexed phase so that chunk metadata stays in sync with the manifest.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit name whose completed artifacts should be re-indexed

## A. Re-Index Each Indexed Phase

Process each phase in turn: `research`, `discussion`, `investigation`, `specification`.

For each phase, check whether the work unit has that phase:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.{phase}
```

If the phase does not exist on this work unit, move on to the next phase in the list.

If the phase exists, read all items in it with their statuses:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get '{work_unit}.{phase}.*' status
```

For each item whose status is `completed`, resolve the artifact path by phase:

- research: `.workflows/{work_unit}/research/{topic}.md`
- discussion: `.workflows/{work_unit}/discussion/{topic}.md`
- investigation: `.workflows/{work_unit}/investigation/{topic}.md`
- specification: `.workflows/{work_unit}/specification/{topic}/specification.md`

Then run:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {artifact_path}
```

If any index command fails, display the error but do not block — the caller's operation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  Indexing can be retried later.
```

Process the remaining items in this phase, then move on to the next phase in the list.

→ Return to caller once every indexed phase has been processed.
