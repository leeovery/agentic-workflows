# Configuration

Ledger configures itself the way it does everything else: conversationally, the first time each setting is needed, with the answer recorded where the next session will find it. There is no setup procedure to follow. This page is where each setting comes from, where it lives and how to change it, so nothing surprises you.

## Installing and updating

```bash
npx agntc add leeovery/agentic-workflows
```

This installs Ledger's skills, agents and Claude Code mods into the project. Commit the installed files to share Ledger with your team. `npx agntc update` pulls the latest version, and `npx agntc remove leeovery/agentic-workflows` uninstalls. An update carries itself forward: the first `/ledger` after it brings your existing work into line with the new version, showing you what moved.

Ledger needs Node 18 or newer, git 2.40.0 or newer — older, or none, and `/ledger` stops and says how to get a newer one — and a project inside a git repository: in a folder in none, `/ledger` stops and says so, and never makes one. In Claude Code's terminal app or the Desktop app's Code tab it needs Claude Code 2.1.287 or newer, where its Claude Code mod is on by default (see [buttons above the prompt](#buttons-above-the-prompt)).

## Effort

The conversation stays in your own session — the discussions, the questions the ask rule sends you, the build's orchestration — at the effort you set. Ledger recommends a minimum of **medium**, Opus 5.5's own default, and never sets it: it puts no `effortLevel` in the project's committed settings, where it would override everyone's own choice. When your session runs below medium, `/ledger` says so once and carries on.

The agents Ledger sends out are different. Each has its model and effort fixed in its own definition, which holds whatever your session runs at; [the agents](agents.md) lists them.

## What the first session sets up

Your first `/ledger` in a project sets up what it needs as it goes, asking only where there is a choice:

- **The state branch.** Ledger keeps its records on a branch of its own, `ledger-state`, checked out at `.ledger/`; [state and git](state-and-git.md) describes it. Nothing is asked.
- **The hooks.** Ledger installs its hooks into the project's `.claude/settings.json`, and commits that change: the guards before file writes, shell commands and agent dispatches, a session-end hook that tidies up after a finished conversation, and, if you opt into session labels, one that puts the label back when you resume. Claude Code picks hooks up only as a session starts, so the session that installed them runs its end without them.
- **The knowledge base**, set up once in each copy of the project. It is required, and one of its choices, keyword-only, needs no outside service at all. See [the knowledge base](knowledge-base.md#switching-it-on).
- **The walkthrough.** A first session offers a short walk through how Ledger works, once; it stays on the start menu's help.
- **An existing codebase.** On a project whose code predates Ledger, the first session offers to have a researcher read the code before the product's first conversation, landing what the code shows as findings and bringing what it leaves open to you as questions. Declining is recorded, and the offer never repeats. A project that grew up on Ledger is never asked: the first session reads the repository's history and records that verdict once. For a project moved across from before Ledger, the history it reads is what came before the old state first entered git.
- **On GitHub**, setup offers a rule refusing the state branch's deletion or any push to it that isn't a fast-forward, for anything run outside Claude Code; and where the project lands through GitHub, the project's first ready to build offers the squash default each task's pull request lands by, which also allows the merge commits a piece of work with a branch of its own lands by at finish. Each is set only on your yes, and your answer is recorded, so it is never offered again on any clone.
- **Session labels**, if you work inside a terminal multiplexer: see [below](#session-labels).

## The drivers

Ledger reaches two outside tools through drivers, each picked per project.

The **task driver** keeps the build's tasks in your tracker. The tracker that ships is [Tick](https://github.com/leeovery/tick), a lightweight task tool built for coding agents, its store kept on the state branch beside the rest of Ledger's records. Tick 0.3.0 or newer is needed.

The **landing driver** lands each task's change in your repository. Where the project's remote is on GitHub it is GitHub's driver: each task a pull request, each build phase a stack of them, landed one commit per task, and a piece of work with a branch of its own landed by one merge commit at finish. It needs GitHub's CLI 2.30.0 or newer and its stack extension 0.1.0 or newer. Where the project has no remote, or one elsewhere, it is the local driver: the same tasks and phases as branches, merged locally. A driver for another code host comes by pull request against the drivers' conformance suite.

Neither asks a question when its default fits: the first thing that needs a driver writes the default into the project manifest, so a build never changes driver under it. Both check their tools at ready to build, the last stop before a build runs unattended, so a missing tool never stops a build you have walked away from. A tool that is missing, or older than its driver needs, stops ready to build naming what is missing, the version found and needed, and where its update instructions are — never an install command. Manage's `d/drivers` changes either driver, while no build is in flight. [The build](the-build.md) describes how the drivers are used.

## The environment setup

The environment setup is how the project runs for the work, kept per project on the project manifest:

- how to run the product, build it and run its tests;
- the steps that prepare the environment — an env file, keys, dependencies, a test database — run as written before a build's first task, and in each worktree a task runs in for whatever a fresh worktree lacks;
- what cannot run at once in the project, such as tests sharing a port or a database, recorded whenever a build learns it so no build learns it twice;
- the linters, each a name and its command, and the command that fixes what it finds where it has one;
- where the [verify setup](verification.md#the-verify-setup) is, and how to call its five parts, recorded by the task that builds it.

It is asked once, at the project's first ready to build, the linters shown as found for you to confirm, and never again at a build; nothing in it runs before your yes. A project moved across from before Ledger brings its old environment setup notes as a step of their own, *From before Ledger*, a note that never runs, which Claude reshapes there with what it finds in the repository. The commit door runs its tests, then each linter, before every code commit. Manage's `s/setup` shows it and changes it. A quick-fix in a project with no environment setup yet runs the tests and linters Claude finds in the repository, asking nothing.

Project skills are not configured anywhere: the builders and reviewers find and invoke the project's skills themselves, and Claude Code loads your `CLAUDE.md` into each of them.

## Trust settings

How often Claude asks you is set by your own answers, described in [trust](trust.md). The settings you control are few: the threshold the [ask rule](trust.md#the-ask-rule) asks by, 20% unless you pick another; the threshold for questions that block build work; and your care entries, the kinds that always ask in one project. Each is changed from [the matrix](trust.md#the-matrix), the threshold after a replay of your history shows what a new value would have changed. The threshold sits in your `config.json` (below), the care entries in the record of you, `person.md`; only the engine writes either.

## Where things live

Settings that belong to the project live on the state branch, on the project manifest: the drivers, the environment setup, the roadmap, the answers to setup's offers. Settings that belong to you live in your own Ledger folder, `~/.config/ledger/`, or wherever `LEDGER_CONFIG_DIR` points:

- `config.json` — the knowledge base's provider settings and tuning, and your trust settings;
- the knowledge base's API key, stored apart and never passed through the chat;
- `trust.jsonl` — the trust log, every answer the ask rule counts, across all your projects;
- `person.md` — the record of you, your preferences in words and your care entries;
- `conversations/` — each Claude Code conversation's own folder: where it is working, the buttons it was showing, the briefs it issued, its boot stamp.

A conversation's folder is found wherever the conversation runs. It lasts as long as Claude Code keeps that conversation to resume, and goes at the next `/ledger` in any project once Claude Code has deleted it, unless a trust log event still waits in it. A conversation whose end the session-end hook never saw — the one whose `/ledger` first installed the hook, since Claude Code picks hooks up only as a session starts, or one that crashed — names no transcript, and its folder stays, a few bytes.

## Session labels

If you work inside a terminal multiplexer, your first session in a project asks once whether Ledger may label your session to show where you are — `myproject · payments · discussion · auth-flow` inside a phase, `myproject · payments` at a work unit's menu, `myproject · roadmap` on the roadmap — and put the original back at the start menu and when the session ends. The label comes back when you resume a session. Ledger labels a session in one of two ways:

- **Portal** — inside a Portal session, Ledger sets the label Portal shows beside the session's name, which never changes. The label keeps its first part, the part before any ` · `, and Ledger's place follows it; the label you had is put back, and where you had none Portal shows the session's name again.
- **tmux** — inside tmux, Ledger renames the tmux session, its own name first.

Where both apply, Portal labels the session. Outside both nothing is labelled and the question is never asked.

## Buttons above the prompt

Ledger comes with a Claude Code mod that shows its menus as buttons above the prompt, instead of printing each menu into the transcript. The buttons stay put while the transcript scrolls. A click on a row picks it, putting its answer in the prompt box; a second click on that row, or Enter, sends it, and the transcript shows it as the question and your answer, `question → answer`. You can always type an answer instead. While any screen but the terminal or the Desktop app is attached beside it, such as Remote Control, menus stay text so every screen shows them. Esc before Claude has run a tool in reply to your answer brings its menu back. While Claude works on something you didn't ask for, such as a background agent's report, the buttons stay; a second click then waits for Claude to finish, marked as queued, and sends only if the same menu is still on screen. Leave a conversation with a menu on screen and resume it later, and its buttons come back.

Beside the conversation the mod draws **the board**, a pane showing what is happening now — the build's tasks and their evidence, a topic's map, the questions waiting — without reprinting it into the transcript. It adds to the conversation and never replaces it.

The mod also carries the work from one step to the next. When you pick work from a menu, or a phase concludes and the work moves on to its next phase, the next step starts in a fresh conversation: as the turn ends, the mod clears the conversation and sends the next step's instruction into the new one, where it shows as a line naming where the work went. Should the send not go through, the instruction waits in the prompt box for you to press Enter. Only the step travels: words you type beside a menu pick stay behind, so say them where the next step asks. Without the mod, the next step runs on in the same conversation. The build is one conversation from its first phase to its last, and runs straight on into the review phase in that same conversation; the review's fix tasks run in the same task loop as the build's.

When a Ledger conversation is compacted — by `/compact`, or by Claude Code as the conversation fills — the mod adds one note at the end: where the work stands, and that Claude re-read the skill and the record the work runs from. In the build the note also names each task in flight with its builder and its reviewers, so each task's next round goes back to the agents that still hold what they learned. Claude then carries on as if nothing had happened, with no recap. After a `/compact` the mod also sends a short message telling Claude to carry on, so the work picks back up without your typing anything. The note shows in the transcript as one dim line, such as `⟳ Compacted · carrying on in payments › discussion › auth-flow`.

In a Ledger conversation the spinner says what the work is — `Shaping` in discovery, `Discussing`, `Investigating`, `Specifying`, `Implementing`, `Reviewing` — in place of Claude Code's word, and the mod turns off Claude Code's one-line summaries of Claude's thinking and its reminder to say what Claude is doing, so what Ledger shows reaches the screen as written; your own settings for both come back when the conversation ends. Your other conversations in the project keep Claude Code's defaults and your own settings.

From Claude Code 2.1.287 mods are on by default, so nothing needs switching on. Claude Code loads the mod as a session starts, so a session already open when you install or update Ledger runs without it until you start a new one. When the mod could run but isn't running, `/ledger` says so and carries on with typed menus, naming the causes: the session started before the install or update; mods are turned off, by `--safe-mode` or `--bare`, `"disableAllHooks": true` in your settings, or your organization's policy; or Anthropic has switched installed mods off remotely. When Claude Code is older than 2.1.287, `/ledger` stops and asks you to update it.

Anywhere else — Claude Code on the web, the VS Code extension, a Desktop app session that runs in the cloud — the mod can't run: menus print as text, and Claude Code keeps its own defaults. Ledger is built for the terminal app and the Desktop app's Code tab and isn't tested elsewhere, so support there is soft, and pull requests with fixes are welcome. The engine draws every menu as text regardless, so wherever the buttons are absent the menu is still there.

## Knowledge configuration

The [knowledge base](knowledge-base.md) reads its settings from three layers. Built-in defaults sit at the bottom. Your machine's `~/.config/ledger/config.json` applies across every project. A project config at `.ledger/.knowledge/config.json` applies to one copy of a project — written by setup, never committed — and wins over both. A key in a file overrides the layers beneath it, and a key set to `null` unsets it, which is how a project switches off a machine-level embedding provider and runs keyword-only on its own.

In both files every knowledge setting sits inside one top-level `"knowledge"` object:

```json
{
  "knowledge": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "similarity_threshold": 0.35
  }
}
```

Only that object is read for the knowledge base. Your machine's file holds other settings beside it — the trust settings sit under their own `"trust"` key — so a knowledge key written at its top level, outside `"knowledge"`, is not read and nothing says so: put it inside the object. A project file with no `"knowledge"` object is an error the knowledge base names, with the file and the shape it expects.

Setup writes provider identity only: which embedding provider, which model, its dimensions, and an endpoint for a compatible service. It changes those and nothing else, so a change of provider keeps your tuning, and a default that improves in a later version reaches you without anything to redo.

Four tuning keys exist, and one appears in a file only where you put it there. They belong in either file, and a project's value beats the machine's:

- `similarity_threshold` (default `0.3`, a number from 0 to 1) — the floor a search-by-meaning match must clear to count. Its one job is returning nothing when nothing is relevant: too low and an unrelated question returns noise; too high and search by meaning silently falls back to keywords.
- `decay_prune_below` (default `0.05`, a number from 0 to 1) — how far a work unit's records must have sunk before they are pruned from the store. `false` disables pruning.
- `decay_base_stability` (default `5`, a number above 0) — how quickly records sink as later work completes. Higher is slower.
- `decay_weights` — how much each kind of completed work counts toward that sinking: a number of 0 or more per work type.

A change takes effect on the next search, and `decay_prune_below` at the next start, when pruning runs. A mistaken setting never stops the knowledge base: a key it doesn't know, or a tuning value outside what the list allows, is ignored and named — above a search's results, in its status, and in the warnings at the start of a session. The provider settings are the exception: they decide what the store holds, so they are used as written, and a wrong one fails where it is used.

## A local embedding model

The recommended ways to run the knowledge base are OpenAI's embedding service or keyword-only. It also works with an embedding model on your own machine, served by anything that speaks OpenAI's embeddings interface — Ollama, LM Studio, or llama.cpp's own server among them: choose the compatible provider at setup and give it the server's address, the model's name and its dimensions. The route is open but unsupported. Setup installs and starts nothing, and while the server is down, searches run on words alone.

Choose the model with care. Six local models were measured against the knowledge base's own retrieval evaluation. The widely used `bge-m3` ranked answers worst of them; two held up best: `granite-embedding-english-r2` (768 dimensions) and `snowflake-arctic-embed-l-v2.0` (1024 dimensions). None matched OpenAI. Three things decide it:

- **The model must read at least 8,192 tokens.** Records are stored by section and many sections run past 512 tokens. A local server can cut longer input without saying so, leaving a short-context model to judge each section by its opening alone.
- **Queries and records are sent as written, with no prefix.** A model that expects an instruction or a `query:` prefix on searches runs below its best. The two above held up without one.
- **The first index embeds everything on your machine.** For a sizeable project that took a few minutes on an Apple-silicon Mac's GPU, and runs longer on a processor alone; later indexes embed only what changed.
