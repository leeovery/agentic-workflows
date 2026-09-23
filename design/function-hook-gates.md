# Function-Hook Gates — gates drawn by code, never relayed by the model

Design record for the gate-surface programme: the engine's gates rendered
as interactive UI through Claude Code function hooks ("Claude Mods"), so
the model never holds the menu text at all. Opened 2026-09-17 as a spike in
an isolated copy of Fumi (deleted 2026-09-22; its mod and engine patch rode
this document until the real mod landed, and went with the close). Rulings
settled 2026-09-22; built the same day.

## Motivation

The render-surface programme (`render-surfaces.md`) moved every menu into
the engine: code composes the `MENU` section, the model emits it verbatim.
That removed the model's authorship but not its *agency* — it still has to
reproduce the text, can editorialise, truncate or reorder it, and the gate
scrolls away with the transcript. A function hook intercepts the engine's
output before the model reads it, draws the gate in the band above the
prompt, and hands the answer back as the person's next message. The
model's only remaining job at a gate is to stop.

Secondary wins: the band is sticky (the gate stays put while the
transcript scrolls), rows are pressable and hoverable, arrow keys and
Enter work once the band has focus, and typing the key still works exactly
as today.

## What function hooks are (verified against the 2.1.274–2.1.280 declarations)

Read from `mods/types/claude-code.d.ts` in anthropics/claude-code and from
`/plugin-types`, or proven in the sandbox and by the mod's own tests. Early
access: hooks modules load only where `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`;
Anthropic's 2026-09-09 update says the semantics are set and shipping is
"weeks" away.

- A mod is a plugin whose `hooks/hooks.json` names a `modules` entry
  exporting `register(on, options)`. Every hook is `($, e, next)`,
  Koa-style; hooks on one event fold in registration order, core last.
- `$` is the only door: no ambient fs or network; every call is spelled
  literally `$.noun.event(...)`. `claude plugin validate <dir>` inventories
  hooks, calls, env reads/writes and surface modules.
- **A hook's budget is ten seconds of its own time.** The clock stops
  while a `next(e)` or any `$` call is in flight (a `$.clock` wait
  excepted). Overrun or throw and the hook is absent: its `.catch` asked
  on a one-second grace, else `next(e)` run on its behalf. A guard fails
  open unless it declares `.catch`; inside `.catch`, `next(e)` alone is
  correct whether or not the hook had called it — `next` is replay-safe.
- `$.ui.ask(question, options)` is the one `$` call that waits on a
  person: the engine's own AskUserQuestion dialog, 2–4 option labels, free
  text as Other. Not a menu of ours.
- `tool.call` event: the tool's input flattened, plus `tool` and
  `tool_use_id` (`e.command` for Bash). Matcher key is `tool`. `text` on
  the result is core's own field, absent from any hook's own `{ result }`;
  the record (`stdout` for Bash) is both the true source and the only thing
  a hook can rewrite, validated against Bash's output schema. `context` on
  a result is text the model reads after it and the user never sees.
- `AbovePrompt` — the band above the composer — is one always-drawn
  instance, **terminal only**; its props are `hasSurvey`, `isWorking`,
  `maxRows`, `bodyColumns`, `scroll`, `view`. A `Pane` (`$.ui.open`)
  waits undrawn below 144 columns when a plugin opens it unasked.
- `Client` element: a surface module with its own frame clock, keys and
  pointer, no `$`, talking back via `surface.post` → `ui.message` — a post
  is the board's alone, not a `$` call. Keys reach it only while it has
  focus (a click, or ctrl+x tab); Escape returns the focus. Its `module`
  is read off the source as a literal (`'./board.ts'`) and comes back
  plugin-relative on the drawn element (`hooks/board.ts`).
- `Button`: one string label; `hotkey` (a digit or a lowercase letter)
  presses while the site holds the focus — a bare digit also from an
  empty composer; `hover` refused outside a keyed `Box` unless it names a
  `scope`. `Select`: a one-of-several picker, focus-gated. Neither
  carries styled runs. The global `h` returns `RenderNode | null |
  undefined`; the element constructors return `RenderElement`, which is
  what a `ui.render` hook must return.
- `$.prompt.submit({ text })` sends text as the person's next message,
  run once the session is idle; a rejection reaches the caller. `turn.start`
  / `turn.complete` bracket a model turn; `session.start` runs once per
  session (a hot reload does not re-run it).
- `Text.color` accepts a theme key (`permission`, `promptBorder`,
  `userMessageBackground`, …); ANSI themes resolve them to the terminal's
  own colours, which a raw hex ignores.
- `$.env.set` sets for this process and everything it starts after — a
  Bash tool's child inherits it; the name must be a literal.
  `$.process.run(argv)` runs a child, no shell. `$.session.surfaces()`
  lists the attached surfaces.
