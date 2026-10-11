'use strict';

// ---------------------------------------------------------------------------
// Domain ring: work-unit projections — the status display, proceed/revisit
// menu, and DATA body over one WorkUnitEntry (see ../workunit-detail.cjs). One
// projection family serves the linear continue menu across the four
// single-topic types; per-type variation (pipeline, work_type route argument)
// comes from WORK_UNIT_TYPES.
//
// Deterministic: same entry, same string. The menu carries machine action keys
// so skills route on keys, never on labels. Layout goes through the kernel
// renderer — no character arithmetic here.
// ---------------------------------------------------------------------------

const { box, renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase, title, materialBlock } = require('../conventions.cjs');
const { menu, menuFrame, cmdOption, actionsTable, section, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { typeConfig } = require('../workunit-detail.cjs');
const { phaseSkill } = require('../handoff.cjs');

/** @typedef {import('../workunit-detail.cjs').WorkUnitEntry} WorkUnitEntry */
/** @typedef {import('../workunit-detail.cjs').WorkUnitTypeConfig} WorkUnitTypeConfig */
/** @typedef {import('../workunit-detail.cjs').PhaseTarget} PhaseTarget */

/**
 * @typedef {object} WorkUnitMenuKey
 * @property {string} key             what the user types (`y`, `r`, `1`, …)
 * @property {string} [word]          long form of a command option (`yes`, `revisit`)
 * @property {string} action          machine action key — skills route on this, never the label
 * @property {string} topic           the item the route names — the work unit's name, but for a promoted unit's moved discussions
 * @property {string} [phase]         revisit_phase entries — the completed phase to reopen
 * @property {string|null} route      skill invocation, or null for internal flows
 * @property {string} label
 */

/**
 * The route a phase of a single-topic unit is entered by — `$0` = the type's
 * work_type value, `$1` = work_unit, `$2` = the item it names where it names
 * one — the route the menu's continue and revisit rows carry.
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {string} phase @param {string} workUnit @param {string|null} [topic]
 * @returns {string}
 */
function phaseRoute(type, phase, workUnit, topic = null) {
  return [`/${phaseSkill(phase)}`, typeConfig(type).workType, workUnit, ...(topic === null ? [] : [topic])].join(' ');
}

/** A revisit candidate as its row names it — the phase, and the item quoted where it names one. @param {PhaseTarget} target */
function targetLabel({ phase, topic }) {
  return topic === null ? titlecase(phase) : `${titlecase(phase)} "${titlecase(topic)}"`;
}

// computeNextPhase's label vocabulary discriminates the next phase's state:
// `{phase} (in-progress)` when started, `ready for {phase}` when not.
/** @param {WorkUnitEntry} unit */
function nextPhaseStarted(unit) {
  return unit.phase_label.endsWith('(in-progress)');
}

/** Pipeline rows: completed phases (an `· input moved` cue on flagged ones), the next phase (in flight or ready), and any other phase in flight (a reopened phase mid-revisit is never dropped) — a `· mail waiting` cue on a phase whose mailbox holds messages. @param {WorkUnitTypeConfig} cfg @param {WorkUnitEntry} unit */
function pipelineNodes(cfg, unit) {
  const flaggedPhases = new Set((unit.reconcile_phases || []).map((r) => r.phase));
  const mailPhases = new Set(unit.mail_phases || []);
  const mailTag = (/** @type {string} */ phase, /** @type {string} */ tag) => (mailPhases.has(phase) ? `${tag} · mail waiting` : tag);
  const nodes = [];
  for (const phase of cfg.pipeline) {
    if (unit.completed_phases.includes(phase)) {
      const tag = flaggedPhases.has(phase) ? 'completed · input moved' : 'completed';
      nodes.push({ title: title({ glyph: '✓', label: titlecase(phase) }), tag });
    } else if (phase === unit.next_phase) {
      // The label vocabulary marks a started next phase, but not every
      // started label says so — `experiment (awaiting evidence)` routes to a
      // phase already in flight — so an in-progress item settles it too.
      const started = nextPhaseStarted(unit) || (unit.in_progress_phases || []).includes(phase);
      nodes.push({
        title: title({ glyph: started ? '◐' : '→', label: titlecase(phase) }),
        tag: mailTag(phase, started ? 'in-progress' : 'ready'),
      });
    } else if ((unit.in_progress_phases || []).includes(phase)) {
      nodes.push({ title: title({ glyph: '◐', label: titlecase(phase) }), tag: mailTag(phase, 'in-progress') });
    }
  }
  return nodes;
}

/**
 * Section A — the work-unit status display. One code-block string: the
 * MATERIAL block (types that surface seeds/imports), and the pipeline tree.
 * The view's heading is the adapter's TITLE section, never drawn here.
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {WorkUnitEntry} unit
 * @returns {string}
 */
function workUnitStatus(type, unit) {
  const cfg = typeConfig(type);
  let out = '';
  const material = materialBlock({ seeds: unit.seeds_count || 0, imports: unit.imports_count || 0 });
  if (material) out += material + '\n\n';
  out += `PIPELINE (${cfg.workType})\n`;
  out += renderTree(pipelineNodes(cfg, unit), { width: TREE_WIDTH });
  for (const r of unit.reconcile_phases || []) {
    out += typeof r.from === 'string'
      ? `\n  ⚑ ${titlecase(r.phase)} input moved — ${r.from} revised since it completed.\n`
      : `\n  ⚑ ${titlecase(r.phase)} input moved — reconcile at next entry.\n`;
  }
  if (unit.finalising) out += '\n  ⚑ All phases complete — ready to finalise.\n';
  return out.replace(/\n+$/, '\n');
}

/**
 * Section B — the proceed/revisit menu. `keys` carries the machine action keys
 * (skills route on these): the `continue` entry always (a `finalise` entry on
 * a finalising unit — the skill runs `workunit complete`, no route), plus
 * `revisit` and one `revisit_phase` entry per revisit candidate when any
 * exist, and `back` to the start menu wherever the menu renders. `rendered` is
 * the dotted-gate markdown block — empty when there is nothing to revisit and
 * nothing to finalise (the calling skill routes straight through, no stop).
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {WorkUnitEntry} unit
 * @returns {{keys: WorkUnitMenuKey[], rendered: string}}
 */
function workUnitMenu(type, unit) {
  const revisitable = unit.revisit;
  const gated = unit.finalising || revisitable.length > 0;

  /** @type {WorkUnitMenuKey[]} */
  const options = [unit.finalising
    ? {
      key: 'y', word: 'yes', action: 'finalise', topic: unit.name, route: null,
      label: 'Mark the work unit completed',
    }
    : {
      key: 'y', word: 'yes', action: 'continue', topic: unit.next_topic ?? unit.name,
      route: phaseRoute(type, unit.next_phase, unit.name, unit.next_topic),
      label: `Proceed to ${unit.next_phase}`,
    }];
  if (revisitable.length > 0) {
    options.push({ key: 'r', word: 'revisit', action: 'revisit', topic: unit.name, route: null, label: 'Revisit an earlier phase' });
  }
  if (gated) {
    options.push({ key: 'b', word: 'back', action: 'back', topic: unit.name, route: null, label: 'Return to the start menu' });
  }

  /** @type {WorkUnitMenuKey[]} */
  const keys = [
    ...options,
    ...revisitable.map((target, i) => ({
      key: String(i + 1), action: 'revisit_phase', topic: target.topic ?? unit.name, phase: target.phase,
      route: phaseRoute(type, target.phase, unit.name, target.topic),
      label: `${targetLabel(target)} — completed`,
    })),
  ];

  const rendered = gated
    ? menu(
      `${unit.finalising ? 'Finalising' : 'Continuing'} "${titlecase(unit.name)}" — *${unit.phase_label}*${(unit.mail_phases || []).length > 0 ? ' · mail waiting' : ''}.`,
      options.map((k) => cmdOption(k.key, k.word, k.label)),
      { question: 'Proceed?' },
    )
    : '';

  return { keys, rendered };
}

/**
 * The DATA body for the view snapshot: flow flags plus the ACTIONS key table
 * (`key  word  action  topic  → route` lines). Reasoning surface — never displayed.
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
  lines.push(`reconcile_pending: ${(unit.reconcile_phases || []).map((r) => `${r.phase} (${r.from})`).join(', ') || '(none)'}`);
  lines.push(`mail_waiting: ${(unit.mail_phases || []).join(', ') || '(none)'}`);
  lines.push(`revisit_available: ${menu.keys.some((k) => k.action === 'revisit')}`);
  if (cfg.surfacesSeeds) {
    lines.push(`seeds_count: ${unit.seeds_count || 0}`);
    lines.push(`imports_count: ${unit.imports_count || 0}`);
  }
  lines.push(...actionsTable(['action', 'topic', '→ route'], menu.keys, (k) => [k.action, k.topic, `→ ${k.route || '(internal)'}`]));
  return lines.join('\n');
}

/**
 * The revisit-phase menu, served by `render revisit-phases` at the gate that
 * displays it — one numbered option per revisit candidate, numbering matching
 * the `revisit_phase` keys. Empty string when there is nothing to revisit.
 * @param {PhaseTarget[]} targets  the revisit candidates, in phaseTargets order
 * @returns {string}
 */
function revisitPhasesSection(targets) {
  if (targets.length === 0) return '';
  return section(
    'MENU: revisit phases',
    MENU_INSTRUCTION,
    menuFrame([
      'Which phase would you like to revisit?',
      '',
      ...targets.map((target, i) => cmdOption(String(i + 1), null, { head: targetLabel(target), tail: 'completed' })),
      cmdOption('b', 'back', 'Return to the previous menu'),
    ]),
  );
}

/** The view's chrome heading. @param {WorkUnitEntry} unit */
function workUnitTitle(unit) { return titlecase(unit.name); }

module.exports = { workUnitStatus, workUnitTitle, workUnitMenu, workUnitData, phaseRoute, revisitPhasesSection };
