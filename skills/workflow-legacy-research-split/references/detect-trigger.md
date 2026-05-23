# Detect Trigger

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Identify the set of legacy migration-seeded research files that qualify for decomposition. The caller stores the resulting list as `qualifying_sources` for **[session-loop.md](session-loop.md)** to iterate.

## A. Read Manifest

Read the work unit's manifest. The `get` command returns the full inception items object and the full research items object:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.research items
```

Treat empty output (work-unit-missing or path-missing — exit code 0 returning no data) as "no items" rather than an error.

→ Proceed to **B. Filter Qualifying Items**.

## B. Filter Qualifying Items

For each inception item `name`, include it in `qualifying_sources` when ALL of these hold:

- `source` field contains `migration-seeded` (substring match — `source` may be comma-accumulated).
- `routing` equals `research`.
- `phases.research.items.{name}` exists.
- `phases.research.items.{name}.status` equals `in-progress`.
- `.workflows/{work_unit}/research/{name}.md` exists on disk.

Set `qualifying_sources = [name1, name2, ...]`.

#### If `qualifying_sources` is empty

No legacy work to do.

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### Otherwise

→ Proceed to **C. Announce**.

## C. Announce

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Legacy Research Split
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> This epic pre-dates the inception phase. One or more research
> files were seeded as broad topics by migration. Before the
> discovery map can route around them, each source file is
> decomposed into topic-scoped themes — user-guided.
```

> *Output the next fenced block as a code block:*

```
Qualifying source files (in-progress, migration-seeded):

@foreach(name in qualifying_sources)
  • {name}.md
@endforeach
```

→ Return to caller.
