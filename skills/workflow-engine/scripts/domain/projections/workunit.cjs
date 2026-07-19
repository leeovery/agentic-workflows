'use strict';

// ---------------------------------------------------------------------------
// Domain ring: work-unit projections — the status display, proceed/revisit
// menu, and DATA body over one WorkUnitEntry (see ../workunit-detail.cjs). One
// projection family serves all four single-topic navigation skills; per-type
// variation (pipeline, work_type route argument) comes from WORK_UNIT_TYPES.
//
// Deterministic: same entry, same string. The menu carries machine action keys
// so skills route on keys, never on labels. Layout goes through the kernel
// renderer — no character arithmetic here.
// ---------------------------------------------------------------------------

const { box, renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase, title } = require('../conventions.cjs');
const { typeConfig } = require('../workunit-detail.cjs');

/** @typedef {import('../workunit-detail.cjs').WorkUnitEntry} WorkUnitEntry */
/** @typedef {import('../workunit-detail.cjs').WorkUnitTypeConfig} WorkUnitTypeConfig */

/**
 * @typedef {object} WorkUnitMenuKey
 * @property {string} key             what the user types (`y`, `r`, `1`, …)
 * @property {string} [word]          long form of a command option (`yes`, `revisit`)
 * @property {string} action          machine action key — skills route on this, never the label
 * @property {string} topic           the work unit name (topic = work unit for these types)
 * @property {string} [phase]         revisit_phase entries — the completed phase to reopen
 * @property {string|null} route      skill invocation, or null for internal flows
 * @property {string} label
 */

/** Phase entry route — `$0` = the type's work_type value, `$1` = work_unit. @param {WorkUnitTypeConfig} cfg @param {string} phase @param {string} workUnit */
function entryRoute(cfg, phase, workUnit) {
  return `/workflow-${phase}-entry ${cfg.workType} ${workUnit}`;
}

// Completed phases that come before next_phase in the pipeline — the revisit
// candidates. A next_phase outside the pipeline (defensive) revisits any.
/** @param {WorkUnitTypeConfig} cfg @param {WorkUnitEntry} unit @returns {string[]} */
function earlierCompleted(cfg, unit) {
  const nextIdx = cfg.pipeline.indexOf(unit.next_phase);
  if (nextIdx === -1) return unit.completed_phases.slice();
  return unit.completed_phases.filter((p) => {
    const i = cfg.pipeline.indexOf(p);
    return i > -1 && i < nextIdx;
  });
}

// computeNextPhase's label vocabulary discriminates the next phase's state:
// `{phase} (in-progress)` when started, `ready for {phase}` when not.
/** @param {WorkUnitEntry} unit */
function nextPhaseStarted(unit) {
  return unit.phase_label.endsWith('(in-progress)');
}

/** Pipeline rows: completed phases, the next phase (in flight or ready), and any other phase in flight (a reopened phase mid-revisit is never dropped). @param {WorkUnitTypeConfig} cfg @param {WorkUnitEntry} unit */
function pipelineNodes(cfg, unit) {
  const nodes = [];
  for (const phase of cfg.pipeline) {
    if (unit.completed_phases.includes(phase)) {
      nodes.push({ title: title({ glyph: '✓', label: titlecase(phase), tag: 'completed' }) });
    } else if (phase === unit.next_phase) {
      const started = nextPhaseStarted(unit);
      nodes.push({
        title: title({
          glyph: started ? '◐' : '→',
          label: titlecase(phase),
          tag: started ? 'in-progress' : 'ready',
        }),
      });
    } else if ((unit.in_progress_phases || []).includes(phase)) {
      nodes.push({ title: title({ glyph: '◐', label: titlecase(phase), tag: 'in-progress' }) });
    }
  }
  return nodes;
}

/**
 * Section A — the work-unit status display. One code-block string: box cap,
 * seed/import callouts (types that surface them), and the pipeline tree.
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {WorkUnitEntry} unit
 * @returns {string}
 */
