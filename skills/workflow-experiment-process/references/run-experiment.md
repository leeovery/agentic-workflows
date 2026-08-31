# The Run

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Begin Measurement

#### If the record is `approved`

The go was given at the freeze — the approve option starts measurement, and a later sitting re-enters through the menu. Record that it begins:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment advance {work_unit} {topic} {id}
```

→ Proceed to **B. Measure as Designed**.

#### If the record is `running`

A resumed run — pick the measurement up where `{dir}/report.md` leaves off. A live sub-experiment resumes its own miniature walk the same way, at whatever leg its status names.

→ Proceed to **B. Measure as Designed**.

## B. Measure as Designed

Execute the setup as designed — the instruments, sample, and environment the design froze. The run is mostly autonomous; choose the execution shape that produces the most dependable results, as the design proposed: doing it directly, writing deterministic code that does the work while you run and observe it, background shells with monitors, or ad-hoc sub-agents (Agent tool) for independent legs. No custom workflow agents exist for this phase. Harness code is instrument, not product code — it lives in `{dir}`; ephemeral working files use `.workflows/.cache/{work_unit}/experiment/{topic}/`.

Author `{dir}/report.md` as the run goes — load **[report-template.md](report-template.md)** for its shape at the first result:

- **Results land as they're measured.** Every number traces to a file under `{dir}` (curated extracts in `{dir}/data/`) or a named source. Raw output is kept by default; genuinely bulky output may stay out of git with the report linking it by path.
- **Deviations are logged as they happen** — the harness broke, the environment surprised. The record shows the run as it went.
- **The design is frozen.** A change it genuinely needs from here follows **[amendment-protocol.md](amendment-protocol.md)** — dated, re-confirmed, and only while no results are visible.
- **Commit after each write** — don't batch; the history is the safety net across context refresh:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} — {what changed}"
  ```

#### If the question decomposes mid-run

Two primary questions where the design saw one.

→ Proceed to **C. Splits**.

#### If the user puts the run down

→ Load **[abandon-experiment.md](abandon-experiment.md)** with id = `{id}`.

→ On return, return to **B. Measure as Designed**.

#### Otherwise

Measure until the design is satisfied, then close the report's results.

→ Return to caller.

## C. Splits

The split is the laboratory's internal method — it never leaks into the spawning conversation's state: the wait stays on the parent and releases once, when the parent as a whole ends. Say what decomposed and how in one or two lines, then for each part derive a kebab-case `sub_slug` and create the sub-experiment — the engine allocates `E{n}.{m}`, its records nested inside the parent's directory:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {sub_slug} --parent {id}
```

Hold the response's `id` and `dir` as `{sub_id}` and `{sub_dir}`, then walk the sub in miniature — the same legs, bound to the sub:

1. **Design**: → Load **[design-experiment.md](design-experiment.md)** with id = `{sub_id}`, dir = `{sub_dir}`.
2. **Freeze**: → Load **[briefing.md](briefing.md)** with id = `{sub_id}`, dir = `{sub_dir}` — the gate renders over the sub's id.
3. **Run and report**: measure per **B. Measure as Designed** with the sub's design, its report in `{sub_dir}/report.md`, then record its verdict — a sub's terminal transition releases no wait; the parent's carries them:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs experiment conclude {work_unit} {topic} {sub_id} --verdict "{one line}"
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {sub_id} concluded"
   ```

A sub put down at its design or briefing ends abandoned on its own row — skip its run and carry on. A split never splits again. When every sub is terminal, restore id = `{id}` and dir = `{dir}` — the parent's measurement completes by synthesising the sub reports.

→ Return to **B. Measure as Designed**.
