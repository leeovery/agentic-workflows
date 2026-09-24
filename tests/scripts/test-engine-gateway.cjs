'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');

const {
  runGateway,
  dataBlock,
  titleBlock,
  displayBlock,
  menuBlock,
  SECTION,
} = require('../../skills/workflow-engine/scripts/gateway.cjs');

const lib = require('../../skills/workflow-engine/scripts/lib.cjs');
const { dataSection, titleSection } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');

// Capture stdout writes around a runGateway call.
function captureRun(handlers, argv) {
  const writes = [];
  const original = process.stdout.write;
  // @ts-ignore — test stub
  process.stdout.write = (chunk) => { writes.push(String(chunk)); return true; };
  try {
    runGateway(handlers, argv);
  } finally {
    process.stdout.write = original;
  }
  return writes.join('');
}

describe('gateway: verb dispatch', () => {
  it('no args routes to index', () => {
    const out = captureRun({ index: () => 'INDEX' }, []);
    assert.strictEqual(out, 'INDEX\n');
  });

  it('a registered verb receives the remaining args', () => {
    const out = captureRun({ index: () => '', view: (wu) => `view:${wu}` }, ['view', 'my-epic']);
    assert.strictEqual(out, 'view:my-epic\n');
  });

  it('extra args pass through to the handler', () => {
    const out = captureRun({ index: () => '', map: (wu, topic) => `${wu}/${topic}` }, ['map', 'wu', 'topic']);
    assert.strictEqual(out, 'wu/topic\n');
  });

  it('unmatched argv falls back to the fallback handler with full argv', () => {
    const out = captureRun(
      { index: () => '', fallback: (...argv) => `fb:${argv.join(',')}` },
      ['my-work-unit']
    );
    assert.strictEqual(out, 'fb:my-work-unit\n');
  });

  it('an inherited Object.prototype name is not a verb — it falls through to fallback', () => {
    for (const inherited of ['toString', 'constructor', 'hasOwnProperty', 'valueOf']) {
      const out = captureRun(
        { index: () => '', view: (wu) => `view:${wu}`, fallback: (...argv) => `fb:${argv.join(',')}` },
        [inherited, 'x']
      );
      assert.strictEqual(out, `fb:${inherited},x\n`, `${inherited} must not dispatch to the inherited method`);
    }
  });

  it('with no fallback, an inherited name is an unknown-verb usage error — never [object Object]', () => {
    const { spawnSync } = require('child_process');
    const gw = require.resolve('../../skills/workflow-engine/scripts/gateway.cjs');
    const res = spawnSync(
      'node',
      ['-e', `require(${JSON.stringify(gw)}).runGateway({ view: (w) => 'v:' + w }, ['toString']);`],
      { encoding: 'utf8' }
    );
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.match(res.stderr, /unknown verb "toString"/);
  });

  it('missing index handler on a no-args call throws', () => {
    assert.throws(() => captureRun({ data: () => '' }, []), /no `index` handler/);
  });

  it('output always ends with exactly one newline', () => {
    const out = captureRun({ index: () => 'X\n\n\n' }, []);
    assert.strictEqual(out, 'X\n');
  });
});

describe('gateway: output sections', () => {
  it('dataBlock renders objects as key: value lines, nested values as JSON', () => {
    const block = dataBlock({ count: 2, flags: { a: true }, name: 'wu' });
    assert.strictEqual(
      block,
      SECTION.data + '\ncount: 2\nflags: {"a":true}\nname: wu\n'
    );
  });

  it('dataBlock passes strings through', () => {
    assert.strictEqual(dataBlock('raw'), SECTION.data + '\nraw\n');
  });

  it('dataBlock opens on the same DATA marker a render surface draws', () => {
    assert.strictEqual(dataBlock('raw'), dataSection(['raw']));
  });

  it('titleBlock draws the same TITLE section a render surface draws', () => {
    assert.strictEqual(titleBlock('Workflow Start'), titleSection('Workflow Start'));
    assert.ok(titleBlock('Workflow Start').startsWith(SECTION.title + '\n'));
  });

  it('displayBlock and menuBlock demarcate and trim trailing newlines', () => {
    assert.strictEqual(displayBlock('TREE\n\n'), SECTION.display + '\nTREE\n');
    assert.strictEqual(menuBlock('MENU'), SECTION.menu + '\nMENU\n');
  });

  it('an empty menu is no gate — menuBlock renders no section, not an empty marker', () => {
    assert.strictEqual(menuBlock(''), '');
    assert.strictEqual(menuBlock('\n\n'), '');
  });

  it('sections compose into one demarcated stdout payload', () => {
    const out = [dataBlock({ k: 1 }), displayBlock('D'), menuBlock('M')].join('\n');
    const idx = (s) => out.indexOf(s);
    assert.ok(idx(SECTION.data) < idx(SECTION.display));
    assert.ok(idx(SECTION.display) < idx(SECTION.menu));
  });
});