- Distribution: a folder under the project's `.claude/skills/<name>/`
  carrying `.claude-plugin/plugin.json` loads as `<name>@skills-dir`
  (proven: `claude plugin details workflow-gates` → `Source:
  workflow-gates@skills-dir`). The flag in the project's
  `.claude/settings.json` `env` is honoured (proven headless: module
  loaded with it, not without). Settings snapshot at startup, so the
  first session after the write still gets the text menu.
- Tests: `claude plugin test <dir>` with `claude-code/testing` —
  `mock.env` (answers `$.env.get` only; `$.env.set` needs its own hook,
  and a second registration of one op is a load error), `mock.store`,
  `mock.clock`, `$.ui.press`; a `Client`'s post is driven with
  `ui.post(data, { in })` on a mounted drawing; `find`/`findAll` match the
  whole shown text, outermost first. The command refuses outright without
  `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## The shape

```
engine (node)            mod hooks module (TS)              board (Client, drawing thread)
──────────────           ──────────────────────             ──────────────────────────────
render / gateway  ──►    tool.call{tool=Bash}               ui.render{AbovePrompt} draws
emits === GATE ===       finds GATE, arms the gate,         <Client module="./board.ts">
JSON beside MENU         cuts MENU out of stdout,           keys, mouse, cursor, wrap
(only when announced)    answers { result } ──► model       press/Enter ──► surface.post
                                                                  │
                         ui.message{element=gate}  ◄──────────────┘
                         $.prompt.submit({ text: answer })  ──► the person's next message
                         turn.start ──► the gate clears
```

The model receives one line where the menu was — the options are on
screen, stop and wait — and the answer arrives as a user message, which is
what the prose's branch tables already read. **No prose changes for the
gates themselves.**

## Rulings

- **R1 — the answer channel is `prompt.submit`.** The prose reads the next
  user message; the transcript records the choice as one; nothing in the
  workflows changes. `$.ui.ask` is not a second path: it is the engine's
  dialog with four options at most.
- **R2 — the payload is announced, never always-on.** The mod sets
  `WORKFLOWS_GATE_SURFACE=1` at `session.start` through `$.env.set`, which
  every Bash child inherits; `openGate()` collects only while it is set.
  Default output stays byte-identical, a session without the mod carries
  no JSON at every gate, and the snapshot goldens are untouched.
- **R3 — the payload states structure, not markdown.** The four option
  builders record their rows as they compose them; the MENU section emits
  `{ gate, question, options: [{ key, word, head, tail, struck,
  recommended }], typed: [{ label, description }] }` directly above
  itself. The engine splits the label on the first ` — `, strips its own
  markup (`**`, `~~`, `` ` ``, `*`), takes ` (recommended)` off the whole
  label before the split (the projections append it after the tail), and
  the mod never parses presentation. The question is the first non-empty
  claim: the glyphed label, the explicit `question`, or the trailing
  `Select an option:` prompt of a label-less menu. A `rangeOption` records
  as a typed row, since a span is not one press; a `bareOption` row's head
  is its word. Taken once per render, so a row can only land in its own
  gate; a response without a MENU drops the collection.
- **R4 — the mod cuts the MENU and leaves the instruction.** The
  `tool.call` hook answers with Bash's own record, the MENU section
  replaced by `=== MENU: {gate} (drawn above the prompt — do NOT emit it;
  stop and wait) ===` and one line saying the choice arrives as the next
  message; the GATE line is removed; every other section stands. The
  engine keeps emitting the MENU regardless, so a broken or absent mod
  degrades to the text menu — every hook carries a `.catch` that falls
  through to `next(e)`, and the render wraps its frame. A gate whose
  payload holds no pressable row (the archived inbox view frames a single
  instruction line) is left as text.
- **R5 — recognition is the GATE marker, and the terminal is a
  precondition.** The hook keys on `=== GATE (` in the Bash record's
  `stdout`, never on the command string; it cuts the MENU only while
  `$.session.surfaces()` includes the terminal (the band is
  terminal-only), and passes through on desktop, web and headless runs.
  A subagent's Bash call (`agentId` set) passes through untouched: a press
  can only answer the conversation.
- **R6 — a gate is armed by its render, drawn at the turn's end, and gone
  at the next `turn.start`.** The render arms it; the main conversation's
  `turn.complete` draws it, so the display the model is still streaming
  lands before the rows it chooses between (a live run showed the band up
  seconds ahead of an epic tree). Every gate is re-armed by its own
  render (the fetch-at-emission rule), so a free-text question that
  re-presents the gate redraws it, and an answer of any kind clears it
  when the turn begins. A press awaits `$.prompt.submit` before clearing,
  so a rejected submit leaves the rows on screen to press again; a
  `prompt.submit` hook on the mod's own submissions leaves the origin out
  of its answer, so the press enters as the person's own message rather
  than wrapped as a plugin's.
