'use strict';

// ---------------------------------------------------------------------------
// What the reshape retired (1.S9, 3.S1, 6.S3): the release ships no research,
// planning, scoping or baseline skill, no plan format, and no cross-cutting
// type a unit can be made as; the engine's phase tables hold discovery,
// discussion, experiment and investigation in Discovery, specification in
// Definition, implementation and review in Delivery, with the item names
// older units carry in a list outside the tables; and the command catalogue
// has the new families with their verbs and the kept ones, and no verb for
// what the release removes.
//
// Layer: unit. World: none — the shipped skills folder, the schema module
// and the engine's usage, read.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const schema = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { HANDOFF_TARGETS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');
const { run, COMMANDS } = require('../../skills/leeway-engine/scripts/engine.cjs');

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

describe('the command catalogue (6.S3)', () => {
  // The catalogue as the engine says it to a call it does not know: each
  // usage line's family and its verb, a render's surface among them.
  const usage = String(run(['nope'], { cwd: os.tmpdir() }).stderr).split('\n').filter((line) => /^ {2}[a-z]/.test(line));
  /** @type {Record<string, string[]>} */
  const verbs = {};
  for (const line of usage) {
    const [family, verb] = line.trim().split(/\s+/);
    (verbs[family] ??= []).push(verb);
  }

  /** The verbs 6.1.4 to 6.1.13, 6.1.15 and 6.1.20 name, by family; a family with none named is its one door. */
  const NEW = {
    ledger: ['ask', 'find', 'decide', 'replace', 'hold', 'move', 'merge', 'record', 'map', 'product', 'since', 'affected'],
    raise: ['answer'],
    verdict: ['queue', 'give'],
    task: ['note'],
    land: ['open', 'chain', 'phase', 'finish'],
    brief: [],
    checklist: ['show', 'done', 'skip', 'close'],
    asset: ['add', 'status', 'lift'],
    verify: ['run', 'setup', 'mutants'],
    gate: [],
    inbox: ['archive', 'restore', 'delete', 'close', 'file'],
    cut: [],
  };
  /** The families 6.1.16 keeps. */
  const KEPT = ['topic', 'workunit', 'roadmap', 'discovery-session', 'experiment', 'agent', 'knowledge', 'commit', 'render', 'handoff', 'conversation', 'presence', 'session', 'boot'];
  /** What the release removes (6.1.17): research threads, the discussion map, routing, build order, analysis cycles, plan formats, grouping, staleness, promotion to cross-cutting. */
  const RETIRED = /research(?!er)|thread|discussion-map|rout(e|ing)|build-order|analys|cache|cycle|format|group|stale|reconcile|promot|cross-cutting/;

  it('has the new families with the verbs they name, and the kept families, each a command the engine dispatches', () => {
    for (const family of [...Object.keys(NEW), ...KEPT]) {
      assert.ok(Object.hasOwn(COMMANDS, family) && Object.hasOwn(verbs, family), `${family} is in the catalogue`);
    }
    assert.deepStrictEqual(Object.entries(NEW).flatMap(([family, named]) => named.filter((verb) => !verbs[family].includes(verb)).map((verb) => `${family} ${verb}`)), []);
  });

  it('has no verb serving what the release removes — no family, verb or surface named for it', () => {
    assert.deepStrictEqual(Object.entries(verbs).flatMap(([family, said]) => [family, ...said.map((verb) => `${family} ${verb}`)]).filter((name) => RETIRED.test(name)), []);
    assert.deepStrictEqual(Object.keys(COMMANDS).filter((family) => RETIRED.test(family)), []);
  });
});
