# Confirm and Persist

*Reference for **[workflow-inception-process](../SKILL.md)***

---

## A. Manifest writes — per topic

For each topic on the working list, in the order the user surfaced them:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} routing {research|discussion}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} source inception
```

If any command fails, surface the error and stop before the commit so the user can recover.

Notes:

- `init-phase` creates the item with `status: in-progress` automatically. Inception items have no other valid status — do not pass `status` explicitly.
- The topic name is the manifest dict key (third dot-path segment). There is no separate `name` field to set.
- `summary` is the one-line description from the working list. Quote the value in shell — single quotes if it contains `[]`, `{}`, `~`, or backticks.
- `routing` is the value the user agreed to during the session.
- `source: inception` distinguishes initial-session topics from later-phase additions (`research-analysis`, `gap-analysis`, `split`, `elevation`, `direct-start`, `migration-seeded`).

→ Proceed to **B. Finalise the session log**.

## B. Finalise the session log

Populate the **Conclusion** section with the topic count. Optionally add a one-line suggestion for where to start (e.g. *"highest-uncertainty: kitchen-printers — research first"*) — only if the rationale is clear from the conversation. Skip the suggestion otherwise.

→ Proceed to **C. Single commit**.

## C. Single commit

Stage the manifest and the finalised session log together and commit once:

```bash
git add .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-001.md
git commit -m "inception({work_unit}): seed discovery map ({N} topic(s))"
```

→ Return to caller.
