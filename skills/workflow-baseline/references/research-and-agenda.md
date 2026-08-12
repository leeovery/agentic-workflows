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
4. **For a deepened area** (its doc `.workflows/.baseline/{area}.md` already exists): the doc path and the deepen brief — investigate the named deeper ground only; the doc holds what the first pass covered

> **CHECKPOINT**: Do not proceed until every dispatched agent has returned.

→ Proceed to **B. Build the Agendas**.

## B. Build the Agendas

For each area dispatched in A, read `.workflows/.baseline/.state/dossier-{area}.md` and build the interview agenda at `.workflows/.baseline/.state/agenda-{area}.md`:

1. **Select** from the dossier's question candidates. Keep a question when its answer lives in the user's head — intent, history, constraints, the meaning of an opaque name — or when a load-bearing observed claim deserves the user's confirmation ("is this a fair description?"). Anything else the code settles is not a question; fold it into the observed layer instead.
2. **Rank** by how likely a future phase is to need the answer: load-bearing decisions and opaque domain semantics first, curiosities last. Cap an area's agenda at what an interview can sustain — roughly 4–10 questions.
3. **Dedupe across areas** — one underlying decision asks once, on the area where it is most at home.
4. **Write** the agenda — for a deepened area, append the new questions after the existing entries; recorded answers are never rewritten:

```markdown
# Agenda: {area}

### Q1: {the question, carrying its evidence — specific enough to jog memory}

- **Evidence**: {what the code shows that raises this — stable names, no line numbers}
- **Candidates**: {2–4 plausible answers, one line each}
- **Status**: pending

### Open Threads

- OPEN: {each un-selected question candidate, unresolved inference, and boundary note naming uncovered ground — one line each; author-doc carries these into the doc's Open Questions}
```

Mark each dispatched area:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.areas.{area} researched
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "baseline: research dossiers and interview agendas"
```

→ Return to caller.
