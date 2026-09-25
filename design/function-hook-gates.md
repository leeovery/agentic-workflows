# Function-Hook Gates — gates drawn by code, never relayed by the model

Design record for the gate-surface programme: the engine's gates rendered
as interactive UI through Claude Code function hooks ("Claude Mods"), so
the model never holds the menu text at all. Opened 2026-09-17 as a spike in
an isolated copy of Fumi (deleted 2026-09-22; its mod and engine patch rode
this document until the real mod landed, and went with the close). Rulings
settled 2026-09-22, built the same day, then reshaped on 2026-09-23 by two
days of live runs in `fumi-gatelab`, a remote-free copy of a real project,
on 2026-09-24 by the first review pass over both stacks, and on 2026-09-25
by the display-delivery work, which made the mod a standing part of the
workflows.

## Motivation

The render-surface programme (`render-surfaces.md`) moved menus into the
engine: code composes the `MENU` section, the model emits it verbatim.
That removes the model's authorship but not its *agency* — it still has to
reproduce the text, can editorialise, truncate or reorder it, and the gate
scrolls away with the transcript. A function hook intercepts the engine's
output before the model reads it and draws the gate in the band above the
prompt, where it stays while the transcript scrolls. The model's only
remaining job at a gate is to stop.

A second problem shares the cure. On Opus 5.5, text Claude writes after a
tool result and before another tool call is taken out of the reply: the
server turns it into a hidden "narration" block, summarised in a line at
most, so a heading, a signpost or a task brief shown between two calls
never reaches the screen, while text that ends a turn always does
(findings 46, 48). No wording reaches it. Claude Code's `SendUserMessage`
tool, a message the person reads verbatim, is a tool call rather than text
and arrives every time. The mod switches it on, and quiets two harness
habits that work against the workflows' prescribed output, for workflow
sessions alone.

## What function hooks are (verified against the 2.1.274–2.1.280 declarations)

Read from `mods/types/claude-code.d.ts` in anthropics/claude-code and from
`/plugin-types`, proven in the lab, or read from the 2.1.280 binary where
the declarations are silent. Early access: hooks modules load only where
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; Anthropic's 2026-09-09 update says
the semantics are set and shipping is "weeks" away.

- A mod is a plugin whose `hooks/hooks.json` names a `modules` entry
  exporting `register(on, options)`. Every hook is `($, e, next)`,
  Koa-style; hooks on one event fold in registration order, core last.
- `$` is the only door: no ambient fs or network; every call is spelled
  literally `$.noun.event(...)`, and `$` may be passed only to functions
  declared at the top level of the module — the loader refuses a closure
  that takes it. `claude plugin validate <dir>` inventories hooks, calls
  (with the helper each goes through), env reads/writes and surface modules.
- **A hook's budget is ten seconds of its own time.** The clock stops
  while a `next(e)` or any `$` call is in flight (a `$.clock` wait
  excepted). Overrun or throw and the hook is absent: its `.catch` asked
  on a one-second grace, else `next(e)` run on its behalf. A guard fails
  open unless it declares `.catch`; inside `.catch`, `next(e)` alone is
  correct whether or not the hook had called it — `next` is replay-safe.
- `$.ui.ask(question, options)` is the one `$` call that waits on a
  person: the engine's own AskUserQuestion dialog, 2–4 option labels, free
  text as Other. Not a menu of ours.
- `tool.call` event: the tool's input flattened, plus `tool`,
  `tool_use_id`, and `agentId` (absent on the main loop). `text` on the
  result is core's own field, absent from any hook's own `{ result }`; the
  record (`stdout` for Bash) is both the true source and the only thing a
  hook can rewrite, validated against Bash's output schema.
- `AbovePrompt` — the band above the composer — is one always-drawn
  instance, **terminal only**; its props are `hasSurvey`, `isWorking`,
  `maxRows`, `bodyColumns`, `scroll`, `view`. A tree taller than `maxRows`
  (half the terminal) scrolls inside the band with its own "N more" marks
  — the pointer still lands on the right rows (tested live). A `Pane`
  (`$.ui.open`) waits undrawn below 144 columns when a plugin opens it
  unasked.
- `Client` element: a surface module with its own frame clock, keys and
  pointer, no `$`, talking back via `surface.post` → `ui.message`. **A
  click on the band gives it the keyboard, and nothing a plugin can call
  gives it back** — `$.ui.focus` moves a ring only inside the plugin's own
  site ("the keyboard is the person's to give"); Escape returns it, and
  never reaches the `Client`. The prompt box keeps drawing its cursor while
  the band holds the keys. Its `module` is read off the source as a literal.
- `Text` takes `color`, `backgroundColor` (theme keys or raw colours),
  `bold`, `italic`, `underline`, `strikethrough`, `dimColor`. Theme keys
  resolve against the person's theme, ANSI themes included; the binary's
  theme carries `selectionBg`, `diffAddedDimmed`, `userMessageBackground`,
  `userMessageBackgroundHover` and more beside the documented ones.
- `$.prompt.fill({ text, mode })` puts a draft in the prompt box (`replace`
  empties it first); the person's Enter sends it as their own message.
  `isFilled` is false under a dialog.
