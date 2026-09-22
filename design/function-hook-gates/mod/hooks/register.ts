/**
 * workflow-gates — draws a gate's options as buttons in the band above the
 * prompt, in the engine's own menu chrome, instead of the model printing them.
 *
 * Not a pane: `$.ui.open` a plugin makes on its own "waits undrawn below 144
 * terminal columns". AbovePrompt is one always-drawn band above the composer.
 *
 * Nothing waits inside a hook (the budget is ten seconds and a gate waits on a
 * person): the press is its own dispatch and submits the answer as the next
 * prompt, which is what the prose already expects to read.
 */
import type { Register, ToolResultOf } from "claude-code"
import { chromeRows, lineCount } from "./layout.ts"

/** The engine's own gate payload: `=== GATE (…) ===` then one line of JSON. */
const GATE_RE = /^=== GATE \([^)]*\) ===\n(.+)$/m
/** The menu the model would otherwise print, which this mod draws instead. */
const MENU_RE = /^=== MENU(?:: [^(]+?)? \([^)]*\) ===\n/m
const NEXT_SECTION_RE = /^=== [A-Z]+/m
const ENGINE_RE = /\/(engine|gateway)\.cjs\b/
/** The engine's own chrome, so the band reads as the menu it replaces. */
const GLYPH = "◆"
/** The band draws its own colour: the transcript's accent comes from markdown. */
/** A light rule between the key column and its description, instead of an arrow. */
const SEPARATOR = "│"

type Option = { key: string; word: string | null; label: string }
type Typed = { label: string; description: string }
type Gate = { question: string; options: readonly Option[]; typed: readonly Typed[]; demo: boolean }

let gate: Gate | null = null
let debug = false
/** The demo arms once per load, so every hot reload redraws it. */
let armed = false

/**
 * The demo gate is the engine's own, not a transcription of it: on load the mod
 * runs a gateway verb and arms whatever gate comes back. So what you see is
 * always the current menu for this instance, in the current design.
 */
const DEMO_VERB = [
  "node",
  ".claude/skills/workflow-start/scripts/gateway.cjs",
  "view",
  "fumi",
]

async function demoGate($: any): Promise<Gate | null> {
  const run = await $.process.run(DEMO_VERB)
  const text = typeof run.stdout === "string" ? run.stdout : ""
  const payload = text.match(GATE_RE)
  if (payload === null) return null
  const stated = JSON.parse(payload[1]) as {
    question: string
    options: Option[]
    typed: Typed[]
  }
  return stated.options.length === 0
    ? null
    : { question: stated.question, options: stated.options, typed: stated.typed, demo: true }
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    debug = (await $.env.get("WORKFLOW_GATES_DEBUG")) !== undefined
    return next(e)
  })

  // A typed answer that names an option answers the gate. Anything else is a
  // question or a comment — the kind of thing a `promptOption` invites — and
  // the workflows answer those and then re-present the same gate, so the menu
  // stays on screen rather than vanishing under the reply.
  on("prompt.submit", ($, e, next) => {
    if (gate === null) return next(e)
    const said = e.text.trim().toLowerCase()
    const answered = gate.options.some((o) => said === o.key.toLowerCase() || said === (o.word ?? "").toLowerCase())
    if (answered) {
      gate = null
      $.ui.invalidate("ui.render")
    }
    return next(e)
  })

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    // The board wants a terminal's keys and mouse; other surfaces draw their own.
    if (e.props.hasSurvey || e.surface !== "terminal") return next(e)
    if (gate === null && !armed) {
      // A reload resets module state but does not re-run session.start, so the
      // demo arms here: every write to this file redraws it. The engine call is
      // not awaited in the draw — it arms the next one.
      armed = true
      demoGate($).then((demo) => {
        if (demo !== null && gate === null) {
          gate = demo
          $.ui.invalidate("ui.render")
        }
      })
    }
    if (gate === null) return next(e)
    const { Box, Client } = await $.ui.resolve(e)
    const open = gate
    // The region must be exactly as tall as the tree: shorter and the pointer
    // cannot reach the rows past its edge, taller and the band shows the gap.
    // `lineCount` is the board's own wrap, so the two cannot drift.
    const rows = chromeRows() + lineCount(open.options, open.typed, e.props.bodyColumns)

    return h(
      Box,
      { flexDirection: "column" },
      h(Client, {
        // The module path is read off this source, so it must be a literal.
        key: "gate",
        module: "./board.ts",
        width: e.props.bodyColumns,
        height: rows,
        props: { question: open.question, options: open.options, typed: open.typed },
      }),
      await next(e),
    )
  })

  // The board has no `$`: a press or Enter posts here, and this submits it.
  on("ui.message", { element: "gate" }, ($, e, next) => {
    const data = e.data as { answer?: unknown }
    if (typeof data.answer !== "string") return next(e)
    const demo = gate !== null && gate.demo
    gate = null
    $.ui.invalidate("ui.render")
    if (demo) {
      $.ui.toast(`pressed ${data.answer}`)
    } else {
      $.prompt.submit({ text: data.answer })
    }
    return next(e)
  })

  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    if (typeof e.command !== "string" || !ENGINE_RE.test(e.command)) return next(e)

    const result = await next(e)
    if (typeof result.text !== "string" || result.isError === true) return result

    // The engine states the gate as data. Nothing here reads the markdown the
    // MENU is made of, so a change to that markdown cannot break this.
    const payload = result.text.match(GATE_RE)
    if (payload === null) return result
    const stated = JSON.parse(payload[1]) as {
      gate: string
      question: string
      options: Option[]
      typed: Typed[]
    }
    if (stated.options.length === 0) return result
    if (debug) $.ui.log(`gate "${stated.gate}" · ${stated.options.length} options`)

    gate = { question: stated.question, options: stated.options, typed: stated.typed, demo: false }
    $.ui.invalidate("ui.render")

    // Cut the MENU the model was told to emit, and the GATE payload it has no
    // use for, leaving the instruction in their place. Bash declares an output
    // schema, so this answers with the tool's own record.
    const menu = result.text.match(MENU_RE)
    const head = menu === null ? result.text : result.text.slice(0, menu.index)
    const rest = menu === null ? "" : result.text.slice((menu.index ?? 0) + menu[0].length)
    const after = rest.match(NEXT_SECTION_RE)
    return {
      result: {
        ...(result.result as ToolResultOf<"Bash">),
        stdout:
          head.replace(GATE_RE, "").trimEnd() +
          `\n=== MENU: ${stated.gate} (drawn above the prompt — do NOT emit it; stop and wait) ===\n` +
          `The options are on screen. The user's choice, or anything they type, arrives as their next message.\n` +
          (after === null ? "" : rest.slice(after.index)),
        stderr: "",
      },
    }
  }).catch(($, e, next) => {
    if (debug) $.ui.log(`workflow-gates: ${next.error.kind} — falling back to the text menu`)
    return next.called ? next.error && next(e) : next(e)
  })
}
