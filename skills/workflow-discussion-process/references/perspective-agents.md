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

When these conditions are met → Proceed to **A. Select Polarity Pair**.

At natural conversational breaks, check for completed results → Proceed to **D. Check and Surface**.

---

## A. Select Polarity Pair

Match the decision topic against the polarity-pair table below. Pick the pair whose tension most closely fits the decision; if no clear match, use the default pair (last row). Each lens is a generic, predictable analytical position — pairs are deliberate counterweights so the angles are guaranteed orthogonal.

| Decision keywords | Pair | Tension |
|---|---|---|
| api, contract, schema, protocol, types, abstraction | **Formal Systems** ↔ **Incentive Realist** | What can be mechanized vs how actors actually behave |
| ship, release, launch, ready, when, timing, iterate | **Ship Now** ↔ **Strategic Timing** | Pragmatic urgency vs decisive moment |
| bug, recurring, regression, leak, debt, again, repeat | **Direct Fix** ↔ **Systems Thinker** | Solve the symptom vs redesign the feedback loop |
| scale, risk, failure, outage, fault, rare, edge, tail | **Common Path** ↔ **Tail-Risk** | Optimise the 95% case vs rare catastrophic dominates cost |
| ux, user, interface, customer, configure, options | **User-Centric** ↔ **Capability-First** | Less but better vs expose the power |
| structure, hierarchy, taxonomy, monolith, microservices, organise | **Classifier** ↔ **Emergence** | Predictable categories vs let structure emerge |
| design, approach, strategy, architecture _(default)_ | **Assumption Destroyer** ↔ **First-Principles** | Top-down questioning vs bottom-up rebuilding |

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
This decision sits on a {tension description} tension. Want to explore both lenses?

- **`y`/`yes`** — Spin up perspective agents arguing each lens
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

1. **Lens** — the assigned lens from the polarity pair (e.g., `Formal Systems`, `Tail-Risk`)
2. **Decision topic** — the decision being explored
3. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
4. **Output file path** — `.workflows/.cache/{work_unit}/discussion/{topic}/perspective-{NNN}-{lens}.md`
5. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: perspective
   status: pending
   created: {date}
   set: {NNN}
   lens: {lens}
   decision: {decision topic}
   ---
   ```

Each perspective agent restates the decision through its lens before arguing (Problem Restate Gate) and returns:

```
STATUS: complete
LENS: {lens}
RESTATEMENT: {one sentence}
SUMMARY: {1 sentence}
```

> *Output the next fenced block as a code block:*

```
Dispatched 2 perspective agents: {lens A}, {lens B}.
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

The synthesis agent also compares the Restatement sections from each perspective. If lenses diverge meaningfully on what the decision IS — different scope, different question, or one lens answering an unasked question — synthesis records a **Framing alignment** tension as `T1` so it surfaces first. This is the Problem Restate Gate's payoff: wrong-question failures get caught before the user acts on a tradeoff landscape.

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

This section handles two responsibilities: promoting completed perspective sets to synthesis, and surfacing synthesis findings via the never-dump protocol.

**Perspective completion check** — scan the cache directory for perspective files. For each set `{NNN}`, if all perspective files in the set have returned AND no synthesis file exists for that set, proceed to **C. Dispatch Synthesis Agent** for that set.

**Synthesis surfacing** — synthesis files carry findings (`tensions:`) that must NOT be dumped. Delegate presentation to the shared surfacing protocol.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `synthesis`, cache_dir = `.workflows/.cache/{work_unit}/discussion/{topic}`, cache_glob = `synthesis-*.md`, findings_key = `tensions`.

**Deriving subtopics during presentation**: When the user engages with a raised tension, reframe it as a practical subtopic tied to project constraints and add it to the Discussion Map as `pending`. Commit the update.

**Perspective files**: The shared protocol handles the synthesis file only. The individual perspective files remain available for reference if the user wants to drill into a specific angle — mention their existence during presentation if relevant, but do not read them out.
