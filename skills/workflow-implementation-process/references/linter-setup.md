# Linter Setup

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Discover and configure project linters for use during the TDD cycle's LINT step. Linters run after every REFACTOR to catch mechanical issues (formatting, unused imports, type errors) that are cheaper to fix immediately than in review.

---

## A. Resolve Configuration

Read topic-level `linters` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} linters
```

#### If `linters` is populated

Set `source` = `topic`.

→ Proceed to **B. Confirm Linters**.

#### Otherwise

Check if phase-level `linters` exists via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation linters
```

**If `false`:**

→ Proceed to **C. Discovery**.

**If `true`:**

Read phase-level `linters` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation linters
```

**If phase-level is populated:**

Set `source` = `phase`.

→ Proceed to **B. Confirm Linters**.

**If phase-level is empty:**

> *Output the next fenced block as a code block:*

```
Previous implementations skipped linters.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Skip linters again?

- **`y`/`yes`** — Skip and proceed
- **`n`/`no`** — Run full linter discovery
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Return to **[the skill](../SKILL.md)**.

**If `no`:**

→ Proceed to **C. Discovery**.

---

## B. Confirm Linters

List the linters returned by the `source` level manifest query.

> *Output the next fenced block as a code block:*

```
Linters found:

  • {name} — {command}
  • ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Use these linters?

- **`y`/`yes`** — Use and proceed
- **`n`/`no`** — Re-discover linters
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

**If `source` is `phase`:**

Copy to topic level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters [{phase-level values}]
```

→ Return to **[the skill](../SKILL.md)**.

**If `source` is `topic`:**

→ Return to **[the skill](../SKILL.md)**.

#### If `no`

Clear topic-level `linters` before re-discovery:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters []
```

→ Proceed to **C. Discovery**.

---

## C. Discovery

Analyse the project to determine which linters are appropriate:

1. **Examine the project** — languages, frameworks, build tools, and existing configuration. Check package files, project skills in `.claude/skills/`, and any linter configs already present.
2. **Check installed tooling** — verify availability of candidate linters via the command line (e.g., `--version`). Check common install locations including package managers (brew, npm global, pip, cargo, etc.).
3. **Recommend a linter set** — based on project analysis and available tooling. Include install commands for any recommended tools that aren't yet installed.

Present discovery findings to the user:

> *Output the next fenced block as a code block:*

```
Linter discovery:

  • {tool} — {command} (installed / not installed)
  • ...

Recommendations: {any suggested tools with install commands}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve these linters?

- **`y`/`yes`** — Approve and proceed
- **`c`/`change`** — Modify the linter list
- **`s`/`skip`** — Skip linter setup (no linting during TDD)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

Store at both levels:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters [...]
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation linters [...]
```

→ Return to **[the skill](../SKILL.md)**.

#### If `change`

Adjust based on user input.

→ Return to **C. Discovery**.

#### If `skip`

Store empty array at both levels:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters []
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation linters []
```

→ Return to **[the skill](../SKILL.md)**.
