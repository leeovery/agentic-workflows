# Project Skills Discovery

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

## A. Resolve Configuration

Read topic-level `project_skills` via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} project_skills
```

#### If `project_skills` is populated

The set was confirmed when this topic stored it — use it without re-asking.

→ Return to caller.

#### Otherwise

Check whether a project-level default `project_skills` exists and read its value via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists project.defaults.project_skills
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.defaults.project_skills
```

**If `false`:**

→ Proceed to **C. Discovery**.

**If `true` and project default is populated:**

→ Proceed to **B. Confirm Skills**.

**If `true` and project default is empty:**

Fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render project-skills {work_unit}.implementation.{topic} --variant skipped
```

**STOP.** Wait for user response.

**If `yes`:**

→ Return to caller.

**If `no`:**

→ Proceed to **C. Discovery**.

---

## B. Confirm Skills

Write the skill names from the project default — each path's last segment — to `.workflows/.cache/{work_unit}/implementation/{topic}/project-skills.json` with the Write tool — `{"skills": ["{skill-name}", ...]}` — then fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render project-skills {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/project-skills.json --variant confirm
```

**STOP.** Wait for user response.

#### If `yes`

Copy to topic level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} project_skills '[{project-level values}]'
```

→ Return to caller.

#### If `no`

→ Proceed to **C. Discovery**.

---

## C. Discovery

Scan `.claude/skills/` for project-specific skill directories — skills carrying this project's own conventions and patterns (e.g. golang-pro, react-patterns). The workflow system's own skills (`workflow-*`) are never project skills. A missing or empty `.claude/skills/` finds nothing.

#### If the scan finds no project skills

> *Output the next fenced block as a code block:*

```
No project skills found. Proceeding without project-specific conventions.
```

Store empty array at topic and project level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} project_skills '[]'
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.project_skills '[]'
```

→ Return to caller.

#### If the scan finds project skills

Write the findings to `.workflows/.cache/{work_unit}/implementation/{topic}/project-skills.json` with the Write tool — one entry per skill, its `detail` a one-line description of what the skill governs: `{"skills": [{"name": "{skill-name}", "detail": "{what it governs}"}]}` — then fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render project-skills {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/project-skills.json --variant discovery
```

**STOP.** Wait for user response.

#### If `none`

Store empty array at topic and project level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} project_skills '[]'
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.project_skills '[]'
```

→ Return to caller.

#### Otherwise

Store the selected skill paths via `engine manifest`, pushing each path individually to topic level and setting the project default:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} project_skills "{path1}"
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} project_skills "{path2}"
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.project_skills '["{path1}","{path2}"]'
```

→ Return to caller.