function workUnitStatus(type, unit) {
  const cfg = typeConfig(type);
  let out = box(titlecase(unit.name));
  const callouts = [];
  if ((unit.seeds_count || 0) > 0) callouts.push('  · seeded from the inbox');
  if ((unit.imports_count || 0) > 0) {
    callouts.push(`  · ${unit.imports_count} import${unit.imports_count === 1 ? '' : 's'}`);
  }
  if (callouts.length > 0) out += callouts.join('\n') + '\n\n';
  out += `  PIPELINE (${cfg.workType})\n`;
  out += renderTree(pipelineNodes(cfg, unit), { width: TREE_WIDTH });
  if (unit.finalising) out += '\n  ⚑ All phases complete — ready to finalise.\n';
  return out.replace(/\n+$/, '\n');
}

/**
 * Section B — the proceed/revisit menu. `keys` carries the machine action keys
 * (skills route on these): the `continue` entry always (a `finalise` entry on
 * a finalising unit — the skill runs `workunit complete`, no route), plus
 * `revisit` and one `revisit_phase` entry per earlier completed phase when any
 * exist. `rendered` is the dotted-gate markdown block — empty when there is
 * nothing to revisit and nothing to finalise (the calling skill routes
 * straight through, no stop).
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {WorkUnitEntry} unit
 * @returns {{keys: WorkUnitMenuKey[], rendered: string}}
 */
function workUnitMenu(type, unit) {
  const cfg = typeConfig(type);
  const revisitable = earlierCompleted(cfg, unit);

  /** @type {WorkUnitMenuKey[]} */
  const keys = [unit.finalising
    ? {
      key: 'y', word: 'yes', action: 'finalise', topic: unit.name, route: null,
      label: 'Mark the work unit completed',
    }
    : {
      key: 'y', word: 'yes', action: 'continue', topic: unit.name,
      route: entryRoute(cfg, unit.next_phase, unit.name),
      label: `Proceed to ${unit.next_phase}`,
    }];

  if (revisitable.length > 0) {
    keys.push({ key: 'r', word: 'revisit', action: 'revisit', topic: unit.name, route: null, label: 'Revisit an earlier phase' });
    revisitable.forEach((phase, i) => {
      keys.push({
        key: String(i + 1), action: 'revisit_phase', topic: unit.name, phase,
        route: entryRoute(cfg, phase, unit.name),
        label: `${titlecase(phase)} — completed`,
      });
    });
  }

  let rendered = '';
  if (unit.finalising || revisitable.length > 0) {
    const options = [`- **\`y\`/\`yes\`** — ${keys[0].label}`];
    if (revisitable.length > 0) options.push('- **`r`/`revisit`** — Revisit an earlier phase');
    rendered = [
      '· · · · · · · · · · · ·',
      `${unit.finalising ? 'Finalising' : 'Continuing'} "${titlecase(unit.name)}" — ${unit.phase_label}.`,
      '',
      ...options,
      '· · · · · · · · · · · ·',
    ].join('\n');
  }

  return { keys, rendered };
}

/**
 * The DATA body for the view snapshot: flow flags plus the ACTIONS key table
 * (`key  action  topic  → route` lines). Reasoning surface — never displayed.
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {WorkUnitEntry} unit
 * @param {{keys: WorkUnitMenuKey[]}} menu  the workUnitMenu result for the same unit
 * @returns {string}
 */
function workUnitData(type, unit, menu) {
  const cfg = typeConfig(type);
  const lines = [];
  lines.push(`work_unit: ${unit.name}`);
  lines.push(`work_type: ${cfg.workType}`);
  lines.push(`next_phase: ${unit.next_phase}`);
  lines.push(`phase_label: ${unit.phase_label}`);
  lines.push(`finalising: ${unit.finalising === true}`);
  lines.push(`completed_phases: ${unit.completed_phases.join(', ') || '(none)'}`);
  lines.push(`revisit_available: ${menu.keys.some((k) => k.action === 'revisit')}`);
  if (cfg.surfacesSeeds) {
    lines.push(`seeds_count: ${unit.seeds_count || 0}`);
    lines.push(`imports_count: ${unit.imports_count || 0}`);
  }
  lines.push('ACTIONS (key  action  topic  → route):');
  for (const k of menu.keys) {
    lines.push(`  ${k.key}  ${k.action}  ${k.topic}  → ${k.route || '(internal)'}`);
  }
  return lines.join('\n');
}

module.exports = { workUnitStatus, workUnitMenu, workUnitData };
