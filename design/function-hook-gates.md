# Function-Hook Gates — gates drawn by code, never relayed by the model

Design record for the gate-surface programme: the engine's gates rendered
as interactive UI through Claude Code function hooks ("Claude Mods"), so
the model never holds the menu text at all. Opened 2026-09-17 as a spike in
an isolated copy of Fumi (deleted 2026-09-22; its mod and engine patch rode
this document until the real mod landed, and went with the close). Rulings
settled 2026-09-22, built the same day, then reshaped on 2026-09-23 by two
days of live runs in `fumi-gatelab`, a remote-free copy of a real project.

## Motivation

The render-surface programme (`render-surfaces.md`) moved every menu into
the engine: code composes the `MENU` section, the model emits it verbatim.
That removed the model's authorship but not its *agency* — it still has to
reproduce the text, can editorialise, truncate or reorder it, and the gate
scrolls away with the transcript. A function hook intercepts the engine's
output before the model reads it and draws the gate in the band above the
prompt, where it stays while the transcript scrolls. The model's only
remaining job at a gate is to stop.

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
- `$.prompt.submit({ text })` submits as a turn; it passes every hook but
  the calling one, and Claude Code **frames it as the plugin's** whatever a
  hook answers: stored as "The {plugin} plugin sent a message:\n{text}\n\n
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
- `$.env.set` sets for this process and everything it starts after — a
  Bash tool's child inherits it; the name must be a literal. `$.fs` reads
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
  while it is set. Default output stays byte-identical.
- **R3 — the payload states structure, not markdown.** Every MENU is
  preceded by one line of JSON: `{ gate, question, statement, options:
  [{ key, word, head, tail, detail, struck, recommended }], typed: [{
  label, description, detail }] }`. The builders record the rows they
  compose; `menuFrame` records the glyphed question and every other line
  of prose it draws — above the rows as `statement`, directly beneath a
  row as that row's `detail` (the engine marks its own wraps so they join
  back). Markup is stripped; ` (recommended)` comes off the whole label
  before the head/tail split. Taken once per render. **Nothing a menu
  draws is missing from its payload**: the pipeline simulation re-renders
  every surface announced and its audit (`tests/scripts/gate-audit.cjs`)
  maps every MENU line to a row, a detail, the question or the statement.
  Row builders are composed per render, never at module load.
- **R4 — the mod cuts the MENU and leaves the instruction.** The MENU
  section becomes `=== MENU: {gate} (drawn above the prompt — do NOT emit
  it; stop and wait) ===` plus one line; the GATE line goes; every other
  section — a DISPLAY above a menu included — stands, and the model writes
  it into the transcript as before. The engine keeps emitting the MENU, so
  an absent or broken mod degrades to the text menu; every hook falls
  through to `next(e)` on failure.
- **R5 — recognition is the GATE marker; the terminal and the main loop
  are preconditions.** A subagent's Bash call and a session without a
  terminal pass through, as does a gate with no pressable row.
- **R6 — a gate is armed by its render and drawn at the turn's end.**
  - `tool.call` arms; the main conversation's `turn.complete` draws, so a
    display the model is still streaming always lands first.
  - `turn.start` clears the band, the pick and the footer, and remembers
    the gate that was on the band as the one being answered.
  - An **interrupted** turn (Esc) discards whatever it armed and brings
    back the gate the person answered to start it, if any — Esc takes back
    an answer; Esc during a render leaves nothing half-drawn.
  - A turn **not opened by the person** — a background agent's
    notification, a schedule, a peer — that ends without arming a gate
    brings back the gate the person had not yet answered. `composer`,
    `bridge`, this plugin's own submission and a missing origin count as
    the person.
  - A turn the person opened that ends without a gate brings back nothing.
    The memory is dropped at every turn's end.
- **R7 — the band.** Top to bottom: a full-width rule (`promptBorder`); a
  blank row; the statement, if any, in normal weight, aligned with the
  question's text; a blank row; the `◆` question in bold (glyph in
  `permission`); a blank row; the rows; a blank row; the footer.
  - A row: a two-cell gutter (`▌` in `permission` on the cursor row), the
    key column showing `word ?? key` with the shortcut letter
    **underlined** inside the word, the label — head plain, ` — tail` dim
    italic, ` (recommended)` plain, the head struck through when held —
    and its `detail` dim beneath it.
  - Backgrounds: the cursor row `selectionBg`; the picked row
    `diffAddedDimmed` (the pick wins when the cursor sits on it). No ticks.
  - Typed rows (Ask, Comment, a range) draw dim and are never pressable.
  - The footer, dim: `Click a row to choose · click it again to send · or
    just type`; after a pick, `**{answer}** is in your prompt · click it
    again or Enter to send`; after a click on a typed row, `{Label} — press
    Esc, then type in the prompt` (a range: `… type the numbers in the
    prompt`). It always reflects the last click, and its height is reserved
    as its tallest state for the gate, so the band never moves.
  - The cursor starts on the recommended row, else the first not struck.
    Arrows work only once a click (or ctrl+x tab) has given the band the
    keyboard.
  - A gate taller than the band scrolls as a whole, Claude Code's way: the
    rule and question scroll away with the rows. Pinning them while only
    the rows scroll was spiked and rejected — the wheel reaches the band
    only when it overflows, which brings Claude Code's own "N more" line
    beside any the mod draws; and every in-band indicator placement tried
    (lines always reserved, lines in place of the blanks, lines only while
    rows are hidden) either doubled the spacing or moved the list under
    the cursor. A scrollbar and right-aligned counts were also turned down.
