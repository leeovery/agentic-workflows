# Invoke the Skill

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

#### If `work_type` is `feature`

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: {work_unit}

Source material:
- Discussion: .workflows/{work_unit}/discussion/{topic}.md

Work unit: {work_unit}
Action: {verb} specification

#### If `work_type` is `bugfix`

```
Specification session for: {work_unit}

Source material:
- Investigation: .workflows/{work_unit}/investigation/{topic}.md

Work unit: {work_unit}
Action: {verb} specification

#### If `work_type` is `epic`

Read the spec's source discussions from the manifest: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources`. List each source discussion file.

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: {topic}

Source material:
- .workflows/{work_unit}/discussion/{source-discussion-1}.md
- .workflows/{work_unit}/discussion/{source-discussion-2}.md
- ...

Work unit: {work_unit}
Topic: {topic}
Action: {verb} specification

#### If `work_type` is `cross-cutting`

Check for completed research: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status`. Include the `Research:` line only when the status is `completed`; omit it otherwise.

```
Specification session for: {work_unit}

Source material:
- Discussion: .workflows/{work_unit}/discussion/{topic}.md
- Research: .workflows/{work_unit}/research/{topic}.md

Work unit: {work_unit}
Action: {verb} specification
