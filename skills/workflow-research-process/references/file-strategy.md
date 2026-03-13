# File Strategy

*Reference for **[workflow-research-process](../SKILL.md)***

---

Read `work_type` from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
```

#### If work_type is `feature`

Single file: `.workflows/{work_unit}/research/{topic}.md`

Feature research stays focused on the feature's scope. No splitting, no multi-file management. When the topic feels well-explored, conclude and move forward.

→ Return to **[the skill](../SKILL.md)**.

#### If work_type is `epic`

Multi-file: `.workflows/{work_unit}/research/`

Start with one file — either `exploration.md` for open research or a named `{topic}.md` for focused research. Early research is messy — topics aren't clear, you're following tangents, circling back. Don't force structure too early.

**Let themes emerge**: As research progresses, threads may become distinct enough to warrant their own files. There's no limit on the number of research topics.

**Periodic review**: Every few sessions, assess: are themes emerging? Offer to split them out. Still fuzzy? Keep exploring. A specific topic converging toward decisions? It may be ready for discussion.

→ Return to **[the skill](../SKILL.md)**.
