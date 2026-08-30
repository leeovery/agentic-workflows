# Topic Completion

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

The series looks ready to conclude — the user indicated they're done, or the topic's question has enough evidence to feed its discussion.

First check the topic's triage queue — a queued concern is work the conclusion cannot pass:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} experiment {topic}
```

**If `count` is non-zero:**

Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.experiment.{topic}
```

→ Return to caller.

**If `count` is `0`:**

→ Load **[compliance-check.md](../../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

Judge the dead-end question before rendering: pass `--dead-end` **only** when `work_type` is `epic` and the session's own conclusion is that this topic gives the product nothing to carry forward under its own name — the measurements didn't pan out, or their useful facts serve only other topics, where provenance and the knowledge base already deliver them. In the common case — the series produced evidence this topic's discussion will consume — the flag is omitted and the row never appears.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-conclude-gate {work_unit}.experiment.{topic} [--dead-end]
```

**If the call answers the blocked shape** (an unfinished series — DISPLAY sections, no menu): emit its sections verbatim per their markers. Every experiment ends `concluded` with its verdict or `abandoned` with its reason before the phase closes — the walk finishes the open rows.

→ Return to caller.

**Otherwise** — emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If `conclude`

→ Load **[conclude-experiments.md](conclude-experiments.md)** with closure = `discussion`.

#### If `dead-end`

Mark the map item first — no commit; the conclusion's own commit carries the manifest change:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map handle {work_unit} {topic}
```

Concluding leaves the experiments completed and their records kept as normal; the topic stays on the map as record and seed material. Route on the response:

**If the write succeeded, or `ok: false` reports the topic already closed** (a resumed conclusion, or a peer session's close — the marker is set either way):

→ Load **[conclude-experiments.md](conclude-experiments.md)** with closure = `dead-end`.

**If `ok: false` for any other reason:**

The marker never landed, so nothing concludes over it. Surface the engine's error verbatim.

→ Return to caller.

#### If `keep`

Continue the series — there's more to measure. The readiness signal isn't a stop sign: the user might want another arm, a variance repeat, or the next question in the chain before the evidence goes to discussion.

→ Return to caller.
