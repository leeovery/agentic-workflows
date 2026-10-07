# Baseline Judgment

*Reference for **[workflow-start](../SKILL.md)***

---

While `baseline` is `none`, nothing is recorded yet. Read the boot response's `baseline_signal` — the repository's own account of what came before the workflows — and decide the one question: was there real development before the workflows arrived, or only setup? `history_before` lists the commits before the arrival as `date  subject` (`commits_before` of `commits_total`, from `root_date` to `workflows_date` — `null` when nothing under `.workflows/` is committed yet: the workflows are arriving now, and the whole history came before them); `tree_at_arrival` and `files_at_arrival` are the project tree they arrived into, less the workflows' own footprint. Read them as you would by hand — the counts are context, never thresholds. Commits that are an initial commit, setup, configuration, a generator's skeleton, and a tree with no application code in it: the project grew up on the workflows, whatever it has become since — **native**. Application code and the history of building it before the arrival: a codebase the workflows were installed into — it **predates** them. A `null` signal is a project with no history to read (no repository, no commits, a shallow clone): look at the project tree yourself, and an empty or scaffold-only tree is native.

#### If the project is native

Record the verdict — written and committed in one call, so the question is settled for good. If it fails (`ok: false`), surface the error and continue — the judgment returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs baseline record native
```

→ Return to caller.

#### If the codebase predates the workflows

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Baseline Assessment`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> This project has an existing codebase the workflows know nothing about. A baseline assessment researches it, then interviews you to capture the intent the code can't show — landing docs the knowledge base surfaces in every later phase. Pausable any time; also available later from the workflow-start menus.
```

Fetch the offer and emit its `MENU: baseline offer` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-offer-gate
```

**STOP.** Wait for user response.

**If `yes`:**

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with route = `/workflow-baseline`.

**If `no`:**

Record the decline — written and committed in one call, so the offer never repeats. If it fails (`ok: false`), surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs baseline record skipped
```

→ Return to caller.
