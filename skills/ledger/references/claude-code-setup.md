# Claude Code Setup

*Reference for **[ledger](../SKILL.md)***

---

Branch on the gate — `mod-notice` means Ledger's mod can run in this Claude Code and this session did not load it, a notice the session carries on past with typed menus; `claude-code-floor` means this Claude Code is older than the mod, a stop.

#### If gate is `mod-notice`

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Claude Code Setup`**
```

> *Output the next fenced block as a text code block (```text fence):*

```text
  ⚑ Ledger's Claude Code mod isn't running
```

> *Output the next fenced block as markdown (not a code block):*

```
> The mod draws Ledger's menus as buttons, and this session didn't load it: the session started before the mod was installed or updated (an install or update made while a session is open loads in the next one), mods are turned off (`--safe-mode` or `--bare`, `"disableAllHooks": true`, or your organization's policy), or Anthropic has switched installed mods off remotely, which nothing on this machine turns back on.
>
> This session carries on with typed menus: they print as text, and you type your answer. A new Claude Code session in this project picks the mod up once the cause is cleared; `/plugin` names the mods a session loaded.
```

**Do not stop here.** Ledger runs on its typed menus.

→ Return to caller.

#### If gate is `claude-code-floor`

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Claude Code Setup`**
```

> *Output the next fenced block as a properties code block (```properties fence):*

```properties
⚑ This Claude Code is too old for Ledger
```

> *Output the next fenced block as markdown (not a code block):*

```
> Ledger runs on Claude Code 2.1.287 or newer. Update Claude Code — `claude update` in a terminal, or update the Desktop app — then start a new session in this project and run `/ledger`.
```

**STOP.** Do not proceed — terminal condition.
