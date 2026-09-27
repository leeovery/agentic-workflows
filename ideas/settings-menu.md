# Settings Menu on the Start Menu

## The Idea

A settings row on the start menu that shows the project's recorded choices
and lets the person change them, instead of the one-time Step 0 prompts
being the only door. Today the answers live on the project manifest
(`defaults.tmux_labels`, and whatever opt-in comes next), and changing one
means knowing an engine command (`engine session label-config`) or editing
`.workflows/manifest.json` by hand.

## Where It Came From

Lee, 2026-09-22, while deciding a gate-surface opt-in (later dropped — the
buttons became part of the workflows): "maybe at some point we need to
develop a config menu in the start menu so that the user can tweak their
settings."

## Shape

- A start-menu row (`s/settings` or similar — the letter settles against
  the menu's existing keys) opening an engine-rendered view of each
  recorded choice and its current value, one row per setting.
- Picking a setting runs its existing record verb, so the settings file
  syncs and the commit stays confined exactly as the Step 0 answer does.
- `b/back` re-renders the start menu through `start-menu.md`, as the
  roadmap, baseline and help homes do.
- A setting whose effect needs a restart says so in the receipt, as the
  Claude Code Setup step does.
