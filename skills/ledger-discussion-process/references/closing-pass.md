# Closing Pass

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

`checklist show decided {work_unit} {topic}` lists the close's items. Mark each as it holds, `checklist done decided {work_unit} {topic} {item}`, or skip it with its reason, `checklist skip decided {work_unit} {topic} {item} --reason '{reason}'`.

## Waiting for Agents

Fetch `render wait-agents {work_unit}.{topic}`, which draws nothing where no agent of the topic runs.

## The Closing Pass

It has two readers: a fresh agent, unanchored by the conversation, and you, who were in it. The fresh reader reads the log: bring it up to date, then dispatch the reader, brief it, `{agent}` the `id` the dispatch answered, and make the Agent call; do your own reads while it works.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind closing-pass
node .claude/skills/ledger-engine/scripts/engine.cjs brief closing-pass-reader {work_unit} {topic} --agent {agent}
```

Its report is taken in as any report coming back is (the skill's **Tools**). A `product` finding is a line for the close's payload, written nowhere before the person's yes.

Where the pass changed what the topic decides — a question opened, an answer replaced — another pass reads what changed, unasked, once the conversation has closed what it opened. The passes end at one that changes nothing, and `closing-pass` is done.

## Your Own Reads

The fresh reader catches *topical* gaps — areas that should have been explored. Your reads catch *conversational* gaps — substance that was discussed in the session but never made it into the record or the log. Only you can do this: you were in the conversation, the reader wasn't.

The stakes are high here. The pressure to polish rationale beyond what was actually said is real, a journey is easy to write tersely after the fact and to clean up post-hoc, and tentative leans can harden into recorded decisions. The specification is written from the record — drift here compounds downstream.

Re-read the topic's record (`ledger record {work_unit} {topic}`), its map and its log in full. Don't rely on your memory of what you wrote earlier.

- `decisions-entered` — the conversation walked against the record and the log, on six dimensions (the last two sweep the log alone):
  1. **Undocumented substance** — threads, tangents, trade-offs, edge cases, provisional positions, or points that came up in conversation but never made it into the record or the log: every decision made in the conversation has its entry, and every answer the person gave landed. Not verbatim — the *substance* of what was explored. This is the most common failure mode as sessions grow long and later exchanges crowd out earlier ones. The log's journey is especially vulnerable: it is supposed to capture the arc of how a decision was reached, and it's easy to write it tersely after the fact in a way that skips the actual back-and-forth.
  2. **Hallucinated or embellished content** — claims, options, rationale, or journey in the record or the log that don't trace back to anything actually discussed. Synthesis that drifted from what was said into what you *think* should have been said. Plausible-sounding filler in a decision's why that wasn't in the conversation.
  3. **Accuracy drift** — positions recorded as firmer than they were, tentative leans written as decisions, softened pushback from the person, competing options understated to make the chosen one look cleaner, a decision landed on a point that was really still converging. Check the map itself for drift — a point under another closed by its parent's decision when it wasn't fully resolved.
  4. **Revision landing** — a decision changed this session that was recorded in an earlier sitting is a replacement naming its cause, never a change carried in the log's prose alone, and the earlier sessions' log stands as written.
  5. **Misdirected knowledge** (epics only) — prose in the log addressed to another topic instead of recording this topic's own ground: notes to carry forward ("→ {topic}: …"), corrections owed to another topic whose decided ground this session's decisions superseded, "tell {topic} about X" asides. A citation of another topic's decision as context is fine — only knowledge *owed to* another topic qualifies, and owed means the note makes an **ask** of the target: a question to explore, a defect in its own ground, substance it owns. A decision that answers a question another topic sent to this one owes nothing back. The way for these is the session's own message at the moment the correction is known; anything found here is a miss to repair, not a convention to preserve.
  6. **Pipeline meta** — the log stating its own pipeline position: readiness declarations ("ready for specification"), decided-point counts, review-cycle tallies — whether written this session or in an earlier sitting. Per-point resolution prose ("X decided — {substance}") is substance and stays; the aggregate goes. The engine holds that state.

  The brief read against the record too: an open question of the brief's that never reached the map goes on it, as does a point it marks as from before, asked with its id from before.

  Put each finding right through the doors, the log only ever appended to:
  - Gap → the missing substance lands where it belongs: a question, a finding or a decision through its door, the journey appended to the log
  - Hallucination → an entry of yours that traces to nothing said is replaced, `--reason was-wrong`, corrected to match what was discussed, and one recorded as the person's put back to them as its replacement (`raise --replaces`); the log corrected by a line appended under this session
  - Drift → the record brought back to what the conversation said: a decision of yours replaced, one recorded as the person's put back to them as its replacement (`raise --replaces`), the log corrected by a line appended
  - Mislanded re-decision → the replacement landed, its cause named; an earlier session's log edited is restored from git
  - Misdirected knowledge → sent as a message, as the skill's **A message** says, built from the note *plus* the session context it stems from — the decision that superseded the other topic's ground, the reasoning, what it needs to change — so the target resolves it from cold; in a single-topic unit, said to the person in one sentence apiece, what it says and which work it points at, theirs to decide
  - Pipeline meta → written no more, any genuine substance it carries folded into the record (an open condition becomes a question on the map), never the status itself
- `conflicts-read` — no two current answers on the topic contradict each other.
- `findings-rerun` — **unverified claims**: every load-bearing empirical claim about the codebase or toolchain, whatever session made it. Each measured or exploratory finding a decision rests on is run again by its command; construct the obvious measurement where none is recorded, and record it as a finding with its command and result. The record's own figures, and anything asserted as verified earlier, are claims — not measurements. A load-bearing claim no command can check is softened to observation, its finding replaced as `read`. A value that has changed is replaced, `--reason was-wrong`, with the new result; each decision relying on it is then confirmed (`ledger hold`) or raised as its replacement (`raise --replaces`).

Where your reads changed anything, tell the person conversationally — do not dump a diff: one short paragraph or a handful of bullets describing what was added, removed, or corrected and why.

## The Payload

`product-lines-shown` — the product-record lines and any candidates, for the screen that shows the close: an epic's decided screen, a feature's ready to build. Write them to `.ledger/.cache/{work_unit}/discussion/{topic}/decided-payload.json` — `{"lines": [{"text", "why", "widens"}], "withdraws": [{"line", "why"}], "candidates": [...]}`: each product-record line the closing pass found, `widens` the id of the decision it makes a rule for the whole product, one line to a decision; where a rule of the record should go, its line by id with why, `withdraws` left out where none should; and each candidate, work no topic owns that holds a call the person would make, with its reason.
- **An epic's candidate** is `{"name", "reason", "brief"}`, named as a topic, `brief` the path of its brief's draft under `.ledger/.cache/{work_unit}/discussion/{topic}/`: what the work is, where it was read, why it matters, and its open questions. One matching a waiting roadmap item takes it in, `"from_roadmap": "{item}"`.
- **A single-topic unit's candidate** parks on the roadmap at the yes: `{"name", "reason", "horizon"}`, named as a roadmap item, on the horizon the person named.

Once it is written, mark the item done.

## The Close

Close the checklist: `checklist close decided {work_unit} {topic}`. Then stage the payload. An epic's topic draws the decided screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render decided {work_unit}.{topic} --file .ledger/.cache/{work_unit}/discussion/{topic}/decided-payload.json
```

A feature's topic closes into its spec with no gate, what it decided shown with ready to build; stage it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs decided stage {work_unit} {topic} --file .ledger/.cache/{work_unit}/discussion/{topic}/decided-payload.json
```

A line widening a decision the product record already widens is refused, naming that entry: leave the line out of the payload, stage it again, and say in a line that it is in the record already. A yes refused for a product-record line resting on a decision replaced since: where its rule still holds, stage a line widening the replacement, in the same words; where it should go, withdraw the line. Then draw the screen again.

An epic's screen asks a verdict of each call the person changed, one at a time; after each, draw `render decided {work_unit}.{topic} --alone`. A Comment that changes a product-record line changes the payload, staged again with `--file`. One keeping a struck candidate after all undoes its strike, `decided unstrike {work_unit} {topic} {n}`. Once what a refused yes names is fixed, draw the screen again.