- `$.prompt.submit({ text })` submits as a turn and resolves to the prompt
  that entered, or `{ drop: reason }` where a hook refused it; it passes
  every hook but the calling one, and Claude Code **frames it as the
  plugin's** whatever a hook answers: stored as "The {plugin} plugin sent a message:\n{text}\n\n
  This is how Claude Code surfaces a prompt a plugin submits…", drawn
  under a grey "Prompt from the {plugin} plugin" line. Declared intent,
  on `UserMessage`: "the model's framing of another party's words as that
  party's … stay as they were." A hook dropping `origin` from its answer
  changes nothing (tested live).
- **A plugin cannot redraw the row of a prompt it submitted** (read from
  the binary): the row's render passes the submitter as the dispatch
  origin, and the dispatcher drops that plugin's hooks as re-entry. Another
  plugin's `ui.render{UserMessage}` hook can rewrite the row's `text`; the
  grey sender line is drawn outside the part any hook reaches.
- Turn events: `turn.start` carries `{ text, turnId }` and no origin;
  `turn.complete` carries `reason` (`answer | aborted | refusal | error`)
  and `isAborted`; a subagent's run raises no `turn.start`, and its
  `turn.complete` carries `agentId`. Who opened a turn is read from the
  `prompt.submit` that began it — the submission with `turnId` absent — by
  its `origin.kind` (`composer`, `bridge`, `plugin`, `task-notification`,
  `scheduled-trigger`, `peer`, `sdk`, `auto-continuation`).
- `session.start` fires once per fresh load — never on `/clear`;
  `session.end` fires on exit, `/clear`, a resume, logout. A `/clear` or an
  in-process resume goes on in the same module as another conversation.
- `$.session.surfaces()` is the roster of screens the session draws on:
  `terminal` first, then `desktop`, `mobile`, `vscode` clients in the order
  they attached (Remote Control), several at once; `session.attach` /
  `detach` mark the changes. SSH or tmux into a terminal is the terminal.
- `$.env.set` sets for this process and everything it starts after — a
  Bash tool's child inherits it; the name must be a literal. It writes the
  host's own environment, where Claude Code reads its switches per
  request; the tool catalogue is built once, just after the `session.start`
  hooks run, so a tool's switch counts only when set there.
- `tool.describe` fires once per tool, when Claude Code first renders its
  schema in a session; the answer (the description, and whether the tool
  waits behind ToolSearch) is cached until `$.ui.invalidate("tool.describe")`,
  which is acted on only at the person's next message. Every change of
  answer sends the tool list again and spends the prompt cache. `$.fs` reads
  and writes relative to the session's cwd; `$.store` is per-plugin JSON
  that survives restarts (4 MiB).
- Distribution: a folder under the project's `.claude/skills/<name>/`
  carrying `.claude-plugin/plugin.json` loads as `<name>@skills-dir`
  (proven live: both mods load from agntc's copy of `skills/` on the
  settings flag alone; the CLI's `plugin list` does not show project-scope
  skills-dir plugins). Settings snapshot at startup, so the session that
  writes the flag never loads the mod. A mod loaded this way **reloads in
  place when its files change**, and a session started just after a change
  can reload it at the end of its first turn; a reload resets the module's
  state, so a drawn gate is lost until the next render.
- The band scrolls as a whole: a tree taller than `maxRows` shows in a
  window with Claude Code's own "↑/↓ N more" line, which no hook reaches.
  The wheel is routed to the band only while its tree overflows; a band
  that fits sends the wheel to the transcript and raises no `ui.scroll`.
