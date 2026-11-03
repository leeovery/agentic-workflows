/**
 * The board's views and pages, each drawn by its kind: the lines it draws
 * beneath the tabs, with the kit's help, and its name for a page's way
 * back to it ("← back to the build"). A kind with no drawing draws
 * nothing beneath the tabs.
 */
import type { Kit, Line } from '../draw.ts'
import type { View } from '../model.ts'

export type ViewDrawing = {
  lines: (view: View, kit: Kit) => Line[]
  name: (view: View) => string
}

export type Views = Readonly<Record<string, ViewDrawing>>

export const VIEWS: Views = {}
