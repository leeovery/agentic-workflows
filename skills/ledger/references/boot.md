# Boot

*Reference for **[ledger](../SKILL.md)** and **[ledger-keep](../../ledger-keep/SKILL.md)***

---

On the bare command, with no words, fetch the banner first:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render banner
```

Boot runs next, given the words, and its answer says where the start goes. A migration may change `.claude/settings.json`, so run it with the sandbox disabled, the words on stdin as they stand, the call described as `Start Ledger`:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs boot <<'WORDS'
{words}
WORDS
```

**CRITICAL**: Use `dangerouslyDisableSandbox: true` when calling the Bash tool for this command, and for every boot the start runs again. Every boot the start runs again is this one, words and all.

A failed boot (`ok: false`, or a non-zero exit) is a migration that must never half-run silently: surface its error. **STOP.** Do not proceed — terminal condition.

Surface the answer's `warnings` first, whatever else it says. Then follow it, branching on nothing else.

## Boot's Stops

Boot names the stop it made in `stop`: what to show, and what follows. Where it names a `marker`, say it on a line of its own, **`▪ {marker}`**. Where it names a `surface`, fetch it with its `args` after it, in order:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render {surface} {args}
```

Then its `next`:
- **None** — the start ends there. **STOP.** Do not proceed — terminal condition.
- **`gate`** — the screen asks the person. Of the `next` their answer returns, a boot's is followed afresh; anything else runs, then boot runs again; a null `next` ends the start.
- **`load`** — load the reference it names, with what its `with` gives, then boot again:
  - `migration-checks`: Load **[migration-checks.md](migration-checks.md)** and follow its instructions as written, with folder = `{folder}`.
  - `migration-directive`: Load **[migration-directive.md](migration-directive.md)** and follow its instructions as written, with directive = `{directive}` and file = `{file}`.
  - `migration-review`: Load **[migration-review.md](migration-review.md)** and follow its instructions as written.

## A Setup Screen

Fetch the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render {screen}
```

A MENU's answer goes to `gate`: run the `next` it returns, and each `next` a call answers after it, until one answers none: the screen is done. A DATA naming the call the person's words answer — `knowledge-ask`'s `the reply:` — is the next to run once they have answered.
- **An engine call**: surface its `warnings`.
- **A refusal that names its way on**: take that way. A call it names draws the screen that tells the person what they need: run it, showing neither the refusal's text nor the call. Carrying on with the start: say the refusal in a line, and go on.
- **A refusal that names none**: surface it; the start ends. **STOP.** Do not proceed — terminal condition.
- **A handoff**: Load **[handing-off.md](../../ledger-shared/references/handing-off.md)** with route = `/{skill} {args}`.
- **`continue`**: as the screen's own line says.