// A MENU is a live gate at the call that returns it. The `!` insert runs as
// the skill loads, before any step shows anything, so a gate it carried would
// be one no step ever shows — every insert the skills declare is run over a
// world holding active and closed work of every type.
describe('gateway: a head-of-skill insert is never a gate', () => {
  const SKILLS = path.join(__dirname, '../../skills');
  const INSERT = /^!`node \.claude\/skills\/(.+?)`$/gm;
  const inserts = fs.readdirSync(SKILLS).flatMap((skill) => {
    const file = path.join(SKILLS, skill, 'SKILL.md');
    if (!fs.existsSync(file)) return [];
    return [...fs.readFileSync(file, 'utf8').matchAll(INSERT)].map((m) => ({ skill, argv: m[1].split(' ') }));
  });

  let dir;
  beforeEach(() => {
    dir = setupFixture();
    const items = (phase, name, status) => ({ [phase]: { items: { [name]: { status } } } });
    for (const [type, phase] of [['epic', 'discussion'], ['feature', 'discussion'], ['bugfix', 'investigation'], ['quick-fix', 'scoping'], ['cross-cutting', 'discussion']]) {
      createManifest(dir, `live-${type}`, { work_type: type, phases: items(phase, type === 'epic' ? 'auth' : `live-${type}`, 'in-progress') });
      createManifest(dir, `done-${type}`, { work_type: type, status: 'completed', phases: items(phase, type === 'epic' ? 'auth' : `done-${type}`, 'completed') });
    }
    createFile(dir, '.workflows/.inbox/ideas/2026-05-01--an-idea.md', '# An idea\n');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('finds the inserts it guards', () => {
    assert.ok(inserts.length > 0, 'no head insert found — the scan would pass vacuously');
  });

  for (const { skill, argv } of inserts) {
    it(`${skill}: the insert answers without a MENU section`, () => {
      const res = spawnSync('node', [path.join(SKILLS, argv[0]), ...argv.slice(1)], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 0, res.stderr);
      assert.ok(res.stdout.trim().length > 0, 'the insert answered nothing');
      assert.doesNotMatch(res.stdout, /^=== MENU/m);
    });
  }
});

// A context-refresh recovery reads state and announces the position; the gate
// the flow resumes at is fetched by the step that shows it, once the position
// is confirmed. Every command a recovery names — a full `node .claude/skills/…`
// call, or an `engine render` shorthand — is run over a world holding each
// phase's item at the placeholder address, in the states a gate would be owed
// over: an undecided subtopic beside a decided one (the defer gate), threads
// on the research register, several live experiments (the record pick),
// agents in flight, a baseline mid-assessment, and a roadmap with waiting
// items.
describe('a context-refresh recovery fetches no gate', () => {
  const SKILLS = path.join(__dirname, '../../skills');
  const COMMAND = /node \.claude\/skills\/\S+(?: [^`\n]+)?|\bengine render [^`\n]+/g;
  const recoveries = fs.readdirSync(SKILLS).flatMap((skill) => {
    const file = path.join(SKILLS, skill, 'SKILL.md');
    if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, 'utf8');
    const at = text.indexOf('\n## Resuming After Context Refresh\n');
    if (at === -1) return [];
    const section = text.slice(at, text.indexOf('\n---\n', at));
    return [...section.matchAll(COMMAND)].map((m) => ({ skill, command: m[0].trim() }));
  });

  const ENGINE = path.join(SKILLS, 'workflow-engine/scripts/engine.cjs');

  let dir;
  beforeEach(() => {
    dir = setupFixture();
    createFile(dir, '.workflows/manifest.json', JSON.stringify({
      baseline: { status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'pending' } },
      roadmap: {
        horizons: ['mvp', 'v1'],
        items: {
          menus: { horizon: 'mvp', summary: 'operators maintain', origin: 'harvest' },
          loyalty: { horizon: 'v1', summary: 'rewards', origin: 'park:wu' },
        },
      },
    }));
    createManifest(dir, 'wu', {
      work_type: 'epic',
      phases: {
        research: { items: { t: { status: 'in-progress', threads: {
          'cart-persistence': { question: 'Does the cart survive a session?', status: 'open', origin: 'seed', parent: null },
        } } } },
        experiment: { items: { t: { status: 'in-progress', experiments: {
          E1: { slug: 'cold-start', status: 'running' },
          E2: { slug: 'warm-cache', status: 'designed' },
        } } } },
        discussion: { items: { t: { status: 'in-progress', subtopics: {
          'token-refresh': { status: 'exploring', parent: null },
          'session-storage': { status: 'decided', parent: null },
        } } } },
        specification: { items: { t: { status: 'in-progress', finding_gate_mode: 'gated' } } },
        planning: { items: { t: { status: 'in-progress' } } },
        implementation: { items: { t: { status: 'in-progress' } } },
      },
    });
    for (const [phase, kind] of [['discussion', 'review'], ['research', 'deep-dive']]) {
      const res = spawnSync('node', [ENGINE, 'agent', 'dispatch', 'wu', phase, 't', '--kind', kind], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 0, res.stderr);
    }
  });
  afterEach(() => { cleanupFixture(dir); });

  it('finds the recoveries it guards', () => {
    assert.ok(recoveries.length > 0, 'no recovery command found — the scan would pass vacuously');
  });

  it('the world holds what a gate would be owed over', () => {
    const map = spawnSync('node', [path.join(SKILLS, 'workflow-discussion-process/scripts/gateway.cjs'), 'map', 'wu', 't'], { cwd: dir, encoding: 'utf8' });
    assert.match(map.stdout, /^all_decided: false$/m);
    assert.match(map.stdout, /^unresolved: \["token-refresh"\]$/m);
    const defer = spawnSync('node', [ENGINE, 'render', 'defer-gate', 'wu.discussion.t'], { cwd: dir, encoding: 'utf8' });
    assert.match(defer.stdout, /^=== MENU: defer gate/m, 'a defer gate is owed over this map — the recovery read must not carry it');
    const pick = spawnSync('node', [ENGINE, 'render', 'experiment-pick', 'wu.experiment.t'], { cwd: dir, encoding: 'utf8' });
    assert.match(pick.stdout, /^=== MENU/m, 'a record pick is owed over this series — the recovery register must not carry it');
    for (const phase of ['discussion', 'research']) {
      const scan = spawnSync('node', [ENGINE, 'agent', 'scan', 'wu', phase, 't'], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(JSON.parse(scan.stdout).in_flight.length, 1, `${phase}: an agent is in flight`);
    }
  });

  for (const { skill, command } of recoveries) {
    it(`${skill}: \`${command}\` answers without a MENU section`, () => {
      const argv = command
        .replace(/^engine render /, 'node .claude/skills/workflow-engine/scripts/engine.cjs render ')
        .replaceAll('{work_unit}', 'wu')
        .replaceAll('{topic}', 't')
        .split(' ');
      const script = path.join(SKILLS, argv[1].replace('.claude/skills/', ''));
      const res = spawnSync('node', [script, ...argv.slice(2)], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 0, res.stderr);
      assert.doesNotMatch(res.stdout, /^=== MENU/m);
    });
  }
});

// A menu's answer resolves from DATA, never from the menu's text: a pressed
// row may send only its word, or its key where it has none. Every gateway
// view whose menu an `ACTIONS` table routes is run over a world where each
// offers its rows, and every row it offers must name an entry by both.
describe('an ACTIONS table resolves every row its MENU offers', () => {
  const SKILLS = path.join(__dirname, '../../skills');

  /** @param {string} dir */
  function projectManifest(dir) {
    createFile(dir, '.workflows/manifest.json', JSON.stringify({
      baseline: { status: 'in-progress', areas: {} },
      roadmap: { horizons: ['mvp'], items: { loyalty: { horizon: 'mvp', summary: 'repeat-customer rewards', origin: 'harvest' } } },
    }));
    createManifest(dir, 'done-feature', { status: 'completed', phases: { discussion: { items: { 'done-feature': { status: 'completed' } } } } });
    createFile(dir, '.workflows/.inbox/ideas/2026-05-01--an-idea.md', '# An idea\n');
  }

  /** @param {string} unit @param {string} type @param {string} earlier @param {string} next */
  function linearUnit(dir, unit, type, earlier, next) {
    createManifest(dir, unit, {
      work_type: type,
      phases: { [earlier]: { items: { [unit]: { status: 'completed' } } }, [next]: { items: { [unit]: { status: 'in-progress' } } } },
    });
  }

  // Every unit mid-flight with an earlier phase to revisit; the epic holds a
  // cancelled topic, a plan blocked on a dependency, a concluded
  // specification and a proposed grouping, so each of its sub-views offers
  // rows.
  const WORLDS = {
    live: (/** @type {string} */ dir) => {
      projectManifest(dir);
      createManifest(dir, 'live-epic', {
        work_type: 'epic',
        phases: {
          discovery: { items: { gone: { routing: 'discussion', source: 'discovery', cancelled: true } } },
          research: { items: { kitchen: { status: 'completed' } } },
          discussion: { items: {
            auth: { status: 'in-progress' },
            billing: { status: 'completed' },
            payments: { status: 'completed' },
            gone: { status: 'cancelled', previous_status: 'in-progress' },
          } },
          specification: { items: {
            billing: { status: 'completed', sources: { billing: { status: 'incorporated' } } },
            payments: { status: 'proposed', sources: { payments: { status: 'pending' } } },
          } },
          planning: { items: { billing: { status: 'completed', external_dependencies: { auth: { description: 'd', state: 'unresolved' } } } } },
        },
      });
      createFile(dir, '.workflows/live-epic/specification/billing/specification.md', '# Billing\n');
      linearUnit(dir, 'live-feature', 'feature', 'research', 'discussion');
      linearUnit(dir, 'live-bugfix', 'bugfix', 'investigation', 'specification');
      linearUnit(dir, 'live-quickfix', 'quick-fix', 'scoping', 'implementation');
      linearUnit(dir, 'live-policy', 'cross-cutting', 'research', 'discussion');
    },
    // No active work: the start view's empty state, every conditional row on.
    quiet: projectManifest,
  };

  /** @type {[string, string[], keyof typeof WORLDS][]} */
  const CALLS = [
    ['workflow-start', ['view'], 'live'],
    ['workflow-start', ['view'], 'quiet'],
    ['workflow-start', ['manage', 'live-feature'], 'live'],
    ['workflow-continue-epic', ['view', 'live-epic'], 'live'],
    ['workflow-continue-epic', ['completed-menu', 'live-epic'], 'live'],
    ['workflow-continue-epic', ['cancel-menu', 'live-epic'], 'live'],
    ['workflow-continue-epic', ['reactivate-menu', 'live-epic'], 'live'],
    ['workflow-continue-epic', ['unblock-menu', 'live-epic'], 'live'],
    ['workflow-continue-feature', ['view', 'live-feature'], 'live'],
    ['workflow-continue-bugfix', ['view', 'live-bugfix'], 'live'],
    ['workflow-continue-quickfix', ['view', 'live-quickfix'], 'live'],
    ['workflow-continue-cross-cutting', ['view', 'live-policy'], 'live'],
    ['workflow-specification-entry', ['view', 'live-epic'], 'live'],
    ['workflow-specification-entry', ['completed-menu', 'live-epic'], 'live'],
    ['workflow-roadmap', ['view'], 'live'],
  ];

  /** @param {string} out @param {string} marker @returns {string} */
  function sectionOf(out, marker) {
    const at = out.indexOf(`=== ${marker}`);
    if (at === -1) return '';
    const body = out.slice(out.indexOf('\n', at) + 1);
    const end = body.search(/^=== /m);
    return end === -1 ? body : body.slice(0, end);
  }

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  for (const [skill, argv, world] of CALLS) {
    it(`${skill} ${argv.join(' ')} over the ${world} world: every row resolves by its key and its word`, () => {
      WORLDS[world](dir);
      const res = spawnSync('node', [path.join(SKILLS, skill, 'scripts/gateway.cjs'), ...argv], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 0, res.stderr);
      const heads = [...sectionOf(res.stdout, 'MENU').matchAll(/^\*\*`(?!◆ )([^`]+)`\*\*/gm)].map((m) => m[1]);
      assert.ok(heads.length > 0, `the world offers no row — the check would pass vacuously:\n${res.stdout}`);
      const lines = sectionOf(res.stdout, 'DATA').split('\n');
      const start = lines.findIndex((l) => l.startsWith('ACTIONS (key  word  '));
      assert.ok(start !== -1, `no ACTIONS table leading with key and word:\n${res.stdout}`);
      const entries = [];
      for (const line of lines.slice(start + 1)) {
        if (!line.startsWith('  ')) break;
        entries.push(line.trim().split('  '));
      }
      for (const head of heads) {
        const [key, word = '—'] = head.split(/\/(.*)/s);
        assert.ok(entries.some(([k, w]) => k === key && w === word), `row \`${head}\` names no ACTIONS entry by key "${key}" and word "${word}":\n${res.stdout}`);
      }
    });
  }
});

describe('lib: ring aggregation', () => {
  it('exposes kernel render, domain conventions, and the gateway', () => {
    assert.strictEqual(typeof lib.render.renderTree, 'function');
    assert.strictEqual(typeof lib.render.wrapWithPrefix, 'function');
    assert.strictEqual(typeof lib.conventions.title, 'function');
    assert.strictEqual(typeof lib.gateway.runGateway, 'function');
  });
});
