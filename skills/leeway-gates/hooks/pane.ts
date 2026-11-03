/**
 * The workflows board's pane: its three tabs, This session following the
 * session, and the pages the person opens over them.
 *
 * What the pane shows is where the person has gone on it (`Nav`): the tab,
 * the unit the unit's tab was opened on, the pages opened over the tab, and
 * the folding sections they opened. The engine answers each with the board's
 * model for that place, so This session, with no page open, is whatever the
 * session's position puts it at, and a page stays — asked for by its ref and
 * the unit it was opened in at every refresh — until the person presses
 * back, however the session moves beneath it. A page whose target has gone
 * says why and stays; where the engine refuses what the pane asks — a ref
 * it cannot read, a unit gone from the project — the pane unwinds a level
 * at a time to This session's top, which asks nothing of the pane's; a read
 * that timed out moves nothing. The way back names what it returns to: the
 * page under it, else what the tab shows beneath it now.
 *
 * The views are drawn by their kind (`views/`), and one the engine cannot
 * draw by its reason; a model this board does not know the version of is
 * refused in a line, never drawn.
 */
import type { ElementTable, RenderElement } from 'claude-code'

import { COLOUR, blank, cutTo, drawLine, foldKey, widthOf, type Button, type Kit, type Line, type Part } from './draw.ts'
import { BOARD_VERSION, isUnavailable, type Answer, type Board, type Reading, type Tab, type View } from './model.ts'
import type { Views } from './views/index.ts'

/** The pane's id, which its render and close name. */
export const PANE = 'board'

/** Its tab's title in Claude Code's tab row, beside sitrep's. */
export const TITLE = 'workflows'

/** The width and height it asks for. */
export const SIZE = { columns: 60, rows: 28 }

/**
 * A page opened over a tab: its ref; the unit it was opened in, a unit's own
 * page its unit; and the name of the page it was opened over, null over the
 * tab.
 */
export type Page = { ref: string; unit: string | null; over: string | null }

/** Where the person has gone on the pane (the header's). */
export type Nav = {
  tab: Tab
  unit: string | null
  pages: readonly Page[]
  opened: ReadonlySet<string>
}

/** This session, at its top. */
export const HOME: Nav = { tab: 'this', unit: null, pages: [], opened: new Set() }

/** The keys a press on the pane addresses. */
const TAB = 'tab:'
const PAGE = 'page:'
const FOLD = foldKey('')
export const BACK = 'back'

/** The key of a tab's button, and of a page's opener. */
export const tabKey = (tab: Tab) => `${TAB}${tab}`
export const pageKey = (ref: string) => `${PAGE}${ref}`

/** What `engine board` is asked beyond the session's id, for where the person is. */
export function argsOf({ tab, unit, pages }: Nav): string[] {
  const page = pages.at(-1)

  return [
    ...(tab === 'this' ? [] : ['--tab', tab]),
    ...(tab === 'unit' && unit !== null ? ['--unit', unit] : []),
    ...(page === undefined ? [] : ['--page', page.ref, ...(page.unit === null ? [] : ['--page-unit', page.unit])]),
  ]
}

/** A unit's own page, opened from All work, by the unit its ref names. */
const UNIT_PAGE = /^unit:([^:]+)$/

/**
 * Where the pane stands once a read of `asked` unwound it: the unwound
 * place, the person's folds kept, where they have gone nowhere else
 * meanwhile; else where they have gone.
 */
export function settled(current: Nav, asked: Nav, unwound: Nav): Nav {
  return JSON.stringify(argsOf(current)) === JSON.stringify(argsOf(asked)) ? { ...unwound, opened: current.opened } : current
}

/** The engine read for where the person is on the pane. */
export type Read = (nav: Nav) => Promise<Reading>

/** One level back towards This session: the page on top, else the tab; none from This session's top. */
function unwound(nav: Nav): Nav | null {
  if (nav.pages.length > 0) {
    return { ...nav, pages: nav.pages.slice(0, -1) }
  }

  return nav.tab === 'this' ? null : { ...nav, tab: 'this', unit: null }
}

/**
 * The engine's answer for where the person is, and where that is: a place
 * the engine refuses unwound a level and read again, until This session's
 * top; one whose read timed out or never started kept.
 */
export async function readOn(nav: Nav, read: Read): Promise<{ nav: Nav; answer: Answer }> {
  const { answer, isRefused } = await read(nav)
  const back = isRefused ? unwound(nav) : null

  return back === null ? { nav, answer } : readOn(back, read)
}

/** The name a view gives a way back to it, where its kind has a drawing. */
const nameOf = (view: View, views: Views): string | undefined => views[view.kind]?.name(view)

/** A tab opened at its top, the unit's on the unit its tab names now. */
function tabbed(nav: Nav, tab: string, board: Board | null): Nav | null {
  if (tab === 'this' || tab === 'all') {
    return { ...nav, tab, unit: null, pages: [] }
  }

  const unit = board?.unit?.unit

  return tab === 'unit' && unit !== undefined ? { ...nav, tab, unit, pages: [] } : null
}

/**
 * Where a press on `key` takes the person, from the board shown; null for a
 * key that is not the pane's to answer.
 */
