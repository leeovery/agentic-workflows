# Brief Synthesis

*Reference for **[workflow-discovery](../SKILL.md)***

---

Loaded by [topic-synthesis.md](topic-synthesis.md) E on the confirmed harvest, while the whole exploration is still in context. A **brief** is a per-topic *view* — one topic's slice of the discovery record (soft decisions, reasoning, rejected paths, open questions), projected out of the source-of-truth logs. It is regenerated freely at every harvest that touches its topic; it is never a record. Overwrite it without hesitation. Writes the briefs for the confirmed set, reconciles brief files against any topics the harvest restructured, and flags downstream work that a regenerated brief now post-dates.

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

## B. Lifecycle — Split / Merge / Drop

When the harvest restructured topics that were already on the map, keep brief files and `brief_path` pointers in step with the confirmed set. Apply whichever operations occurred. The new topics' briefs are written in **A**; this section only removes what the restructuring orphaned.

**Split** — parent `P` became children `C1`, `C2`:

```bash
rm -f .workflows/{work_unit}/discovery/briefs/{parent}.md
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery.{parent} brief_path
```

**Merge** — topics `A` and `B` became `M`. For each absorbed topic:

```bash
rm -f .workflows/{work_unit}/discovery/briefs/{absorbed}.md
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery.{absorbed} brief_path
```

**Drop** — topic `T` removed from the set:

```bash
rm -f .workflows/{work_unit}/discovery/briefs/{topic}.md
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery.{topic} brief_path
```

New topics with no prior brief need no cleanup. `delete` fails loudly when the field is absent — run it only for a topic that actually carried a `brief_path` (a committed map topic with a prior brief); skip it otherwise. The `rm -f` is safe to run unconditionally.

→ Proceed to **C. Propagation**.

## C. Propagation — Flag, Don't Overwrite

For each brief **regenerated** in **A** (the topic already had a brief before this harvest), check whether downstream research or discussion work exists for that topic:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.research.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discussion.{topic}
```

A topic routes to one of the two. If either returns a non-empty item, flag it to reconcile:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{research|discussion}.{topic} reconcile_needed true
```

This is a signal, not a rewrite — it never touches the downstream artifact's content. Soft can prompt re-examination; it can never overwrite hard. The downstream phase surfaces the flag when it next runs. First-write briefs have no prior downstream work — skip them.

→ Return to caller.
