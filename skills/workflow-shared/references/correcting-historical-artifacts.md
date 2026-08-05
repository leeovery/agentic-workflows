# Correcting Historical Artifacts

*Shared reference for all workflow skills.*

---

Load this when a phase artifact belonging to **another work unit** — surfaced by a knowledge query or read directly — carries a claim you have verified is wrong or has shifted. Completed work units keep their knowledge-base chunks live at full confidence, so a wrong claim left standing is re-served as validated context to every future query — and an edit that skips the re-index leaves the store serving the old content indefinitely.

Derive the owning work unit from the artifact's path (`.workflows/{owning_work_unit}/…`), then read its status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {owning_work_unit} status
```

#### If `in-progress`

Do not edit the artifact from outside — corrections to live work flow through the owning unit's own phase. Tell the user what you found and where it belongs: re-entering that unit's phase for the artifact's topic reopens the item, and re-completion re-indexes the knowledge base automatically. A claim that stems from a decision (not a factual error) belongs in the owning unit's discussion, not the artifact that inherited it.

→ Return to caller.

#### If `cancelled`

Cancellation removed the unit's chunks from the knowledge base, and reactivation re-indexes from disk. Edit the file freely — no corrigendum, no re-index.

→ Return to caller.

#### If `completed`

Present the wrong claim, the evidence, and the proposed correction in the conversation, then confirm — editing another work unit's record is never silent. Skip the confirmation only when executing an already-approved plan task that names these steps.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Apply the correction protocol to {artifact path}?
**`y/yes`** → Edit in place + corrigendum + knowledge re-index
**`n/no`**  → Leave the artifact as-is
```

**STOP.** Wait for user response.

**If `no`:**

→ Return to caller.

**If `yes`:**

1. **Edit in place.** Replace the wrong claims in the affected sections with corrected content. The live file is current truth; git history is the historical record — never keep wrong content in the body for posterity.

2. **Corrigendum block.** At the top of the file, directly beneath the title, add (or extend, one entry per correction):

   ```markdown
   > **Corrigendum {YYYY-MM-DD}** (from `{correcting_work_unit}`): {original claim, quoted} — corrected: {what is true}.
   ```

3. **Re-index.** Replaces the file's existing chunks in one idempotent call:

   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {artifact path}
   ```

4. **Commit.** Scoped to the owning unit; the store rides along (every engine commit stages `.workflows/.knowledge`):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {owning_work_unit} -m "{phase}({owning_work_unit}): corrigendum from {correcting_work_unit}"
   ```

The owning unit's manifest is never touched — no reopen, no status change; the unit stays completed.

**Phase judgment**: specifications and investigations state facts — correct them whenever they are wrong. A discussion is a record of a conversation; when rewriting the record is worse than losing its retrieval, remove its chunks instead and leave the file as history:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {owning_work_unit} --phase discussion --topic {topic}
```

→ Return to caller.
