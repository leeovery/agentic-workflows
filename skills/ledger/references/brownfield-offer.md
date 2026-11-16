# Brownfield Offer

*Reference for **[ledger](../SKILL.md)***

---

Nothing is recorded yet. Read the boot response's `brownfield_signal` — the project's own account of what came before Ledger, read across the root and every repo nested in it — and decide the one question: was there real development before Ledger arrived, or only setup? `history_before` lists the commits before the arrival as `date  subject` (`commits_before` of `commits_total`, from `root_date` to `workflows_date`, the date of the state branch's first commit — `null` while the state holds no commit yet: Ledger is arriving now, and the whole history came before it); `tree_at_arrival` and `files_at_arrival` are the project tree it arrived into, less Ledger's own footprint. A project inside a larger repository counts only the commits that touched its folder, and a shallow nested clone adds its files with none of its history, so its code shows in the tree without the commits that built it. Read them as you would by hand — the counts are context, never thresholds. Commits that are an initial commit, setup, configuration, a generator's skeleton, and a tree with no application code in it: the project grew up on Ledger, whatever it has become since — **native**. Application code and the history of building it before the arrival: a codebase Ledger was installed into — it **predates** it. A `null` signal is a project with no history to read (no repository, no commits in any repo, a shallow root): look at the project tree yourself, and an empty or scaffold-only tree is native.

#### If the project is native

Record the verdict — written and committed in one call, so the question is settled for good. If it fails (`ok: false`), surface the error and continue — the judgment returns at the next start:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brownfield record native
```

→ Return to caller.

#### If the codebase predates Ledger

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ The Existing Code`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> This project has code Ledger knows nothing about. The product researcher can read it first, then the product's conversation opens on what the code shows and the intent it can't.
```

Fetch the offer and emit its `MENU: brownfield offer` section verbatim per its marker:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render brownfield-offer-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Record the acceptance — written and committed in one call, so the product's conversation resumes the research at its next opening until it lands:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brownfield record accepted
```

→ Load **[handing-off.md](../../ledger-shared/references/handing-off.md)** with route = `/ledger-discovery none none`.

**If `no`:**

Record the decline — written and committed in one call, so the offer never repeats. If it fails (`ok: false`), surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brownfield record skipped
```

→ Return to caller.
