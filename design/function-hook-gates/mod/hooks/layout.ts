/**
 * The gate's geometry and text shaping, shared by the hooks module and the
 * surface module so both agree on how many lines the menu occupies. The hook
 * sizes the Client region with it; the board draws with it. Any drift between
 * the two shows up as dead space under the frame, or as rows the pointer
 * cannot reach.
 */

export type Option = { key: string; word: string | null; label: string }
export type Typed = { label: string; description: string }

export type Run = { text: string; italic?: boolean; strikethrough?: boolean; accent?: boolean }

/** Which option each drawn line belongs to; -1 for the typed row. */
let rowsOfOption: number[] = []


/**
 * A label in two parts: what the option is, and its metadata tail.
 *
 * The engine marks emphasis where it falls in the sentence — `*discussion*` in
 * the middle of "Continue X — *discussion* · triage waiting" — which renders as
 * grey between two whites. Read as a menu that is noise: an option has a name
 * and, after the em dash, detail about it. So the split is on the dash, the head
 * takes one style and the tail takes one style, and no row alternates.
 *
 * A row the engine struck through (already in session) keeps that on its head.
 */
export function labelRuns(label: string): Run[] {
  const struck = label.includes("~~")
  const bare = label.replace(/\*\*?|`|~~/g, "")
  const at = bare.indexOf(" — ")
  if (at < 0) return [{ text: bare, strikethrough: struck }]
  return [
    { text: bare.slice(0, at), strikethrough: struck },
    { text: bare.slice(at), italic: true },
  ]
}

export const widthOf = (runs: Run[]) => runs.reduce((n, r) => n + r.text.length, 0)

/** Pad a line of runs to exactly `width` cells. */
export function pad(runs: Run[], width: number): Run[] {
  const total = widthOf(runs)
  return total >= width ? runs : [...runs, { text: " ".repeat(width - total) }]
}

/**
 * Greedy word wrap that keeps each run's styling: a label too long for the
 * column breaks onto the next line rather than being cut off, so nothing the
 * engine wrote is lost to a `…`.
 */
export function wrapRuns(runs: Run[], width: number): Run[][] {
  const lines: Run[][] = []
  let line: Run[] = []
  let used = 0
  const push = () => {
    lines.push(line)
    line = []
    used = 0
  }
  for (const run of runs) {
    for (let word of run.text.split(/(\s+)/)) {
      if (word === "") continue
      const blank = word.trim() === ""
      if (blank && used === 0) continue
      while (word.length > width) {
        // A single word longer than the column: break it rather than overflow.
        if (used > 0) push()
        line.push({ ...run, text: word.slice(0, width) })
        word = word.slice(width)
        push()
      }
      if (used + word.length > width) {
        if (blank) continue
        push()
      }
      line.push({ ...run, text: word })
      used += word.length
    }
  }
  if (line.length > 0 || lines.length === 0) push()
  return lines
}


/** What the person sees: one name per option, never `key/word` — they press it. */
export const shownKey = (o: Option) => o.word ?? o.key
/** What the answer submits as, which the engine's prose branches on. */
export const answerOf = (o: Option) => o.word ?? o.key

/**
 * Which way the gate draws. The hook sizes the region from the same maths the
 * board draws with, so this lives here and not in either of them.
 *
 *  table  — framed, key column, inner divider, question on its own row
 *  bar    — no frame: a dotted rule, the question, and an accent gutter
 *  titled — framed, question in the top border, no divider
 */
export type Style = "table" | "bar" | "titled"
export const STYLE: Style = "table"

/** The key column's width, and the description column's, for a given band. */
export function geometry(options: readonly Option[], typed: readonly Typed[], columns: number) {
  const keyWidth = Math.max(
    ...options.map((o) => shownKey(o).length),
    ...typed.map((t) => t.label.length),
    1,
  )
  if (STYLE === "bar") {
    // gutter(2) + key + gap(2) + label
    const left = keyWidth + 2
    return { inner: columns, left, right: Math.max(8, columns - left - 2) }
  }
  const inner = Math.max(24, columns - 2)
  if (STYLE === "titled") {
    // A row is │ + pad(2) + key + gap(2) + label + │, and must total the
    // border's `inner + 2`: the two frame glyphs sit outside `inner`, so the
    // label takes `inner - left`, not `inner - left - 2`.
    const left = keyWidth + 4
    return { inner, left, right: Math.max(8, inner - left) }
  }
  const left = keyWidth + 5
  return { inner, left, right: inner - left - 1 }
}

/** The rows a style spends on chrome: borders, question, divider. */
export function chromeRows(): number {
  return STYLE === "bar" ? 3 : STYLE === "titled" ? 2 : 4
}

/** Exactly how many lines the options and the typed row draw onto. */
export function lineCount(options: readonly Option[], typed: readonly Typed[], columns: number): number {
  const { right } = geometry(options, typed, columns)
  const wrapped = (text: string) => wrapRuns(labelRuns(text), right - 1).length
  return (
    options.reduce((n, o) => n + wrapped(o.label), 0) +
    typed.reduce((n, t) => n + wrapped(t.description), 0)
  )
}
