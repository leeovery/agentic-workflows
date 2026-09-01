# The Run

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Begin Measurement

Re-read the record — a session can arrive here holding a stale status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

Take `{id}`'s `status` from the response, and note its live sub-experiments — `E{n}.{m}` rows under `{id}` that are neither `concluded` nor `abandoned`.

#### If the record is `approved`

The go was given at the freeze — the approve option starts measurement, and a later sitting re-enters through the menu. Record that it begins:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment advance {work_unit} {topic} {id}
```

→ Proceed to **B. Measure as Designed**.

#### If the record is `running` and live sub-experiments exist

A resumed split — the open rows finish first.

→ Proceed to **C. Splits**.

#### If the record is `running`

A resumed run — pick the measurement up where `{dir}/report.md` leaves off.

→ Proceed to **B. Measure as Designed**.

#### Otherwise

The record is terminal — a peer session closed it, and its verdict or reason stands. Say so in one line.

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

## B. Measure as Designed

Execute the setup as designed — the instruments, sample, and environment the design froze. The run is mostly autonomous; choose the execution shape that produces the most dependable results, as the design proposed: doing it directly, writing deterministic code that does the work while you run and observe it, background shells with monitors, or ad-hoc sub-agents (Agent tool) for independent legs. No custom workflow agents exist for this phase. Harness code is instrument, not product code — it lives in `{dir}`; ephemeral working files use `.workflows/.cache/{work_unit}/experiment/{topic}/`.

Author `{dir}/report.md` as the run goes — load **[report-template.md](report-template.md)** for its shape at the first result:

- **Results land as they're measured.** Every number traces to a file under `{dir}` (curated extracts in `{dir}/data/`) or a named source. Raw output is kept by default; genuinely bulky output may stay out of git with the report linking it by path.
- **Deviations are logged as they happen** — the harness broke, the environment surprised. The record shows the run as it went.
- **The design is frozen** — changes are dated amendments, never silent edits.
- **Commit after each write** — don't batch; the history is the safety net across context refresh:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} — {what changed}"
  ```

#### If the design needs a change

→ Load **[amendment-protocol.md](amendment-protocol.md)** and follow its instructions as written.

→ On return, return to **B. Measure as Designed**.

#### If the question decomposes mid-run

Two primary questions where the design saw one.

→ Proceed to **C. Splits**.

#### If the user abandons the run

→ Load **[abandon-experiment.md](abandon-experiment.md)** with id = `{id}`.

→ On return, proceed as the reference directed.

#### Otherwise

Measure until the design is satisfied, then close the report's results.

→ Return to caller.

## C. Splits

The split is the laboratory's internal method — it never leaks into the spawning conversation's state: the wait stays on the parent and releases once, when the parent as a whole ends. A split never splits again. The parent's `{id}` and `{dir}` bindings hold in this file — the walk below names each sub directly, and a loaded leg binds its own `{id}`/`{dir}` to the sub for its duration.

On a fresh decomposition, say what decomposed and how in one or two lines, then for each part derive a kebab-case `sub_slug` and create its record — the engine allocates `E{n}.{m}`, nested inside the parent's directory:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {sub_slug} --parent {id}
```

On a resume the parts are already on the register — create nothing; each live sub is picked up at whatever leg its status names.

Walk each sub in miniature, holding its `id` and `dir` — from the create response, or on a resume from the register and `{dir}`'s subdirectories — as `{sub_id}` and `{sub_dir}`:

1. **Design** — a sub abandoned here ends on its own row; skip its remaining legs.

   → Load **[design-experiment.md](design-experiment.md)** with id = `{sub_id}`, dir = `{sub_dir}`.

2. **Freeze** — the gate renders over the sub's id; an abandon here ends the sub on its own row — skip its remaining legs.

   → Load **[briefing.md](briefing.md)** with id = `{sub_id}`, dir = `{sub_dir}`.

3. **Run** — record that the sub's measurement begins (a sub resumed already `running` skips this call):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs experiment advance {work_unit} {topic} {sub_id}
   ```

   Then measure under **B. Measure as Designed**'s discipline — the sub's frozen design, its report at `{sub_dir}/report.md`, its measurement commits naming `{sub_id}` in the subject.

   A sub abandoned mid-measurement ends on its own row — skip its verdict:

   → Load **[abandon-experiment.md](abandon-experiment.md)** with id = `{sub_id}`.

4. **Verdict** — execute the sub's pre-registered decision rule and record it — a sub's terminal transition releases no wait; the parent's carries them:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs experiment conclude {work_unit} {topic} {sub_id} --verdict "{one line}"
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {sub_id} concluded"
   ```

   A refused conclude records nothing and takes no commit — say why in one line, fix what it names (a multi-line verdict becomes its one-line outcome), and re-run the pair.

When every sub is terminal, the parent's measurement completes by synthesising the sub reports.

→ Return to **B. Measure as Designed**.
