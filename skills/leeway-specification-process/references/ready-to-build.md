# Ready to Build

*Reference for **[leeway-specification-process](../SKILL.md)***

---

The spec's gate: the outline and the phase cut, the build's position, and the person's review of the spec on a page. The review is theirs to take or skip — all of it, the parts they care about, or none — and skipping it is as good a way through: never press it. A feature's carries its topic's close as well — what the person decided, the product-record lines and the candidates for the roadmap — and its pick marks the topic decided with them. Its payload is the one its discussion wrote; it is staged again, once changed, with:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs decided stage {work_unit} {work_unit} --file .leeway/.cache/{work_unit}/discussion/{work_unit}/decided-payload.json
```

Its `next` carries on here.

## The Screen

Pass `--page` where this session can publish a page: the Artifact tool is among its tools. While the review page is open, its marks are read back first: load **[review-page.md](review-page.md)** and follow its instructions as written, from **Reading the Marks**, where this conversation has not loaded it already. Then draw the screen, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render ready-to-build {work_unit} [--page]
```

A refusal names what to fix — an item open again since a land or a cut among them: work it, close the checklist again, and draw the screen again. A feature's topic close refused — something new on the topic since, or the payload staged for an earlier close — is worked as its discussion works it: the topic's `decided` items done again, `checklist close decided {work_unit} {work_unit}`, and the payload written afresh and staged again; then draw the screen again.

Each verdict the screen asks before its gate goes to `gate`, whose `next` gives the verdict; then draw the screen again. The gate's answer goes to `gate`; follow its `next`. A `next` that takes the page's marks — a position's while the page is open, or the review's — names the file they are read back to: read them back fresh into it before running it.
- **A position** runs the yes. It refuses while a comment on the page waits for you, listing each: answer each beneath its line, then draw the screen again. A feature's refuses while a product-record line rests on a decision of the topic replaced since, naming the line: where the rule still holds, add to the payload a line widening the replacement, in the same words; where it should go, withdraw the line; stage it again, then draw the screen again. Its own `next` hands off into the build: follow it.
- **The review** builds the page, or once it is open reads the comments left on it, as review-page.md says.

On a feature's screen, one keeping a struck candidate after all undoes its strike, `decided unstrike {work_unit} {work_unit} {n}`, whose `next` draws the screen.

## A Change Asked For

A Comment on a feature's screen that changes a product-record line or a candidate changes the payload: write it afresh and stage it again, then draw the screen again.

A Comment asking for a change to the outline, the phase cut, or what the person decided is the person's decision, landed at the spec. Decide its route first:
- **It changes a decision already made** — `ledger replace {work_unit}.specification --replaces {decision_id} --reason changed-mind` with `{"drops", "text", "why", "by": "person", "who_moved_whom": "none"}` on stdin, which stands on that decision's topic. A replacement answers no question: ask none.
- **It decides something afresh** — its question, `ledger ask {work_unit}.specification`, then the person's answer, `ledger decide {work_unit}.specification --answers {question_id}` with `{"text", "why", "rules_out", "by": "person", "given": "own", "who_moved_whom": "none"}` on stdin.

Then the writer goes again, its brief carrying the decision, and its land goes through the review's next pass (**[writing-and-review.md](writing-and-review.md)**). The cut is made again, its brief carrying the decision too (**[phase-cut.md](phase-cut.md)**); then close the checklist again and draw the screen again.

## The Split

An epic's size is never capped by a number: splitting it is a judgement. Put it to the person whenever the outline they would approve grows unwieldy, or the read across its topics for seams nobody linked does. The ledger's links show where it splits cleanly: groups of topics linked within, with little between. A split moves whole decided topics, with their records, to a next epic on the roadmap; the ledger keeps every link working. Part of a topic never moves here: a topic too large to build whole is split in discovery, before it is decided.

Say in a few lines the split you lean on — the topics that would move, and the seam they part at — then ask each move of the person through the postpone gate, one topic at a time. Where they named a horizon, fetch the confirm, `render postpone-gate {work_unit}.discovery.{topic} --horizon "{horizon}"`; otherwise the pick over the roadmap's horizons, `render horizon-pick {work_unit}.discovery.{topic}`. A pick that refuses has none to offer: ask for the horizon in the conversation, then fetch the confirm. Emit each MENU verbatim per its marker; the answer goes to `gate`:
- **A horizon picked** — follow its `next`, the confirm.
- **A new horizon** (`n/new`) — ask for its name in the conversation, then fetch the confirm with it.
- **Postpone it** (`y/yes`) — follow its `next`, which postpones the topic, then fetch the receipt and emit its sections verbatim per their markers:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb postpone
  ```

- **Keep it here** (`n/no`) — the topic stays in the epic: say so in a line.
- **A Comment** — a change to the horizon: fetch the confirm again with the one they give.

Once the topics the person moved have gone, the lines that cited their entries no longer trace: the writer goes again, its land goes through the review's next pass, and where `phases-complete` is open again the cut is made again; then close the checklist again. The split is open until the person picks the build's position.
