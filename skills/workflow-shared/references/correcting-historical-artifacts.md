# Correcting Historical Artifacts

*Shared reference for all workflow skills.*

---

Load this when **another work unit's specification** — surfaced by a knowledge query or read directly — carries a claim you have verified is wrong or has shifted. The specification is the golden record: completed, its knowledge-base chunks stay live at full confidence, so a wrong claim left standing is re-served as validated context to every future query — and an edit that skips the re-index leaves the store serving the old content indefinitely. No other phase artifact is ever corrected — research, discussion, and investigation feed the spec and decay in the knowledge base; a wrong claim in one is superseded by current work and left to age out.

Derive the owning work unit from the specification's path (`.workflows/{owning_work_unit}/…`), then read its status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {owning_work_unit} status
```

#### If `in-progress`

Do not edit the specification from outside — corrections to live work flow through the owning unit's own phase. Tell the user what you found and where it belongs: re-entering that unit's specification for the topic reopens the item, and re-completion re-indexes the knowledge base automatically. A claim that stems from a decision (not a factual error) belongs in the owning unit's discussion, not the spec that inherited it.

→ Return to caller.

#### If `cancelled`

Cancellation removed the unit's chunks from the knowledge base, and reactivation re-indexes from disk. Edit the specification freely — no corrigendum, no re-index.

→ Return to caller.

#### If `completed`

Present the wrong claim, the evidence, and the proposed correction in the conversation, then confirm — editing another work unit's record is never silent. Present a large correction set as its shape — what moved, which sections, counts — with the full list available on request. Skip the confirmation only when executing an already-approved plan task that names these steps.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Apply the correction protocol to {specification path}?

**`y/yes`**  → Edit in place + corrigendum + knowledge re-index
**`v/view`** → Show the full correction list
**`n/no`**   → Leave the specification as-is
```

**STOP.** Wait for user response.

**If `view`:**

Present the full correction list — each wrong claim, its evidence, and its proposed correction — then re-present the gate.

**STOP.** Wait for user response.

**If `no`:**

→ Return to caller.

**If `yes`:**

1. **Edit in place.** Replace the wrong claims in the affected sections with corrected content. The live file is current truth; git history is the historical record — never keep wrong content in the body for posterity.

2. **Corrigenda section.** Append the entry to the end of the `## Corrigenda` section at the bottom of the file, appending the section as the file's last when absent. One entry per correction — and a mechanical, uniform substitution landing across many lines (a rename, a moved path) is a single correction: one entry stating the mapping — old term → new term, throughout — never an entry per edited line:

   ```markdown
   > **Corrigendum {YYYY-MM-DD}** (from `{correcting_work_unit}`): {original claim, quoted} — corrected: {what is true}.
   ```

3. **Re-index.** Replaces the file's existing chunks in one idempotent call:

   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {specification path}
   ```

4. **Commit.** Scoped to the owning unit; the store rides along (every engine commit stages `.workflows/.knowledge`):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {owning_work_unit} -m "specification({owning_work_unit}): corrigendum from {correcting_work_unit}"
   ```

The owning unit's manifest is never touched — no reopen, no status change; the unit stays completed.

→ Return to caller.
