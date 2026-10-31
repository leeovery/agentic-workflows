'use strict';

// ---------------------------------------------------------------------------
// The merged phase (9.S41): with the release installed, research is no skill
// and no phase, the research-thread and subtopic-map verbs are gone, neither
// map draws a subtopic state, and the screens name the one conversational
// phase discussion — which closes at its decided gate, never through
// `topic complete`.
//
// Layer: verb. World, built once and only read: an epic, `orbit`, its topic
// `alpha` under discussion with a question decided on the ledger.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { call, ok, output, refuses, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { WORK_TYPE_PIPELINES, VALID_PHASE_STATUSES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { TOPIC_PHASES } = require('../../skills/leeway-engine/scripts/domain/ledger-units.cjs');
const { HANDOFF_TARGETS, OPENING_SKILLS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');
const EPIC_GATEWAY = require('../../skills/leeway-continue-epic/scripts/gateway.cjs');
const { epicDashboard } = require('../../skills/leeway-engine/scripts/domain/projections/epic.cjs');

const ROOT = path.join(__dirname, '../..');
const EPIC = 'orbit';
const SUBTOPIC_TAG = /\[(pending|exploring|converging|deferred)\]/;

const world = fixtureFrom('merged-phase-', (dir) => {
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: { items: { alpha: { order: 1, summary: 'Alpha', source: 'discovery' } } },
      discussion: { items: { alpha: { status: 'in-progress' } } },
    },
  });
  commitAll(dir, 'the world');
  const person = { by: 'person', who_moved_whom: 'none' };
  const env = { CLAUDE_CODE_SESSION_ID: 'session-1' };
  const asked = ok(dir, ['ledger', 'ask', `${EPIC}.discussion.alpha`], { env, stdin: JSON.stringify({ ...person, text: 'What does alpha settle?' }) }).id;
  ok(dir, ['ledger', 'decide', `${EPIC}.discussion.alpha`, '--answers', asked], { env, stdin: JSON.stringify({ ...person, text: 'Its own scope.', why: 'The rest is beta.' }) });
});

/** @type {string} */ let dir;
before(() => { dir = world(); });
after(() => { cleanupFixture(dir); });

describe('research is no skill and no phase', () => {
  it('ships no research skill, and no handoff lands on one', () => {
    assert.strictEqual(fs.existsSync(path.join(ROOT, 'skills/leeway-research-process')), false);
    assert.ok(!HANDOFF_TARGETS.some((skill) => skill.includes('research')));
    assert.ok(!OPENING_SKILLS.some((skill) => skill.includes('research')));
    assert.match(refuses(dir, ['handoff', '/leeway-research-process', 'epic', EPIC, 'alpha']).error,
      /^"leeway-research-process" is not a handoff target/);
  });

  it('is in no pipeline and no topic\'s phases, and no item of it can be written or started', () => {
    for (const pipeline of Object.values(WORK_TYPE_PIPELINES)) assert.ok(!pipeline.includes('research'));
    assert.ok(!TOPIC_PHASES.includes('research'));
    assert.strictEqual(Object.hasOwn(VALID_PHASE_STATUSES, 'research'), false);
    assert.match(refuses(dir, ['manifest', 'set', `${EPIC}.research.alpha`, 'status', 'in-progress']).error, /^Invalid phase "research"/);
    assert.match(refuses(dir, ['topic', 'start', EPIC, 'research', 'alpha']).error, /^unknown or non-lifecycle phase "research"/);
  });
});

describe('the research-thread and subtopic-map verbs are gone', () => {
  for (const verb of [['research-threads', 'add', EPIC, 'alpha', 'scope', '--question', 'Why?', '--origin', 'seed'], ['discussion-map', 'add', EPIC, 'alpha', 'edge']]) {
    it(`${verb[0]} is no command`, () => {
      const res = call(dir, verb);
      assert.strictEqual(res.code, 1);
      assert.match(res.stderr, /^Usage: engine <command>/);
      assert.ok(!res.stderr.includes(verb[0]), `the usage names no ${verb[0]}`);
    });
  }
});

describe('neither map draws a subtopic state', () => {
  it('the topic\'s map draws its ledger: the question decided, yours', () => {
    const map = output(dir, ['render', 'map', `${EPIC}.alpha`]);
    assert.match(map, /^ {2}└─ ✓ What does alpha settle\? +\[yours\]$/m);
    assert.doesNotMatch(map, SUBTOPIC_TAG);
  });

  it('the epic\'s dashboard draws the topic discussing, with nothing nested beneath it', () => {
    const board = epicDashboard(EPIC, EPIC_GATEWAY.discover(dir, EPIC));
    assert.match(board, /Alpha/);
    assert.match(board, /Discussing/);
    assert.doesNotMatch(board, SUBTOPIC_TAG);
    assert.doesNotMatch(board, /What does alpha settle\?/, 'the questions are the topic\'s own map, never the epic\'s rows');
  });
});

describe('the screens name the merged phase discussion', () => {
  it('the phases card names discussion, and research nowhere', () => {
    const card = output(dir, ['render', 'walkthrough-topic', '--name', 'the-phases']);
    assert.match(card, /discussion +argues the design through to conclusions/);
    assert.doesNotMatch(card, /research/i);
  });

  it('a discussion closes at its decided gate, never through topic complete', () => {
    assert.match(refuses(dir, ['topic', 'complete', EPIC, 'discussion', 'alpha']).error,
      /^a discussion closes at its decided gate — `checklist close decided`, then `render decided` and the yes, which runs `decided yes`$/);
  });
});