- **R7 — chrome is `bar`, and only `bar`.** No frame; a full-width rule in
  `promptBorder`; the `◆` question in `permission`; rows with a two-cell
  gutter (`▌` on the selected row) and `userMessageBackground` beneath it;
  metadata tails dim italic on every row, as the text menu renders them,
  ` (recommended)` plain after the tail, the head struck where the row is
  held. The board is a `Client` (whole-row targets, styled runs); the key
  shown is the option's word where it has one; a typed row (`Ask`,
  `Comment`, a range) draws dim and unpressable. Presses: click, Enter on
  the cursor row, the engine's own key while the band has focus; arrows
  after a click or ctrl+x tab. Long labels wrap on word boundaries; the
  region is exactly as tall as the tree, hook and board sharing one wrap,
  the chrome's height derived from the wrapped question rather than fixed.
  The cursor starts on the `recommended` row, else the first row not
  struck, else the first — Enter on arrival never picks a held topic. The
  board's listeners read module state, not their closure, and new rows
  reset the cursor by the same rule.
- **R8 — the mod lives at `skills/workflow-gates/`** (`.claude-plugin/
  plugin.json`, `hooks/hooks.json`, `hooks/register.ts`, `hooks/board.ts`,
  `hooks/layout.ts`, `tests/`, `tsconfig.json`, `README.md`). agntc copies
  every entry of `skills/` recursively (`copy-plugin-assets.ts`), so it
  lands at `.claude/skills/workflow-gates/` and loads as
  `workflow-gates@skills-dir`. Type declarations are fetched into the
  gitignored `types/` by `npm run mod:types`.
- **R9 — opt-in per project, the tmux-labels shape.** The project
  manifest's `defaults.gate_surface` boolean; absent means never asked.
  `engine boot` reports `gate_surface` (`on`/`off`/`prompt`) and
  `workflow-start` Step 0.4 asks once, straight after the session-labels
  question, through `render gate-surface-gate`, in plain words: the
  signpost says menus are where a decision is the person's, that Claude
  Mods can draw them as buttons, and how to turn it off
  (`gate_surface: false` in `./.workflows/manifest.json`); the question
  points at the menu on screen. A clean `yes` ends the session on one red
  line telling the person to exit and start Claude Code again — settings
  are read at startup, so the answering session can never draw the
  buttons; a failed record or a warning carries on as text.
  `engine gate-surface config <true|false>` records
  the choice, syncs `.claude/settings.json`
  `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` (`"1"` on true, the key removed
  on false, an emptied `env` block with it, every other key untouched;
  the settings read/write is `domain/settings.cjs`, shared with the
  session hooks), and commits the manifest confined — the settings file
  alongside only when the sync changed it. Every boot re-syncs the flag
  against a recorded choice; a never-asked project is left exactly as
  found, the flag being one any plugin in the project may want. The
  prose-test harness stamps `gate_surface: false` into every world beside
  `tmux_labels: false`.
- **R10 — auto gates arm nothing.** Under `auto`/`bounded` the engine
  emits a DISPLAY, never a MENU, so no payload and no board. Verified.
- **R11 — the prose-authored menus migrate in this programme.** Every
  reference still carrying a menu becomes an engine surface, wording
  preserved, stacked by skill family: `workflow-specification-entry` (the
  four `confirm-*.md` → `spec-confirm-gate`),
  `workflow-start/references/view-completed.md` (`completed-actions`),
  `workflow-discovery/references/show-dismissed.md` (`dismissed-topics`),
  `workflow-planning-entry/references/cross-cutting-context.md`
  (`cross-cutting-gate --file`, the session's relevance read validated
  against the derived set), `workflow-planning-process/references/
  output-formats.md` (`plan-format-gate --variant select --file` — the
  catalogue rides a payload the reference writes verbatim, so format
  names never enter engine code), `workflow-investigation-process/
  references/findings-signoff.md` (`findings-signoff-gate`),
  `workflow-scoping-process/references/complexity-check.md`
  (`complexity-gate --file`, `first-phase-gate --file`), and the two
  glyph-less menus the option-row grep found:
  `workflow-discovery/references/first-phase-routing.md` (adopts
  `first-phase-gate`) and `workflow-planning-entry/references/
  validate-phase.md` (`plan-context-gate`). Conversational stops (a
  question in prose) are not menus and stay. Both completeness greps —
  option rows and dot rules outside the engine's own reference and the
  walkthrough card — return nothing: every gate in the system is drawn by
  the surface.
