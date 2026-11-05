/**
 * The board's views and pages, each drawn by its kind: the lines it draws
 * beneath the tabs, with the kit's help, and its name for a page's way
 * back to it ("← back to the build"). A kind with no drawing draws
 * nothing beneath the tabs.
 */
import type { Kit, Line } from '../draw.ts'
import type { View } from '../model.ts'
import { buildLines } from './build.ts'
import { checkLines, findingLines, reviewLines } from './review.ts'
import { evidenceLines, evidenceName, roundLines, roundName, scenarioLines, scenarioName, taskLines, taskName, writtenLines, writtenName } from './task.ts'
import { ALL } from './all.ts'
import { BRIEF, DISCOVERY, SPIKE } from './discovery.ts'
import { DISCUSSION, ENTRY, MESSAGE, REVIEW_REPORT } from './discussion.ts'
import { EXPERIMENT, EXPERIMENT_REPORT } from './experiment.ts'
import { PASS, SECTION, SPEC, SPEC_FINDING } from './spec.ts'
import { EPIC, PHASE, UNIT } from './unit.ts'

export type ViewDrawing = {
  lines: (view: View, kit: Kit) => Line[]
  name: (view: View) => string
}

export type Views = Readonly<Record<string, ViewDrawing>>

export const VIEWS: Views = {
  build: { lines: buildLines, name: () => 'the build' },
  task: { lines: taskLines, name: taskName },
  'task-written': { lines: writtenLines, name: writtenName },
  'task-round': { lines: roundLines, name: roundName },
  scenario: { lines: scenarioLines, name: scenarioName },
  evidence: { lines: evidenceLines, name: evidenceName },
  review: { lines: reviewLines, name: () => 'the review' },
  finding: { lines: findingLines, name: () => 'the finding' },
  check: { lines: checkLines, name: () => 'the check' },
  discussion: DISCUSSION,
  entry: ENTRY,
  message: MESSAGE,
  'review-report': REVIEW_REPORT,
  spec: SPEC,
  section: SECTION,
  pass: PASS,
  'spec-finding': SPEC_FINDING,
  discovery: DISCOVERY,
  brief: BRIEF,
  spike: SPIKE,
  experiment: EXPERIMENT,
  'experiment-report': EXPERIMENT_REPORT,
  epic: EPIC,
  unit: UNIT,
  phase: PHASE,
  all: ALL,
}
