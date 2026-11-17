# Splitting the Experiment

*Reference for **[ledger-experiment-process](../SKILL.md)***

---

The running experiment's question turned out to be two primary questions. The split is the laboratory's own method and never reaches the spawning conversation: its wait stays on the parent and is released once, when the parent ends. A split never splits again.

Say in a line or two what decomposed and how. For each part, draw a kebab-case `{slug}` and create it; the engine numbers it `E{n}.{m}` and answers its folder, `dir`, nested in the parent's:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {slug} --parent {id}
```

On a resume the parts are made already: the DATA's `split` lines name each with its status and its folder, and nothing is created again.

Walk each part as the laboratory walks its parent, the part's id and folder in place of the parent's: its design and `experiment advance`; its briefing, the approval gate drawn with its id; `experiment advance` as its measurement begins, its report in its own folder and its tally under its own id; then its verdict, or its abandonment. A part's end releases nothing, and its `next` carries the parent's run on.

Once every part has ended, the parent's measurement completes by bringing their reports together, and the parent goes on to its verdict.
