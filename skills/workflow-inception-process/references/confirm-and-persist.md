# Confirm and Persist

*Reference for **[workflow-inception-process](../SKILL.md)***

---

The session loop has returned with the user's `yes` on the proposed map. This step takes the working list and turns it into manifest items + a finalised session log + one commit. This is the only persistence gate in the inception phase — adds batch under one approval per the design's "safety scales with destructiveness" rule.

## A. Render the Final Map

Re-render the proposed map one more time so the user sees exactly what is about to be persisted. Use the same shape as the convergence display, but with the heading shifted to indicate this is the persistence preview:

> *Output the next fenced block as a code block:*

```
Persisting Discovery Map — {work_unit:(titlecase)}

  • {topic-1} — {summary}    [routing: {research|discussion}]
  • {topic-2} — {summary}    [routing: {research|discussion}]
  • {topic-3} — {summary}    [routing: {research|discussion}]

{N} topic(s) · all source: inception · all status: in-progress
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Confirm and persist?

- **`y`/`yes`** — Write items to the manifest and finalise the session log
- **`n`/`no`** — Return to the session for further refinement
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### If `yes`

→ Proceed to **B. Persist**.

## B. Persist

Apply the writes in this order. Treat the whole sequence as one logical change — if any step fails, surface the error and stop before the commit so the user can recover.

### B.1. Manifest writes — per topic

For each topic on the working list, in the order the user surfaced them:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} routing {research|discussion}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} source inception
```

Notes:

- `init-phase` creates the item with `status: in-progress` automatically. Inception items have no other valid status — do not pass `status` explicitly.
- The topic name is the manifest dict key (third dot-path segment). There is no separate `name` field to set.
- `summary` is the one-line description from the working list. Quote the value in shell — single quotes if it contains `[]`, `{}`, `~`, or backticks.
- `routing` is the one the user agreed to in the session.
- `source: inception` distinguishes initial-session topics from later-phase additions (`research-analysis`, `gap-analysis`, `split`, `elevation`, `direct-start`, `migration-seeded`).

### B.2. Finalise the session log

Re-read the draft `session-001.md`. Reconcile against the persisted map:

- Ensure every persisted topic appears under **Topics Identified** with its routing and one-line "Why".
- Remove any draft entries the user dropped during refinement that were never confirmed.
- Drop the **Imports** section if it is empty.
- Drop the **Considered and Discarded** section if nothing was dropped during the session.
- Populate the **Conclusion** section with the topic count. Optionally add a one-line suggestion for where to start (e.g. *"highest-uncertainty: kitchen-printers — research first"*) — only if the rationale is clear from the conversation. Skip the suggestion otherwise.

### B.3. Single commit

Stage the manifest and the finalised session log together and commit once:

```bash
git add .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-001.md
git commit -m "inception({work_unit}): seed discovery map ({N} topic(s))"
```

→ Return to caller.
