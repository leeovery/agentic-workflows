# Linter Setup

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Discover and configure project linters for use during the TDD cycle's LINT step. Linters run after every REFACTOR to catch mechanical issues (formatting, unused imports, type errors) that are cheaper to fix immediately than in review.

---

## A. Resolve Configuration

Read topic-level `linters` via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} linters
```

#### If `linters` is populated

The set was confirmed when this topic stored it — use it without re-asking.

→ Return to caller.

#### Otherwise

Read the project-level default `linters` via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.defaults.linters
```

**If output is empty (never set):**

→ Proceed to **C. Discovery**.

**If output is a populated array:**

→ Proceed to **B. Confirm Linters**.

**If output is `[]` (previously skipped):**

Fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render linters {work_unit}.implementation.{topic} --variant skipped
```

**STOP.** Wait for user response.

**If `yes`:**

→ Return to caller.

**If `no`:**

→ Proceed to **C. Discovery**.

---

## B. Confirm Linters

Write the linter names from the project default to `.workflows/.cache/{work_unit}/implementation/{topic}/linters.json` with the Write tool — `{"linters": ["{name}", ...]}` — then fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render linters {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/linters.json --variant confirm
```

**STOP.** Wait for user response.

#### If `yes`

Copy to topic level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} linters '[{project-level values}]'
```

→ Return to caller.

#### If `no`

→ Proceed to **C. Discovery**.

---

## C. Discovery

Analyse the project to determine which linters are appropriate:

1. **Examine the project** — languages, frameworks, build tools, and existing configuration. Check package files, project skills in `.claude/skills/`, and any linter configs already present.
2. **Check installed tooling** — verify availability of candidate linters via the command line (e.g., `--version`). Check common install locations including package managers (brew, npm global, pip, cargo, etc.).
3. **Recommend a linter set** — based on project analysis and available tooling. Include install commands for any recommended tools that aren't yet installed.

#### If the analysis finds no candidate linters

> *Output the next fenced block as a code block:*

```
No linters found for this project. Proceeding without linting during TDD.
```

Store empty array at topic and project level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} linters '[]'
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.linters '[]'
```

→ Return to caller.

#### If the analysis finds candidate linters

Write the findings to `.workflows/.cache/{work_unit}/implementation/{topic}/linters.json` with the Write tool — `installed` is what the check above actually found, and `recommendations` (omit it when there are none) carries any install commands as one line: `{"linters": [{"name": "{tool}", "detail": "{command}", "installed": true|false}], "recommendations": "{suggested tools with their install commands}"}` — then fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render linters {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/linters.json --variant discovery
```

**STOP.** Wait for user response.

#### If `yes`

Store at topic and project level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} linters '[...]'
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.linters '[...]'
```

→ Return to caller.

#### If `change`

Adjust based on user input.

→ Return to **C. Discovery**.

#### If `skip`

Store empty array at topic and project level:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} linters '[]'
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.linters '[]'
```

→ Return to caller.
