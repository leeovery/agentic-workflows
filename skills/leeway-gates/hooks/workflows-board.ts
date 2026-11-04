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
 * The board shows, and never answers: the conversation gets every summary
 * and question whether the board is open or not. What it says to Claude is
 * the person's readiness to discuss the questions waiting, and their skip or
 * cancel of the discussion, a line each (`discuss.ts`); nothing else it does
 * reaches the conversation or the prompt box.
 */
import type { EngineInterface, On, Timer } from 'claude-code'

import { TOGGLE, drawBanner } from './banner.ts'
import {
  DISCUSSING,
  QUIET,
  discussedBanner,
  discussionIn,
  keptOf,
  live,
  pressedOn,
  readyLines,
  recorded,
  recordedIn,
  waitingLines,
  type Discussion,
} from './discuss.ts'
import { kitOf } from './draw.ts'
import { ENGINE, ENGINE_TIMEOUT_MS, MARKER, folderOf } from './folder.ts'
import { readingOf, type Answer, type Board, type Question, type Reading } from './model.ts'
import {
  HOME,
  PANE,
  SIZE,
  TITLE,
  argsOf,
  drawPane,
  framed,
  isPinned,
  lastOffset,
  pressed,
  readOn,
  settled,
  widthIn,
  type Nav,
} from './pane.ts'
import { isAnnounced, isBandAlone } from './surface.ts'
import { VIEWS } from './views/index.ts'

/** How often what runs turns a quarter, and how often a clock ticks. */
const TURN_MS = 250
const TICK_MS = 1000

/** Any engine call, as a Bash command names it. */
const ENGINE_CALL = /\.claude\/skills\/leeway-engine\/scripts\/engine\.cjs/

/** The engine calls that record what became of a question waiting, answering with its receipt. */
const RECORDS = /\.claude\/skills\/leeway-engine\/scripts\/engine\.cjs"?\s+raise\s+(?:answer|aside)\b/

/**
 * The board as this session holds it: what the engine last answered, for
 * which conversation; where the person is on the pane; whether the pane is
 * up; the spinner's frame and the clocks running it; the read under way,
 * owed one more where a refresh was asked meanwhile; the discussion, for
 * which conversation, and whether a line of it is being sent; and, while
 * the pane holds READY TO DISCUSS docked, how far what is above it is
 * scrolled, and the furthest it can be, else null.
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
  talk: { id: string; discussion: Discussion } | null
  isSpeaking: boolean
  offset: number
  pinned: number | null
}

/** Whether the board draws: in a session that announced, the band's screen the only one attached. */
async function isDrawn($: EngineInterface): Promise<boolean> {
  return (await isAnnounced($)) && (await isBandAlone($))
}

