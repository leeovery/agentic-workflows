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

At natural conversational breaks, check for completed results → Proceed to **D. Check for Results**.

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
   ---
   ```

The synthesis agent returns:

```
STATUS: complete
DECISION: {topic}
TENSIONS: {N}
SUMMARY: {1-2 sentences}
```

The discussion continues — do not wait for the agent to return.

---

## D. Check for Results

Scan the cache directory for perspective and synthesis files.

#### If all perspective files in a set are complete and no synthesis file exists for that set

→ Proceed to **C. Dispatch Synthesis Agent**.

#### If a synthesis file with `status: pending` exists

→ Proceed to **E. Surface Findings**.

#### Otherwise

Nothing to surface. Continue the discussion.

---

## E. Surface Findings

1. Read the synthesis file (and perspective files if needed for detail)
2. Update all files in the set to `status: read`

> *Output the next fenced block as a code block:*

```
Perspective analysis complete: {decision topic}

{N} perspectives explored. {M} key tensions identified.
```

Summarise the key tensions, strongest arguments, and decision criteria conversationally. The user can ask for more detail on any perspective.

**Do not read out the full perspective files.** Surface the tradeoff landscape — what's at stake, what the decision hinges on.

**Deriving questions**: Extract decision criteria and unresolved questions from the synthesis. Reframe them as practical questions tied to the project's constraints. Add unresolved questions to the discussion file's Questions list (as unchecked items). Commit the update.

**Marking as incorporated**: After findings have been discussed and their questions explored (or deliberately set aside), update all files in the set to `status: incorporated`. No commit needed for cache file status changes.