export function pressed(nav: Nav, key: string, board: Board | null, views: Views): Nav | null {
  if (key.startsWith(TAB)) {
    return tabbed(nav, key.slice(TAB.length), board)
  }

  if (key.startsWith(PAGE) && board !== null) {
    const { view } = board
    const ref = key.slice(PAGE.length)
    const unit = UNIT_PAGE.exec(ref)?.[1] ?? (typeof view.unit === 'string' ? view.unit : null)
    const over = nav.pages.length === 0 ? null : (nameOf(view, views) ?? '')

    return { ...nav, pages: [...nav.pages, { ref, unit, over }] }
  }

  if (key === BACK) {
    return { ...nav, pages: nav.pages.slice(0, -1) }
  }

  if (key.startsWith(FOLD)) {
    const opened = new Set(nav.opened)
    const section = key.slice(FOLD.length)

    if (!opened.delete(section)) {
      opened.add(section)
    }

    return { ...nav, opened }
  }

  return null
}

/** A tab's button, and whether it is the tab shown. */
export type TabButton = Button & { isActive: boolean }

/** What the pane draws: its tabs, where it has a board to draw, and its lines beneath them. */
export type Framed = { tabs: TabButton[] | null; lines: Line[] }

const THIS_SESSION = '⌂ This session'
const ALL_WORK = '≡ All work'
const TAB_GAP = '   '

/** The tabs: This session, the unit's where there is one, All work; the unit's name cut to fit. */
function tabsOf(board: Board, width: number): TabButton[] {
  const room = width - widthOf([{ text: THIS_SESSION + ALL_WORK + TAB_GAP.repeat(2) }])
  const unit: TabButton[] =
    board.unit === null
      ? []
      : [{ key: tabKey('unit'), label: cutTo([{ text: `≡ ${board.unit.title}` }], room)[0]?.text ?? '', isActive: board.tab === 'unit' }]

  return [
    { key: tabKey('this'), label: THIS_SESSION, isActive: board.tab === 'this' },
    ...unit,
    { key: tabKey('all'), label: ALL_WORK, isActive: board.tab === 'all' },
  ]
}

/** The rule beneath the tabs, heavy and lavender under the tab shown. */
function ruleOf(tabs: readonly TabButton[], width: number): Line {
  const parts: Part[] = tabs.flatMap((tab, at) => [
    ...(at === 0 ? [] : [{ text: '─'.repeat(TAB_GAP.length), color: COLOUR.rule }]),
    tab.isActive
      ? { text: '━'.repeat([...tab.label].length), color: COLOUR.thisView }
      : { text: '─'.repeat([...tab.label].length), color: COLOUR.rule },
  ])

  return { key: 'tabs:rule', parts: [...parts, { text: '─'.repeat(Math.max(0, width - widthOf(parts))), color: COLOUR.rule }] }
}

/** The way back from the page on top, naming what it returns to: the page under it, else what the tab shows beneath it. */
function backOf(page: Page, beneath: View | null, views: Views): Line[] {
  const name = page.over ?? (beneath === null ? undefined : nameOf(beneath, views)) ?? ''

  return [{ key: BACK, parts: [], button: { key: BACK, label: name === '' ? '← back' : `← back to ${name}` } }, blank(BACK)]
}

/** The line refusing a version this board does not draw. */
const refusal = (version: unknown): Line => ({
  key: 'refused',
  wraps: true,
  parts: [
    {
      text: `This board draws version ${BOARD_VERSION} of the engine's board, and the engine answers version ${String(version)}: nothing is drawn until they match.`,
      color: COLOUR.body,
    },
  ],
})

/** Why the engine cannot draw what the person is on, for them to see before they press back. */
const reasonOf = (reason: string): Line => ({ key: 'unavailable', wraps: true, parts: [{ text: reason, color: COLOUR.secondary }] })

/** The lines a view draws: its drawing's, by its kind, or why it cannot be drawn. */
const linesOf = (view: View, views: Views, kit: Kit): Line[] =>
  isUnavailable(view) ? [reasonOf(view.reason)] : (views[view.kind]?.lines(view, kit) ?? [])

/**
 * What the pane draws for the engine's answer: the tabs and their rule,
 * then the way back from a page, then the view, or why it cannot be drawn;
 * a version refused, its line alone; with nothing answered, only the way
 * back from a page.
 */
export function framed(answer: Answer, nav: Nav, views: Views, kit: Kit): Framed {
  const page = nav.pages.at(-1)
  const beneath = answer?.kind === 'board' ? answer.board.beneath : null
  const back = page === undefined ? [] : backOf(page, beneath, views)

  if (answer === null) {
    return { tabs: null, lines: back }
  }

  if (answer.kind === 'refused') {
    return { tabs: null, lines: [refusal(answer.version)] }
  }

  const { board } = answer
  const tabs = tabsOf(board, kit.width)

  return {
    tabs,
    lines: [ruleOf(tabs, kit.width), blank('tabs'), ...back, ...linesOf(board.view, views, kit)],
  }
}

/** The width the pane's lines take inside its padding. */
export const widthIn = (bodyColumns: number) => Math.max(30, bodyColumns - 2)

/** The tabs as buttons, the one shown lavender. */
const drawTabs = (els: ElementTable, tabs: readonly TabButton[]) =>
  els.Box({
    key: 'tabs',
    children: tabs.flatMap((tab, at) => [
      ...(at === 0 ? [] : [els.Text({ children: [TAB_GAP] })]),
      els.Button({
        key: tab.key,
        plain: true,
        onPress: () => undefined,
        children: [els.Text({ bold: tab.isActive, color: tab.isActive ? COLOUR.thisView : COLOUR.secondary, children: [tab.label] })],
      }),
    ]),
  })

/** The pane as drawn. */
export const drawPane = (els: ElementTable, { tabs, lines }: Framed): RenderElement =>
  els.Box({
    flexDirection: 'column',
    paddingX: 1,
    children: [...(tabs === null ? [] : [drawTabs(els, tabs)]), ...lines.map(line => drawLine(els, line))],
  })
