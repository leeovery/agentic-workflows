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

/** A view or page, by its kind; each kind's fields are its drawing's to read. */
export type View = { kind: string } & Record<string, unknown>

/** The board as the engine answers it, its `ok` dropped. */
export type Board = {
  version: number
  place: Place
  banner: Banner | null
  unit: { unit: string; title: string } | null
  tab: Tab
  view: View
  questions: unknown[]
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

/** Whether a known version's answer holds what the frame draws from. */
const isBoard = (value: Record<string, unknown>): boolean =>
  isObject(value.place) &&
  (value.banner === null || isObject(value.banner)) &&
  (value.unit === null || isObject(value.unit)) &&
  isObject(value.view) &&
  typeof value.view.kind === 'string'

/** What the engine's stdout gives the board (the type's). */
export function answerIn(stdout: string): Answer {
  let read: unknown

  try {
    read = JSON.parse(stdout)
  } catch {
    return null
  }

  if (!isObject(read) || read.ok !== true) {
    return null
  }

  const { ok: _ok, ...board } = read

  if (board.version !== BOARD_VERSION) {
    return { kind: 'refused', version: board.version }
  }

  return isBoard(board) ? { kind: 'board', board: board as Board } : null
}
