# Perspective Agents

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the discussion session but are not for immediate use. Perspective agents argue for distinct approaches in the background. When all perspectives in a set complete, a synthesis agent reconciles them into a tradeoff landscape. Apply the dispatch and results processing instructions below when the time is right.

**Trigger conditions** — offer perspective agents when the orchestrator identifies a decision point with **genuine ambiguity** — two or more viable approaches where the tradeoffs are not obvious.

Signals:
- Multiple defensible approaches with no clear winner
- The user expresses uncertainty ("I'm not sure which...", "they both seem fine")
- The domain has known competing paradigms (e.g., relational vs document, monolith vs microservices, sync vs async)
- Explicit disagreement between orchestrator and user on the best approach

Do not fire when the decision is straightforward, the tradeoffs are already well understood, or the user has already made a confident decision.

When these conditions are met → Proceed to **A. Offer Perspectives**.

At natural conversational breaks, check for completed results → Proceed to **D. Check and Surface**.

---

## A. Offer Perspectives

Identify 2-3 distinct perspectives worth exploring. Each should be a genuinely defensible position, not a strawman.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
This decision has {N} genuinely viable approaches. Want to explore them in depth?

- **`y`/`yes`** — Spin up perspective agents to argue each position
- **`n`/`no`** — Continue without perspectives
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Continue the discussion without perspectives.

#### If `yes`

→ Proceed to **B. Dispatch Perspective Agents**.

---

## B. Dispatch Perspective Agents

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/discussion/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/discussion/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`). All agents in this set share the same `{NNN}`.

**Agent path**: `../../../agents/workflow-discussion-perspective.md`

Dispatch **all perspective agents in parallel** via the Task tool with `run_in_background: true`.

Each perspective agent receives:

1. **Perspective** — the specific angle to advocate
2. **Decision topic** — the decision being explored
3. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
4. **Output file path** — `.workflows/.cache/{work_unit}/discussion/{topic}/perspective-{NNN}-{angle}.md`
5. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: perspective
   status: pending
   created: {date}
   set: {NNN}
   perspective: {angle}
   decision: {decision topic}
   ---
   ```

Each perspective agent returns:

```
STATUS: complete
PERSPECTIVE: {angle}
SUMMARY: {1 sentence}
```

> *Output the next fenced block as a code block:*

```
Dispatched {N} perspective agents: {angle1}, {angle2}, {angle3}.
Results will be surfaced when available.
```

The discussion continues — do not wait for agents to return.

---

## C. Dispatch Synthesis Agent

This section is reached when all perspective agents in a set have completed. The synthesis agent reconciles their findings into a tradeoff landscape.

**Agent path**: `../../../agents/workflow-discussion-synthesis.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The synthesis agent receives:

1. **Perspective file paths** — paths to all perspective files in this set
2. **Decision topic** — the decision being explored
3. **Output file path** — `.workflows/.cache/{work_unit}/discussion/{topic}/synthesis-{NNN}.md`
4. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: synthesis
   status: pending
   created: {date}
   set: {NNN}
   decision: {decision topic}
   tensions: []   # sub-agent populates with T1/T2/... IDs
   surfaced: []
   announced: false
   ---
   ```

The sub-agent writes tension entries with stable IDs (`T1`, `T2`, …) into the `tensions:` list. See `agents/workflow-discussion-synthesis.md` for the schema.

The synthesis agent returns:

```
STATUS: complete
DECISION: {topic}
TENSIONS: {N}
SUMMARY: {1-2 sentences}
```

The discussion continues — do not wait for the agent to return.

---

## D. Check and Surface

This section handles both in-flight perspective checks (promote to synthesis when ready) and synthesis surfacing (apply the never-dump protocol).

### D1. Perspective Completion Check

Scan the cache directory for perspective files. For each set `{NNN}`:

- If all perspective files in the set have returned AND no synthesis file exists for that set → Proceed to **C. Dispatch Synthesis Agent** for that set.

### D2. Synthesis Surfacing

Synthesis files carry findings (`tensions:`) that must NOT be dumped. Delegate presentation to the shared surfacing protocol.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `synthesis`, cache_dir = `.workflows/.cache/{work_unit}/discussion/{topic}`, cache_glob = `synthesis-*.md`, findings_key = `tensions`.

**Deriving subtopics during presentation**: When the user engages with a tension via `explore`, reframe it as a practical subtopic tied to project constraints and add it to the Discussion Map as `pending`. Commit the update.

**Perspective files**: The shared protocol handles the synthesis file only. The individual perspective files remain available for reference if the user wants to drill into a specific angle — mention their existence during presentation if relevant, but do not read them out.
