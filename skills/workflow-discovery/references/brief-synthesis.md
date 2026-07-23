# Brief Synthesis

*Reference for **[workflow-discovery](../SKILL.md)***

---

Loaded by [topic-synthesis.md](topic-synthesis.md) E on the confirmed harvest, while the whole exploration is still in context. A **brief** is a per-topic *view* — one topic's slice of the discovery record (soft decisions, reasoning, rejected paths, open questions), projected out of the source-of-truth logs. It is regenerated at every harvest that touches its topic — overwrite freely; it is never a record. Writes the briefs for the confirmed set, reconciles brief files and pointers against the harvest, and flags in-flight downstream work the fresh briefs post-date.

## A. Write the Briefs

For each topic in the confirmed set — the working-list new topics **plus** any existing map topic this session's exploration materially deepened — extract that topic's slice from the whole exploration (all sessions in context) and (over)write `.workflows/{work_unit}/discovery/briefs/{topic}.md`.

Note which written topics are existing committed map topics — **B**'s pointer backfill checks their pointers.

The brief is a written artifact, not user output — write the file, do not render it. Word every decision plainly and naturally: softness is conferred by where the brief lives on the gradient, not by hedged wording. Empty sections get `(none)`.

```markdown
# Discovery Brief — {topic:(titlecase)}

Drawn from discovery session(s) {coarse session range}.

## Soft decisions

{decisions reached, plainly, with the reasoning behind each}

## Rejected paths

{paths set aside, with why — so the next phase doesn't re-derive them}

## Open questions

{unresolved threads carried forward for the next phase}
```

→ Proceed to **B. Lifecycle**.

## B. Lifecycle

Keep brief files and `brief_path` pointers in step with the confirmed set. The restructure cleanup below applies only to restructures **within the session's working list** — the set the harvest shaped and the user confirmed. Committed map items outside the working list are never restructured by a harvest (map edits go through map-operations, which owns its own log entries); their briefs are untouched here. Apply whichever operations occurred — split, merge, and drop are independent, and more than one may apply in a single harvest. This section removes only what the restructuring orphaned.

Collect the orphaned topics across every operation that occurred — **split** orphans the parent (children's briefs are written in **A**), **merge** orphans each absorbed topic (the merged topic's brief is written in **A**), **drop** orphans the removed topic — then clean them all up in two calls: one `rm -f` naming every orphaned brief file, and one `apply` deleting every `brief_path` pointer (write the ops file with the Write tool first):

```bash
rm -f .workflows/{work_unit}/discovery/briefs/{parent}.md .workflows/{work_unit}/discovery/briefs/{absorbed}.md
```

```json
[{"op": "delete", "path": "{work_unit}.discovery.{parent}", "field": "brief_path"}]
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/discovery/brief-cleanup-ops.json
```

New topics with no prior brief need no cleanup. A `delete` op fails the whole batch when the field is absent — include only topics that actually carried a `brief_path` (committed map topics with a prior brief); the `rm -f` paths are safe to include unconditionally.

**Pointer backfill** — the write direction of the same bookkeeping: a brief written in **A** for an existing committed topic whose map item lacks `brief_path` has a file but no pointer (new working-list topics get theirs from the persist batch). Keying on the pointer, not the file, also heals briefs orphaned by an interrupted prior harvest. Read each written committed topic's pointer (`get` prints nothing when absent) and add one set op per lacking topic to the same ops file:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} brief_path
```

```json
[{"op": "set", "path": "{work_unit}.discovery.{topic}", "fields": {"brief_path": "discovery/briefs/{topic}.md"}}]
```

Skip the `apply` when the ops file would hold no ops at all.

→ Proceed to **C. Propagation**.

## C. Propagation

Flag downstream work, never overwrite it.

#### If **A** wrote no briefs

→ Return to caller.

#### Otherwise

Read both downstream phases once — every topic's items in two calls, however many briefs were written:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion
```

For each brief written in **A**, check the subtrees for that topic's item — a topic routes to one of the two. A hit is in-flight downstream work the fresh brief post-dates: a regenerated brief changed content the phase may have read; a first-written brief covers work that started brief-less and has never been read at all. Collect a flag op for every hit, then persist them in one call (skip when none; write the ops file with the Write tool):

```json
[{"op": "set", "path": "{work_unit}.{research|discussion}.{topic}", "fields": {"reconcile_needed": true}}]
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/discovery/reconcile-ops.json
```

This is a signal, not a rewrite — it never touches the downstream artifact's content. Soft can prompt re-examination; it can never overwrite hard. The downstream phase surfaces the flag when it next runs.

→ Return to caller.
