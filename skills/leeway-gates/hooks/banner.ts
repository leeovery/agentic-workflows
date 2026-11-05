/**
 * The workflows board's banner: one line in the band above the prompt,
 * naming the work and where it stands, with the button that shows or hides
 * the board at its right. Its mark is the session's state — ◐ running, ⚑
 * waiting on the person, ✓ done, none where neither — then the work's name
 * in bold and its facts in grey, each one that waits on the person in peach
 * behind a ⚑, and one that says what waits beside them — the messages
 * waiting in a topic, and at a unit's menu what waits on the person there —
 * in peach with no ⚑; at its right, the buttons the questions waiting give
 * it (`discuss.ts`), then the board's. A banner too long for the band is cut
 * from its right end, its buttons kept.
 */
import type { ElementTable, RenderElement } from 'claude-code'

import { COLOUR, MARK, RUNNING_FRAMES, buttonOf, textOf, type Button, type Part } from './draw.ts'
import type { Banner, Fact } from './model.ts'

/** The key of the banner's button that shows or hides the board. */
export const TOGGLE = 'board:toggle'

/** The banner's mark by the session's state; an idle session has none. */
const MARKS: Readonly<Record<Banner['state'], Part | null>> = {
  running: { text: `${RUNNING_FRAMES[0]} `, color: COLOUR.running },
  needs: { text: `${MARK.needs} `, color: COLOUR.needs },
  done: { text: `${MARK.done} `, color: COLOUR.done },
  idle: null,
}

const SEPARATOR: Part = { text: ' · ', color: COLOUR.secondary }

/** A fact as drawn: flagged in peach where it waits on the person, peach where it says what waits, else grey. */
function factPart({ text, needs, waits }: Fact): Part {
  if (needs) {
    return { text: `${MARK.needs} ${text}`, color: COLOUR.needs }
  }

  return { text, color: waits === true ? COLOUR.needs : COLOUR.secondary }
}

/** The banner's words: its mark, the work's name, and each fact after a separator. */
export function bannerParts({ state, name, facts }: Banner): Part[] {
  const mark = MARKS[state]

  return [
    ...(mark === null ? [] : [mark]),
    { text: name, bold: true },
    ...facts.flatMap(fact => [SEPARATOR, factPart(fact)]),
  ]
}

/** What the board's button reads: "▸ show board" while it is hidden, "hide board" while it is up. */
export const toggleLabel = (isOpen: boolean) => (isOpen ? 'hide board' : '▸ show board')

/** The banner to draw, the buttons before the board's, and whether the board is up. */
export type Shown = { banner: Banner; buttons: readonly Button[]; isOpen: boolean }

/** The banner as drawn, `width` cells across. */
export const drawBanner = (els: ElementTable, { banner, buttons, isOpen }: Shown, width: number): RenderElement =>
  els.Box({
    key: 'banner',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: 2,
    width,
    children: [
      els.Text({ wrap: 'truncate-end', children: bannerParts(banner).map(part => textOf(els, part)) }),
      ...buttons.map(button => buttonOf(els, button)),
      buttonOf(els, { key: TOGGLE, label: toggleLabel(isOpen) }),
    ],
  })
