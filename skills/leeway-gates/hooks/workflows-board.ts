/**
 * The workflows board (§20): a pane titled "workflows" beside the
 * conversation, and a banner on the band's last line, directly above the
 * prompt, that names the work and shows or hides the pane — in a session
 * that announced, in a conversation the engine has marked, with no screen
 * but the band's attached; anywhere else nothing draws.
 *
 * Both draw the board's model as `engine board` answers it for where the
 * person is on the pane, read afresh after every engine call, the
 * conversation's or a subagent's, on every press that moves the pane, and
 * once for each conversation the board draws in — the session's first, a
 * /clear's or a resume's. One call reads it; a refresh asked while one runs
 * is answered by one more call after it. Never on a clock: while the pane is
 * up, what runs turns a quarter every 250 ms and a clock ticks each second,
 * from the model already read; while it is hidden, nothing turns.
 *
 * The board only shows: nothing it does reaches the conversation, which
 * gets every summary and question whether the board is open or not.
 */
import type { EngineInterface, On, Timer } from 'claude-code'

import { TOGGLE, drawBanner } from './banner.ts'
import { kitOf } from './draw.ts'
import { ENGINE, ENGINE_TIMEOUT_MS, MARKER, folderOf } from './folder.ts'
import { readingOf, type Answer, type Board, type Reading } from './model.ts'
import { HOME, PANE, SIZE, TITLE, argsOf, drawPane, framed, pressed, readOn, widthIn, type Nav } from './pane.ts'
import { isAnnounced, isBandAlone } from './surface.ts'
import { VIEWS } from './views/index.ts'

/** How often what runs turns a quarter, and how often a clock ticks. */
const TURN_MS = 250
const TICK_MS = 1000

/** Any engine call, as a Bash command names it. */
const ENGINE_CALL = /\.claude\/skills\/leeway-engine\/scripts\/engine\.cjs/

/**
 * The board as this session holds it: what the engine last answered, for
 * which conversation; where the person is on the pane; whether the pane is
 * up; the spinner's frame and the clocks running it; and the read under
 * way, owed one more where a refresh was asked meanwhile.
 */
type State = {
  read: { id: string; answer: Answer } | null
  nav: Nav
  isOpen: boolean
  frame: number
  turning: Timer | null
  ticking: Timer | null
  reading: Promise<void> | null
  isStale: boolean
}

/** Whether the board draws: in a session that announced, the band's screen the only one attached. */
async function isDrawn($: EngineInterface): Promise<boolean> {
  return (await isAnnounced($)) && (await isBandAlone($))
}

