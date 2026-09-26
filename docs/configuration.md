# Configuration

The system configures itself the way it does everything else: conversationally, once, with the answer recorded where the next session will find it. There is no setup procedure to follow, and the one file you might ever open by hand is optional tuning for the knowledge base, described at the end of this page. This page describes where each kind of setting comes from and how it behaves, so nothing surprises you.

## Installing and updating

```bash
npx agntc add leeovery/agentic-workflows
```

This installs the workflow skills into the project. Commit the installed files to share the workflows with your team and to use them in Claude Code for the Web. `npx agntc update` pulls the latest version, and `npx agntc remove leeovery/agentic-workflows` uninstalls. Updates carry themselves forward: the first run after an update brings your existing work into line with the new version automatically, so there is nothing to migrate by hand.

The only requirement is Node 18 or newer. The first `/workflow-start` sets everything else up in conversation. Optionally, if you want search-by-meaning over your past work, you will be offered a one-time setup for it — including an option that needs no external service at all. See [the knowledge base](knowledge-base.md) for that choice.

## Settings that fill themselves in

A few settings exist, but you never set them in advance. Each is asked the first time it is needed and remembered thereafter. There is where your plan's tasks get stored (asked during [planning](planning.md)), the project-specific skills that guide the building and reviewing agents (asked during [implementation](implementation.md)), and the linters that run through the build (also discovered during implementation).

These stored values are suggestions, not standing decisions. When a setting is relevant again, the remembered value pre-fills the question, but you still confirm or override it, and the value you confirm is what actually gets used for that piece of work. Nothing reads a stored default at the moment of execution, so changing one never silently rewrites work already in flight. This is the same discipline the system applies everywhere: a value that was right last time is a suggestion for this time, never consent given in advance.

## The baseline offer

On a project whose code predates the workflows, the first `/workflow-start` offers a one-time **baseline assessment**: researcher agents read the codebase area by area, then an interview captures the intent, history, and constraints only you can supply — evidence woven into every question, candidate answers to jog memory, and "don't know" always a costless answer. Each finished area lands as a doc the [knowledge base](knowledge-base.md) surfaces in every later thinking phase. The interview pauses and resumes from the start menu, and a completed baseline stays expandable — new areas, or deeper passes over existing ones — from the manage menu. Declining records the answer: the offer never repeats, and the assessment stays available from the start menus whenever you want it. A project that grew up on the workflows is never offered one — the first run reads the repository's history, records that verdict once, and never puts the question to you — its record is real.

## Session labels

If you work inside tmux, the first `/workflow-start` in a project asks once whether the workflows may rename your tmux session to show where you are — `myproject · payments · discussion · auth-flow` inside a phase, `myproject · payments` at the work unit's menu, `myproject · roadmap` on the roadmap — and put the original name back at the start menu and when the session ends; the label is brought back when you resume the session. You answer once per project. Outside tmux nothing is renamed and the question is never asked.

Whatever you answer, the workflows keep a small session-end hook in the project's Claude settings, which tidies up after a finished session — clearing the markers that tell other sessions a topic is in use, and restoring your tmux name if you opted in. Opting in adds a second hook that puts the label back when you resume a session. You may see them appear in `.claude/settings.json` after your first start.

## Buttons above the prompt

The workflows come with a Claude Code mod that shows their menus as buttons above the prompt, instead of printing each menu into the transcript. The buttons stay put while the transcript scrolls. A click on a row picks it, putting its answer in the prompt box; a second click on that row, or Enter, sends it, and Claude Code shows the sent answer as the plugin's message. You can also type an answer. While any screen but the terminal is attached, such as Remote Control, menus stay text, and a Remote Control screen that attaches after a menu was drawn on the terminal does not get that menu. Pressing Esc before Claude has run a tool in reply to your answer brings its menu back; once Claude has run one, Esc leaves no buttons until the next menu, and so does running `/clear`. While Claude works on something you did not ask for, such as a background agent's report, the buttons stay; a second click then waits for Claude to finish, marked as queued, and sends only if the same menu is still on screen — if the menu changed, it is not sent and the new menu says so. An answer you picked for a menu that has gone is taken out of the prompt box, unless you have edited it. Leave a conversation with a menu on screen and resume it later, and its buttons come back, as long as nothing has happened in it since. Your other Claude sessions in the project are left as they are.

The mod is part of the workflows. It runs in Claude Code's terminal app, from version 2.1.282, and there the first `/workflow-start` in a project switches it on; anywhere else — Claude Code on the web, another Claude Code app such as an IDE extension, an older version — nothing is written and the menus print as text. Claude Code loads it only where its function hooks, which are early access, are switched on, so every `/workflow-start` writes their switch, `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`, into the `env` block of the project's `.claude/settings.json` wherever it is not already `"1"` — which turns them on for every plugin in this project's sessions. Claude Code reads settings only when it starts, so the start that writes the flag ends with an instruction to restart; the next session has the buttons. A start that finds the flag in place but the mod not running — Claude Code was already running when the flag landed, or a setting of your own turns function hooks off — stops and says so. The workflows never take the flag out, since other plugins may rely on it.

The engine emits every menu as text regardless, so wherever the buttons are absent or broken, the menu prints into the transcript as text.

## Handing over the gates

Every approval loop offers an auto option, and choosing it is how you hand that particular gate over — from then on the system proceeds there without stopping to ask. This is scoped and reversible rather than a global switch. Some gates reset to asking at the start of each session, so auto is an opt-in for a sitting rather than a permanent setting, and the implementation task and fix gates also offer a bounded auto that hands the gate over only to the end of the current plan phase; and certain escalations override auto entirely — when a fix loop or an analysis loop hits its limit, it stops and asks regardless, because those are the moments a human needs to look. Auto is always something you choose at a gate, never something the system infers from a past choice or a stored preference. The reasoning is covered in [the collaboration model](collaboration.md).

## Environment setup

The first time [implementation](implementation.md) runs, it asks whether there are any project-specific steps it should carry out before writing code — copying an environment file, running migrations, installing an extension. It saves your answer and never asks again; "no special setup required" is a perfectly good saved answer. The steps are run exactly as you wrote them, before the first task.

## Knowledge configuration

The [knowledge base](knowledge-base.md) reads its settings from three layers. Built-in defaults sit at the bottom. A system config at `~/.config/workflows/config.json` applies across every project on your machine. A project config at `.workflows/.knowledge/config.json` applies to one copy of a project — it is written by setup and never committed — and wins over both. A key present in a file overrides the layers beneath it, and a key set to `null` unsets it — which is how a project switches off a machine-level embedding provider and runs keyword-only on its own.

Setup writes provider identity only: which embedding provider, which model, its dimensions, and an endpoint for a compatible service. If a cloud service is involved, its key is stored separately and securely on your machine and never travels through the chat. Setup never writes a tuning value, so a default that improves in a later version reaches you without anything to redo.

Four tuning keys exist, and the only way one appears in a file is that you put it there. They belong in either file, and a project's value beats the machine's:

- `similarity_threshold` (default `0.3`) — the floor a search-by-meaning match must clear to count. Its one job is returning nothing when nothing is relevant. Too low and an unrelated question returns a few noise results; too high and search-by-meaning silently falls back to keywords.
- `decay_prune_below` (default `0.05`) — how far a work unit's material must have sunk before it is pruned from the store. `false` disables pruning.
- `decay_base_stability` (default `5`) — how quickly material sinks as later work completes. Higher is slower.
- `decay_weights` — how much each kind of completed work counts toward that sinking, per work type.

Specifications never decay whatever these say. Changing a value takes effect on the next query; nothing needs re-running.
