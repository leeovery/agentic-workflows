# The Walk of One Experiment

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

A protocol, not a step: the session loop enters it for the live experiment at the section its status names — `conceived` → **B. Design**, `designed` → **C. Briefing**, `approved` or `running` → **D. Run**; **A. Conceive** opens the next record when none is live, and **F. Abandon** is the exit from any pre-terminal point — the briefing's park, or the user putting a run down. Nothing runs at load time.

The lifecycle is the design-before-data invariant made mechanical: conceived → designed → approved (the user-confirmed freeze) → running → concluded with its verdict, or abandoned with its reason from any earlier point. The engine enforces the order; this file is how each step is done well.

## A. Conceive

The next question crystallised in conversation and the user confirmed it's worth a run. Derive a kebab-case `slug` from the question, then conceive the record — the engine allocates the id and answers `dir`, the record's directory:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {slug}
```

Hold `id` and `dir` from the response.

**If the handoff carries a `Spawned from:` line and its wait is not yet recorded** — this is the walk's first conceive after a discussion's empirical-wall exit, and this experiment is the one the waiting point waits on. Record the evidence wait and commit immediately, so create and await land together:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment await {work_unit} {topic} {id}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} conceived — evidence wait recorded"
```

The same-topic discussion now cannot conclude until {id} concludes or is abandoned.

→ Proceed to **B. Design**.

## B. Design

Author `{dir}/design.md` with the user — load **[design-template.md](design-template.md)** for the skeleton and the conditional sections. The conversation does the designing: what exactly is the question, what do we predict and why, what rule settles it, how will we measure. Depth scales with the shape — a ten-minute local test writes four lines per section; a multi-day run writes pages — but the skeleton never scales away, and one primary question is the width limit: anything else measured is explicitly secondary, and a second primary question is the next experiment.

When the design is written, record the step and commit — the commit carries the design file and the manifest together:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment advance {work_unit} {topic} {id}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} designed — {slug}"
```

→ Proceed to **C. Briefing**.

## C. Briefing

Present the design conversationally in plain terms, as markdown paragraphs — never a file dump: what we'll do, what we expect and why, and what each outcome triggers ("if the rule reads X we do A; if Y, B"). The user's challenges are part of the method — changes fold into `design.md` now, before the freeze, and the amended design is re-presented.

Then fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-approval-gate {work_unit}.experiment.{topic} --id {id}
```

**STOP.** Wait for user response.

#### If `approve`

Record the freeze — from here the design changes only by the amendment protocol:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment approve {work_unit} {topic} {id}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} approved — design frozen"
```

→ Proceed to **D. Run**.

#### If the user asks for changes

Fold them into `design.md`, re-present, and re-render the gate — the record is still `designed`, so the same gate serves the amended design.

→ Return to **C. Briefing**.

#### If `park`

The experiment is put down before it ran. Take the one-line reason from the conversation — ask when it isn't stated.

→ Proceed to **F. Abandon**.

## D. Run

**If the record is `approved`:** measurement begins on the user's go — usually right after the freeze, sometimes a later sitting. When it begins, record it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment advance {work_unit} {topic} {id}
```

**If the record is already `running`:** a resumed run — read what `report.md` holds and pick the measurement up where it left off.

Execute the setup as designed — the instruments, sample, and environment the design froze. Author `{dir}/report.md` as the run goes — load **[report-template.md](report-template.md)** for its shape at the first result:

- **Results land as they're measured.** Every number traces to a file under `{dir}` (curated extracts in `{dir}/data/`) or a named source. Raw output is kept by default; genuinely bulky output may stay out of git with the report linking it by path. Commit after each write (session-loop cadence).
- **Deviations are logged as they happen** — the harness broke, the environment surprised. The record shows the run as it went.
- **The design is frozen.** A change it genuinely needs from here follows **[amendment-protocol.md](amendment-protocol.md)** — dated, re-confirmed, and only while no results are visible.

When measurement is complete:

→ Proceed to **E. Report and Verdict**.

## E. Report and Verdict

Complete the report: the reading (kept separate from the results it reads), the conclusion executing the pre-registered decision rule, and the reproduce notes. A measure conceived after seeing the data is labelled **exploratory** — it can motivate the next experiment, never settle this one. Walk the user through what was measured and what the rule says it means — the conclusion is the rule's outcome, not a fresh judgment.

Then record the verdict — one line, the decision rule's outcome:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment conclude {work_unit} {topic} {id} --verdict "{one line}"
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} concluded"
```

When the conclude response carries `released_wait`, say in one line where the ball sits: the same-topic discussion's wait on this experiment is released, and the evidence surfaces when that discussion next opens. When it carries `reconcile_flagged`, name the downstream work it flagged the same way.

Re-render the register — the series moved — and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

→ Return to caller.

## F. Abandon

Abandonment is a first-class terminal — the register keeps the row and its reason, and nothing is erased. Record it with the one-line reason, then commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment abandon {work_unit} {topic} {id} --reason "{one line}"
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} abandoned"
```

When the response carries `released_wait`, say in one line where the ball sits: the same-topic discussion's wait on this experiment is released, and the abandonment — with its reason — surfaces when that discussion next opens.

Re-render the register and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

→ Return to caller.
