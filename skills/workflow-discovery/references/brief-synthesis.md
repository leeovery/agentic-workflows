# Brief Synthesis

*Reference for **[workflow-discovery](../SKILL.md)***

---

Loaded by [topic-synthesis.md](topic-synthesis.md) E on the confirmed harvest, while the whole exploration is still in context. A **brief** is a per-topic *view* — one topic's slice of the discovery record (soft decisions, reasoning, rejected paths, open questions), projected out of the source-of-truth logs. It is regenerated at every harvest that touches its topic — overwrite freely; it is never a record. Writes the briefs for the confirmed set, reconciles brief files against any topics the harvest restructured, and flags downstream work that a regenerated brief now post-dates.

## A. Write the Briefs

For each topic in the confirmed set — the working-list new topics **plus** any existing map topic this session's exploration materially deepened — extract that topic's slice from the whole exploration (all sessions in context) and (over)write `.workflows/{work_unit}/discovery/briefs/{topic}.md`.

Note which briefs already existed on disk before this write (**regenerations**) versus which are **first writes** — **C** needs the distinction.

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

This section applies only to restructures **within the session's working list** — the set the harvest shaped and the user confirmed. Committed map items outside the working list are never restructured by a harvest (map edits go through map-operations, which owns its own log entries); their briefs are untouched here. When the confirmed working list restructured a topic that already carried a brief, keep brief files and `brief_path` pointers in step with the confirmed set. Apply whichever operations occurred — split, merge, and drop are independent, and more than one may apply in a single harvest. This section removes only what the restructuring orphaned.

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

New topics with no prior brief need no cleanup. A `delete` op fails the whole batch when the field is absent — include only topics that actually carried a `brief_path` (committed map topics with a prior brief), and skip the `apply` entirely when no orphan carried one; the `rm -f` paths are safe to include unconditionally.

→ Proceed to **C. Propagation**.

## C. Propagation

Flag downstream work, never overwrite it.

#### If no briefs were regenerated

Every write in **A** was a first brief — there is no prior downstream work to flag.

→ Return to caller.

#### Otherwise

Read both downstream phases once — every topic's items in two calls, however many briefs regenerated:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion
```

For each brief **regenerated** in **A** (the topic already had a brief before this harvest), check the subtrees for that topic's item — a topic routes to one of the two. Collect a flag op for every hit, then persist them in one call (skip when none; write the ops file with the Write tool):

```json
[{"op": "set", "path": "{work_unit}.{research|discussion}.{topic}", "fields": {"reconcile_needed": true}}]
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/discovery/reconcile-ops.json
```

This is a signal, not a rewrite — it never touches the downstream artifact's content. Soft can prompt re-examination; it can never overwrite hard. The downstream phase surfaces the flag when it next runs. First-write briefs have no prior downstream work — skip them.

→ Return to caller.
