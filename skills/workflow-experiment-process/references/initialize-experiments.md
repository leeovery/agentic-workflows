# Initialize Experiments

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Read the Phase Inputs

The durable inputs live in the manifest and at fixed paths — read them here; the handoff never carries them.

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

#### If `work_type` is not `epic`

The carrier discovery left has two halves — read both. First the manifest `description`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

Then the discovery session log's **Exploration** — single-phase work has exactly one log, at `.workflows/{work_unit}/discovery/sessions/session-001.md`. A legacy work unit may have no log, or a placeholder whose **Exploration** is absent or `(none)`.

→ Proceed to **B. Check for Research**.

#### Otherwise

The brief just read is the carrier — nothing more to read here.

→ Proceed to **B. Check for Research**.

## B. Check for Research

Completed research reaches a topic two ways: under the topic's own name, and through provenance — a rerouted or split-out topic carries its origin in its discovery item's `source` (`reroute:{origin}`, `legacy-split:{parent}`, or the historical `research-analysis:{parent}` / `research-split:{parent}`), naming the topic whose research contributed it.

Read the topic's own research status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status
```

Then the topic's provenance (empty for non-epic work — no discovery map item):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} source
```

Each such entry (values comma-accumulate) names a contributing topic — read each parent's `{work_unit}.research.{parent}` status the same way; a parent with no research item contributes nothing.

#### If any status read is `completed`

> *Output the next fenced block as markdown (not a code block):*

```
> Completed research was found for this topic — reading it in full to seed the experiments.
```

Read each completed file in full — `.workflows/{work_unit}/research/{topic}.md` and every completed parent's `.workflows/{work_unit}/research/{parent}.md`, each file once. Research is the series' richest input: its hypotheses are candidate questions, and its exploratory sightings are the hunches an experiment turns into dependable numbers — never evidence in their own right.

→ Proceed to **C. Register**.

#### Otherwise

No completed research for this topic.

→ Proceed to **C. Register**.

## C. Register

The inputs just read are inherited ground, not a list of questions to re-ask. Decisions discovery or research already reached with the user carry forward as working position; the experiments test what they left uncertain. Hold what emerged as candidate questions for the session — the register stays empty until the first experiment is conceived in conversation.

1. Register in manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} experiment {topic}
   ```
2. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}): initialize {topic} experiments"
   ```

→ Return to caller.
