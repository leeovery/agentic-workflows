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

describe('lib: ring aggregation', () => {
  it('exposes kernel render, domain conventions, and the gateway', () => {
    assert.strictEqual(typeof lib.render.renderTree, 'function');
    assert.strictEqual(typeof lib.render.wrapWithPrefix, 'function');
    assert.strictEqual(typeof lib.conventions.title, 'function');
    assert.strictEqual(typeof lib.gateway.runGateway, 'function');
  });
});
