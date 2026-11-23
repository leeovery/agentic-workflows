# The README's screens

Records the stills in the project README, `art/*.webp`, from real Claude Code sessions running
real Ledger: Ledger installed from this checkout into a small demo project, `/ledger` typed into
`claude`, and the screen it draws caught as it stands. Nothing is mocked up: the menus are Ledger's
engine rendering the project's state, drawn as buttons by Ledger's Claude Code mod, and the words
around them are Claude's.

**It costs real turns.** Each tape starts `claude` with your own login and spends the turns its
header names, one to three. Remake only the tapes you need, and expect each to take a few minutes.

```bash
demo/world.sh start && demo/check.sh start-menu   # the world boots to its screen, no Claude yet
demo/record.sh start-menu                         # record it, then make art/start-menu.webp
```

## What's recorded

| Tape | World | Turns | Art |
|---|---|---|---|
| `start-menu` | `start` | 1 | `art/start-menu.webp`: `/ledger`, Ledger's banner and the inbox, and the start menu as buttons above the prompt: a feature mid-build, a bugfix in investigation, an epic in discussion |
| `roadmap` | `roadmap` | 3 | `art/roadmap.webp`: `roadmap` answered at the start menu hands off into a fresh conversation, where Claude invokes the roadmap and Ledger draws each item under its horizon, with the roadmap's menu as buttons |
| `discussion` | `discussion` | 2 | `art/discussion.webp`: `/ledger carry on with the billing discussion` and Claude's opening, then `show me the map` and the topic's map: what was decided since the person last looked, what is open, what is decided and whose call each was, with the board's banner for the topic. The still starts at the ask for the map |

`look.tape` holds the settings every tape sources. Each tape builds its world out of sight, starts
`claude`, types what the person would, and waits on the screen for words only the real path draws:
the menu's question, then the last line Claude writes as its turn ends. A session that stops
early, asks a question the tape doesn't expect, or draws something else fails the recording rather
than leaving a still that looks right.

The art goes to `art/` at the repository's root, where the README takes it from.

## The world

`demo/world.sh <mode>` builds it under `/tmp/ledger-demo`, outside the checkout, and each tape
builds it afresh before it shows anything. `DEMO_WORLD=<dir>` moves it, but the art is recorded at
the default. `world.sh` empties the world first, so it takes only a folder that holds nothing, or
holds the marker file a world is built with (`.ledger-demo-world`).

- **`acme-app`**, a small web app for teams' reports (filters, exports, card payments, CSV
  imports), in a git repository of a few dated commits.
- **Ledger, installed from this checkout** as `npx agntc add` installs its pack: each folder of
  `skills/` into the project's `.claude/skills/`, the mods among them, and `agents/*.md` into
  `.claude/agents/`.
- **Ledger's state, from the walkthrough's sample worlds**, the same files the walkthrough draws its
  example screens from (`skills/ledger-engine/content/walkthrough/fixtures/`). `world.sh` runs
  Ledger's own boot to set up `.ledger/` (a worktree of the project's `ledger-state` branch),
  answers every setup question through the engine (the walkthrough skipped, the knowledge base
  keyword-only, the project native to Ledger), lays the sample's files into `.ledger/`, its
  project manifest merged into the one boot made, and commits them to the state branch. So
  `/ledger` goes straight to the screen: no setup question, no migration, no walkthrough offer.
- **Modes:** `start` (the `start-menu` sample: Saved Filters mid-build, Export Timeout in
  investigation, Payments Overhaul in discussion, four inbox items), `roadmap` (`roadmap`: three
  items over three horizons, Launch Core started), `discussion` (`discussion-map`: Launch Core's
  Billing topic, three of its questions decided, one open, two calls Claude made), and `build`
  (`build-progress`; no tape, see below).
- **Ledger's config is the world's:** `LEDGER_CONFIG_DIR` names `/tmp/ledger-demo/config`, so
  nothing of your own `~/.config/ledger` is read or written. **Git's is the world's:**
  `GIT_CONFIG_GLOBAL` names its gitconfig, with `GIT_CONFIG_NOSYSTEM=1`.
- **The engine's own calls to Claude go to a stand-in** that cannot answer
  (`LEDGER_CLAUDE=/usr/bin/false`). The discussion sample's decisions landed unchecked, so every
  boot of that world launches Ledger's late one-decision check in the background, a `claude -p`
  call a decision on your login, which would also write its results into whatever world was built
  at the same path by the time it finished. With the stand-in the decisions stay as the sample has
  them.

`demo/check.sh` boots the world and draws a screen through the engine directly, with no Claude Code
session, as the tape's session will. Run it before a recording: boot's `gates` must be empty and its
`go` the start the tape expects (`menu` for the bare `/ledger`, `route` where words follow it).

```bash
demo/world.sh roadmap && demo/check.sh roadmap
demo/world.sh discussion && WORDS="carry on with the billing discussion" demo/check.sh map launch-core.billing
```

## The session

