'use strict';

// ---------------------------------------------------------------------------
// What the reshape retired (1.S9, 3.S1): the release ships no research,
// planning, scoping or baseline skill, no plan format, and no cross-cutting
// type a unit can be made as; and the engine's phase tables hold discovery,
// discussion, experiment and investigation in Discovery, specification in
// Definition, implementation and review in Delivery, with the item names
// older units carry in a list outside the tables.
//
// Layer: unit. World: none — the shipped skills folder and the schema
// module, read.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const schema = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { HANDOFF_TARGETS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');

const SKILLS = path.join(__dirname, '../../skills');

/** Every path under `dir`. @param {string} dir @returns {string[]} */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => [path.join(dir, entry.name), ...(entry.isDirectory() ? walk(path.join(dir, entry.name)) : [])]);
}

describe('the release ships none of the retired skills, formats or types (1.S9)', () => {
  const RETIRED = /research|planning|scoping|baseline/;

  it('lists no research, planning, scoping or baseline skill, and no handoff lands on one', () => {
    const skills = fs.readdirSync(SKILLS);
    assert.ok(skills.includes('leeway-discussion-process'), 'the listing reads the shipped skills');
    assert.deepStrictEqual(skills.filter((name) => RETIRED.test(name)), []);
    assert.deepStrictEqual(HANDOFF_TARGETS.filter((skill) => RETIRED.test(skill)), []);
  });

  it('lists no plan format — no output formats anywhere in the product', () => {
    assert.deepStrictEqual(walk(SKILLS).filter((file) => path.basename(file).startsWith('output-formats')), []);
  });

  it('lists no cross-cutting type: a unit is made only as one of the four, a migrated one read under the legacy name', () => {
    assert.deepStrictEqual(schema.VALID_WORK_TYPES, ['epic', 'feature', 'bugfix', 'quick-fix']);
    assert.deepStrictEqual(Object.keys(schema.WORK_TYPE_PIPELINES), schema.VALID_WORK_TYPES);
    assert.deepStrictEqual(Object.keys(schema.LEGACY_WORK_TYPES), ['cross-cutting']);
  });
});

describe('the engine\'s phase tables (3.S1)', () => {
  /** Every phase name each of the engine's phase tables holds. */
  const TABLES = {
    'the phase table': Object.keys(schema.PHASE_STAGES),
    'the status vocabularies': Object.keys(schema.VALID_PHASE_STATUSES),
    'the pipelines': Object.values(schema.WORK_TYPE_PIPELINES).flat(),
    'the epic\'s phases': schema.EPIC_PHASES,
    'the topic\'s phases': schema.TOPIC_PHASES,
    'the build\'s phases': schema.BUILD_PHASES,
    'the derived phases': schema.DERIVED_PHASES,
  };

  it('sits discovery, discussion, experiment and investigation in Discovery, specification in Definition, and implementation and review in Delivery', () => {
    /** @type {Record<string, string[]>} */
    const byStage = {};
    for (const [phase, stage] of Object.entries(schema.PHASE_STAGES)) (byStage[stage] ??= []).push(phase);
    assert.deepStrictEqual(Object.fromEntries(Object.entries(byStage).map(([stage, phases]) => [stage, phases.sort()])), {
      Discovery: ['discovery', 'discussion', 'experiment', 'investigation'],
      Definition: ['specification'],
      Delivery: ['implementation', 'review'],
    });
  });

  it('every table holds the phase table\'s phases alone — no research, planning or scoping phase', () => {
    const phases = Object.keys(schema.PHASE_STAGES);
    assert.deepStrictEqual(schema.VALID_PHASES, phases);
    for (const [table, names] of Object.entries(TABLES)) {
      assert.deepStrictEqual(names.filter((name) => !phases.includes(name)), [], table);
    }
    assert.deepStrictEqual(Object.keys(schema.VALID_PHASE_STATUSES), phases, 'a status vocabulary for every phase, and for nothing else');
  });

  it('keeps the item names older units carry in a list outside the tables', () => {
    assert.deepStrictEqual(schema.LEGACY_PHASES, ['planning']);
    for (const [table, names] of Object.entries(TABLES)) {
      assert.deepStrictEqual(names.filter((name) => schema.LEGACY_PHASES.includes(name)), [], table);
    }
  });
});
