/**
 * The gate's surface module: its own keys and mouse, no `$`, answering by
 * posting to the hooks module.
 *
 * The frame is drawn by hand rather than with `borderStyle`, because a drawn
 * border cannot carry `┬`/`┴` junctions where the key column meets it — the
 * same reason Portal's panels draw their own dividers at full inner width.
 *
 * Labels arrive as the engine's markdown, and the transcript's colour comes
 * from rendering it: `*italic*` for a metadata tail, `~~strike~~` for a row
 * that is already in session, `` `code` `` for a name. Those become styled
 * runs here rather than being stripped, so the menu reads as the engine's.
 */
import type { ClientSurface } from "claude-code"
import { STYLE, answerOf, geometry, pad, labelRuns, shownKey, wrapRuns, type Option, type Run, type Typed } from "./layout.ts"

type Props = { question: string; options: Option[]; typed: Typed[] } | undefined
type State = { cursor: number }

/**
 * Which option each drawn line belongs to, -1 for the typed row. Module state
 * rather than surface state: the pointer handler is registered once, on the
 * first draw, and must read the current mapping every time it fires.
 */
let rowsOfOption: number[] = []

/**
 * Colours are theme keys, not values: the engine resolves them against the
 * person's theme, so the menu follows it instead of fighting it.
 *
 * Every colour is a theme key, so the menu resolves against the person's
 * theme — including the ANSI themes, where the palette is the terminal's own
 * ("permission" is "ansi:blue" there). A raw colour would ignore that, and a
 * light background would swallow anything picked for a dark one.
 *
 * Other keys the binary carries, if you want a different accent:
 *   permission · suggestion — the blue-violet the prompt and its dialogs use
 *   skill · autoAccept      — violet
 *   ide                     — a muted blue
 *   planMode                — teal
 *   claude                  — the terracotta of the spinner
 * A raw colour still works where a theme has no key for what you mean, e.g.
 * Nord frost: "#88C0D0".
 */
const ACCENT = "permission"
/** The prompt's own border colour, so the rule above the menu matches it. */
const RULE = "promptBorder"
const SELECTED_BG = "userMessageBackground"

