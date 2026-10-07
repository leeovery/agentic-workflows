# Session Label Prompt

*Reference for **[workflow-start](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Session Labels`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> You're running inside tmux. The workflows can rename your tmux session to show where you're working — `myproject · payments · discussion · auth-flow` inside a phase, `myproject · payments` at its menu — putting the original name back at the start menu and when the session ends, and bringing the label back when you resume the session. You're asked once per project.
```

Fetch the opt-in and emit its `MENU: label gate` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render label-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Record the choice. If the command fails (`ok: false`), surface its error and continue — the prompt returns at a future start once the project manifest is fixed. If it succeeds carrying `warnings`, surface them and continue — the choice is recorded; the hooks or the commit will be re-tried at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label-config true
```

→ Return to caller.

**If `no`:**

Record the choice. If the command fails (`ok: false`), surface its error and continue — the prompt returns at a future start once the project manifest is fixed. If it succeeds carrying `warnings`, surface them and continue — the choice is recorded; the hooks or the commit will be re-tried at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label-config false
```

→ Return to caller.
