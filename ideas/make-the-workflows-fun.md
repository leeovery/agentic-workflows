# Make the Workflows Fun

## The Idea

Computers should be fun. Work moments of delight into the workflows —
small, earned, never in the way — the way Claude Code already does in
places.

## The Example That Started It

Claude Code's `/effort` picker. Move the selection to the far right
(`ultracode`) and the panel comes alive: purple bands grow out from the
selected point, ripple across until they fill the whole panel, and keep
flickering while it stays selected. It shipped inside Claude Code, so the
harness can draw this kind of thing.

Other kinds of delight Lee likes: confetti when something installs.

## Where It Could Live

Moments the workflows already mark, each a candidate:

- a work unit completing its pipeline;
- a review passing;
- an epic's last topic landing, or a build order running out;
- the walkthrough's first run ending;
- a long implementation phase closing.

The workflow-gates mod (`design/function-hook-gates.md`) is the likely
canvas: function hooks draw in the terminal, and the band already sits
above the prompt. A celebration there needs no model tokens and never
reaches the transcript.

## Bounds

- Terminal only, like the band — a Remote Control screen gets nothing,
  not a text imitation.
- Earned moments only; a flourish on every gate is noise.
- Never blocks input and never delays the next step.

## Where It Came From

Lee, 2026-09-24, after trying `/effort`'s ultracode animation during the
function-hook gates review: "I love stuff like this… I would love to work
more stuff like this into the workflows."

## Trigger

After the function-hook gates stacks land and release. Spike an animation
in the lab (`fumi-gatelab`) first, to learn what a mod can draw and how
smoothly.
