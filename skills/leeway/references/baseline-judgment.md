# Baseline Judgment

*Reference for **[leeway](../SKILL.md)***

---

While `brownfield_offer` is `none`, nothing is recorded yet. Read the boot response's `baseline_signal` — the project's own account of what came before the workflows, read across the root and every repo nested in it — and decide the one question: was there real development before the workflows arrived, or only setup? `history_before` lists the commits before the arrival as `date  subject` (`commits_before` of `commits_total`, from `root_date` to `workflows_date` — `null` when nothing under `.workflows/` is committed yet: the workflows are arriving now, and the whole history came before them); `tree_at_arrival` and `files_at_arrival` are the project tree they arrived into, less the workflows' own footprint. A project inside a larger repository counts only the commits that touched its folder, and a shallow nested clone adds its files with none of its history, so its code shows in the tree without the commits that built it. Read them as you would by hand — the counts are context, never thresholds. Commits that are an initial commit, setup, configuration, a generator's skeleton, and a tree with no application code in it: the project grew up on the workflows, whatever it has become since — **native**. Application code and the history of building it before the arrival: a codebase the workflows were installed into — it **predates** them. A `null` signal is a project with no history to read (no repository, no commits in any repo, a shallow root): look at the project tree yourself, and an empty or scaffold-only tree is native.

#### If the project is native

Record the verdict — written and committed in one call, so the question is settled for good. If it fails (`ok: false`), surface the error and continue — the judgment returns at the next start:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brownfield record native
```

→ Return to caller.

#### If the codebase predates the workflows

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Baseline Assessment`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> This project has an existing codebase the workflows know nothing about. A baseline assessment reads it, then opens the product's conversation on what the code shows and the intent it can't.
```

Fetch the offer and emit its `MENU: brownfield offer` section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render brownfield-offer-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Record the acceptance — written and committed in one call, so the product's conversation resumes the research at its next opening until it lands:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brownfield record accepted
```

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery none none`.

**If `no`:**

Record the decline — written and committed in one call, so the offer never repeats. If it fails (`ok: false`), surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brownfield record skipped
```

→ Return to caller.