The tapes run your real `claude`, with your real home folder, so it signs in as you do. What keeps
the rest of your setup out of the frame:

- **`--setting-sources project`**: the session reads the demo project's settings alone, so your
  own plugins, hooks, status line and permission rules don't load.
- **The project's settings** (`.claude/settings.json`, written by `world.sh`, with the hooks
  Ledger's boot adds) allow every tool Ledger's turns use, any shell command among them: Claude
  writes its own loops and pipes round the engine's calls, and a permission question would stop
  the recording where no one answers it. The project is a throwaway in `/tmp`. The session runs in
  Claude Code's ask-first mode (`--permission-mode manual`), so auto mode's offer to learn the
  environment never draws over the screen. Prompt suggestions are off, so the prompt box stays
  empty.
- **`--model opus`** and Claude Code's fullscreen renderer (`CLAUDE_CODE_NO_FLICKER=1`, in the
  world's `profile.sh`).
- **The trust question.** The first session in the world's folder asks whether to trust it, with
  "No, exit" first, since the project's settings carry hooks and permissions. The tape answers
  Down and Enter. Claude Code keeps the answer, so later recordings may not be asked; the keys then
  meet an empty prompt and do nothing.
- **The welcome header** names the model, the billing and the folder. The stills are cut below it:
  `# art: from #373737` in a tape cuts its still above the first band of rows drawn in that colour
  three-quarters of the way across, the band Claude Code draws a sent prompt on,
  `# art: from-last` above the last such band, and a `+<n>` after the colour the terminal row
  that many below it (`finalize.sh --from`, `--from-last`, `--rows`). The roadmap's starts two
  rows under the handoff's continuation, at Claude invoking the roadmap's skill, so the cleared
  conversation's header and the continuation's rows are cut too.
- **The environment** the tape's shell carries of another Claude Code session, or of a terminal
  multiplexer's, is unset in `profile.sh`, so the new `claude` doesn't take itself for a child of
  the one you run the recording from, and Ledger doesn't offer session labels.

Ledger's mod (`skills/ledger-gates/`) runs in these sessions, so the menus draw as buttons in the
band above the prompt, with the board's banner beneath them. The band is as tall as Claude Code
lets it be, which grows with the terminal: the tapes are 46 rows tall so the start menu's ten rows
show on one page.

## No build tape

`world.sh build` lays in the `build-progress` sample, but a live build's tasks come from the task
tracker the project's drivers name, which the sample carries only as the tracker's answer
(`tracker.json`), so the engine draws its phases with no tasks written. And the way into a live
build is the implementation phase starting work: it builds the next task. A build still needs a
tracker set up in the world with the sample's tasks, and a way to stop the session at the
progress screen.

## The look

JetBrains Mono in Nordfox (Ghostty's own values), 100 columns at 28px, 46 rows, frames twice the
width the README shows them at, so a high-density screen draws them sharp. A cell is 16 × 37 px.

## How a tape becomes art

`record.sh` deletes the tape's old frames, runs it through vhs, and hands its frames to
`finalize.sh`, which makes a lossless WebP of the last frame, set in a 40 px margin of the theme's
background, cut below the last row drawn and, with the tape's `# art: from` line, above the
prompt it names. The tapes keep their screen hidden while Claude works, and show it only at the
end, so a recording writes a few dozen frames rather than thousands.

`demo/out/`, the frames, is remade each time and never committed. Since a still is made from the
frames alone, `demo/finalize.sh --still [--from …] <name>` remakes its art from the frames left in
`demo/out/<name>/` without another session.

`demo/review.sh` records review tapes, `demo/review/<name>.tape`, a `Screenshot` at each state a
change passes through, into `demo/out/review/<name>/`; there are none yet.

## Setting up

```bash
brew install vhs ffmpeg webp
ls ~/Library/Fonts /Library/Fonts | grep JetBrainsMono-Regular
```

vhs 0.12 or later; Claude Code 2.1.287 or later, signed in; `node` on the `PATH`.

## Gotchas

- **The sandbox.** vhs drives a headless browser that connects to `ttyd` over loopback, which an
  agent's sandbox refuses (`could not open ttyd: ... ERR_CONNECTION_REFUSED`): run `record.sh`
  with the sandbox off.
- **`TMPDIR` on another volume.** vhs records a tape's frames under `$TMPDIR`, then moves them to
  the tape's `Output`; across volumes the move fails without a word. `record.sh` gives vhs a
  `TMPDIR` in `demo/out`.
- **Claude Code's words.** The tapes wait on Claude Code's own: the trust question, `for shortcuts`
  in the footer, the line it writes as a turn ends (`Cooked for 14s`). A Claude Code that words
  them differently stops a recording at its timeout, with the screen it was on: change the wait.
- **Silent failures.** vhs can run a tape, report nothing wrong, and write nothing: `record.sh`
  deletes a tape's output before it records, and `finalize.sh` stops when there are no frames.
- **Settings come first** in a tape, and **a path with a `/`** in a tape must be quoted.
