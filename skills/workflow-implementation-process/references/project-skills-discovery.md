# Project Skills Discovery

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

## A. Resolve Configuration

Read topic-level `project_skills` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} project_skills
```

#### If `project_skills` is populated

Set `source` = `topic`.

→ Proceed to **B. Confirm Skills**.

#### Otherwise

Check if project-level default `project_skills` exists via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists project.defaults.project_skills
```

**If `false`:**

→ Proceed to **C. Discovery**.

**If `true`:**

Read project default `project_skills` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get project.defaults.project_skills
```

**If project default is populated:**

Set `source` = `project`.

→ Proceed to **B. Confirm Skills**.

**If project default is empty:**

> *Output the next fenced block as a code block:*

```
Previous implementations used no project skills.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Skip project skills again?

- **`y`/`yes`** — Skip and proceed
- **`n`/`no`** — Analyse for project skills
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Return to caller.

**If `no`:**

→ Proceed to **C. Discovery**.

---

## B. Confirm Skills

List the skills returned by the `source` level manifest query.

> *Output the next fenced block as a code block:*

```
Project skills found:

  • {skill-name} — {path}
  • ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Use these project skills?

- **`y`/`yes`** — Use and proceed
- **`n`/`no`** — Re-discover and choose skills
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

**If `source` is `project`:**

Copy to topic level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} project_skills '[{project-level values}]'
```

→ Return to caller.

**If `source` is `topic`:**

→ Return to caller.

#### If `no`

Clear topic-level `project_skills` before re-discovery:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} project_skills '[]'
```

→ Proceed to **C. Discovery**.

---

## C. Discovery

#### If `.claude/skills/` does not exist or is empty

> *Output the next fenced block as a code block:*

```
No project skills found. Proceeding without project-specific conventions.
```

Store empty array at topic and project level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} project_skills '[]'
node .claude/skills/workflow-manifest/scripts/manifest.cjs set project.defaults.project_skills '[]'
```

→ Return to caller.

#### If project skills exist

Scan `.claude/skills/` for project-specific skill directories. Present findings:

> *Output the next fenced block as a code block:*

```
Found these project skills that may be relevant to implementation:

  • {skill-name} — {brief description}
  • {skill-name} — {brief description}
  • ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which project skills should be used?

- **`a`/`all`** — Use all listed skills
- **`n`/`none`** — Skip project skills
- **List the ones you want** — e.g. "golang-pro, react-patterns"
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `none`

Store empty array at topic and project level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} project_skills '[]'
node .claude/skills/workflow-manifest/scripts/manifest.cjs set project.defaults.project_skills '[]'
```

→ Return to caller.

#### Otherwise

Store the selected skill paths via manifest CLI, pushing each path individually to topic level and setting the project default:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.implementation.{topic} project_skills "{path1}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.implementation.{topic} project_skills "{path2}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set project.defaults.project_skills '["{path1}","{path2}"]'
```

→ Return to caller.
