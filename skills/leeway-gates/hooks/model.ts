/**
 * The workflows board's view model, as `engine board` answers it
 * (domain/board-model.cjs): the contract between the engine and the board.
 * The mod draws a version it knows and refuses any other rather than draw
 * it wrongly. The model carries kinds, states, counts, times and the
 * records' words; colours, marks, buttons and layout are the mod's.
 */

/** The view model's version this mod draws. */
export const BOARD_VERSION = 1

/** The board's tabs: This session, the unit's, All work. */
export type Tab = 'this' | 'unit' | 'all'

/** Where the session is: a unit, its type, the phase and topic it works in; all null at the start menu. */
export type Place = {
  unit: string | null
  type: string | null
  phase: string | null
  topic: string | null
}

/** A fact on the banner: its words, and whether it waits on the person. */
export type Fact = { text: string; needs: boolean }

/** The banner: running, waiting on the person, done, or neither; the work's name; its facts in order. */
export type Banner = {
  state: 'running' | 'needs' | 'done' | 'idle'
  name: string
  facts: Fact[]
}

/**
 * A question waiting on the person a press can queue (12.13, 20.5.3): its
 * number, what it asks, each task it parks with its title, the tasks
 * waiting after those, and when it parked; oldest first.
 */
export type Question = {
  question: string
  asks: string
  parks: { task: string; title: string }[]
  after: string[]
  since: string
}

/** A view or page, by its kind; each kind's fields are its drawing's to read. */
export type View = { kind: string } & Record<string, unknown>

/** A view or page the engine cannot draw, and why, the banner and the questions standing beside it. */
export type Unavailable = { kind: 'unavailable'; reason: string }

/** Whether a view is one the engine cannot draw. */
export const isUnavailable = (view: View): view is View & Unavailable => view.kind === 'unavailable'

/**
 * The board as the engine answers it, its `ok` dropped: under a page,
 * `beneath` is what the tab shows under it.
 */
export type Board = {
  version: number
  place: Place
  banner: Banner | null
  unit: { unit: string; title: string } | null
  tab: Tab
  view: View
  beneath: View | null
  questions: Question[]
  warnings: string[]
}

/**
 * What the engine's answer gives the board to draw: the board; a version
 * this mod does not know, refused; or nothing, where the engine refused or
 * answered what does not read as a board.
 */
export type Answer = { kind: 'board'; board: Board } | { kind: 'refused'; version: unknown } | null

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isView = (value: unknown): boolean => isObject(value) && typeof value.kind === 'string'

/** Whether a known version's answer holds what the frame draws from. */
const isBoard = (value: Record<string, unknown>): boolean =>
  isObject(value.place) &&
  (value.banner === null || isObject(value.banner)) &&
  (value.unit === null || isObject(value.unit)) &&
  isView(value.view) &&
  (value.beneath === null || isView(value.beneath)) &&
  Array.isArray(value.questions)

/** A JSON text's value; undefined for text that is not JSON. */
function parsed(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** What the engine's stdout gives the board (the type's). */
export function answerIn(stdout: string): Answer {
  const read = parsed(stdout)

  if (!isObject(read) || read.ok !== true) {
    return null
  }

  const { ok: _ok, ...board } = read

  if (board.version !== BOARD_VERSION) {
    return { kind: 'refused', version: board.version }
  }

  return isBoard(board) ? { kind: 'board', board: board as Board } : null
}

/**
 * One read of the board: what it answered, and whether the engine refused
 * it — the engine exited with its error, as it does for a page whose unit or
 * ref has gone. A read that timed out, its child killed, or that never
 * started is no refusal.
 */
export type Reading = { answer: Answer; isRefused: boolean }

/** The reading of an engine run that ended on its own; `null` for one that timed out or never started. */
export function readingOf(ran: { stdout: string; stderr: string } | null): Reading {
  if (ran === null) {
    return { answer: null, isRefused: false }
  }

  const error = parsed(ran.stderr)

  return { answer: answerIn(ran.stdout), isRefused: isObject(error) && error.ok === false }
}