const HEAD = STYLE === "bar" ? 3 : STYLE === "titled" ? 1 : 3
const G = { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", tee: "├", eet: "┤", down: "┬", up: "┴" }

export default function GateBoard(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const options = props === undefined ? [] : props.options
  const typed = props === undefined ? [] : props.typed

  if (surface.state === undefined) {
    surface.setState({ cursor: 0 })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (s === undefined || options.length === 0) return
      if (key === "up") surface.setState({ cursor: (s.cursor - 1 + options.length) % options.length })
      else if (key === "down") surface.setState({ cursor: (s.cursor + 1) % options.length })
      else if (key === "return") surface.post({ answer: answerOf(options[s.cursor]) })
      else {
        // The engine's own key still answers, for anyone who types it.
        const hit = options.find((o) => o.key === key)
        if (hit !== undefined) surface.post({ answer: answerOf(hit) })
      }
    })
    surface.onPointer((ev) => {
      const s = surface.state
      if (s === undefined) return
      const line = ev.y - HEAD
      const option = line < 0 || line >= rowsOfOption.length ? -1 : rowsOfOption[line]
      if (option < 0) return
      if (ev.type === "down") surface.post({ answer: answerOf(options[option]) })
      else if (option !== s.cursor) surface.setState({ cursor: option })
    })
  }

  const cursor = surface.state === undefined ? 0 : surface.state.cursor
  const { inner, left, right } = geometry(options, typed, surface.columns)

  const dim = (text: string) => h(Text, { dimColor: true }, text)
  const ruleText = (text: string) => h(Text, { color: RULE }, text)
  const rule = (l: string, join: string, r: string) =>
    dim(`${l}${G.h.repeat(left)}${join}${G.h.repeat(right)}${r}`)

  /** One entry per drawn line, so the pointer can map a row back to an option. */
  const lines: { option: number; keyText: string; runs: Run[]; first: boolean; quiet: boolean }[] = []
  options.forEach((o, i) => {
    wrapRuns(labelRuns(o.label), right - 1).forEach((runs, n) => {
      lines.push({ option: i, keyText: n === 0 ? shownKey(o) : "", runs, first: n === 0, quiet: false })
    })
  })
  typed.forEach((t) => {
    wrapRuns(labelRuns(t.description), right - 1).forEach((runs, n) => {
      lines.push({ option: -1, keyText: n === 0 ? t.label : "", runs, first: n === 0, quiet: true })
    })
  })
  rowsOfOption = lines.map((l) => l.option)

  const runOf = (r: Run, selected: boolean, background: string | undefined) =>
    h(
      Text,
      {
        italic: r.italic,
        strikethrough: r.strikethrough,
        color: r.accent === true ? ACCENT : undefined,
        dimColor: r.italic === true,
        bold: selected && r.italic !== true,
        backgroundColor: background,
      },
      r.text,
    )

  const drawLine = (line: (typeof lines)[number]) => {
    const selected = line.option === cursor && line.option >= 0
    const background = selected ? SELECTED_BG : undefined
    const keyCell = h(
      Text,
      { color: line.quiet ? undefined : ACCENT, bold: selected, backgroundColor: background },
      line.keyText.padEnd(left - (STYLE === "table" ? 5 : STYLE === "titled" ? 4 : 2)),
    )
    const label = h(
      Text,
      { backgroundColor: background },
      ...pad(line.runs, right).map((r) => runOf(r, selected, background)),
    )

    if (STYLE === "bar") {
      return h(
        Text,
        {},
        h(Text, { color: ACCENT, backgroundColor: background }, selected ? "▌ " : "  "),
        keyCell,
        h(Text, { backgroundColor: background }, "  "),
        label,
      )
    }
    if (STYLE === "titled") {
      return h(
        Text,
        {},
        dim(G.v),
        h(Text, { backgroundColor: background }, "  "),
        keyCell,
        h(Text, { backgroundColor: background }, "  "),
        label,
        dim(G.v),
      )
    }
    return h(
      Text,
      {},
      dim(G.v),
      h(
        Text,
        { color: line.quiet ? undefined : ACCENT, bold: selected, backgroundColor: background },
        `  ${selected && line.first ? "▸" : " "} ${line.keyText}`.padEnd(left),
      ),
      h(Text, { dimColor: true, backgroundColor: background }, G.v),
      h(
        Text,
        { backgroundColor: background },
        ...pad([{ text: " " }, ...line.runs], right).map((r) => runOf(r, selected, background)),
      ),
      dim(G.v),
    )
  }

  const question = props === undefined ? "" : props.question

  if (STYLE === "bar") {
    return h(
      Box,
      { flexDirection: "column" },
      // A full-width rule rather than the engine's dot rule: the band's own
      // width, so it reads as a horizontal border on the transcript.
      ruleText(G.h.repeat(surface.columns)),
      h(Text, {}, h(Text, { color: ACCENT, bold: true }, "◆ "), h(Text, { bold: true }, question)),
      h(Text, {}, " "),
      ...lines.map(drawLine),
    )
  }

  if (STYLE === "titled") {
    const title = ` ◆ ${question} `
    const bar = Math.max(0, inner - title.length - 1)
    return h(
      Box,
      { flexDirection: "column" },
      h(
        Text,
        {},
        dim(`${G.tl}${G.h}`),
        h(Text, { color: ACCENT, bold: true }, title),
        dim(`${G.h.repeat(bar)}${G.tr}`),
      ),
      ...lines.map(drawLine),
      dim(`${G.bl}${G.h.repeat(inner)}${G.br}`),
    )
  }

  return h(
    Box,
    { flexDirection: "column" },
    dim(`${G.tl}${G.h.repeat(inner)}${G.tr}`),
    h(
      Text,
      {},
      dim(G.v),
      h(Text, { color: ACCENT, bold: true }, "  ◆ "),
      h(Text, { bold: true }, question.padEnd(inner - 4)),
      dim(G.v),
    ),
    rule(G.tee, G.down, G.eet),
    ...lines.map(drawLine),
    rule(G.bl, G.up, G.br),
  )
}
