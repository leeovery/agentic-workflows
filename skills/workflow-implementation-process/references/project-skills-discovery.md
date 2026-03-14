# Project Skills Discovery

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

## A. Resolve Configuration

Read topic-level `project_skills` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} project_skills
```

#### If `project_skills` is populated

→ Proceed to **B. Confirm Skills**.

#### If `project_skills` is empty

Query the phase-level recommendation:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation project_skills
```

**If phase-level is populated:** → Proceed to **B. Confirm Skills**.

**If phase-level is an empty array:**

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

**If `yes`:** → Return to **[the skill](../SKILL.md)**.

**If `no`:** → Proceed to **C. Discovery**.

**If no phase-level field exists:** → Proceed to **C. Discovery**.

---

## B. Confirm Skills

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

**If source was phase-level:** Copy to topic level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills [{phase-level values}]
```

→ Return to **[the skill](../SKILL.md)**.

#### If `no`

→ Proceed to **C. Discovery**.

---

## C. Discovery

#### If `.claude/skills/` does not exist or is empty

> *Output the next fenced block as a code block:*

```
No project skills found. Proceeding without project-specific conventions.
```

Store empty array at both levels:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills []
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation project_skills []
```

→ Return to **[the skill](../SKILL.md)**.

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

Store empty array at both levels:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills []
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation project_skills []
```

→ Return to **[the skill](../SKILL.md)**.

#### Otherwise

Store the selected skill paths via manifest CLI, pushing each path individually to topic level and setting phase level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit}.implementation.{topic} project_skills "{path1}"
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit}.implementation.{topic} project_skills "{path2}"
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation project_skills ["{path1}","{path2}"]
```

→ Return to **[the skill](../SKILL.md)**.
