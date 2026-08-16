# Invoke Consolidation Finder

*Reference for **[consolidation-pass.md](consolidation-pass.md)***

---

This step invokes the `workflow-implementation-consolidation-finder` agent (`../../../agents/workflow-implementation-consolidation-finder.md`) to sweep one phase's combined surface.

---

## Identify Scope

Build the list of files the phase touched using git history — internal IDs embed the topic and phase, so the `T{topic}-{N}-` prefix scopes the sweep to this phase's task commits:

```bash
git log --oneline --name-only --pretty=format: --grep="impl({work_unit}): T{topic}-{N}-" | sort -u | grep -v '^$'
```

Read the bank (an absent field is empty — dispatch with an empty list):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} bank
```

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-consolidation-finder.md`

Dispatch a **fresh** agent via the Task tool — fresh context is the point: the finder reads the phase's final surface with no memory of how it was built. Pass:

1. **Phase files** — the file list from scope identification
2. **Bank entries** — the full bank JSON (the finder verdicts every entry against the phase's final state)
3. **Specification path** — from the specification (if available)
4. **Project skill paths** — from `project_skills` in the manifest (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} project_skills`)
5. **code-quality.md path** — `.claude/skills/workflow-implementation-process/references/code-quality.md`
6. **Work unit** — the work unit name (for path construction)
7. **Topic name** — the implementation topic
8. **Phase number** — `{N}`, and the commit grep token `impl({work_unit}): T{topic}-{N}-` for reading the phase's diff

The agent writes its findings to `.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`.

---

## Expected Result

The agent returns a brief status:

```
STATUS: findings | clean
FINDINGS_COUNT: {N}
BANK: {confirmed M, mooted K, residue R | no entries}
SUMMARY: {1 sentence}
```

- `findings`: consolidation is owed — proposals and bank verdicts are in the findings file
- `clean`: nothing above the bar and no confirmed bank entries. The findings file is still written when bank verdicts, pre-existing debt, or Observations exist, and not at all otherwise

→ Return to caller.
