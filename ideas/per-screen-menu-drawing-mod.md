# Per-Screen Menu Drawing — the model always prints the menu, the terminal draws the band

## The Idea

Let Claude print every gate's text menu as it does without the mod, and have
the workflow-gates mod (`design/function-hook-gates.md`) hide that menu from
the terminal's drawing of the reply and show the band in its place. Every
other screen draws the reply as printed. Today the mod cuts the MENU out of
the Bash result before the model reads it, so the model never prints it.

The hook is `ui.render{AssistantMessage}`: one text block of an assistant
reply, "raised on every surface", with `e.surface` naming the screen. A
rewrite changes the drawing and leaves the stored message alone.

What falls out, if it holds:

- **Remote screens get the menu with no duplicate.** A Remote Control
  client (`mobile`, `desktop`) draws the text menu; the terminal draws the
  band alone. Today a session with a remote client attached falls back to
  text everywhere, the band off, because a cut menu would reach no screen
  but the terminal.
- **Nothing is cut from what the model reads.** The menu stays in the
  model's context, so a numbered row resolves from the menu the model
  printed, and the call sites' "emit the MENU" instruction is simply true —
  no rewritten marker, no stop note.
- **Fail-open is total.** A mod that is off, broken or mid-reload leaves the
  printed menu standing on every screen; nothing depends on the band drawing.

## Where It Came From

The gate-surface review (2026-09-23): a terminal plus a Remote Control client
left the phone with no menu at all. Lee wanted "mod bar on the TUI, old
markdown elsewhere, not both"; the per-surface `AssistantMessage` hook is
the only way to get exactly that, and it may be the better base for every
gate, not only remote sessions.

## Open Verification (a lab spike, before any design)

- Whether a rewrite of an `AssistantMessage` block can find and hide the
  menu cleanly — it is the last thing in the block, opened by the dot rule —
  while the reply streams in, without a flash of the text menu.
- Whether the rewrite reaches every terminal redraw (scrollback, ctrl+o,
  resume) and leaves remote surfaces untouched.
- What the model does at a gate when its printed menu is hidden from the
  person but the band carries the rows — whether anything in the prose or
  the answer path changes.

## Trigger

After the gate-surface stacks land. A working spike reopens R4 (the cut)
in the design record, not only the remote-surface fallback.