/** Whether the engine has marked the conversation `id` as one that runs the workflows. */
async function isWorkflow($: EngineInterface, id: string): Promise<boolean> {
  const folder = folderOf(await $.env.get('LEEWAY_CONFIG_DIR'), await $.env.get('HOME'), id)

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`))
}

/** The engine's reading for the conversation `id`, `nav` asked: a run that rejects timed out or never started. */
async function readNow($: EngineInterface, id: string, nav: Nav): Promise<Reading> {
  try {
    const root = await $.session.root()

    return readingOf(
      await $.process.run(['node', `${root}/${ENGINE}`, 'board', id, ...argsOf(nav)], {
        cwd: root,
        timeoutMs: ENGINE_TIMEOUT_MS,
      }),
    )
  } catch {
    return readingOf(null)
  }
}

/** What the board shows for the conversation `id` from `nav` (`readOn`'s); nothing where it does not run the workflows. */
async function readFor($: EngineInterface, id: string, nav: Nav): Promise<{ nav: Nav; answer: Answer }> {
  const isMarked = await isWorkflow($, id).catch(() => false)

  return isMarked ? readOn(nav, at => readNow($, id, at)) : { nav, answer: null }
}

/** Reads the board afresh (the header's), redrawing where what it draws changed. */
function refresh($: EngineInterface, state: State): Promise<void> {
  if (state.reading !== null) {
    state.isStale = true

    return state.reading
  }

  state.reading = (async () => {
    do {
      state.isStale = false

      const id = await $.session.id()
      const asked = state.nav
      const { nav, answer } = await readFor($, id, asked)
      const drawn = state.read?.id === id ? state.read.answer : null
      const isChanged = JSON.stringify(answer) !== JSON.stringify(drawn)

      state.read = { id, answer }

      if (state.nav === asked) {
        state.nav = nav
      }

      if (isChanged) {
        $.ui.invalidate('ui.render')
      }
    } while (state.isStale)
  })()
    .catch(() => undefined)
    .finally(() => {
      state.reading = null
    })

  return state.reading
}

/**
 * The answer for the conversation drawn now. One not yet read — the
 * session's first, or a /clear's or a resume's — is read once, nothing
 * drawn meanwhile; the pages open stay, as the session moving beneath them.
 */
async function answerFor($: EngineInterface, state: State): Promise<Answer> {
  const id = await $.session.id()

  if (state.read?.id === id) {
    return state.read.answer
  }

  if (state.reading === null) {
    void refresh($, state)
  }

  return null
}

/** The board the engine last answered, where it answered one. */
const boardIn = (state: State): Board | null => (state.read?.answer?.kind === 'board' ? state.read.answer.board : null)

/**
 * The clocks the pane's last drawing wants: turning while it holds what
 * runs, ticking while it holds a clock. A hidden pane is drawn no more, so
 * hiding it stops both.
 */
function clocks($: EngineInterface, state: State, holds: { turns: boolean; clocks: boolean }) {
  if (!holds.turns) {
    state.turning?.cancel()
    state.turning = null
  } else if (state.turning === null) {
    state.turning = $.clock.every(TURN_MS, () => {
      state.frame += 1
      $.ui.invalidate('ui.render')
    })
  }

  if (!holds.clocks) {
    state.ticking?.cancel()
    state.ticking = null
  } else if (state.ticking === null) {
    state.ticking = $.clock.every(TICK_MS, () => {
      $.ui.invalidate('ui.render')
    })
  }
}

/** The pane hidden: nothing turns, and the banner's button says it can be shown. */
function hidden($: EngineInterface, state: State) {
  state.isOpen = false
  clocks($, state, { turns: false, clocks: false })
  $.ui.invalidate('ui.render')
}

/** Shows the pane where it is hidden and hides it where it is up, its close hidden as every close is. */
async function toggle($: EngineInterface, state: State) {
  if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
    await $.ui.close({ id: PANE })

    return
  }

  await $.ui.open({ id: PANE, title: TITLE, ...SIZE })
  state.isOpen = true
  $.ui.invalidate('ui.render')
}

/** Takes the person where a press on the pane goes: a new place is read afresh, a fold only redrawn. */
async function move($: EngineInterface, state: State, moved: Nav) {
  const isElsewhere = JSON.stringify(argsOf(moved)) !== JSON.stringify(argsOf(state.nav))

  state.nav = moved

  if (isElsewhere) {
    await refresh($, state)
  } else {
    $.ui.invalidate('ui.render')
  }
}

export function workflowsBoard(on: On) {
  const state: State = {
    read: null,
    nav: HOME,
    isOpen: false,
    frame: 0,
    turning: null,
    ticking: null,
    reading: null,
    isStale: false,
  }

  // Read afresh after every engine call, never holding up its result.
  on('tool.call', { tool: 'Bash', command: ENGINE_CALL }, async ($, e, next) => {
    const result = await next(e)

    if (await isAnnounced($)) {
      $.clock.after(0, () => {
        void refresh($, state)
      })
    }

    return result
  }).catch(($, e, next) => next(e))

  // The banner's button shows or hides the pane inside the press, so the
  // pane is placed at any width.
  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name) {
      return next(e)
    }

    if (e.element === TOGGLE) {
      await toggle($, state)
    } else {
      const moved = pressed(state.nav, e.element, boardIn(state), VIEWS)

      if (moved !== null) {
        await move($, state, moved)
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Every close comes through here: the banner's button, and the person's own.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    hidden($, state)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A pane drawn is up, a reload's among them, which finds it still open.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (!(await isDrawn($))) {
      clocks($, state, { turns: false, clocks: false })

      return next(e)
    }

    state.isOpen = true

    const answer = await answerFor($, state)
    const { kit, holds } = kitOf(widthIn(e.props.bodyColumns), await $.clock.now(), state.frame, state.nav.opened)
    const drawn = framed(answer, state.nav, VIEWS, kit)

    clocks($, state, holds)

    return drawPane(await $.ui.resolve(e), drawn)
  }).catch(($, e, next) => next(e))

  // The banner takes the band's last line, beneath whatever the band draws,
  // the gate's rows drawn in the rows it leaves; a survey holds the band alone.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await isDrawn($))) {
      return next(e)
    }

    const answer = await answerFor($, state)
    const banner = answer?.kind === 'board' ? answer.board.banner : null

    if (banner === null) {
      return next(e)
    }

    const beneath = await next({ ...e, props: { ...e.props, maxRows: e.props.maxRows - 1 } })
    const els = await $.ui.resolve(e)

    return els.Box({ flexDirection: 'column', children: [beneath, drawBanner(els, { banner, isOpen: state.isOpen }, e.props.bodyColumns)] })
  }).catch(($, e, next) => next(e))
}
