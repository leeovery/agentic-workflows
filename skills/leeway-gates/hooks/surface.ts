/**
 * Where the mod draws: in a session that announced, on the one screen its
 * drawings are made for — Claude Code's terminal app or the Desktop app's
 * Code tab — with no other attached beside it.
 */
import type { EngineInterface, RenderSurface } from 'claude-code'

/** The surfaces the band draws on: the terminal app's, and the Desktop app's. */
const BAND_SURFACES: ReadonlySet<RenderSurface> = new Set(['terminal', 'desktop'])

/**
 * Whether the session announces the gate surface: set at its start, and
 * still set after a reload of the module. The band is kept and read back,
 * the harness put on and the board drawn, only where it is, so a process
 * whose session never announced — one the mod does not apply to, or one
 * this module was loaded into after it started — never gets any of them.
 */
export async function isAnnounced($: EngineInterface): Promise<boolean> {
  return (await $.env.get('LEEWAY_GATE_SURFACE')) === '1'
}

/**
 * Whether the session's only screen is one the band draws on, where any
 * other attached beside it, Remote Control's among them, shows the menus as
 * text alone. The Desktop app attaches after the session starts, so this is
 * read where it is needed.
 */
export async function isBandAlone($: EngineInterface): Promise<boolean> {
  const [only, ...others] = await $.session.surfaces()

  return only !== undefined && others.length === 0 && BAND_SURFACES.has(only)
}
