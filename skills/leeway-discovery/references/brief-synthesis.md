# Brief Synthesis

*Reference for **[leeway-discovery](../SKILL.md)***

---

Loaded by [topic-synthesis.md](topic-synthesis.md) E on the confirmed harvest, while the whole exploration is still in context. A **brief** is a per-topic *view* — one topic's slice of the discovery record (soft decisions, reasoning, rejected paths, open questions), projected out of the source-of-truth logs. It is regenerated at every harvest that touches its topic — overwrite freely; it is never a record. Writes the briefs for the confirmed set, and reconciles brief files and pointers against the harvest.

## A. Write the Briefs

For each topic in the confirmed set — the working-list new topics **plus** any existing map topic this session's exploration materially deepened — extract that topic's slice from the whole exploration (all sessions in context) and (over)write `.workflows/{work_unit}/discovery/briefs/{topic}.md`.

Note which written topics are existing committed map topics — **B**'s pointer backfill checks their pointers.

The brief is a written artifact, not user output — write the file, do not render it. Word every decision plainly and naturally: softness is conferred by where the brief lives on the gradient, not by hedged wording. Every line traces to the record: a soft decision is one the conversation settled. A point the user left open goes under **Open questions** — a lean they voiced without settling it (*"I suspect we should…"*) included, carried there as their lean — and so does a suggestion of yours they never took up; neither is ever promoted into a decision. Empty sections get `(none)`.

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
node .claude/skills/leeway-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/discovery/brief-cleanup-ops.json
```

New topics with no prior brief need no cleanup. A `delete` op fails the whole batch when the field is absent — include only topics that actually carried a `brief_path` (committed map topics with a prior brief); the `rm -f` paths are safe to include unconditionally.

**Pointer backfill** — the write direction of the same bookkeeping: a brief written in **A** for an existing committed topic whose map item lacks `brief_path` has a file but no pointer (new working-list topics get theirs from the persist batch). Keying on the pointer, not the file, also heals briefs orphaned by an interrupted prior harvest. Read each written committed topic's pointer (`get` prints nothing when absent) and add one set op per lacking topic to the same ops file:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} brief_path
```

```json
[{"op": "set", "path": "{work_unit}.discovery.{topic}", "fields": {"brief_path": "discovery/briefs/{topic}.md"}}]
```

Skip the `apply` when the ops file would hold no ops at all.

→ Return to caller.
