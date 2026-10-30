# Format Version Check

*Shared reference. Loaded by `leeway-planning-process` (plan initialisation and session setup), `leeway-scoping-process` (format selection), `leeway-implementation-process` (adapter load), and `leeway-review-process` (plan read) — before a session's first command against a plan format's tool.*

---

The caller provides `format`, and `work_unit`, `topic` and `phase` (the session's own).

## A. Read the Declaration

Read the **Version** section of the format's **[about.md](../../leeway-planning-process/references/output-formats/{format}/about.md)**. It declares the tool, the version it requires, the command that prints the installed version with the shape of its output, and where the update instructions live.

#### If the section declares nothing to check

→ Return to caller.

#### Otherwise

→ Proceed to **B. Compare**.

---

## B. Compare

Run the declared command and take the installed version from its output; where the command fails because the tool is not installed, there is no installed version. The check passes when the installed version satisfies the requirement.

#### If the check passes

→ Return to caller.

#### Otherwise

Write what the check found to `.workflows/.cache/{work_unit}/{phase}/{topic}/format-version.json` with the Write tool — `{"tool": "{tool}", "installed": "{installed version}", "format": "{format}", "required": "{required version}", "update_instructions": "{where the update instructions live}"}`, leaving `installed` out where the command failed — then fetch the blocker and emit both sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render format-version-check --file .workflows/.cache/{work_unit}/{phase}/{topic}/format-version.json
```

**STOP.** Wait for user response.

→ Return to **B. Compare**.