/** The folder of the conversation `id`, where the engine has marked it as one that runs the workflows; else null. */
async function markedFolder($: EngineInterface, id: string): Promise<string | null> {
  const folder = folderOf(await $.env.get('LEEWAY_CONFIG_DIR'), await $.env.get('HOME'), id)

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`)) ? folder : null
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
  const isMarked = (await markedFolder($, id).catch(() => null)) !== null

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

      state.nav = settled(state.nav, asked, nav)

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

/** The questions waiting the engine last answered: none where it answered no board. */
const questionsIn = (state: State): Question[] => boardIn(state)?.questions ?? []

/**
 * The discussion of the conversation `id`: as this session holds it, else
 * as its folder keeps it, read once for each conversation — the session's
 * first, a /clear's, a resume's — and none where nothing is kept.
 */
async function discussionFor($: EngineInterface, state: State, id: string): Promise<Discussion> {
  if (state.talk?.id !== id) {
    const folder = await markedFolder($, id).catch(() => null)
    const file = folder === null ? null : `${folder}/${DISCUSSING}`
    const isKept = file !== null && (await $.fs.exists(file).catch(() => false))
    const text = isKept ? await $.fs.read(file).catch(() => null) : null

    state.talk = { id, discussion: discussionIn(text) }
  }

  return state.talk.discussion
}

/** The discussion as it stands against the questions waiting, for the conversation drawn now. */
async function discussionNow($: EngineInterface, state: State): Promise<Discussion> {
  return live(await discussionFor($, state, await $.session.id()), questionsIn(state))
}

/**
 * Holds `discussion` for the conversation `id`, kept in its folder where
 * what Claude reads of it changed, and redraws.
 */
async function keep($: EngineInterface, state: State, id: string, discussion: Discussion) {
  const before = state.talk?.id === id ? state.talk.discussion : QUIET

  state.talk = { id, discussion }
  $.ui.invalidate('ui.render')

  if (keptOf(before) !== keptOf(discussion)) {
    const folder = await markedFolder($, id)

    if (folder !== null) {
      await $.fs.write(`${folder}/${DISCUSSING}`, keptOf(discussion))
    }
  }
}

/**
 * Sends a press's one line to Claude, the discussion it leads to kept
 * already; a line dropped or failed puts back the discussion as it was
 * `before`.
 */
async function speak($: EngineInterface, state: State, id: string, line: string, before: Discussion) {
  try {
    const { drop } = await $.prompt.submit({ text: line })

    if (drop !== undefined) {
      await keep($, state, id, before)
    }
  } catch {
    await keep($, state, id, before).catch(() => undefined)
  } finally {
    state.isSpeaking = false
  }
}

/**
 * Does what a press on `key` does to the discussion, saying its one line to
 * Claude where it says one — never while another is being sent. The line
 * goes after the press, which a send Claude Code takes its time over never
 * holds up; false for a key that is not the discussion's.
 */
async function discussOn($: EngineInterface, state: State, key: string): Promise<boolean> {
  const id = await $.session.id()
  const questions = questionsIn(state)
  const before = live(await discussionFor($, state, id), questions)
  const press = pressedOn(key, before, questions)

  if (press === null) {
    return false
  }

  if (press.line === null) {
    await keep($, state, id, press.discussion)

    return true
  }

  if (state.isSpeaking) {
    return true
  }

  state.isSpeaking = true

  try {
    await keep($, state, id, press.discussion)
  } catch {
    state.isSpeaking = false
    state.talk = { id, discussion: before }
    $.ui.invalidate('ui.render')

    return true
  }

  void speak($, state, id, press.line, before)

  return true
}

/** Takes the questions Claude recorded out of the conversation's discussion. */
async function recordedBy($: EngineInterface, state: State, names: readonly string[]) {
  const id = await $.session.id()

  await keep($, state, id, recorded(await discussionFor($, state, id), names))
}

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
    talk: null,
    isSpeaking: false,
    offset: 0,
    pinned: null,
  }

  // Read afresh after every engine call, never holding up its result; a
  // question the conversation recorded answered or set aside leaves its
  // discussion.
  on('tool.call', { tool: 'Bash', command: ENGINE_CALL }, async ($, e, next) => {
    const result = await next(e)

    if (await isAnnounced($)) {
      const names = e.agentId === undefined && RECORDS.test(e.command) && result.isError !== true ? recordedIn(result.result?.stdout ?? '') : []

      $.clock.after(0, () => {
        if (names.length > 0) {
          void recordedBy($, state, names).catch(() => undefined)
        }

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
    } else if (!(await discussOn($, state, e.element))) {
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
    const questions = questionsIn(state)
    const discussion = await discussionNow($, state)
    const now = await $.clock.now()
    const width = widthIn(e.props.bodyColumns)
    const { kit, holds } = kitOf(width, now, state.frame, state.nav.opened, () => waitingLines(questions, discussion, width, now))
    const drawn = framed(answer, state.nav, VIEWS, kit)
    const foot = { lines: readyLines(questions, discussion, width), placement: e.props.placement, bodyRows: e.props.scroll.bodyRows, offset: 0 }

    clocks($, state, holds)
    state.pinned = isPinned(foot) ? lastOffset(drawn, foot, width) : null
    state.offset = Math.min(state.offset, state.pinned ?? 0)

    return drawPane(await $.ui.resolve(e), drawn, { ...foot, offset: state.offset })
  }).catch(($, e, next) => next(e))

  // Docked with READY TO DISCUSS at its foot, the pane scrolls what is above
  // the box itself, the box staying put; else Claude Code scrolls the board.
  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (state.pinned === null) {
      return next(e)
    }

    state.offset = Math.max(0, Math.min(state.pinned, state.offset + e.by))
    $.ui.invalidate('ui.render')

    return {}
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

    const discussed = discussedBanner(banner, await discussionNow($, state), questionsIn(state))
    const beneath = await next({ ...e, props: { ...e.props, maxRows: e.props.maxRows - 1 } })
    const els = await $.ui.resolve(e)

    return els.Box({ flexDirection: 'column', children: [beneath, drawBanner(els, { ...discussed, isOpen: state.isOpen }, e.props.bodyColumns)] })
  }).catch(($, e, next) => next(e))
}
