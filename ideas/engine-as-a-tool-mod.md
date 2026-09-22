# The Engine as a Tool — typed calls, and rows that read as engine verbs

## The Idea

The model calls the engine as a tool instead of writing a shell command.
The workflow-gates mod (`design/function-hook-gates.md`) registers one
tool through `$.tool.register({ name: "engine", inputSchema: { verb,
args[] } })`; the model calls it as `mcp__workflow-gates__engine`, and the
mod's `tool.call` hook serves it by running the engine through
`$.process.run` and answering with its stdout.

Two things fall out:

- **No shell.** Argv arrives as a JSON array. The zsh failure class behind
  render-surfaces D7 — `[]` globbed, `~` expanded, `&&` chains and shell
  variables improvised over a run of calls — cannot happen, because there
  is no shell between the model and the engine.
- **Rows read as engine verbs.** A plugin tool's transcript row draws its
  own name. `Bash(node .claude/skills/workflow-engine/scripts/engine.cjs
  render task-gate pay.implementation.pay)` becomes `engine · render
  task-gate · pay.implementation.pay`, spinner while it runs, red on
  error. The same effect is reachable on its own as a `ui.render
  {component: "ToolUse"}` hook that redraws the Bash row — cosmetic, zero
  engine change — but it is the smaller half of this idea, and it comes
  free once the tool exists.

Gate interception then matches on `{ tool: "mcp__workflow-gates__engine" }`
rather than on a marker in a Bash result.

## Where It Came From

Raised while deciding the function-hook gate design (2026-09-22). D7's
history: a flow that prescribes a run of engine calls gets one-lined by
the model, and the improvisations are where the failures live (the fumi
harvest's 24 `discovery-map add` calls aliased into `$E add …`, every one
dying on zsh's no-word-split). The batch forms answered the N-ary case;
the typed tool answers the rest.

## Cost, and Why It Waits

- **Every prose call site changes.** Engine calls are Bash fences today,
  hundreds of them, plus the `allowed-tools` frontmatter that names them.
- **The prose-test invariants change.** `calls_include` and
  `calls_in_order` match argv strings recorded from Bash; a tool call is
  recorded differently.
- **The mod becomes load-bearing.** The tool exists only when the mod is
  loaded. Prose that calls it cannot fall back to Bash, so the
  removability the gate design keeps (delete the mod, the text menus
  stand) is gone. That is the real gate on this idea: it is sane only once
  the mod is no longer opt-in and function hooks are out of early access.

## Shape

- One tool, one schema: `{ verb: string, args: string[] }`, `cwd` the
  session's. Stdout answered as the result; a non-zero exit as an error
  result carrying stderr, so a refusal reads as a refusal.
- The mod keeps the engine's output contract as it is — DATA / DISPLAY /
  MENU / GATE sections — so nothing downstream of the call changes.
- Prose migrates fence by fence under the same "touching a file adopts
  it" rule the menu migration uses, with the Bash form kept until the last
  file converts; the prose-test recorder learns the tool's call shape
  first.

## Open Verification

- Whether a plugin tool's row can carry the verb and dotpath in its label,
  or only the tool name (then a `ToolUse` render hook supplies the label).
- Whether `-p` runs and the prose-test walkers (which run the prose without
  the mod) need the Bash form retained permanently, which would make the
  migration a dual form rather than a replacement.
- The tool's permission footprint: one tool, allow-listed once, versus the
  `Bash(node …)` patterns the skills declare today.

## Trigger

After the workflow-gates mod ships and the opt-in is retired. Not before.
