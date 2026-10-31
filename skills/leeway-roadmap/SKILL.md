---
name: leeway-roadmap
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-roadmap/scripts/gateway.cjs *), Bash(node .claude/skills/leeway/scripts/gateway.cjs *), Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Product Roadmap

The product layer above the work unit: the roadmap — horizons of shaped-but-uncommitted items: ideas, bugs and quick-fixes — and starting work from it.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

The roadmap is project-level and outside the pipeline — no work unit, no phases. The map lives on the project manifest (`roadmap`: ordered horizons + items), and item lifecycle is computed by joining `pulled_to` against the work unit it became — waiting is the absence of a join. The product's conversation that fills it is discovery's. Starting work from the roadmap hands the picked items to discovery as its seeds, and discovery's start this work creates the unit.

The skill is invoked as `open`, from the `r/roadmap` start-menu row: show the map, then start work from it, talk about the product, or return to the start menu.

---

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../leeway-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside.
2. **Read the state.** Run `node .claude/skills/leeway-engine/scripts/engine.cjs roadmap state` and reason from its response.
3. **Carry on from where the conversation was**, as if the break never happened — no recap and no announcement. Where the person's message is waiting, take it at the step it arrived at, unless it only asks to carry on. Otherwise, where the conversation was at a gate, put the gate back, fetched fresh; elsewhere continue the step it was on.

Do not guess at progress or continue from memory. The engine's state is authoritative — your recollection is not.

---

## Step 1: Home

Record where this session is working — the call also labels the tmux session where the user opted in:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs session label roadmap
```

Render the roadmap home snapshot (its TITLE section is the phase title):

```bash
node .claude/skills/leeway-roadmap/scripts/gateway.cjs view
```

The output arrives in demarcated sections: read `=== DATA` to reason from (state, `ITEMS`, `SESSIONS`, the `ACTIONS` key table — never display it); emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

Match the input to its `ACTIONS` entry by `key` or `word` and route on the entry's `action`:

#### If `action` is `open_product`

→ Load **[handing-off.md](../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery none none`.

#### If `action` is `pull`

→ Proceed to **Step 2**.

#### If `action` is `back`

Load **[start-menu.md](../leeway/references/start-menu.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

#### If the user asks a question

Answer from the DATA and the map. The question sets the gate aside; once the exchange looks settled, ask in conversation whether they are ready to move on, and on yes put it back:

→ Return to **Step 1**.

---

## Step 2: Pull

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Start Work From the Roadmap`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Pick the items to build now. Discovery takes them as its seeds and shapes the work; everything else stays on the roadmap, waiting.
```

Load **[pull.md](references/pull.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.
