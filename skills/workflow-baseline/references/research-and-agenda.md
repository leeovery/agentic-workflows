# Research and Agenda

*Reference for **[workflow-baseline](../SKILL.md)***

---

Fan researcher agents out over the pending areas, then synthesise their dossiers into per-area interview agendas. The agents' real product is questions — the interview is where the WHY layer gets captured, and these agendas are its material.

## A. Dispatch

Read the area map and collect every area whose status is `pending`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.baseline.areas
```

> *Output the next fenced block as a code block:*

```
Researching the pending areas — one agent per area, in parallel.
This runs against the code only; nothing is asked of you yet.
```

Dispatch **one agent per pending area, all in parallel** via the Task tool.

- **Agent path**: `../../../agents/workflow-baseline-researcher.md`

Each agent receives:

1. **Area name** and its one-line coverage description (from scoping; when resuming without it in context, derive it from the area name)
2. **Output file path** — `.workflows/.baseline/.state/dossier-{area}.md`
3. **Sibling areas** — the full area list, so the agent leaves adjacent ground to its neighbours

> **CHECKPOINT**: Do not proceed until every dispatched agent has returned.

**If an agent failed or its dossier is missing:** re-dispatch that area once; if it fails again, tell the user which area's research failed and continue with the dossiers that exist — the area stays `pending` and a later resume retries it.

→ Proceed to **B. Build the Agendas**.

## B. Build the Agendas

For each researched area, read `.workflows/.baseline/.state/dossier-{area}.md` and build the interview agenda at `.workflows/.baseline/.state/agenda-{area}.md`:

1. **Select** from the dossier's question candidates. Keep a question only when its answer lives in the user's head — intent, history, constraints, rejected alternatives, the meaning of an opaque name. Anything the code itself settles is not a question; fold it into the observed layer instead.
2. **Rank** by how likely a future phase is to need the answer: load-bearing decisions and opaque domain semantics first, curiosities last. Cap an area's agenda at what an interview can sustain — roughly 4–10 questions; the tail lands as `OPEN:` items in the area doc, not as questions.
3. **Dedupe across areas** — one underlying decision asks once, on the area where it is most at home.
4. **Write** the agenda:

```markdown
# Agenda: {area}

### Q1: {the question, carrying its evidence — specific enough to jog memory}

- **Evidence**: {what the code shows that raises this — stable names, no line numbers}
- **Candidates**: {2–4 plausible answers, one line each}
- **Status**: pending
```

Mark each researched area:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.areas.{area} researched
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "baseline: research dossiers and interview agendas"
```

→ Return to caller.
