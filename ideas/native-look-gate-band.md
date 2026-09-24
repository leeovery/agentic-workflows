# A Native-Looking Gate Band

## The Idea

Bring the workflow-gates band (`design/function-hook-gates.md` R7) closer
to Claude Code's own AskUserQuestion dialog, so the buttons read as part
of the harness rather than a plugin's panel. Borrow its look, not the
dialog itself.

## What to Borrow

- **Typing inside the panel.** The dialog's "Type something." row takes
  text in place. The band's typed rows (Ask, Comment, ranges) are dead
  rows today — the footer says to press Esc and type in the prompt. If a
  `Client` can host a text field, that gap closes. Spike this first.
- **The picked row:** green text with a ✔, no background — in place of
  the `diffAddedDimmed` fill (this revisits the lab's "no ticks" ruling).
- **The cursor:** a `❯` chevron and the accent colour on the label, no
  `selectionBg` band.
- **The question:** bold white behind a left bar, in place of the `◆`
  glyph line.
- **The footer:** "Enter to select · Tab/Arrow keys to navigate · Esc to
  cancel" phrasing.
- **"Chat about this" beneath its own rule** — the band's Ask row maps
  onto it.
- **The multi-question tab strip** (☐/☒ per step, a Submit tab) — no
  obvious home among the gates today; note it for the batch finding walks.

## What Not to Borrow

The dialog itself (`$.ui.ask`): it caps at four options, answers inside
the running turn rather than as the person's next message, and the
workflows forbid tool dialogs at gates for exactly that reason.

## Where It Came From

Lee, 2026-09-24, comparing the band with an AskUserQuestion dialog on
screen during the gate-surface review.

## Trigger

After the function-hook gates stacks land and release. Each change is a
lab spike first (`fumi-gatelab`), then a design decision.
