# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Read the Phase Inputs

The durable inputs live in the manifest and at fixed paths — read them here.

#### If `phase_status` is `in-progress` or `completed`

A restart — skip the reads; the session gathers context naturally.

→ Proceed to **C. Create and Register**.

#### Otherwise

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

→ Load **[read-prior-record.md](../../workflow-shared/references/read-prior-record.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`.

**If `work_type` is not `epic`:**

The carrier discovery left has two halves — read both. First the manifest `description`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

Then the discovery session log's **Exploration** — single-phase work has exactly one log, at `.workflows/{work_unit}/discovery/sessions/session-001.md`.

→ Proceed to **C. Create and Register**.

**Otherwise:**

The brief just read is the carrier — unless the topic was started fresh from the epic menu.

→ Proceed to **B. Gather Context**.

## B. Gather Context

The map item's `source` says whether the topic was shaped on the discovery map or started fresh from the epic menu:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} source
```

#### If the output is exactly `direct-start`

The topic was started fresh, not shaped on the map — there is no curated carrier, so interview.

→ Load **[gather-context.md](gather-context.md)** and follow its instructions as written.

→ On return, proceed to **C. Create and Register**.

#### Otherwise

→ Proceed to **C. Create and Register**.

## C. Create and Register

The inputs just read are inherited ground, not a list of questions to re-ask. Exploring adjacent territory is this phase's job; putting a decision discovery already reached back to the user as an open question is not. Where exploration turns up something that genuinely undercuts one, raise it in the conversation, or carry it as a thread (origin `conversation`), rather than reopening the decision.

1. Load **[template.md](template.md)** — use it to create the research file at `.workflows/{work_unit}/research/{topic}.md`. When the file already exists, keep its content and write the template's working sections around it.
2. Populate the Starting Point section from whatever seeded this phase: the interview's answers when it ran, otherwise the inputs read at **A** and anything the user said in the conversation that launched this session. A prior record's queued concern enters only as **B** of **[read-prior-record.md](../../workflow-shared/references/read-prior-record.md)** places it, its case left in that record. When restarting (**A** was skipped), leave the section empty.
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} research {topic}
   ```
4. Seed the thread register — the questions the inputs leave open, judged: a question discovery already settled is inherited ground, not a thread; a question the seed, the carrier, the brief, or a prior record leaves open is one. Origin `seed` for the seed material's and the carrier's questions, `brief` for the brief's and for a prior record's — its still-standing queued concerns included, the record carrying a brief's standing — `user` for a question the interview or the launching conversation raised; a kebab slug per thread, the question as asked, `--parent` nesting a question under the top-level one it refines. When restarting (**A** was skipped), add nothing — threads enter from the conversation:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs research-threads add {work_unit} {topic} {slug} --question "{the question, as asked}" --origin {seed|brief|user} [--parent {slug}]
   ```
   Then render the register once:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render research-threads {work_unit}.research.{topic}
   ```
   Emit the call's DISPLAY section verbatim per its marker — the response is empty when nothing was seeded.
5. Commit — the manifest rides with the file:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}): initialize {topic} research"
   ```

→ Return to caller.
