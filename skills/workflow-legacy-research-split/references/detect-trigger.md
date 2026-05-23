# Detect Trigger

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Build `qualifying_sources` — names of migration-seeded research items that need decomposition.

## A. Read Manifest

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.research items
```

→ Proceed to **B. Filter Qualifying Items**.

## B. Filter Qualifying Items

Include an inception item `name` in `qualifying_sources` when ALL hold:

- `source` contains `migration-seeded`
- `routing` is `research`
- `phases.research.items.{name}.status` is `in-progress`
- `.workflows/{work_unit}/research/{name}.md` exists

#### If `qualifying_sources` is empty

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
