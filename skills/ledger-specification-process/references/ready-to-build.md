# Ready to Build

*Reference for **[ledger-specification-process](../SKILL.md)***

---

The spec's gate: the outline and the phase cut, the build's position, and the person's review of the spec on a page. The review is theirs to take or skip — all of it, the parts they care about, or none — and skipping it is as good a way through: never press it. A feature's carries its topic's close as well — what the person decided, the product-record lines and the candidates for the roadmap — and its pick marks the topic decided with them. Its payload is the one its discussion wrote, each line, withdrawal and candidate in the shape it was written in; once changed, it is staged again with:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs decided stage {work_unit} {work_unit} --file .ledger/.cache/{work_unit}/discussion/{work_unit}/decided-payload.json
```

A bugfix's carries its investigation's recap, and its pick concludes the investigation. Its recap is the one the investigation staged; once changed, it is staged again with:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs investigation stage {work_unit} --file .ledger/.cache/{work_unit}/investigation/{work_unit}/recap.json
```

## The Screen

Pass `--page` where this session can publish a page: the Artifact tool is among its tools. While the review page is open, its marks are read back first: load **[review-page.md](review-page.md)** and follow its instructions as written, from **Reading the Marks**, where this conversation has not loaded it already. Then draw the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render ready-to-build {work_unit} [--page]
```

Where a tool the drivers need is missing, too old or failing, the screen is the drivers' stop, with no gate: once the person says it is put right, draw the screen again. At the project's first ready to build the screen may be GitHub's squash offer instead: once its answer has run, draw the screen again.

A refusal names what to fix: work it, close the checklist again, and draw the screen again. Where a feature's staged line can no longer land: in the payload, the line widens that decision's replacement, in the same words where the rule still holds, or goes where it no longer does; stage it again, then draw the screen again.

After each verdict the screen asks before its gate, draw it again with `--alone` added. A `next` that takes the page's marks — a position's while the page is open, or the review's — names the file they are read back to: read them back fresh into it before running it.
- **A position** runs the yes. A feature's yes refused for a product-record line resting on a decision replaced since: where its rule still holds, add to the payload a line widening the replacement, in the same words; where it should go, withdraw the line; stage it again, then draw the screen again. Any other refused yes names what to fix: fix it, then draw the screen again.
- **The review** builds the page, or once it is open reads the comments left on it, as review-page.md says.

On a feature's screen, one keeping a struck candidate after all undoes its strike, `decided unstrike {work_unit} {work_unit} {n} [--page]`, `--page` as the screen was drawn, whose `next` draws the screen.

## A Change Asked For

A Comment on a feature's screen that changes a product-record line or a candidate changes the payload: change it and stage it again, then draw the screen again. One on a bugfix's screen that changes the recap's paragraph or what the bug is in changes it alike; one that changes the root cause or the fix direction is the person's decision, below.

A Comment asking for a change to the outline, the phase cut, or what the person decided is the person's decision, landed at the spec. Decide its route first:
- **It changes a decision already made** — `ledger replace {work_unit}.specification --replaces {decision_id} --reason changed-mind` with `{"drops", "text", "why", "by": "person"}` on stdin, which stands on that decision's topic. The engine sets who moved whom; only where the decision replaced already stood over Claude's lean, add `"who_moved_whom"`: `claude-moved-person` where the change comes round to Claude's lean, else `person-moved-claude`. A replacement answers no question: ask none.
- **It decides something afresh** — its question, `ledger ask {work_unit}.specification`, then the person's answer, `ledger decide {work_unit}.specification --answers {question_id}` with `{"text", "why", "rules_out", "by": "person", "given": "own", "who_moved_whom": "none"}` on stdin.

Then the writer goes again, its brief carrying the decision, and its land goes through the review's next pass (**[writing-and-review.md](writing-and-review.md)**). The cut is made again, its brief carrying the decision too (**[phase-cut.md](phase-cut.md)**); then close the checklist again. On a feature's screen, a changed decision restages each line that widens it: the line widens the replacement in the payload, and the payload is staged again. On a bugfix's, a changed root cause or fix direction stages the recap again with the call above, its paragraph telling the hunt as it now ends. Then draw the screen again.

## The Split

An epic's size is never capped by a number: splitting it is a judgement. Put it to the person whenever the outline they would approve grows unwieldy, or the read across its topics for seams nobody linked does. The ledger's links show where it splits cleanly: groups of topics linked within, with little between. A split moves whole decided topics, with their records, to a next epic on the roadmap; the ledger keeps every link working. Part of a topic never moves here: a topic too large to build whole is split in discovery, before it is decided.

Say in a few lines the split you lean on — the topics that would move, and the seam they part at — then ask each move of the person through the postpone gate, one topic at a time. Where they named a horizon, fetch the confirm, `render postpone-gate {work_unit}.discovery.{topic} --horizon "{horizon}"`; otherwise the pick over the roadmap's horizons, `render horizon-pick {work_unit}.discovery.{topic}`. Then, by the answer:
- **A new horizon** (`n/new`) — ask for its name in the conversation, then fetch the confirm with it.
- **Postpone it** (`y/yes`) — follow its `next`, which postpones the topic and answers its receipt.

- **Keep it here** (`n/no`) — the topic stays in the epic: say so in a line.
- **A Comment** — a change to the horizon: fetch the confirm again with the one they give.

Once the topics the person moved have gone, the lines that cited their entries no longer trace: the writer goes again, its land goes through the review's next pass, and where `phases-complete` is open again the cut is made again; then close the checklist again. The split is open until the person picks the build's position.
