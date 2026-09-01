# Topic Completion

*Reference for **[workflow-research-process](../SKILL.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

The current topic is converging — tradeoffs are clear, it's approaching decision territory.

First check the topic's triage queue — a queued concern is work the conclusion cannot pass, and a review dispatched over it would read a file the walk is about to move:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} research {topic}
```

**If `count` is non-zero:**

Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.research.{topic}
```

→ Return to caller.

**If `count` is `0`:**

Check the topic's evidence waits next — a spawned experiment still open means the conclusion cannot pass, and the engine would refuse the completion anyway (`get` prints empty when no wait is held):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} awaiting_experiments
```

**If the wait output is non-empty:**

Render the gate and emit its sections verbatim per their markers — the blocker line, its guidance, then the menu:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-wait-gate {work_unit}.research.{topic}
```

**STOP.** Wait for user response.

**If `pause`:**

Commit any uncommitted session work with the session's cadence commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}/{topic}): {what changed}"
```

Then say where the ball sits:

> *Output the next fenced block as markdown (not a code block):*

```
> Paused with the experiment(s) queued — the closing ceremony waits for the evidence. Run `/clear`, then `/workflow-start`: the menu carries the way in, and this research concludes once the waits release.
```

**STOP.** Do not proceed — terminal condition.

**If `keep`:**

→ Return to caller.

**If the wait output is empty:**

→ Load **[final-review.md](final-review.md)** and follow its instructions as written.

→ Load **[document-review.md](document-review.md)** and follow its instructions as written.

→ Load **[compliance-check.md](../../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

Judge the dead-end question before rendering: pass `--dead-end` **only** when `work_type` is `epic` and the session's own conclusion is that this topic gives the product nothing to carry forward under its own name — the thread didn't pan out, or its useful facts serve only other topics, where provenance and the knowledge base already deliver them. In the common case — the research surfaced material this topic's discussion will ratify — the flag is omitted and the row never appears.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render research-conclude-gate {work_unit}.research.{topic} [--dead-end]
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If `conclude`

→ Load **[conclude-research.md](conclude-research.md)** with closure = `discussion`.

#### If `dead-end`

Mark the map item first — no commit; the conclusion's own commit carries the manifest change:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map handle {work_unit} {topic}
```

Concluding leaves the research completed and indexed as normal; the file stays on the map and in the knowledge base as record and seed material. Route on the response:

**If the write succeeded, or `ok: false` reports the topic already closed** (a resumed conclusion, or a peer session's close — the marker is set either way):

→ Load **[conclude-research.md](conclude-research.md)** with closure = `dead-end`.

**If `ok: false` for any other reason:**

The marker never landed, so nothing concludes over it. Surface the engine's error verbatim.

→ Return to caller.

#### If `keep`

Continue exploring. The convergence signal isn't a stop sign — it's an awareness check. The user might want to stress-test the emerging conclusion, explore edge cases, or understand the problem more deeply before moving on.

→ Return to caller.
