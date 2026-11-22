---
name: ledger
description: Use for any change to what this project's code does, however small; for talk that turns to the product itself at length, what it is, who it is for and where it is going; and whenever the person asks to run something through Ledger. Invoke it with their words, unless this conversation is already in a Ledger phase, which takes them itself. Comments, docs and formatting that change no behaviour go straight through; in doubt, use it.
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

## Arguments

- `$ARGUMENTS` — **words**: the person's words, whole: what they asked for in the conversation — the request itself, never the go-ahead that followed it — or typed after the command. The bare command has none.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## Boot

Load **[boot.md](references/boot.md)** and follow its instructions as written, with words = `{words}`.

## The Opening

Past every stop, boot answers `go`. Work each of boot's `gates` in its order, as **The Setup Gates** says, and go where `go` says, as **Where the Start Goes** says.

## The Setup Gates

- `migration-review`: Load **[migration-review.md](references/migration-review.md)** and follow its instructions as written.
- `claude-code-floor`, `mod-notice`: Load **[claude-code-setup.md](references/claude-code-setup.md)** and follow its instructions as written, with gate = `{gate}`.
- `effort`: where boot's `effort` is a level below medium, say ``This session runs at `{effort}` effort; Ledger recommends medium or above.`` once, and carry on. At medium or above, say nothing.
- `knowledge`, `knowledge-adopt`: Load **[knowledge-gate.md](references/knowledge-gate.md)** and follow its instructions as written, with gate = `{gate}`.
- `brownfield`: Load **[brownfield-offer.md](references/brownfield-offer.md)** and follow its instructions as written.
- `session-labels`: Load **[session-label-prompt.md](references/session-label-prompt.md)** and follow its instructions as written.
- `walkthrough`, `github-rule`: work the screen `walkthrough-offer` or `github-rule-gate` as the boot reference's **A Setup Screen** says. The walkthrough's `continue` is the walk: Load **[walk.md](references/walk.md)** with origin = `first-run`.

## Where the Start Goes

- **`menu`**: Load **[start-menu.md](references/start-menu.md)** and follow its instructions as written.
- **`route`**: boot routed the words to Start's type call, or into the work they name. Invoke the skill its `route`'s `next` names, with its `args`, here in this conversation: ``Invoke `/{skill} {args}`.``

  This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
- **`pick`**: the words name work among other words, several pieces of it, or a unit that has closed; or they carry on, with several units in progress. Words that talk about the product are never picked between: invoke its `start` as `route` invokes its `next`. Otherwise fetch its `surface` with its `args` after it, in order.

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs render {surface} {args}
  ```

  Once a closed unit is drawn: Load **[start-menu.md](references/start-menu.md)** and follow its instructions as written, from **Managing a Unit**.
