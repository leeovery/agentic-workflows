# Claude Code Setup

*Reference for **[workflow-start](../SKILL.md)***

---

Branch on the boot response's `gate_surface` — `not-running` means the workflows' mod can run in this Claude Code and this session did not load it, a notice the session carries on past with typed menus; `outdated` means this Claude Code is older than the mod, a stop.

#### If `gate_surface` is `not-running`

If the boot response carries `warnings`, surface them first.

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Claude Code Setup`**
```

> *Output the next fenced block as a text code block (```text fence):*

```text
  ⚑ The workflows' Claude Code mod isn't running
```

> *Output the next fenced block as markdown (not a code block):*

```
> The mod draws the workflows' menus as buttons, and this session didn't load it: the session started before the mod was installed or updated (an install or update made while a session is open loads in the next one), mods are turned off (`--safe-mode` or `--bare`, `"disableAllHooks": true`, or your organization's policy), or Anthropic has switched installed mods off remotely, which nothing on this machine turns back on.
>
> This session carries on with typed menus: they print as text, and you type your answer. A new Claude Code session in this project picks the mod up once the cause is cleared; `/plugin` names the mods a session loaded.
```

**Do not stop here.** The workflows run on their typed menus.

→ Return to caller.

#### If `gate_surface` is `outdated`

If the boot response carries `warnings`, surface them first.

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Claude Code Setup`**
```

> *Output the next fenced block as a properties code block (```properties fence):*

```properties
⚑ This Claude Code is too old for the workflows
```

> *Output the next fenced block as markdown (not a code block):*

```
> The workflows run on Claude Code 2.1.287 or newer. Update Claude Code — `claude update` in a terminal, or update the Desktop app — then start a new session in this project and run `/workflow-start`.
```

**STOP.** Do not proceed — terminal condition.
