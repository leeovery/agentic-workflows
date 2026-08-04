# Handoff: Continue Completed Specification

*Reference for **[confirm-continue.md](../confirm-continue.md)***

---

This skill's purpose is now fulfilled.

Omit the `Consult references` block when the grouping owes none, and either sources block when the spec has none of that status.

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: {Title Case Name}

Continuing existing: .workflows/{work_unit}/specification/{topic}/specification.md [completed]

New sources to extract:
- .workflows/{work_unit}/discussion/{new-discussion-name}.md

Stale sources to reconcile (re-decided since extraction):
- .workflows/{work_unit}/discussion/{stale-discussion-name}.md

Previously extracted (for reference):
- .workflows/{work_unit}/discussion/{existing-discussion-name}.md

Consult references (read narrowly — do not extract):
- .workflows/{work_unit}/discussion/{ref-topic}.md — {slice hint}

Context: This specification was previously completed. New source discussions have been identified, and stale sources were re-decided after extraction. Extract new content, reconcile stale sources against their revisions, and maintain consistency with the existing specification.
```
