# Brownfield Offer

*Reference for **[ledger](../SKILL.md)***

---

Nothing is recorded yet. Read the boot response's `brownfield_signal` — the project's own account of what came before Ledger, read across the root and every repo nested in it — and decide the one question: was there real development before Ledger arrived, or only setup? `history_before` lists the commits before the arrival as `date  subject` (`commits_before` of `commits_total`, from `root_date` to `ledger_date`, the date Ledger arrived: for a migrated project, when its old state first entered git, else the date of the state branch's first commit — `null` while there is neither: Ledger is arriving now, and the whole history came before it); `tree_at_arrival` and `files_at_arrival` are the project tree it arrived into, less Ledger's own footprint. A project inside a larger repository counts only the commits that touched its folder, and a shallow nested clone adds its files with none of its history, so its code shows in the tree without the commits that built it. Read them as you would by hand — the counts are context, never thresholds. Commits that are an initial commit, setup, configuration, a generator's skeleton, and a tree with no application code in it: the project grew up on Ledger, whatever it has become since — **native**. Application code and the history of building it before the arrival: a codebase Ledger was installed into — it **predates** it. A `null` signal is a project with no history to read (no repository, no commits in any repo, a shallow root): look at the project tree yourself, and an empty or scaffold-only tree is native.

Where it is native, record it, settling the question for good:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brownfield record native
```

Where it predates Ledger, say the marker **`▪ The Existing Code`** on a line of its own, then work the screen `brownfield-offer-gate` as the start's **A Setup Screen** says.
