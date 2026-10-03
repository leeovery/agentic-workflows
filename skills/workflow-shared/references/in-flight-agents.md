# In-Flight Agents

*Shared reference. Loaded by the research and discussion sessions as the session leaves — at its conclusion and at a pause.*

---

The caller provides `work_unit`, `topic`, `phase` (`research` or `discussion`), and `exit` — `conclude` or `pause`, the way the session is leaving. Leaving hands the work off, so nothing this session dispatched is left running unless the user chooses to leave it.

After return, the caller reads `result` from conversation memory: `leave` — nothing of this session's is in flight, or the user chose to leave it running — or `stay` — the conversation has the turn, and the session leaves on a later attempt.

## A. Check

Read the store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

Its `in_flight` list holds the agents dispatched and not yet returned. An agent an earlier session dispatched cannot still be running — each row's `created` timestamp tells you which those are. Close those the phase's way:

- **Research** — enter **C. Land and Fold** in **[deep-dive-agent.md](../../workflow-research-process/references/deep-dive-agent.md)** — it closes the dead rows and folds what landed.
- **Discussion** — close each (`agent incorporate`). A dead `synthesis` row is the exception: handle it per **D. Check and Surface** in **[perspective-agents.md](../../workflow-discussion-process/references/perspective-agents.md)** — closed *and* re-dispatched, so the council's tensions aren't lost.

Then re-scan and count this session's `in_flight` rows alone.

#### If a fold ended on a question to the user

Set `result = stay`.

→ Return to caller.

#### If no agents are in flight

Set `result = leave`.

→ Return to caller.

#### If agents are still running and the discussion close's review-running gate `yes` led here

The wait is already chosen — no second ask.

→ Proceed to **B. Wait for Results**.

#### If agents are still running

Fetch the gate — with `--pause` when `exit` is `pause`, so its rows name the pause:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render in-flight-agents-gate {work_unit}.{phase}.{topic} --count {N} [--pause]
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `wait`:**

→ Proceed to **B. Wait for Results**.

**If `proceed`:**

Set `result = leave`.

→ Return to caller.

## B. Wait for Results

Watch for `agent scan` to promote each in-flight row to `pending`. When none remain in flight, take in what came back — the session leaving is the natural break, so the break check will pass:

- **Research** — fold each per **C. Land and Fold** in **[deep-dive-agent.md](../../workflow-research-process/references/deep-dive-agent.md)**.
- **Discussion** — delegate surfacing to the surfacing protocol loaded by **[review-agent.md](../../workflow-discussion-process/references/review-agent.md)** and **[perspective-agents.md](../../workflow-discussion-process/references/perspective-agents.md)**. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time.

Set `result = stay`.

→ Return to caller.
