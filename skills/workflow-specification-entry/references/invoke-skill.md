# Invoke the Skill

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled.

Invoke the [technical-specification](../../technical-specification/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on verb and source material.

#### If `work_type` is `feature`

```
Specification session for: {work_unit}

Source material:
- Discussion: .workflows/{work_unit}/discussion/{topic}.md

Work unit: {work_unit}
Action: {verb} specification

Invoke the technical-specification skill.
```

#### If `work_type` is `bugfix`

```
Specification session for: {work_unit}

Source material:
- Investigation: .workflows/{work_unit}/investigation/{topic}.md

Work unit: {work_unit}
Action: {verb} specification

Invoke the technical-specification skill.
```

#### If `work_type` is `epic`

Read the spec's source discussions from the manifest: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} sources`. List each source discussion file.

```
Specification session for: {topic}

Source material:
- .workflows/{work_unit}/discussion/{source-discussion-1}.md
- .workflows/{work_unit}/discussion/{source-discussion-2}.md
- ...

Work unit: {work_unit}
Topic: {topic}
Action: {verb} specification

Invoke the technical-specification skill.
```