- **R12 — tests.** The engine payload: `tests/scripts/test-engine-gate-
  payload.cjs` under `npm test` (the announce switch, exact payloads for
  a surface and a gateway menu, flags and markers, typed rows, display-only
  and auto responses, GATE directly above MENU, the question's three
  claims), and the pipeline simulation re-renders every surface announced
  and checks the GATE's keys against the MENU's rows. The mod: `claude
  plugin test skills/workflow-gates` through `npm run test:mod`, run by
  hand — the kit ships in the binary — 28 tests over announce, cut,
  pass-through, draw, survey yield, press → submit → clear, a failed
  submit, keys, pointer on wrapped rows, `turn.start`; `npm run
  typecheck:mod` against the fetched declarations.
- **R13 — non-goals.** A hook that stops the model when it does not stop
  (idea #48, the stall guard); the mod owning the gate loop (the model is
  the loop, gates are its stops); DISPLAY sections as data; the engine as
  a registered tool (idea #50). The position line (#47) and compaction
  recovery (#49) ride this plugin later.
- **R14 — removable by construction.** The collector is referenced by
  nothing else; the mod is one directory; the opt-in is one boolean, one
  verb and one env line. Delete the three and the text menus are exactly
  what they were.

## The stack

- **PR0** — this document, on its own branch, merged last.
- **Migration stack** (#1278) — R11, five layers, independent of the rest
  and landed first: #1276 → #1277 → #1282 → #1286 → #1287.
- **Gate-surface stack** (#1291) — #1289 the engine payload, #1290 the
  mod, #1292 the opt-in with the Step 0 question, the settings sync, the
  harness stamp, `docs/` and the README.
- **Close** — the spike's assets deleted from beside this file; owed prose
  walks listed, never run unasked.

## Findings log — API facts a first reading missed

1. Sections are `=== MENU (…) ===` (gateway, unnamed) and `=== MENU: name
   (…) ===` (surfaces, named).
2. The `tool.call` event is the input flattened: `e.command`, not
   `e.input.command`.
3. `text` is core's; return `{ result }` to change what the model reads,
   and Bash has an output schema the answer is validated against.
4. Awaiting a Button press inside `tool.call` burns the budget (a press is
   not a `$` call); a `$` call's wait does not.
5. A Pane has no `id` prop; the instance is `e.requestId`.
6. A plugin-opened pane waits undrawn below 144 columns — hence the band.
7. `$.ui.notice` is `(tool_use_id, text)`; the transient line is
   `$.ui.toast`.
8. Setting state without `$.ui.invalidate("ui.render")` redraws nothing.
9. `hover` on a Button outside a keyed Box: tree refused, engine drew its
   own.
10. Region height clamped to `maxRows` kills pointer hit-testing past the
    edge; over-allocation shows dead space. Hook and board must share the
    wrap, and the chrome's height must follow a question that wraps.
11. Hot reload resets module state but does not re-run `session.start`.
12. Hand-drawn frames drift by a column per style; `adaptive-display.md`'s
    thesis applies in the band too.
13. Parsing the menu's markdown for options was brittle by construction;
    the engine states the gate as data.
14. Option sets composed at module load record nothing: `cmdOption` ran
    once at `require` time, so four surfaces rendered a GATE with no rows
    over a menu full of them. Every option set is composed per render.
15. A surface that hand-rolls its `=== MENU` marker instead of calling
    `section()` can never carry a payload (`revisit-phases` did).
16. `$.ui.message` is not a call on `$`: a `Client`'s post is the board's
    alone, so a test drives it with `ui.post(data, { in })`.
17. `$.ui.resolve(e)` is declared synchronous; awaiting it is harmless
    and what the shipped `diff` mod does.
18. `mock.env` answers `$.env.get` only; `$.env.set` needs its own test
    hook, and registering one op twice is a load error.
19. A `prompt.submit` that fails is reachable in the kit by having the
    test's bottom hook throw; `{ drop }` is a resolution, not a rejection.
20. `claude plugin test` refuses without `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`;
    the npm script sets it for itself.

## Log

- 2026-09-17 — sandbox copied from fumi, mod built through findings 1–9,
  engine `GATE` payload added.
- 2026-09-22 — colour by theme key; distribution proven (skills-dir load,
  settings-env flag); announced-payload variant prototyped. Rulings
  R1–R14 settled with Lee; programme opened. Built the same day: the
  migration stack (nine surfaces, both completeness greps empty), the
  engine payload (findings 14–15 found by the simulation's audit), the mod
  (findings 16–20 against the 2.1.280 declarations), the opt-in. Spike
  assets deleted at the close.
- 2026-09-23 — first live run in a remote-free copy of fumi: the mod
  loaded from the project's skills directory on the settings flag alone.
  The run moved R6 (draw at the turn's end; the press enters as the
  person's own), R7 (the cursor starts on the recommended row), R5 (a
  subagent's call passes through) and R9 (plain-words opt-in, a clean
  yes ends the session on a restart line).
