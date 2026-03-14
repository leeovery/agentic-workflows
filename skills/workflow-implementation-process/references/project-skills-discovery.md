# Project Skills Discovery

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Check `project_skills` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} project_skills
```

#### If `project_skills` is populated

Present the existing configuration for confirmation:

> *Output the next fenced block as markdown (not a code block):*

```
Previous session used these project skills:
- `{skill-name}` — {path}
- ...

· · · · · · · · · · · ·
Keep these project skills?

- **`y`/`yes`** — Keep and proceed
- **`c`/`change`** — Re-discover and choose skills
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### If `change`

Clear `project_skills` and fall through to discovery below.

#### If `project_skills` is empty

Query the phase-level recommendation:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation project_skills
```

#### If phase-level is a non-empty array and user accepts

Present the shortened recommendation menu:

> *Output the next fenced block as markdown (not a code block):*

```
Previous implementations used these project skills:
- `{skill-name}` — {path}
- ...

· · · · · · · · · · · ·
Use the same project skills?

- **`y`/`yes`** — Use the same and proceed
- **`n`/`no`** — Analyse for project skills (picks up any changes)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:** Copy phase-level array to topic level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills [{phase-level values}]
```
→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**If `no`:** Fall through to discovery below.

#### If phase-level is an empty array

> *Output the next fenced block as markdown (not a code block):*

```
Previous implementations used no project skills.

· · · · · · · · · · · ·
Skip project skills again?

- **`y`/`yes`** — Skip and proceed
- **`n`/`no`** — Analyse for project skills
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:** → Return to **[the skill](../SKILL.md)** for **Step 5**.

**If `no`:** Fall through to discovery below.

#### If no phase-level field exists

Fall through to discovery below.

#### If `.claude/skills/` does not exist or is empty

> *Output the next fenced block as a code block:*

```
No project skills found. Proceeding without project-specific conventions.
```

Write to phase level so future topics receive a recommendation:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation project_skills []
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### If project skills exist

Scan `.claude/skills/` for project-specific skill directories. Present findings:

> *Output the next fenced block as markdown (not a code block):*

```
Found these project skills that may be relevant to implementation:
- `{skill-name}` — {brief description}
- `{skill-name}` — {brief description}
- ...

· · · · · · · · · · · ·
Which project skills should be used?

- **`a`/`all`** — Use all listed skills
- **`n`/`none`** — Skip project skills
- **List the ones you want** — e.g. "golang-pro, react-patterns"
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `none`:**

Write to phase level so future topics receive a recommendation:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation project_skills []
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**Otherwise:**

Store the selected skill paths via manifest CLI, pushing each path individually:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit}.implementation.{topic} project_skills "{path1}"
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit}.implementation.{topic} project_skills "{path2}"
```

Write to phase level so future topics receive a recommendation:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation project_skills ["{path1}","{path2}"]
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
