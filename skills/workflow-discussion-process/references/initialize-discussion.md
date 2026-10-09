# Initialize Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## A. Read the Phase Inputs

The durable inputs live in the manifest and at fixed paths — read them here.

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

→ Load **[read-prior-record.md](../../workflow-shared/references/read-prior-record.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`.

#### If `work_type` is not `epic`

The carrier discovery left has two halves — read both. First the manifest `description`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

Then the discovery session log's **Exploration** — single-phase work has one log, at `.workflows/{work_unit}/discovery/sessions/session-001.md`, except a cross-cutting unit promoted from an epic's specification, which has none.

→ Proceed to **B. Check for Research**.

#### Otherwise

The brief just read is the carrier — nothing more to read here.

→ Proceed to **B. Check for Research**.

## B. Check for Research

Completed research reaches a topic two ways: under the topic's own name, and through provenance — a topic created by a message or split out carries its origin in its discovery item's `source` (`message:{origin}`, `legacy-split:{parent}`, or the historical `research-analysis:{parent}` / `research-split:{parent}`), naming the topic whose research contributed it.

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
> Completed research was found for this topic — reading it in full to seed the discussion.
```

Read each completed file in full — `.workflows/{work_unit}/research/{topic}.md` and every completed parent's `.workflows/{work_unit}/research/{parent}.md`, each file once.

→ Proceed to **D. Create and Register**.

#### Otherwise

No completed research for this topic.

→ Proceed to **C. Gather Context**.

## C. Gather Context

An interview stands in for a missing carrier on a first start. A topic has none where it is an epic topic started fresh from the epic menu — the source read at **B** is exactly `direct-start` — or a cross-cutting unit promoted from an epic's specification, with no discovery session log at **A**.

#### If `phase_status` is empty or `unstarted` and the topic has no carrier

→ Load **[gather-context.md](gather-context.md)** and follow its instructions as written.

→ On return, proceed to **D. Create and Register**.

#### Otherwise

→ Proceed to **D. Create and Register**.

## D. Create and Register

The inputs just read — the seed, the brief or carrier, any prior record, and any completed research — are this discussion's **inherited position**, not a list of questions to re-ask. Decisions discovery already reached with the user carry forward as working ground: record them, build on them, let this discussion's own findings test them. Softness means such a decision *can* move when something surfaced here contradicts it, or when the user reopens it — never that it gets re-elicited on entry. Re-running settled scope as a fresh options weigh-up spends the user's time on ground they covered and puts alternatives they already rejected back into the document as live material.

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Register the discussion in the manifest (the map commands below require the item to exist):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} discussion {topic}
   ```
3. Load **[template.md](template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`. When the file already exists, keep its content and write the template's working sections around it.
4. Populate the Context section and derive the initial subtopics:

   **If research was read at B:**

   Use the full research content together with the inputs read at **A** — the brief or carrier still carries decisions the research does not restate. Seed subtopics should represent the key concerns, decisions, and questions that emerged from research.

   **Otherwise:**

   Populate from the inputs read at **A**, the interview's answers when it ran, and anything the user said in the conversation that launched this session. Derive initial subtopics from whatever context is available — the seed, the brief or carrier, the topic itself, obvious architectural concerns. These are seeds, not a complete list — the map grows during discussion.

   The Context section carries the substance of what was read — the brief's soft decisions, rejected paths, and open questions land here, not a pointer to them: this file is what a resumed session inherits. A prior record's waiting message is not substance to carry: it enters only as **B** of **[read-prior-record.md](../../workflow-shared/references/read-prior-record.md)** places it, its case left in that record. List each input read — the brief, research file(s), seed file(s), a prior record's files — under Context → References, so a later session can re-open what seeded this discussion.

   Either way, this topic's own mailbox is not a seeding source: its messages enter as raises through the session loop's mailbox check, and pre-adding their titles to the map forces every fold into the wrong branch. A prior record's mailbox is not that: a message read there whose ask still applies is an open question that record left, and seeds the map beside the brief's.

5. Seed the Discussion Map — record each initial subtopic (kebab-case name; new subtopics start `pending`):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic}
   ```
6. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{topic} -m "discussion({work_unit}): initialize {topic} discussion"
   ```

→ Return to caller.
