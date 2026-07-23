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

→ Return to caller.

#### If `yes`

→ Proceed to **B. Dispatch Perspective Agents**.

---

## B. Dispatch Perspective Agents

Record the pair in one dispatch — the engine allocates a shared set number and answers with the `set` and each lens's content-file path; no files are created (a file's later existence is that agent's completion signal). Labels are slash- and dot-free: drop any dots a lens name carries.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind perspective --label {lens-a:(kebabcase)} --label {lens-b:(kebabcase)}
```

**Agent path**: `../../../agents/workflow-discussion-perspective.md`

Dispatch **all perspective agents in parallel** via the Task tool with `run_in_background: true`.

Each perspective agent receives:

1. **Lens** — the assigned lens from the polarity pair (e.g., `Formal Systems`, `Tail-Risk`)
2. **Decision topic** — the decision being explored
3. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
4. **Output file path** — that lens's `file` from the dispatch response. The agent writes its completed argument there — pure markdown, never frontmatter.

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

Record the dispatch against the completed set — the engine joins the synthesis to its perspectives by the set number and refuses a second live synthesis for the same set (re-dispatch over a closed one replaces it — the engine discards the stale report):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind synthesis --set {set}
```

Then close out the consumed perspective rows — synthesis has read them; they are never surfaced. One call per perspective id in the set still `pending` (a re-dispatch for a dead synthesis arrives with the lenses already closed — skip them):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} discussion {topic} {perspective_id}
```

**Agent path**: `../../../agents/workflow-discussion-synthesis.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The synthesis agent receives:

1. **Perspective file paths** — paths to all perspective files in this set
2. **Decision topic** — the decision being explored
3. **Output file path** — the `file` from the dispatch response. The agent writes its completed landscape there — pure markdown with one `### {ID}: {label}` section per tension (`T1`, `T2`, …), never frontmatter.

The synthesis agent also compares the Restatement sections from each perspective. If lenses diverge meaningfully on what the decision IS — different scope, different question, or one lens answering an unasked question — synthesis records a **Framing alignment** tension as `T1` so it surfaces first. This is the Problem Restate Gate's payoff: wrong-question failures get caught before the user acts on a tradeoff landscape.

The synthesis agent returns:

```
STATUS: complete
DECISION: {topic}
TENSIONS: {T1,T2,… — every id in the report; omit when none}
TENSIONS_COUNT: {N}
SUMMARY: {1-2 sentences}
```

The discussion continues — do not wait for the agent to return.

---

## D. Check and Surface

This section handles two responsibilities: promoting completed perspective sets to synthesis, and surfacing synthesis findings via the never-dump protocol.

**Perspective completion check** — run `agent scan` and group the `perspective` rows by their `set` field. For each set, if every perspective row in the set is `pending` (one still `in-flight` is an agent still running) AND no live `synthesis` row carries that `set` (an `incorporated` one is closed — the engine permits a fresh dispatch over it), proceed to **C. Dispatch Synthesis Agent** for that set. Rows an earlier session dispatched are dead, not running: incorporate a dead lens together with its set's landed siblings (a half-dead council can no longer synthesise — re-offer the pair if the decision still matters). A dead synthesis: incorporate it, then re-dispatch via **C. Dispatch Synthesis Agent** for its set — the engine permits the fresh `--kind synthesis --set {set}`, and the lens files persist for the new agent to read.

**Synthesis surfacing** — a synthesis report carries tensions that must NOT be dumped. Delegate presentation to the shared surfacing protocol.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `synthesis`, work_unit = `{work_unit}`, phase = `discussion`, topic = `{topic}`.

**Deriving subtopics during presentation**: When the user engages with a raised tension, reframe it as a practical subtopic tied to project constraints and record it on the Discussion Map as `pending` (`node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic}`). Commit the update.

**Perspective files**: The shared protocol handles the synthesis file only. The individual perspective files remain available for reference if the user wants to drill into a specific angle — mention their existence during presentation if relevant, but do not read them out.