- **R8 — two mods, both under `skills/`.** `workflow-gates` (the band) and
  `workflow-gates-rows` (R15). agntc copies `skills/` recursively, so both
  land in `.claude/skills/` and load as `…@skills-dir`. Declarations are
  fetched into the gitignored `skills/workflow-gates/types/` by `npm run
  mod:types`; `test:mod` and `typecheck:mod` cover both.
- **R9 — opt-in per project, the tmux-labels shape.** The project
  manifest's `defaults.gate_surface`; `engine boot` reports `gate_surface`
  (`on`/`off`/`prompt`); `workflow-start` Step 0.4 asks once, after the
  session-labels question, through `render gate-surface-gate`. The
  signpost: "Whenever a decision is yours, the workflows stop and show a
  menu like the one below. Claude Mods, an experimental Claude Code
  feature, can show these menus as buttons above the prompt instead: click
  a row or press its key to answer. You can turn it off at any time by
  setting `gate_surface` to `false` in `./.workflows/manifest.json`." The
  question: "Show menus like this one as buttons above the prompt?". A
  clean `yes` ends the session on a red title, "Restart Claude Code to
  turn the buttons on", with a signpost saying why (settings are read at
  startup); a failed record or a warning carries on as text. `engine
  gate-surface config <true|false>` records and syncs
  `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` (`domain/settings.cjs`, shared
  with the session hooks); every boot re-syncs a recorded choice, a
  never-asked project left alone. The prose-test harness stamps
  `gate_surface: false`.
- **R10 — auto gates arm nothing.** Under `auto`/`bounded` the engine
  emits a DISPLAY, never a MENU.
- **R11 — every gate is an engine menu, and every menu asks.** The
  seventeen prose-authored menus moved into the engine (spec-confirm,
  completed-actions, dismissed-topics, cross-cutting, the format catalogue
  as a verbatim payload so format names never enter engine code,
  findings-signoff, complexity, first-phase, plan-context). CONVENTIONS'
  route-menu exemption is gone: every menu carries a glyphed question, a
  statement above it as context, and `menuFrame` refuses a menu without a
  question above its rows or without a pressable row. The pickers whose
  `b/back` lived inside an instruction line — archived inbox, working-set
  add/drop, manage list, completed, experiment pick, baseline doc pick —
  are selection menus with a real `b/back` row. So the band has one
  shape: statement, question, rows.
- **R12 — tests.** Engine: `test-engine-gate-payload.cjs` and the
  simulation's strict audit under `npm test`. Mods: `npm run test:mod`
  (run by hand — the kit ships in the binary), every lifetime and
  pick/send rule mutation-checked; `npm run typecheck:mod`.
- **R13 — non-goals.** A hook that stops the model when it does not stop
  (idea #48); the mod owning the gate loop; DISPLAY sections as data; the
  engine as a registered tool (idea #50). The position line (#47) and
  compaction recovery (#49) ride this plugin later, as does provisioning
  the harness's own display knobs from the mod (another session's
  research).
- **R14 — removable by construction.** The collector is referenced by
  nothing else; the mods are two directories; the opt-in is one boolean,
  one verb and one env line. Delete them and the text menus are what they
  were — bar R11, which stands on its own.
- **R15 — the sent row reads as the answer.** `workflow-gates-rows`
  redraws the transcript row of an answer the band sent as `{question} →
  {answer} · {label}` (label left out when empty or equal to the answer).
  On send the band writes `.workflows/.cache/.gates/sent.json` (`{ answer,
  question, label }`); the rows plugin pairs it with the new row the first
  time it draws it (matching answer), remembers the line by message id in
  `$.store` so scrolling and a resume keep it, and spends the record.
  Expanded rows (ctrl+o) and every other row pass through. The grey sender
  line stays, and the model still reads Claude Code's framing — by design.

## The stack

- **PR0** — this document (#1274), merged last.
- **Migration stack** (#1278): #1276 → #1277 → #1282 → #1286 → #1287 (the
  seventeen menus) → #1295 (every menu asks).
- **Gate-surface stack** (#1291): #1289 the payload (statement, detail,
  strict audit) → #1290 the band → #1292 the opt-in → #1294 the rows mod.
  When it is rebased onto main after the migration stack lands, four
  things need a hand beyond the recorded conflict resolutions: the
  migration's `spec-confirm-gate` must call `yesNo()` (the payload made
  shared row sets per-render functions), duplicate `GLYPHED_LINE` /
  `glyphed()` copies in `surfaces.cjs` go, the payload tests re-pin to the
  menus' new questions, and the trailing-prompt fallback in the collector
  and audit becomes dead code to remove.
- **Ideas logged on the way** (#1272, #1293): the position line, the stall
  guard, compaction recovery, the engine as a tool, cancel's "no"
  returning to its list, a settings menu.

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
