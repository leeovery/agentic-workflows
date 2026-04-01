# Reconcile Pending Topics

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Reconcile manifest entries to reflect the current research analysis. This ensures surfaced topics are visible to discovery as pending discussions before the user starts discussing them.

## A. Create Pending Entries

For each topic identified in the research analysis (loaded or freshly generated in the previous step), convert the topic name to kebab-case (e.g., "Data Schema Design" → `data-schema-design`) and check if a discussion entry already exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.discussion.{topic_kebab}
```

**If `false`** — create a pending entry:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discussion.{topic_kebab}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic_kebab} status pending
```

**If `true`** — skip. Leave existing entries untouched regardless of their status.

Repeat for all topics, then:

→ Proceed to **B. Remove Stale Entries**.

---

## B. Remove Stale Entries

Using `discussions.files` from discovery, check each discussion with `status === 'pending'`. Convert each analysis topic name to kebab-case and check if the pending entry's name matches any of them.

**If NOT found in the analysis** — delete the stale pending entry:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discussion items.{topic_kebab}
```

**If found** — skip. The entry is still valid.

**CRITICAL**: Only delete `pending` entries during reconciliation. Never touch `in-progress`, `completed`, or `skipped` entries.

→ Return to caller.
