---
name: ledger
description: Use for any change to what this project's code does, however small, and whenever the person asks to run something through Ledger — invoke it with their words, unless this conversation is already in a Ledger phase, which takes them itself. Comments, docs and formatting that change no behaviour go straight through; in doubt, use it.
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

## Arguments

- `$ARGUMENTS` — the person's words, whole: what they asked for in the conversation, or typed after the command. The bare command has none.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## Boot

Boot runs first, given the words, and its answer says where the start goes. A migration may change `.claude/settings.json`, so run it with the sandbox disabled, the words on stdin as they stand:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs boot <<'WORDS'
$ARGUMENTS
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
  - `migration-checks`: Load **[migration-checks.md](references/migration-checks.md)** and follow its instructions as written, with folder = `{folder}`.
  - `migration-directive`: Load **[migration-directive.md](references/migration-directive.md)** and follow its instructions as written, with directive = `{directive}` and file = `{file}`.
  - `migration-review`: Load **[migration-review.md](references/migration-review.md)** and follow its instructions as written.

## The Opening

Past every stop, boot answers `go`. Where it is `menu`, the bare command, fetch the banner first:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render banner
```

Then work each of boot's `gates` in its order, as **The Setup Gates** says, and go where `go` says, as **Where the Start Goes** says.

## The Setup Gates

- `migration-review`: Load **[migration-review.md](references/migration-review.md)** and follow its instructions as written.
- `claude-code-floor`, `mod-notice`: Load **[claude-code-setup.md](references/claude-code-setup.md)** and follow its instructions as written, with gate = `{gate}`.
- `effort`: where boot's `effort` is a level below medium, say ``This session runs at `{effort}` effort; Ledger recommends medium or above.`` once, and carry on. At medium or above, say nothing.
- `knowledge`: Load **[knowledge-gate.md](references/knowledge-gate.md)** and follow its instructions as written.
- `brownfield`: Load **[brownfield-offer.md](references/brownfield-offer.md)** and follow its instructions as written.
- `session-labels`: Load **[session-label-prompt.md](references/session-label-prompt.md)** and follow its instructions as written.
- `walkthrough`, `github-rule`, `github-squash`: work the screen `walkthrough-offer`, `github-rule-gate` or `github-squash-gate`. The walkthrough's `continue` is the walk: Load **[walk.md](references/walk.md)** with origin = `first-run`. A question at the offer puts back its menu alone, the screen's call with `--menu-only` added.

### A Setup Screen

Fetch the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render {screen}
```

A MENU's answer goes to `gate`: run the `next` it returns, and each `next` a call answers after it, until one answers none: the screen is done. A DATA naming the call the person's words answer — `knowledge-ask`'s `the reply:` — is the next to run once they have answered.
- **An engine call**: surface its `warnings`.
- **A refusal that names its way on**: take that way. A call it names draws the screen that tells the person what they need: run it, showing neither the refusal's text nor the call. Carrying on with the start: say the refusal in a line, and go on.
- **A refusal that names none**: surface it; the start ends. **STOP.** Do not proceed — terminal condition.
- **A handoff**: Load **[handing-off.md](../ledger-shared/references/handing-off.md)** with route = `/{skill} {args}`.
- **`continue`**: as the screen's own line says.

## Where the Start Goes

- **`menu`**: Load **[start-menu.md](references/start-menu.md)** and follow its instructions as written.
- **`route`**: boot routed the words to Start's type call, or into the work they name. Invoke the skill its `route`'s `next` names, with its `args`, here in this conversation: ``Invoke `/{skill} {args}`.``

  This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
- **`pick`**: the words name work among other words, several pieces of it, or a unit that has closed; or they carry on, with several units in progress. Fetch its `surface` with its `args` after it, in order.

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs render {surface} {args}
  ```

  Once a closed unit is drawn: Load **[start-menu.md](references/start-menu.md)** and follow its instructions as written, from **Managing a Unit**.
