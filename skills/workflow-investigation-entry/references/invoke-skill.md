# Invoke the Skill

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

#### If source is `new`

Re-read the manifest `description` discovery left as the seed carrier (the latest session log's Exploration was read into context at Step 3):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

Fill the Bug context from that carrier (discovery path) or the `gather-context` answers (logless path) — it primes the process, not a full report; `workflow-investigation-process` does the deep symptom gathering (Step 3) and a knowledge-base query (Step 4):

```
Investigation session for: {work_unit}

Output: .workflows/{work_unit}/investigation/{topic}.md

Bug context:
- Expected behavior: {from the carrier / gather-context}
- Actual behavior: {from the carrier / gather-context}
- Initial context: {error messages, reproduction steps — from the carrier / gather-context, or "(none captured yet)"}

Invoke the workflow-investigation-process skill.
```

Invoke the [workflow-investigation-process](../../workflow-investigation-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `continue`

```
Investigation session for: {work_unit}

Source: existing investigation
Output: .workflows/{work_unit}/investigation/{topic}.md

Invoke the workflow-investigation-process skill.
```

Invoke the [workflow-investigation-process](../../workflow-investigation-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
