# Reconcile Stale Sources

*Reference for **[workflow-specification-process](../SKILL.md)** — loaded by [session-setup.md](session-setup.md), [spec-completion.md](spec-completion.md), and the shared reconcile advisory.*

---

Entered when a source row reads `stale` — its source document was re-decided after extraction, so the specification holds content from a decision that has since moved. Reconcile the logged content against the revision; never re-extract the source wholesale. `{source phase}` is the source's own phase — `discussion`, or `investigation` for a bugfix — and its artifact path follows the source ladder in **[spec-review.md](spec-review.md)**.

First check the source item's status (`engine manifest get {work_unit}.{source phase}.{source-name} status`).

#### If it is `in-progress`

The revision is not final — defer: leave the row `stale` and tell the user reconciliation waits for that item to re-conclude.

→ Return to caller.

#### Otherwise

1. Re-read the source document in full. A discussion's decision timeline marks the revision — identify which decisions changed, which were added, and which stand; an investigation carries no timeline — diff its passages against the logged content in judgment.
2. Re-read the specification for the content logged from that source.
3. Diff the two in judgment: content the revision left standing stays untouched. For each piece the revision contradicts or extends, summarize what's changing in the chat, then write the gate payload to `.workflows/.cache/{work_unit}/specification/{topic}/resurface-gate.json` with the Write tool — `{"section": "{section name}", "diff": {"context_above": […], "current": […], "proposed": […], "context_below": […]}, "full": [the full updated section's lines]}` (2 context lines each side) — and fetch the gate, emitting each section verbatim at its marked instruction (this gate stays gated even when `construction_gate_mode` is `auto`):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render resurface-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/resurface-gate.json
   ```

   **STOP.** Wait for user response. On `yes`, write the clean replacement to the specification verbatim — no silent modifications; on `view full`, re-fetch with `--view full`, emit, and **STOP** again for the same answers; on feedback, revise and re-present the gate.
4. When every changed decision is reconciled, mark the source `incorporated` and commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status incorporated
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): reconcile stale source {source-name}" --topic specification/{topic}
```

→ Return to caller.
