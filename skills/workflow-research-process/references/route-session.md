# Route Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

Read `work_type` from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} work_type
```

#### If work_type is `feature` or `cross-cutting`

Single-topic session — no splitting offers.

→ Load **[feature-session.md](feature-session.md)** and follow its instructions as written.

#### If work_type is `epic`

Per-topic session with topic-awareness and topic-splitting on convergence.

→ Load **[epic-session.md](epic-session.md)** and follow its instructions as written.