- Tests: `claude plugin test <dir>` with `claude-code/testing` —
  `mock.env` (answers `$.env.get` only), `mock.store`, `mock.clock`,
  `$.ui.press`; a `Client`'s post is driven with `ui.post(data, { in })`.
  The kit does not model the self-row skip, and hands a plugin's own
  submission to its `prompt.submit` hook with `origin` undefined. The
  command refuses outright without `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## The shape

```
engine (node)            workflow-gates hooks (TS)          board (Client, drawing thread)
──────────────           ──────────────────────────         ──────────────────────────────
render / gateway  ──►    tool.call{Bash}: finds GATE,       ui.render{AbovePrompt} draws
emits === GATE ===       arms the gate, cuts MENU out       rule · statement · ◆ question
JSON beside MENU         of what the model reads            rows · footer; keys, pointer
(only when announced)    turn.complete ──► draws it         press ──► surface.post
                                                                  │
                         ui.message{gate} ◄───────────────────────┘
                         first press on a row  ──► $.prompt.fill   (the person's Enter sends)
                         press on the picked row ──► $.prompt.submit
                                                   + sent.json ──► workflow-gates-rows
                                                                   redraws the sent row
```

## Rulings

- **R1 — the prompt box is the answer channel; the person sends.** A
  click on a pressable row, or Enter / a row's own key once the band holds
  the keyboard, *picks*: `$.prompt.fill` puts the answer (`word ?? key`)
  in the prompt box, replacing whatever was there. A second click on the
  picked row, or Enter with the cursor on it, *sends* it through
  `$.prompt.submit`, the box cleared first and put back if the send fails.
  Typing a key and Enter, or Esc then Enter after a pick, sends as the
  person's own message. A pick never commits; a mis-click costs nothing.
- **R2 — the payload is announced, never always-on.** The mod sets
  `WORKFLOWS_GATE_SURFACE=1` at `session.start`; `openGate()` collects only
  while it is set, so an engine run the mod did not start (a test, a
  session without function hooks) prints byte-identical output. The test
  suites strip the variable from their environment (`hermetic-env.cjs`,
  `test:cli`).
- **R3 — the payload states structure, built from parts.** Every MENU is
  preceded by one line of JSON: `{ gate, question, statement, options:
  [{ key, word, head, tail, cue, holder, detail, struck, recommended }],
  typed: [{ label, description, detail }] }`.
  - Rows are built from their parts: a row builder takes its label as a
    plain string (the head alone) or `{ head, tail, cue, holder,
    recommended }`, draws the markdown from the parts (` — *tail*`,
    ` · cue` plain, the strike through the cue when held, ` · holder`
    after it, ` (recommended)`), and the payload records each part as
    text, its markup removed and its escapes honoured — nothing is split
    back out of a label string. A string label carrying that markup inline
    is refused. `struck` is `holder !== null`; a bare yes/no row states no
    head.
  - `menuFrame` records the glyphed question and every other line of
    prose it draws — above the rows as `statement`, directly beneath a row
    as that row's `detail` (the engine marks its own wraps so they join
    back) — as text with its markup removed and its escapes honoured.
  - A menu that recorded nothing states no payload. Taken once per render;
    row builders are composed per render, never at module load.
  - **Nothing a menu draws is missing from its payload**
    (`tests/scripts/gate-audit.cjs`): every MENU line maps to a row part, a
    detail, the question or the statement, compared as text against the
    drawn row's plain reading — strike and italics checked by position, a
    head's own emphasis allowed — so a part still carrying markup fails.
    It runs over every render the render suites make (the task surfaces'
    included), re-rendered announced; over every navigation gateway's view
    the pipeline simulation formats, after every mutation; and over every
    verb of every gateway `runGateway` table, spawned once by the payload
    suite over worlds carrying every row shape, the verb list checked
    against the scripts. Running the gateways in-process for every
    simulation step is idea #57.
- **R4 — the mod cuts the MENU and leaves the instruction.** The GATE
  block is the mod's input alone and never reaches the model: the mod
  removes it from every Bash result that carries one. Where it arms the
  gate (R5), the MENU section becomes `=== MENU: {gate} (drawn above the
  prompt — do NOT emit it; stop and wait) ===` plus one line saying the
  options are on screen as buttons and the answer arrives as the person's
  next message — typed by them, or sent for them by the plugin when they
  press a row. Every other section — a DISPLAY above a menu included —
  stands, and the model writes it into the transcript. Call
  sites defer to their section's marker (R18), so the rewritten marker is
  the one instruction at the gate. The engine keeps emitting the MENU, so
  an absent mod, or one that fails before the cut, leaves the text menu;
  every hook falls through to `next(e)` on failure.
- **R5 — recognition is the GATE marker; the main loop and the terminal
  alone are preconditions.** The mod arms a gate only from the main
  conversation's Bash call, in a session whose only screen is the
  terminal; every gate has a question and a row to press, which the engine
  guarantees (R11) and the audit asserts, so the mod does not check. A
  subagent's call and a session with any other screen attached (Remote
  Control on a phone or the desktop app) keep the text menu, so every
  screen sees it — the band is the terminal's alone. A screen that
  attaches after a menu was cut for the terminal does not get that menu
  (idea #53 would close it).
- **R6 — a gate is armed by its render, drawn at the turn's end, and kept
  until the person answers it.**
  - `tool.call` arms; the main conversation's `turn.complete` draws, so a
    display the model is still streaming always lands first.
  - A turn the person starts — an answer, a question, a press sent — clears
    the band, the pick and the footer as it begins, and remembers the gate
    as the one being answered. A reply the person types into a running
    turn answers it too. `composer`, `bridge`, this plugin's own submission
    and a missing origin count as the person.
  - A turn the person did not start — a background agent's report, a
    notification, a schedule, a peer — leaves the band as it is, live. A
    send pressed while Claude works is held by the mod, the row reading
    ` · queued` and the footer "**{answer}** sends when Claude finishes ·
    click to undo"; at the turn's end it sends if the band
    still shows the same gate — compared by content, so the gate presented
    again fresh is the same — and is dropped otherwise, the new gate's
    footer saying "**{answer}** not sent — the menu changed". A
    turn that draws a new gate replaces the band's. A pick's answer left
    in the prompt box under a gate that goes is cleared, unless the person
    has edited it.
  - An **interrupted** turn (Esc) the person started discards whatever it
    armed. Until it has called a tool it brings back the gate the person
    answered to start it — Esc takes back a mis-press; once any tool has
    run (a read and a write look alike to the mod), or it has armed a gate
    of its own, the band stays empty and the person carries on by talking
    to Claude. Esc during a render leaves nothing half-drawn.
  - Esc during a background turn leaves the band as it is, unless the turn
    armed a different gate — its transcript now ends at that gate, so the
    band empties rather than answer the wrong one. An interrupt never
    sends: a held answer goes back to a pick, or with an emptied band is
    dropped.
  - A turn the person started that ends without a gate brings back
    nothing: the prose presents the gate again when the person is ready
    (R19).
  - **The band survives the process.** At every turn's end, and as the
    conversation ends, the mod saves what the band shows — the gate, or
    nothing — in its store, keyed by the conversation's first tool-use id
    and stamped with where the transcript ends (its last message and newest
    tool-use id). The lines Claude Code writes around an interrupted turn
    are no step of the conversation and no stamp reads them: the
    "[Request interrupted by user…]" line, which lands after the aborted
    turn's end has kept the band, and the "No response requested." reply
    it puts in the model's place when a conversation interrupted that way
    is resumed (findings 44–45). On a fresh load (`claude --resume`, a restart, an account
    switch), a reload's first drawing, or after an in-process end — and
    only in a session that announced (R2) — it reads the record back: a
    transcript that still ends at the stamp redraws the gate, nothing picked
    or held — a held answer waits on a turn a new process never has — and
    one that moved on drops it. Records past Claude Code's 30-day
    transcript retention go.
  - `session.end` — a `/clear`, a resume — empties the band first: no gate
    of the old conversation answers into the new one.
- **R7 — the band never overflows.** Top to bottom: a full-width rule
  (`promptBorder`); a blank row; the statement, if any, in normal weight,
  aligned with the question's text; the `◆` question in bold (glyph in
  `permission`); a blank row; the rows; a blank row; the footer. The band
  is never taller than the `maxRows` Claude Code gives it (half the
  terminal's rows, the prompt's included), so it never becomes Claude
  Code's scroll window and the wheel never reaches it (finding 28).
  - A row: a two-cell gutter (`▌` in `permission` on the cursor row), the
    key column showing `word ?? key` with the shortcut letter
    **underlined** inside the word, the label in the text menu's grammar —
    head plain, ` — tail` and ` · cue` dim italic, the strike running from
    the head through the cue when held, ` · holder` plain after it,
    ` (recommended)` bold in `permission`; a bare yes/no row draws its key
    alone — and its `detail` dim beneath it.
  - Backgrounds: the cursor row `selectionBg`; the picked row
    `diffAddedDimmed` (the pick wins when the cursor sits on it). No ticks.
  - Typed rows (Ask, Comment, a range) draw dim and are never pressable.
  - The footer, dim: `Click to choose · click again to send · or type`;
    after a pick, `**{answer}** is in your prompt · click again to send`;
    after a click on a typed row, `{Label} — Esc, then type it in the
    prompt` (a range: `… — Esc, then type the numbers in the prompt`). It
    always reflects the last click, and its height is reserved as its
    tallest state for the gate, so the band never moves — every state is
    worded to fit one line on a phone, since the reserve is the longest
    state any row could reach, clicked or not.
  - The cursor starts on the recommended row, else the first not struck.
    Arrows work only once a click (or ctrl+x tab) has given the band the
    keyboard.
  - A gate that fits is drawn whole. One that does not keeps its head —
    rule, statement, question — and its footer fixed, and pages the rows:
    as many whole rows as the space left holds, a pager line beneath them
    (`↑ previous   ↓ next   page 1 of 2`, a press that goes nowhere
    dimmed), every page padded to one height so the band never moves. A
    click on previous or next turns the page and puts the cursor on its
    first row; the arrows move through every row and turn the page at its
    edge; a key for a row on another page turns to it. The budget is read
    at every drawing, so a taller terminal pages less or not at all, and
    the same rule serves every gate — nothing is sized per menu.
  - Scrolling is rejected in both its forms. The band as Claude Code's
    scroll window takes trackpad momentum carried in from a flick
    elsewhere, scrolling its rule away (finding 43); a pinned header over
    scrolling rows brings Claude Code's own "N more" line beside any the
    mod draws (finding 29). Two columns of rows were tried and dropped:
    long labels wrap in half the width, and a phone screen has no second
    column to give.
- **R8 — two mods, both under `skills/`.** `workflow-gates` (the band) and
  `workflow-gates-rows` (R15). agntc copies `skills/` recursively, so both
  land in `.claude/skills/` and load as `…@skills-dir`. Declarations are
  fetched into the gitignored `skills/workflow-gates/types/` by `npm run
  mod:types`; `test:mod` and `typecheck:mod` cover both.
- **R9 — the mod is part of the workflows.** No project is asked: the
  workflows are opinionated, and the mod carries the buttons and the
  workflow session's harness (R20) alike. Every `engine boot` puts
  `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: "1"` into the project's
  committed `.claude/settings.json` wherever it is not already `"1"`
  (`domain/gate-surface.cjs`, writing through the `domain/settings.cjs`
  the session hooks' sync shares), inside the lock that sync holds,
  commits it confined, and reports `gate_surface`:
  - `on` where the mod is running, its announcement (R2) in boot's
    environment;
  - `restart` where this boot wrote the flag and the mod is not running;
  - `off` otherwise: a Claude Code without function hooks, or a checkout
    that took the flag from a pull mid-session, carries on in text.

  Claude Code reads settings only at startup, so the session that writes
  the flag cannot load the mod. On `restart`, workflow-start's Step 0.2,
  straight after the boot and before the walkthrough and the other setup
  questions so all of them run with the mod, shows what the mod does
  under a `▪ Workflow Mod` sub-step marker and ends the session on a red
  title, "Restart Claude Code to finish setting up", with a signpost
  saying why. There is nothing to answer. Only the boot's own review of
  migration changes comes before it. Those blocks are the terminal step's
  closing text, so they need no engine surface (R21). The text menus
  stay as the fallback wherever the band is not drawn (R4, R5). A
  prose-test world carries the flag, so a walk never meets the restart.
- **R10 — auto gates arm nothing.** Under `auto`/`bounded` the engine
  emits a DISPLAY, never a MENU.
- **R11 — every gate is an engine menu, and every menu asks.** No skill
  prose authors a menu: the last seventeen (spec-confirm,
  completed-actions, dismissed-topics, cross-cutting, the format catalogue
  as a verbatim payload so format names never enter engine code,
  findings-signoff, complexity, first-phase, plan-context) are engine
  surfaces, and the conventions lint (check 3) refuses a menu anywhere in
  skill prose. The hand-drawn displays these stacks edit are
  engine-drawn too — the specification entry's confirmation, the empty
  dismissed list, the cross-cutting references, the missing-dependencies
  tree. A file these stacks only swept (a wording normalization, a step
  renumbering) keeps its other displays: CONVENTIONS' "touching a file
  adopts its displays" is loosened for this programme alone, and idea #54
  migrates the rest in one focused pass. Every menu carries a glyphed
  question with any statement above it as context, and `menuFrame` refuses
  a menu without a question above its rows or without a single key to
  press (a range row is typed, never pressed). The pickers — archived
  inbox, working-set add/drop, manage list, completed, experiment pick,
  baseline doc pick — are selection menus with a real `b/back` row. So
  the band has one shape: statement, question, rows.
- **R12 — tests.** Engine: `test-engine-gate-payload.cjs` and the strict
  audit where R3 says, all under `npm test`; guards that no skill's head
  insert and no context-refresh recovery fetches a gate (over a world that
  owes gates), and that every ACTIONS table resolves every row its menu
  offers by key and word; conventions lint checks 3 (no menu in prose), 21
  (every section a sentence emits defers to its marker, in one phrasing)
  and 22 (no bare `--horizon`/`--summary` value). Mods: `npm run test:mod`
  (run by hand — the kit ships in the binary), every lifetime, resume,
  pick/send, queued-send and drawing rule mutation-checked, and the
  harness settings, their recognition of the boot and the tool's placement
  (R20); `npm run
  typecheck:mod`. CLAUDE.md's test gates name both as owed for a change
  under `skills/workflow-gates*/`. What the kit cannot model — a real
  resume, a reload, Remote Control, the store across processes — is a lab
  pass before sign-off.
- **R13 — non-goals.** A hook that stops the model when it does not stop
  (idea #48); the mod owning the gate loop; DISPLAY sections as data; the
  engine as a registered tool (idea #50). The position line (#47) and
  compaction recovery (#49) ride this plugin later. After release: per-screen drawing so a Remote Control screen
  keeps the text menu (#53), the remaining hand-drawn displays (#54), a
  native-looking band (#55), commentary worked into engine-rendered gates
  (#56), and one render door for the gateways' views (#57).
- **R14 — removable by construction.** The collector is referenced by
  nothing else; the mods are two directories; the flag is one env
  line, and the delivery rule one bullet (R21). Delete them and the text menus stand as the
  engine draws them — R11 and R16–R19 are the workflows' own rules and
  stand without the mods.
- **R15 — the sent row reads as the answer.** `workflow-gates-rows`
  redraws the transcript row of an answer the band sent as `{question} →
  {answer} · {label}` (label left out when empty or equal to the answer).
  On send the band writes `.workflows/.cache/.gates/sent.json` (`{ answer,
  question, label }`); the rows plugin pairs it with the new row the first
  time it draws it (matching answer), remembers the line by message id in
  `$.store` so scrolling and a resume keep it, and spends the record.
  Expanded rows (ctrl+o) and every other row pass through. The grey sender
  line stays, and the model still reads Claude Code's framing — by design.
  A send that fails or is dropped writes `null` over the record, so no row
  pairs with a send that never entered.
- **R16 — a gate is fetched where it is shown.** A MENU in a tool result
  is a live gate at that call: a call returns one only where the prose
  shows that gate at that call, and a response with no gate carries no
  MENU section. A gate shown later is fetched through its own call where
  it is shown — the discussion's defer gate (`render defer-gate`), the
  continue skills' pick list (`gateway select`), the help card's menu
  (`--menu-only`); a view fetched only for its data or display goes
  through a call carrying none — `render roadmap-view`, `roadmap state`,
  the specification entry's routing read; a context-refresh recovery
  confirms its position before fetching the gate it resumes into. A
  section is emitted from the call that fetched it, never re-emitted from
  an earlier one. This finishes the render-surface programme's move of
  gates to the moment they are displayed, and it is what makes "a GATE in
  a Bash result is a gate the flow has reached" (R5) true.
- **R17 — every answer resolves from DATA.** A cut menu's rows are gone
  from what the model reads, so an answer — a word, or a key with no word
  — resolves from the same response's DATA or from the prose, never from
  the menu's own text: `ACTIONS` tables carry the word a press sends, a
  numbered pick states its table (the baseline doc pick's `DOCS`, the
  inbox tables carrying each item's title), a numbering that follows a
  payload or an earlier call's list says so, and a row whose branch needs
  the person's own words asks for them when a press brings none.
- **R18 — call sites defer to the marker.** Engine output arrives in
  sections, each opened by a section marker, `=== NAME (instruction) ===`,
  whose instruction says how the section is emitted — a code block for
  trees and displays, markdown for titles and menus, or not at all where a
  surface draws the menu. `instructions.md` defines it once for every
  session. Every sentence that emits a TITLE, DISPLAY or MENU says so in
  one phrasing, "…verbatim per its marker", never restating the form
  (conventions lint check 21, both directions); the framework lines that
  once said content is emitted byte-for-byte defer to the marker too.
  Prose-authored blocks keep "Output the next fenced block as …", the one
  other mechanism. A consumer that rewrites a marker (R4) then meets one
  instruction, not two. The prose never names the mod.
- **R19 — a gate waiting on the person.** One framework rule in
  `instructions.md`, and every gate's own Ask/Comment branches defer to
  it: a reply that picks one option unambiguously is the answer; a
  question sets the gate aside — answer it, talk it through, ask in
  conversation whether the person is ready, then present the gate again,
  fetched fresh; a reply that changes what happens next is confirmed
  before anything acts on it, the gate's own branches owning how. A gate
  set aside moves forward only by being presented again and answered
  there: a yes to being ready, or a go-ahead or a pick the person
  volunteers in the conversation, brings it back at once — never the
  answer, and a volunteered go-ahead is never met with a readiness
  question of its own. A bare go-ahead given at a gate on screen answers it only where
  the gate has one way forward. Never move past a gate without an
  answer. Background work arriving while a
  gate waits is handled and named in a line, then the waiting gate is
  presented again, fetched fresh — never typed from memory — and a gate
  background work surfaces meanwhile is held until the waiting one is
  answered: one gate at a time, which is also all the band can show.
- **R20 — the mod sets the harness for workflow sessions alone.**
  - At `session.start` it sets `CLAUDE_CODE_PEWTER_OWL_TOOL=true`, which
    gives the session Claude Code's `SendUserMessage` tool. This is the
    only moment the switch counts: set later, the tool stays out of the
    catalogue and a call is refused "not enabled in this session". Its
    `tool.describe` answer keeps the tool behind ToolSearch in every
    session, one answer that never changes and so never spends the prompt
    cache. A plain session's tool list is Claude Code's own; a workflow
    session loads the tool once, the first time R21 sends a block through
    it.
  - When the engine's boot runs in the main conversation (only
    `/workflow-start` runs it), the mod sets
    `CLAUDE_CODE_THINKING_DISPLAY_UPDATES=false`, which stops one-line
    summaries of Claude's thinking printing as if they were output, and
    `CLAUDE_CODE_SILENT_TURN_REMINDER=false`, which stops the "the user
    hasn't heard from you — say what you're doing" nudge. Project
    settings cannot set the second (finding 50). Both are read per
    request and hold from the next one. A conversation's end (`/clear`,
    a resume) unsets them, and a conversation that has run the boot gets
    them again when the mod next follows it, in a new process or this
    one. A plain conversation in the same project keeps Claude Code's
    defaults throughout.
- **R21 — what a step shows reaches the person.** One rule in
  `instructions.md` says how what a step shows or says (a fenced block
  the prose tells Claude to output, an engine section emitted per its
  marker, a line the prose tells Claude to say) gets to the screen:
  - Written and then carried past with another tool call, it goes
    through `SendUserMessage`, a block verbatim in the form its
    instruction names; what comes one after another shares one call.
  - The step that ends the turn (at a gate, a STOP, or a dispatch that
    waits) holds what it shows and writes it after its last call, in
    order, as Claude's own text. A turn always ends on text: one that ends
    on a tool call alone draws Claude Code's "no visible output" nudge,
    and a gate whose lead-in all went through the tool left Claude
    narrating the buttons (finding 51).
  - Where `SendUserMessage` is not available (no mod, the first run) every
    block is written as text, as before.

  The engine's markers do not change: "do not stop; continue" already
  says another call follows. The rule is the one place the tool is named,
  so a renamed tool, or a model that shows text between calls again, is
  one line.
- **R22 — a turn that ends on a background dispatch ends on one sentence.**
  Where a flow sends an agent to work in the background and waits for its
  report, the turn's closing text is a sentence the prose prescribes, "The
  executor agent has been dispatched for task 5.1.", naming the task by
  the plan's phase and task numbers, never an internal id or a topic slug;
  every other waited-on agent is named with what it works on ("phase 2",
  "review cycle 3"). Without it the turn ends on the dispatch, and Claude
  improvises a status line in answer to the nudge. Claude Code runs an
  agent in the background unless told otherwise, so every dispatch the
  flow waits on ends a turn and carries a sentence; a dispatch meant to
  run in the foreground says `run_in_background: false`, and one the
  conversation carries on past carries none (CONVENTIONS' Dispatch
  Lines).

## The stack

- **PR0** — this document (#1274), merged last.
- **One stack** (#1278), off main, merged bottom to top:
  - the migration — #1276 → #1277 → #1282 → #1286 → #1287 (the seventeen
    menus, and the hand-drawn displays these stacks edit) → #1295 (every
    menu asks; no menu in prose) → #1299 (a gate is fetched where it is
    shown, R16) → #1300 (call sites defer to the marker, R18) → #1301
    (every answer resolves from DATA, R17) → #1302 (a gate waiting on the
    person, R19);
  - the gate surface on top of it — #1289 the payload (rows from parts,
    strict audit) → #1290 the band → #1292 the mod set up on the first
    run (R9) → #1294 the rows mod;
  - display delivery on top of that — #1303 the workflow session's
    harness (R20) → #1304 what a step shows reaches the person, with the
    dispatch sentence (R21, R22). Where the payload meets the migration's menus, each layer closes
    on `sync:` commits: the spec-confirm gate's per-render `yesNo()`, one
    glyph helper and a menu asking on its glyphed line alone, the
    migration's pick rows built from parts, the payload suite re-pinned
    to menus that always ask (#1289); the band's question-less and
    row-less paths removed, the audit asserting a question and a row to
    press (#1290); the rows mod's question-less line removed (#1294).
- **Ideas logged on the way** (#1272, #1293): the position line, the stall
  guard, compaction recovery, the engine as a tool, cancel's "no"
  returning to its list, a settings menu, per-screen menu drawing, the
  remaining hand-drawn displays, a native-looking band, commentary worked
  into gates, one render door, moments of delight drawn by the mod
  (#53–#58).

## Findings log — API facts a first reading missed

1. Sections are `=== MENU (…) ===` (gateway, unnamed) and `=== MENU: name
   (…) ===` (surfaces, named).
2. The `tool.call` event is the input flattened: `e.command`.
3. `text` is core's; return `{ result }` to change what the model reads,
   validated against the tool's output schema.
4. Awaiting a Button press inside `tool.call` burns the budget; a `$`
   call's wait does not.
5. A Pane has no `id` prop; the instance is `e.requestId`.
6. A plugin-opened pane waits undrawn below 144 columns — hence the band.
7. `$.ui.notice` is `(tool_use_id, text)`; the transient line is
   `$.ui.toast`.
8. Setting state without `$.ui.invalidate("ui.render")` redraws nothing.
9. `hover` on a Button outside a keyed Box is refused.
10. The region must be exactly as tall as the tree: hook and board share
    one geometry, including a question or footer that wraps.
11. Hot reload resets module state but does not re-run `session.start`.
12. Hand-drawn frames drift by a column per style.
13. Parsing the menu's markdown for options was brittle by construction.
14. Option sets composed at module load record nothing.
15. A surface that hand-rolls its `=== MENU` marker can never carry a
    payload.
16. `$.ui.message` is not a call on `$`.
17. `$.ui.resolve(e)` is declared synchronous.
18. `mock.env` answers `$.env.get` only.
19. A failing `prompt.submit` is reachable in the kit by a throwing bottom
    hook; `{ drop }` is a resolution.
20. `claude plugin test` refuses without the function-hooks flag.
21. A plugin's submitted prompt is framed as the plugin's for the model
    and the person, whatever a hook answers.
22. A plugin's own render hooks are skipped on the row of a prompt it
    submitted; the kit does not model it.
23. A click hands the band the keyboard for good — only the person's Esc
    returns it — so "click, then Enter" cannot mean the prompt's Enter.
24. The loader accepts `$` passed only to top-level functions.
25. A gate armed and drawn on `tool.call` appears while the model is still
    streaming the display above it; drawing belongs at the turn's end.
26. A menu's statement was drawn by the text menu and dropped by the
    payload; the strict audit is what guarantees parity now.
27. A background agent's notification opens a turn that clears the band;
    a gate the person had not answered must come back.
28. The wheel reaches the band only while its tree is taller than
    `maxRows`; a band kept within `maxRows` never sees `ui.scroll`.
29. An overflowing band always carries Claude Code's own "N more" line,
    counting whatever overflows — padding included — and no render hook
    reaches it.
30. A skills-dir mod reloads in place when its files change, and can
    reload at the first turn's end of a session started just after a
    change; module state goes with it.
31. A snapshot that carries a MENU the prose does not show at that call
    — the discussion map's defer gate, the continue skills' pick list, a
    view read for its data — is armed and drawn all the same: the mod
    cannot tell a shown gate from a carried one. Hence R16.
32. With the MENU cut, a numbered row or a bare word means nothing unless
    the response's DATA or the prose says what it selects. Hence R17.
33. Taking a payload's parts back out of a label string — splitting at
    ` — `, stripping markup — broke on escaped inbox titles and on dashes
    inside a sentence, and blurred an alert cue into the metadata tail.
    Hence rows built from parts (R3).
34. A MENU cut for the terminal reaches no other screen: a Remote Control
    client sees the display with no menu under it. Hence R5's terminal-
    alone precondition.
35. `/clear` never fires `session.start`; a gate from the old conversation
    stays on the band unless `session.end` clears it.
36. `$.prompt.submit` can resolve `{ drop }` without throwing; a send that
    ignores it reports a send that never entered.
37. The function-hooks flag can come from user settings, local settings or
    the shell, so the project's settings file cannot say whether the mod
    is running; boot reads the mod's own announcement instead (R9), and
    never removes a flag it cannot prove it wrote.
38. The loader refuses a second hook on an event another hook of the same
    mod already takes, unless each names a matcher: one hook per event,
    branching inside it.
39. `$.session.messages()` reads the transcript — each message's role,
    text and tool uses — so the mod can tell whether anything happened
    since it last drew (R6's resume stamp).
40. `$.prompt.submit` made while Claude works waits for the turn to end
    and then enters, whatever the band shows by then; a send the mod does
    not hold itself can answer a gate that has already gone (R6's held
    send).
41. A reply the person types into a running turn carries that turn's
    `turnId` and opens no turn of its own; the mod counts it as the
    person answering (R6).
42. A background turn that cleared the band and drew nothing left a
    waiting gate on no screen, and the model re-presented it from memory
    — a different gate under the same name. Hence the band staying
    through background turns (R6) and a waiting gate fetched fresh
    (R19).
43. A trackpad flick's momentum keeps arriving as wheel ticks after the
    fingers lift, and Claude Code sends each to whatever sits under the
    pointer: moving from the transcript to the prompt across an
    overflowing band scrolls the band, and back again scrolls the
    transcript — a loop on the iPad's trackpad, seen in the first minute.
    `maxRows` on the `AbovePrompt` render is the band's budget, readable
    before it draws. Hence R7's band that never overflows.
44. `session.end` does not run (or never lands) on `/exit`: the band kept
    at the last turn's end is the only record a later resume reads.
45. Resuming a conversation whose last turn was interrupted, Claude Code
    inserts an assistant "No response requested." after the interruption
    line, so a stamp read off the transcript's last message never matches
    the one kept before the quit. Hence R6's stamp skipping both.
46. Text a skill prescribes just before a tool call — the setup gates'
    sub-step marker and signpost before the buttons question, Portal's
    task brief — is dropped on some runs and shown on others, while the
    gate the call returns is always drawn. The display-delivery layers
    exist for it.
47. A background agent's report arrives as two turns, one after the
    other (origin `peer`, then `task-notification`); an Esc in the first
    and the second starting within the same second once left the band
    treating a press as a send, not a hold. Not reproduced since; open.
48. Opus 5.5 loses the text written between two tool calls: no text block
    reaches the wire, and the server returns the text as a hidden
    "narration" block. A 13-line brief was lost in every run, a
    177-character block survived, and the lab lost a 90-character heading
    in half its sessions. On 2.1.280, Opus 5 showed 11 of 12 long
    displays, so the loss follows the model's path, not the harness
    version. Marker wording, a preamble and CLAUDE.md change nothing
    (Portal session `4219c972`, `~/Code/harness-spike` C0–C12,
    claude-code#96288).
49. `SendUserMessage` is a tool call, not text, and arrives mid-turn every
    time (C13–C15, C21, the lab). `CLAUDE_CODE_PEWTER_OWL_TOOL` switches
    it on, and counts only when set by `session.start`.
50. Project settings silently drop `CLAUDE_CODE_SILENT_TURN_REMINDER`, one
    of the keys project scope may not set; the mod's `$.env.set` reaches
    it, so a workflow session alone runs without the nudge (C18, and no
    nudge in any lab run under R20).
51. A turn that ends on a tool call with no text draws "[Your previous
    response had no visible output…]"; at a gate whose lead-in had all
    gone through the tool, Claude said "The resume options are showing as
    buttons above the prompt" instead. Hence R21's closing text.
52. The tool kept behind ToolSearch sits in neither list on a
    conversation's first request, and behind ToolSearch from the second;
    bringing it forward at the boot landed only at the person's next
    message, after the workflow had already searched for it. Hence one
    answer for every session (R20).

## Log

- 2026-09-17 — sandbox copied from fumi, mod built through findings 1–9,
  engine `GATE` payload added.
- 2026-09-22 — distribution proven, rulings R1–R14 settled, built the
  same day across two stacks; spike assets deleted.
- 2026-09-23 — live runs in `fumi-gatelab`: click-to-send replaced by
  pick-then-send (R1), drawing moved to the turn's end and Esc/background
  restores added (R6), the band's final chrome settled (R7), the rows mod
  added after the origin hook proved inert (R15), statements and details
  added to the payload with a strict audit (R3), every menu made to ask
  (R11), the opt-in's copy rewritten in plain words (R9). Findings 21–27.
- 2026-09-23 — a pinned header over scrolling rows spiked on a short
  terminal and rejected (R7); the band keeps Claude Code's whole-panel
  scroll. Findings 28–30.
- 2026-09-24 — the first review pass: gates fetched where they are shown
  (R16), answers resolved from DATA (R17), call sites deferring to the
  marker (R18); rows built from parts with a cue and holder of their own
  (R3, R7); the GATE block kept from the model, the band confined to a
  terminal-only session, Esc restoring only before a tool ran, `/clear`
  emptying the band, a dropped send put back (R4–R6, R15); the recorded
  answer governing the mod and a recorded no leaving the flag alone (R2,
  R9); the hand-drawn displays beside the migrated menus moved to the
  engine (R11). Findings 31–37.
- 2026-09-24 — the second review pass: the band survives a resume and
  stays through background work, holding a send pressed while Claude
  works (R6); a gate waiting on the person has one rule (R19); the section
  marker defined once and every call site deferring to it in one
  phrasing (R18); payload parts recorded as text and audited in every
  suite that renders a menu (R3, R12); displays migrate only where these
  stacks edit them (R11). Findings 38–42. Both stacks rebased onto main
  over the topic postpone and joined into one, the gate surface on top of
  the migration, its reconciliation carried as `sync:` commits.
- 2026-09-24 — the lab pass on the one stack: the band never overflows,
  its rows paged under a fixed head and footer (R7); two columns tried and
  dropped. Finding 43.
- 2026-09-25 — the lab pass continued, then paused: answering, questions
  at a gate, background work and resume all passed live (R6's resume
  stamp corrected, findings 44–45); the footers shortened to one line on
  a phone, the setup gates given sub-step markers (R7, R9); prescribed
  text before a tool call seen dropped (finding 46), bringing the
  display-delivery work in as the stack's next layers.
- 2026-09-25 — display delivery: the Portal spike read back and checked
  against 2.1.282 (findings 48–50); the mod made part of the workflows,
  its opt-in gone (R2, R9); the lab spikes settled the harness settings,
  the tool kept behind ToolSearch, and one rule for shown text with every
  turn ending on text (R20–R22). Findings 48–52.
