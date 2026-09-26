# Position Line — where the session is, pinned under the prompt

## The Idea

One line under the prompt, beside Claude Code's own pinned notices, that
says where this session is working:

    portal · implementation · lazy-resume-on-attach · task 21/45

Drawn by the workflow-gates mod (`design/function-hook-gates.md`) through
`$.ui.status(text)` — one status line per plugin, replaced on each call,
cleared with `undefined`. The tmux label keeps its job as the view *across*
panes; this is the in-app view, and needs no tmux and no opt-in.

## Where It Came From

Session labels exist because there was no place inside the app to say
where a session is. Function hooks give the app that place. Raised while
deciding the function-hook gate design (2026-09-22); Lee: works in addition
to the tmux labelling.

## Shape

- **Source is the engine's own verbs, read off the argv.** The mod's
  `tool.call` hook already intercepts every engine call for the gates. It
  reads `engine session label {wu} {phase} {topic}` — the call every
  process skill makes at Step 0 and discovery makes at its run step — and
  pins `{wu} · {phase} · {topic}`, the topic collapsed when it equals the
  work unit, exactly as the tmux label does. No new engine verb, no file.
- **Task progress rides the same hook.** A `task start` response names the
  task; the plan's count comes from the same place the task loop reads it.
  Both are optional tails on the line, never the line itself.
- **Leaving a place is never an event** (the session-label rule): the line
  changes only when the next place labels itself. `/clear` and `/resume`
  are `command.run` events the mod can watch to clear or restore it.
- **Headless and non-terminal surfaces**: a no-op. `$.ui.status` is the
  terminal's notice bar.

## Open Verification

- Whether `$.ui.status` survives a `/clear` on its own, or needs the
  `command.run` hook to clear it.
- Width: the notice bar truncates; confirm the collapsed form fits at
  narrow widths, or shorten from the right (drop the task tail first).

## Trigger

Build with, or straight after, the workflow-gates mod — it is one hook and
one `$.ui.status` call inside a plugin that already sees every engine call.
