'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DOTS, section, timedInstruction, STOP_CLAUSE, CONTINUE_CLAUSE, AUTO_GATE_CLAUSE, menuFrame, menu, cmdOption, bareOption, promptOption, rangeOption, callout, indentedBody, bulletRow, subDetail, treeList } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { auditingRender } = require('./gate-audit.cjs');
const { setupFixture, cleanupFixture } = require('./discovery-test-utils.cjs');

const renderSurface = auditingRender(require('../../skills/workflow-engine/scripts/domain/render.cjs').renderSurface);

// Worklist leading indents are non-breaking spaces (a 4-space lead is a code
// block to a markdown renderer) — goldens spell them explicitly.
const NB = (n) => '\u00a0'.repeat(n);

// Reverse the menu label wrap for wording asserts: a continuation joins its
// previous line with the single space the break replaced. Exact only for
// labels with no markup spanning the break \u2014 layout itself is covered by
// the byte-exact pins.
const unwrap = (s) => s.replace(/\n\u00a0+/g, ' ');

/** A string matched literally inside a regular expression. */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function setup() {
  return setupFixture('render-surfaces-');
}
function teardown(dir) {
  cleanupFixture(dir);
}
function writeManifest(dir, name, data) {
  const mdir = path.join(dir, '.leeway', name);
  fs.mkdirSync(mdir, { recursive: true });
  fs.writeFileSync(path.join(mdir, 'manifest.json'), JSON.stringify({
    name, work_type: 'epic', status: 'in-progress', description: 'Test', phases: {}, ...data,
  }, null, 2));
}
function writePayload(dir, rel, obj) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return rel;
}

describe('cancel-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('a never-started topic: only the map row is marked', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { 'data-export': { routing: 'discussion', source: 'discovery' } } } },
    });
    const out = renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.data-export' });
    assert.match(out, /MENU: cancel gate/);
    assert.match(unwrap(out), /Cancelling \*\*Data Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    assert.match(out, /◆ Cancel it\?/);
    assert.match(out, /\*\*`y\/yes`\*\* → Confirm cancellation/);
    assert.match(out, /\*\*`n\/no`\*\*  → Keep it/);
  });

  it('a started topic: the items by phase, the open records that end abandoned, the proposed groupings discarded', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'research', source: 'discovery' } } },
        research: { items: { auth: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress', awaiting_experiments: ['E2'] } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: {
          E1: { slug: 'a', status: 'concluded', verdict: 'held' },
          E2: { slug: 'b', status: 'running' },
          'E2.1': { slug: 'c', status: 'conceived' },
        } } } },
        specification: { items: {
          grp: { status: 'proposed', sources: { auth: { status: 'pending' } } },
          other: { status: 'proposed', sources: { auth: { status: 'pending' } } },
          dead: { status: 'cancelled', sources: { auth: { status: 'pending' } } },
        } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }));
    assert.match(out, /Cancelling \*\*Auth\*\* marks its research \[completed\] and discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E2, with E2\.1\) ends abandoned on the register\. The proposed groupings \*\*Grp\*\* and \*\*Other\*\* are discarded — the next grouping analysis rebuilds from the new world\./);
    assert.ok(!out.includes('Dead'), 'a cancelled specification is neither a lock nor a discard');
  });

  it('experiments count top-level — a split is named with its parent, and a sub-record whose parent closed stands alone', () => {
    const series = (experiments) => writeManifest(dir, 'pay', {
      phases: {
        discussion: { items: { auth: { status: 'in-progress' } } },
        experiment: { items: { auth: { status: 'in-progress', experiments } } },
      },
    });
    series({ E1: { slug: 'a', status: 'running' }, E2: { slug: 'b', status: 'running' }, 'E2.1': { slug: 'c', status: 'conceived' }, 'E2.2': { slug: 'd', status: 'designed' } });
    assert.match(unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' })), /2 open experiments \(E1, E2 with E2\.1, E2\.2\) end abandoned on the register\./);
    series({ E1: { slug: 'a', status: 'concluded', verdict: 'held' }, 'E1.1': { slug: 'c', status: 'running' } });
    assert.match(unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' })), /1 open experiment \(E1\.1\) ends abandoned on the register\./);
  });

  it('refuses a unit with nothing to cancel — an off-map topic whose only item is superseded, a specification carrying no status', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { legacy: { status: 'superseded', superseded_by: 'other' } } },
        specification: { items: { blank: { sources: {} } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.legacy' }),
      /"legacy" has nothing to cancel — no live item under its name and no map row, so the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.blank' }),
      /"blank" has nothing to cancel — it carries no status, so the menu never offers it/);
  });

  it('a single item, a single open record: singular wording, no discard clause', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { auth: { status: 'unstarted' } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: { E1: { slug: 'a', status: 'running' } } } } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }));
    assert.match(out, /Cancelling \*\*Auth\*\* marks its research \[unstarted\] cancelled — it can be reactivated later\. 1 open experiment \(E1\) ends abandoned on the register\./);
    assert.ok(!out.includes('discarded'), out);
  });

  it('a specification: the plan and the source discussions it frees', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discussion: { items: { auth: { status: 'completed' }, roles: { status: 'completed' } } },
        specification: { items: { unified: { status: 'in-progress', sources: { auth: { status: 'incorporated' }, roles: { status: 'pending' } } } } },
        planning: { items: { unified: { status: 'in-progress' } } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.unified' }));
    assert.match(out, /Cancelling \*\*Unified\*\* marks the specification and its plan cancelled and frees its source discussions \(Auth, Roles\) to be regrouped or cancelled; it can be reactivated later\./);
  });

  it('a specification with no plan and no sources names neither', () => {
    writeManifest(dir, 'pay', {
      phases: { specification: { items: { unified: { status: 'completed' } } } },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.unified' }));
    assert.match(out, /Cancelling \*\*Unified\*\* marks the specification cancelled; it can be reactivated later\./);
  });

  it('refuses what the menu never offers — locked, cancelled, proposed — and a non-unit address', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: {
          gone: { routing: 'discussion', source: 'discovery', cancelled: true },
          away: { routing: 'discussion', source: 'discovery', postponed: true },
        } },
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: {
          unified: { status: 'in-progress', sources: { auth: { status: 'incorporated' } } },
          grp: { status: 'proposed', sources: {} },
          shipped: { status: 'completed', sources: {} },
          done: { status: 'promoted', sources: {} },
        } },
        implementation: { items: { shipped: { status: 'in-progress' } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }),
      /"auth" is locked by the specification sourcing its discussion \("unified"\) — the menu never offers it/);
    writeManifest(dir, 'moved', {
      phases: {
        discussion: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc' } } },
        specification: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc', sources: { fees: { status: 'incorporated' } } } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'moved.discovery.fees' }),
      /"fees" is locked by the specification sourcing its discussion \("fees" \(promoted to "fees-cc"\)\) — the menu never offers it/,
      'a promoted topic locks as a started one does — never "nothing has started"');
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'moved.discovery.fees', horizon: 'v2' }),
      /postponing "fees" is refused while the specification "fees" \(promoted to "fees-cc"\) sources its discussion — a topic past specification is past "not yet"/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.gone' }),
      /"gone" is already cancelled — the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.away' }),
      /"away" is postponed — the roadmap owns it; remove its item there to cancel it, or pull it forward first/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.ghost' }),
      /no topic "ghost" — nothing on the map and no research or discussion item of that name/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.shipped' }),
      /"shipped" is locked — implementation has started, so the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.grp' }),
      /"grp" is a proposed grouping — not started, so the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.done' }),
      /"done" is promoted — the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.ghost' }),
      /no specification item "ghost"/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discussion.auth' }),
      /address must be <work_unit>\.discovery\.<topic> or <work_unit>\.specification\.<spec>, got phase "discussion"/);
  });
});

describe('postpone-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {object|null} roadmap */
  function writeProject(roadmap) {
    fs.mkdirSync(path.join(dir, '.leeway'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'),
      JSON.stringify(roadmap === null ? { work_units: {} } : { work_units: {}, roadmap }, null, 2));
  }

  const LIVE = {
    phases: {
      discovery: { items: { auth: { routing: 'research', source: 'discovery', summary: 'Auth flow' } } },
      research: { items: { auth: { status: 'completed' } } },
      discussion: { items: { auth: { status: 'in-progress' } } },
    },
  };

  it('a never-started topic with no roadmap: the row alone, and the map is created with it', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { 'data-export': { routing: 'discussion', source: 'discovery' } } } },
    });
    const out = renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.data-export', horizon: 'next' });
    assert.match(out, /MENU: postpone gate/);
    assert.match(unwrap(out), /Postponing \*\*Data Export\*\* sets it aside — nothing has started, so only the map row is marked\. It waits on the roadmap under "next", until it is pulled into work\. The roadmap is created with it\./);
    assert.match(out, /◆ Postpone it\?/);
    assert.match(out, /\*\*`y\/yes`\*\*   → Postpone it/);
    assert.match(out, /\*\*`n\/no`\*\*    → Keep it here/);
    assert.match(out, /\*\*Comment\*\* → Tell me what to change \(the horizon\)/);
    assert.ok(!out.includes('(new)'), 'the map\'s own birth already says the horizon is new');
  });

  it('a started topic: the items by phase, the groupings discarded, the horizon flagged new over an existing map', () => {
    writeProject({ horizons: ['mvp'], items: { other: { horizon: 'mvp', summary: 's', origin: 'harvest' } } });
    writeManifest(dir, 'pay', {
      phases: {
        ...LIVE.phases,
        specification: { items: {
          grp: { status: 'proposed', sources: { auth: { status: 'pending' } } },
          other: { status: 'proposed', sources: { auth: { status: 'pending' } } },
        } },
      },
    });
    const out = unwrap(renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth', horizon: 'v2' }));
    assert.match(out, /Postponing \*\*Auth\*\* marks its research \[completed\] and discussion \[in-progress\] postponed — its record stays on disk and comes back with the pull\. The proposed groupings \*\*Grp\*\* and \*\*Other\*\* are discarded — the next grouping analysis rebuilds from the new world\. It waits on the roadmap under "v2" \(new\), until it is pulled into work\./);
    assert.ok(!out.includes('The roadmap is created with it.'), 'the map exists — only its horizon is new');
  });

  it('a topic the roadmap already sent here: its own item re-waits, whatever the item is named', () => {
    writeProject({
      horizons: ['mvp', 'v2'],
      items: { ordering: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'pay', topic: 'auth' } } },
    });
    writeManifest(dir, 'pay', LIVE);
    const out = unwrap(renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth', horizon: 'v2' }));
    assert.match(out, /Its own item \*\*Ordering\*\* re-waits under "v2"\./);
    assert.ok(!out.includes('It waits on the roadmap under'), 'a re-wait is not a birth');
  });

  it('every lock refuses at the gate, so a locked unit is met at the confirm', () => {
    writeProject({ horizons: ['mvp'], items: { auth: { horizon: 'mvp', summary: 'somebody else\'s', origin: 'harvest' } } });
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: {
          auth: { routing: 'research', source: 'discovery' },
          gone: { routing: 'discussion', source: 'discovery', cancelled: true },
          away: { routing: 'discussion', source: 'discovery', postponed: true },
          dead: { routing: 'research', source: 'discovery', handled: true },
          locked: { routing: 'discussion', source: 'discovery' },
          busy: { routing: 'discussion', source: 'discovery' },
        } },
        research: { items: { dead: { status: 'completed' } } },
        discussion: { items: {
          auth: { status: 'in-progress' },
          locked: { status: 'completed' },
          busy: { status: 'in-progress' },
        } },
        experiment: { items: { busy: { status: 'in-progress', experiments: {
          E1: { slug: 'a', status: 'concluded', verdict: 'held' },
          E2: { slug: 'b', status: 'running' },
          'E2.1': { slug: 'c', status: 'conceived' },
        } } } },
        specification: { items: { unified: { status: 'in-progress', sources: { locked: { status: 'incorporated' } } } } },
      },
    });
    const gate = (topic) => renderSurface(dir, 'postpone-gate', { dotpath: `pay.discovery.${topic}`, horizon: 'mvp' });
    assert.throws(() => gate('ghost'), /render postpone-gate: no topic "ghost" — nothing on the map and no research or discussion item of that name/);
    assert.throws(() => gate('away'), /render postpone-gate: "away" is already postponed — it waits on the roadmap/);
    assert.throws(() => gate('gone'), /render postpone-gate: "gone" is cancelled — reactivate it from the epic menu first/);
    assert.throws(() => gate('dead'), /render postpone-gate: "dead" is closed as a dead end — reopen it first/);
    assert.throws(() => gate('locked'), /render postpone-gate: postponing "locked" is refused while the specification "unified" sources its discussion — a topic past specification is past "not yet"/);
    assert.throws(() => gate('busy'), /render postpone-gate: postponing "busy" is refused while an experiment is live \(E2, with E2\.1\) — conclude or abandon it first; a laboratory cannot run under a topic that has left the epic/);
    assert.throws(() => gate('auth'), /render postpone-gate: a roadmap item named "auth" \(horizon "mvp"\) is not this topic's — rename or remove it on the roadmap first/);
  });

  it('refuses a dead address, a non-Discovery address, a missing horizon, and one the roadmap could not name', () => {
    writeManifest(dir, 'pay', LIVE);
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth', horizon: 'v2.1' }),
      /render postpone-gate: "v2\.1" is not a legal horizon name — dots and slashes break manifest addressing/);
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth', horizon: 'v2/1' }),
      /render postpone-gate: "v2\/1" is not a legal horizon name — dots and slashes break manifest addressing/);
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discussion.auth', horizon: 'mvp' }),
      /render postpone-gate: address must be <work_unit>\.discovery\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'ghost.discovery.auth', horizon: 'mvp' }),
      /render postpone-gate: work unit "ghost" not found/);
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth' }),
      /render postpone-gate: --horizon is required/);
    assert.throws(() => renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth', horizon: '  ' }),
      /render postpone-gate: --horizon is required/);
  });
});

describe('topic-receipt — the postpone verb', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  function writeWorld(postponed) {
    fs.mkdirSync(path.join(dir, '.leeway'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        ordering: { horizon: 'next', summary: 's', origin: 'postpone:pay', postponed_from: { work_unit: 'pay', topic: 'auth' } },
      } },
    }, null, 2));
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'discussion', source: 'discovery', ...(postponed ? { postponed: true } : {}) } } },
        discussion: { items: { auth: { status: postponed ? 'postponed' : 'in-progress', ...(postponed ? { previous_status: 'in-progress' } : {}) } } },
      },
    });
  }

  it('names the horizon the topic waits under, the removal advisory riding --warn', () => {
    writeWorld(true);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'postpone' }),
      /Postponed "Auth" → next\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'postpone', warn: '1' }),
      /⚑ Knowledge removal warning[\s\S]*Postponed "Auth" → next\.\n/);
  });

  it('refuses a topic that is not postponed, a non-Discovery address, and a dead name', () => {
    writeWorld(false);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'postpone' }),
      /"auth" is not postponed — the postpone has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discussion.auth', verb: 'postpone' }),
      /--verb postpone addresses the Discovery unit — <work_unit>\.discovery\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.ghost', verb: 'postpone' }),
      /no topic "ghost" — nothing on the map and no research or discussion item of that name/);
  });
});

describe('topic-receipt — the supersede verb', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        specification: { items: { old: { status: 'superseded', superseded_by: 'unified' }, unified: { status: 'completed' } } },
        discussion: { items: { old: { status: 'completed' } } },
      },
    });
  });
  afterEach(() => { teardown(dir); });

  it('renders the knowledge removal advisory over a superseded specification, empty without --warn', () => {
    assert.strictEqual(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.old', verb: 'supersede' }), '');
    assert.strictEqual(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.old', verb: 'supersede', warn: '1' }), [
      '=== DISPLAY: kb warning (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '  ⚑ Knowledge removal warning',
      '    The spec is superseded. The next start removes its chunks from the knowledge base.',
      '',
    ].join('\n'));
  });

  it('refuses a specification the supersede has not reached, and any other phase', () => {
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.unified', verb: 'supersede', warn: '1' }),
      /"unified" is not superseded — the supersede has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.ghost', verb: 'supersede' }),
      /"ghost" is not superseded — the supersede has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discussion.old', verb: 'supersede' }),
      /--verb supersede addresses a specification — <work_unit>\.specification\.<spec>, got phase "discussion"/);
  });
});

describe('topic-receipt — the restore verb', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('names the statuses the pull forward returned the unit to, the indexing advisory riding --warn', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'discussion', source: 'discovery' }, fresh: { routing: 'research', source: 'discovery' } } },
        research: { items: { auth: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'restore' }),
      /Pulled "Auth" forward\. Restored research \[completed\] · discussion \[in-progress\]\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'restore', warn: '1' }),
      /⚑ Knowledge indexing warning[\s\S]*Pulled "Auth" forward\./);
    // A topic that never started comes back with nothing to name.
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.fresh', verb: 'restore' }),
      /Pulled "Fresh" forward\.\n/);
  });

  it('refuses a topic still postponed, a non-Discovery address, and a dead name', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'discussion', source: 'discovery', postponed: true } } },
        discussion: { items: { auth: { status: 'postponed', previous_status: 'in-progress' } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'restore' }),
      /"auth" is still postponed — the pull forward has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discussion.auth', verb: 'restore' }),
      /--verb restore addresses the Discovery unit — <work_unit>\.discovery\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.ghost', verb: 'restore' }),
      /no topic "ghost" — nothing on the map and no research or discussion item of that name/);
  });
});

describe('topic-receipt — the unit addresses', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('cancel and reactivate read the unit; a never-started topic restores nothing', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { gone: { routing: 'discussion', source: 'discovery', cancelled: true }, back: { routing: 'discussion', source: 'discovery' } } },
        research: { items: { back: { status: 'completed' } } },
        discussion: { items: { back: { status: 'in-progress' } } },
        specification: { items: { spec: { status: 'cancelled', previous_status: 'completed' }, live: { status: 'completed' } } },
        planning: { items: { live: { status: 'in-progress' } } },
      },
    });
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.gone', verb: 'cancel' }), /Cancelled "Gone"\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'reactivate' }),
      /Reactivated "Back"\. Restored research \[completed\] · discussion \[in-progress\]\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.spec', verb: 'cancel', warn: '1' }),
      /⚑ Knowledge removal warning[\s\S]*Cancelled "Spec"\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.live', verb: 'reactivate' }),
      /Reactivated "Live"\. Restored specification \[completed\] · planning \[in-progress\]\.\n/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'cancel' }), /"back" is not cancelled — the cancel has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.spec', verb: 'reactivate' }), /"spec" is still cancelled — the reactivate has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.back', verb: 'reactivate' }),
      /--verb reactivate addresses a unit — <work_unit>\.discovery\.<topic> or <work_unit>\.specification\.<spec>, got phase "research"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.ghost', verb: 'cancel' }), /no topic "ghost"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.ghost', verb: 'cancel' }), /no specification item "ghost"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'bogus' }), /--verb must be complete, supersede, cancel, reactivate, postpone, or restore/);
  });

  it('complete keeps its phase-item address', () => {
    writeManifest(dir, 'pay', { phases: { research: { items: { back: { status: 'completed' } } } } });
    assert.strictEqual(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.back', verb: 'complete' }), '');
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.back', verb: 'complete', warn: '1' }), /Knowledge indexing warning/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.ghost', verb: 'complete' }), /no research item "ghost"/);
  });
});

describe('the experiment surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {object} experiments */
  function labWith(experiments) {
    writeManifest(dir, 'lab', {
      phases: { experiment: { items: { timing: { status: 'in-progress', experiments } } } },
    });
  }

  it('renders the empty register with the none-yet line — no caller branch needed', () => {
    labWith({});
    const out = renderSurface(dir, 'experiment-register', { dotpath: 'lab.experiment.timing' });
    assert.match(out, /=== DISPLAY: experiment register \(emit verbatim as a text code block \(```text fence\) — do not stop; continue as the workflow instructs\) ===/);
    assert.match(out, /Experiments — Timing \(0 experiments\)/);
    assert.match(out, /\(none yet — the series starts at E1\)/);
  });

  it('tags live rows, spells terminal state on the ↳ line, and gaps top-level siblings', () => {
    labWith({
      E1: { slug: 'window-placement', status: 'concluded', verdict: 'all layouts placed; adopted' },
      E2: { slug: 'multi-monitor', status: 'abandoned', reason: 'question dissolved' },
      E3: { slug: 'focus-order', status: 'running' },
    });
    const out = renderSurface(dir, 'experiment-register', { dotpath: 'lab.experiment.timing' });
    assert.match(out, /Experiments — Timing \(3 experiments\)/);
    assert.match(out, / {2}├─ E1 window-placement\n {2}│ {5}↳ Concluded — all layouts placed; adopted/);
    assert.match(out, /↳ Abandoned — question dissolved/);
    assert.match(out, /└─ E3 focus-order\s+\[running\]/, 'a live row keeps the status tag');
    assert.ok(!/\[concluded\]/.test(out) && !/\[abandoned\]/.test(out), 'a body-bearing row drops the tag column');
    assert.match(out, / {2}│\n {2}├─ E2/, 'top-level rows gap with a gutter-only line');
  });

  it('nests sub-experiments under their parent, id order', () => {
    labWith({
      E1: { slug: 'window-placement', status: 'running' },
      'E1.2': { slug: 'multi-monitor', status: 'conceived' },
      'E1.1': { slug: 'single-monitor', status: 'concluded', verdict: 'held' },
    });
    const out = renderSurface(dir, 'experiment-register', { dotpath: 'lab.experiment.timing' });
    assert.match(out, /Experiments — Timing \(3 experiments\)/);
    const e1 = out.indexOf('E1 window-placement');
    const e11 = out.indexOf('E1.1 single-monitor');
    const e12 = out.indexOf('E1.2 multi-monitor');
    assert.ok(e1 > -1 && e1 < e11 && e11 < e12, 'parent first, subs beneath in id order');
    assert.match(out, / {5}├─ E1\.1 single-monitor\n {5}│ {5}↳ Concluded — held/, 'subs nest inside the parent\'s rail');
    assert.match(out, /└─ E1\.2 multi-monitor\s+\[conceived\]/, 'a live sub keeps its tag');
  });

  it('refuses a wrong phase address and a topic with no series', () => {
    labWith({});
    assert.throws(() => renderSurface(dir, 'experiment-register', { dotpath: 'lab.discussion.timing' }),
      /address must be <work_unit>\.experiment\.<topic>/);
    assert.throws(() => renderSurface(dir, 'experiment-register', { dotpath: 'lab.experiment.ghost' }),
      /no experiment series for "ghost"/);
  });

  it('renders the approval gate over a designed record — commands first, the prompt last', () => {
    labWith({ E1: { slug: 'window-placement', status: 'designed' } });
    const out = renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1' });
    assert.match(out, /=== MENU: experiment approval gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /◆ Approve E1's design\?/);
    const a = out.indexOf('**`y/yes`**');
    const b = out.indexOf('**`b/abandon`**');
    const amend = out.indexOf('**Amend**');
    assert.ok(a > -1 && b > a && amend > b, 'command options lead, the prompt option closes');
    assert.match(unwrap(out), /Freeze the design and start measuring/);
    assert.ok(!out.includes('re-confirmed here'), 'the amendment-window explanation lives in prose, not the option label');
    assert.match(unwrap(out), /Abandon E1 — recorded with its reason; the register keeps the row/);
    assert.match(unwrap(out), /Tell me what to change — the design folds it in before the freeze/);
  });

  it('the approval gate serves a designed sub-experiment by its dotted id', () => {
    labWith({
      E1: { slug: 'window-placement', status: 'running' },
      'E1.1': { slug: 'single-monitor', status: 'designed' },
    });
    const out = renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1.1' });
    assert.match(out, /◆ Approve E1\.1's design\?/);
  });

  it('refuses a missing id, an unknown id, and every status but designed', () => {
    labWith({ E1: { slug: 'window-placement', status: 'running' } });
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing' }),
      /--id is required/);
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E9' }),
      /no experiment E9/);
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1' }),
      /E1 is "running", not designed — the briefing confirm follows the written design/);
  });

  it('renders the record picker byte-exactly — one row per live top-level record, keyed by its id, then back', () => {
    labWith({
      E1: { slug: 'window-placement', status: 'running' },
      'E1.1': { slug: 'single-monitor', status: 'designed' },
      E2: { slug: 'cold-start', status: 'concluded', verdict: 'held' },
      E3: { slug: 'warm-cache', status: 'conceived' },
    });
    assert.strictEqual(renderSurface(dir, 'experiment-pick', { dotpath: 'lab.experiment.timing' }), [
      "=== MENU: experiment pick (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which experiment?`**',
      '',
      '**`E1`**     → window-placement — *running*',
      '**`E3`**     → warm-cache — *conceived*',
      '**`b/back`** → Leave without picking one',
      '',
    ].join('\n'));
  });

  it('the picker refuses a wrong phase and a series with nothing live to pick', () => {
    labWith({ E1: { slug: 'window-placement', status: 'abandoned', reason: 'moot' } });
    assert.throws(() => renderSurface(dir, 'experiment-pick', { dotpath: 'lab.experiment.timing' }),
      /"timing"'s series holds no live experiments — there is nothing to pick/);
    assert.throws(() => renderSurface(dir, 'experiment-pick', { dotpath: 'lab.discussion.timing' }),
      /address must be <work_unit>\.experiment\.<topic>/);
  });

  it('the next gate names the live top-level records and offers next or menu', () => {
    labWith({
      E1: { slug: 'window-placement', status: 'concluded', verdict: 'held' },
      'E2.1': { slug: 'single-monitor', status: 'conceived' },
      E2: { slug: 'multi-monitor', status: 'running' },
      E3: { slug: 'focus-order', status: 'conceived' },
    });
    const out = renderSurface(dir, 'experiment-next-gate', { dotpath: 'lab.experiment.timing' });
    assert.match(out, /=== MENU: experiment next gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /The series still holds E2 multi-monitor, E3 focus-order\./,
      'the statement names the live ids — terminal rows and subs stay out');
    assert.match(out, /◆ Work the next experiment\?/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Work the next experiment/);
    assert.match(out, /\*\*`m\/menu`\*\*\s+→ Back to the menu/);
  });

  it('the next gate refuses a finished series and a wrong phase address', () => {
    labWith({
      E1: { slug: 'window-placement', status: 'concluded', verdict: 'held' },
      E2: { slug: 'multi-monitor', status: 'abandoned', reason: 'moot' },
    });
    assert.throws(() => renderSurface(dir, 'experiment-next-gate', { dotpath: 'lab.experiment.timing' }),
      /"timing"'s series holds no live experiments — the bridge exit follows a finished series/);
    assert.throws(() => renderSurface(dir, 'experiment-next-gate', { dotpath: 'lab.discussion.timing' }),
      /address must be <work_unit>\.experiment\.<topic>/);
  });
});

describe('experiment spawn gate + wait gate — the conversation\'s two pauses', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {string} phase @param {string[]} [awaiting] */
  function holderWith(phase, awaiting) {
    writeManifest(dir, 'lab', {
      phases: { [phase]: { items: { timing: { status: 'in-progress', ...(awaiting ? { awaiting_experiments: awaiting } : {}) } } } },
    });
  }

  it('renders the now-or-later choice over a recorded spawn, consequences named', () => {
    holderWith('research', ['E1']);
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.research.timing', id: 'E1' });
    assert.match(out, /=== MENU: experiment spawn gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /◆ Work E1 now\?/);
    const n = out.indexOf('**`y/yes`**');
    const l = out.indexOf('**`l/later`**');
    assert.ok(n > -1 && l > n, 'yes leads, later follows');
    assert.match(unwrap(out), /Pause this research here and return to the epic menu with E1 queued/);
    assert.ok(!out.includes('the session ends'), 'the pause returns through the bridge — the row never describes a session ending');
    assert.match(unwrap(out), /Keep the conversation going — this research cannot conclude until E1's evidence lands/);
  });

  it('addresses the spawning discussion identically', () => {
    holderWith('discussion', ['E3']);
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.discussion.timing', id: 'E3' });
    assert.match(unwrap(out), /this discussion cannot conclude until E3's evidence lands/);
  });

  it('refuses a missing id, an unawaited id, and a non-spawn address', () => {
    holderWith('research', ['E1']);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.research.timing' }),
      /--id is required/);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.research.timing', id: 'E9' }),
      /research "timing" holds no evidence wait on E9 — the gate follows the recorded spawn/);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.experiment.timing', id: 'E1' }),
      /address must be <work_unit>\.<research\|discussion>\.<topic>/);
  });

  it('renders the blocked-conclusion gate — blocker naming the ids, guidance, then the yes/keep menu', () => {
    holderWith('discussion', ['E1', 'E2']);
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.timing' });
    assert.match(out, /=== DISPLAY: wait block \(emit verbatim as a properties code block \(```properties fence\)\) ===/);
    assert.match(out, /⚑ Conclusion blocked — this discussion awaits experiment evidence \(E1, E2\)/);
    assert.match(out, /=== DISPLAY: wait guidance \(emit verbatim as markdown \(not a code block\)\) ===/);
    assert.match(out, /> The wait releases when each experiment ends\. The epic menu carries the way in\./);
    assert.match(out, /=== MENU: wait gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /◆ Pause to the menu\?/);
    assert.match(unwrap(out), /Pause this discussion here and return to the epic menu with E1, E2 queued/);
    assert.match(unwrap(out), /Keep the conversation going — conclusion stays blocked until the evidence lands/);
  });

  it('the wait gate is empty over an item with no live wait, and refuses an address outside the waiting phases', () => {
    holderWith('research');
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.research.timing' }), '');
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.experiment.timing' }),
      /address must be <work_unit>\.<research\|discussion\|planning>\.<topic>/);
  });
});

describe('wait-gate — the blocked-conclusion gate over every wait', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {object|undefined} research @param {object} discussion */
  function billingWith(research, discussion) {
    writeManifest(dir, 'lab', {
      phases: {
        ...(research ? { research: { items: { billing: research } } } : {}),
        discussion: { items: { billing: discussion } },
      },
    });
  }

  it('a research wait — the blocker names the topic and that the research is in flight, the guidance the ways out', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress' });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' });
    assert.match(out, /=== DISPLAY: wait block \(emit verbatim as a properties code block \(```properties fence\)\) ===/);
    assert.match(out, /⚑ Conclusion blocked — this discussion awaits research on "Billing" \(in flight\)\n/);
    assert.match(out, /=== DISPLAY: wait guidance \(emit verbatim as markdown \(not a code block\)\) ===/);
    assert.match(out, /> Work the research first — concluding it releases its wait; this discussion can conclude once the research lands\. The epic menu carries the way in\.\n/);
    assert.match(out, /=== MENU: wait gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /◆ Pause to the menu\?/);
    assert.match(unwrap(out), /\*\*`y\/yes`\*\*\s+→ Pause this discussion here and return to the epic menu with the research queued/);
    assert.match(unwrap(out), /\*\*`k\/keep`\*\* +→ Keep the conversation going — conclusion stays blocked until the research lands/);
    assert.ok(!out.includes('experiment'), 'no experiment clause without an experiment wait');
  });

  it('a parked stub reads parked', () => {
    billingWith({ status: 'unstarted' }, { status: 'in-progress' });
    assert.match(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' }),
      /⚑ Conclusion blocked — this discussion awaits research on "Billing" \(parked — not yet started\)\n/);
  });

  it('both kinds — every wait named, research first, and each clause of the guidance and the menu composed', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' });
    assert.match(out, /⚑ Conclusion blocked — this discussion awaits research on "Billing" \(in flight\) and experiment evidence \(E1, E2\)\n/);
    assert.match(out, /> Work the research first — concluding it releases its wait\. The wait releases when each experiment ends\. This discussion can conclude once the research and the evidence have landed\. The epic menu carries the way in\.\n/);
    assert.match(unwrap(out), /return to the epic menu with the research and E1, E2 queued/);
    assert.match(unwrap(out), /conclusion stays blocked until the research and the evidence land/);
  });

  it('an experiment-only wait names the evidence alone — landed research holds nothing', () => {
    billingWith({ status: 'completed' }, { status: 'in-progress', awaiting_experiments: ['E1'] });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' });
    assert.match(out, /awaits experiment evidence \(E1\)\n/);
    assert.ok(!out.includes('research'), 'no research clause once the research has landed');
  });

  it('empty when nothing blocks conclusion', () => {
    billingWith({ status: 'completed' }, { status: 'in-progress' });
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' }), '');
    billingWith(undefined, { status: 'in-progress' });
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' }), '');
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.research.billing' }),
      /no research item "billing" — nothing to hold shut/, 'an absent item is a misrouted address, never a clear conclusion');
  });

  it('a feature\'s discussion waits on its research the same way — the pause names the work unit\'s next step, never a menu', () => {
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: {
        research: { items: { feat: { status: 'unstarted' } } },
        discussion: { items: { feat: { status: 'in-progress' } } },
      },
    });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'feat.discussion.feat' });
    assert.match(out, /awaits research on "Feat" \(parked — not yet started\)/);
    assert.match(out, /Work the research first — concluding it releases its wait; this discussion can conclude once the research lands\. The pause continues the work unit at what it waits on\./);
    assert.match(out, /◆ Pause here\?/);
    assert.match(unwrap(out), /\*\*`y\/yes`\*\*\s+→ Pause this discussion here and continue the work unit at the research/);
    assert.ok(!out.includes('menu') && !out.includes('row'), 'a linear pause hands off to what it waits on, never to a menu — no epic vocabulary');
  });

  it('a feature\'s spawn gate pauses straight into the laboratory — no menu on a linear unit', () => {
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: { research: { items: { feat: { status: 'in-progress', awaiting_experiments: ['E1'] } } } },
    });
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'feat.research.feat', id: 'E1' });
    assert.match(unwrap(out), /Pause this research here and open the laboratory for E1/);
    assert.ok(!out.includes('menu'), 'no menu on a linear unit');
  });

  it('refuses a phase that holds no wait', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress' });
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.experiment.billing' }),
      /address must be <work_unit>\.<research\|discussion\|planning>\.<topic>/);
  });

  it('a plan waits on its specification — the blocker names why it is unsettled, the guidance the way out', () => {
    writeManifest(dir, 'lab', {
      phases: {
        specification: { items: { billing: { status: 'completed', sources: { talks: { status: 'stale' } } } } },
        planning: { items: { billing: { status: 'in-progress' } } },
      },
    });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.planning.billing' });
    assert.match(out, /⚑ Conclusion blocked — this plan awaits its specification \(a source has moved beneath the extraction \(talks\)\)\n/);
    assert.match(out, /> Settle the specification first — concluding it releases its wait; this plan can conclude once the specification lands\. The epic menu carries the way in\.\n/);
    assert.match(unwrap(out), /\*\*`y\/yes`\*\*\s+→ Pause this plan here and return to the epic menu with the specification queued/);
    assert.match(unwrap(out), /\*\*`k\/keep`\*\* +→ Keep planning here — conclusion stays blocked until the specification lands/);
  });

  it('a settled specification holds nothing — the plan\'s gate is empty', () => {
    writeManifest(dir, 'lab', {
      phases: {
        specification: { items: { billing: { status: 'completed', sources: { talks: { status: 'incorporated' } } } } },
        planning: { items: { billing: { status: 'in-progress' } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.planning.billing' }), '');
  });
});

describe('phase-paused — the epic menu\'s banner for a phase leaving on a pause', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  const HEADER = '=== DISPLAY: phase paused (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';

  it('a linear unit names what its one conversation awaits, the topic name dropped — the unit is the topic', () => {
    writeManifest(dir, 'ledger', {
      work_type: 'feature',
      phases: {
        research: { items: { ledger: { status: 'unstarted' } } },
        discussion: { items: { ledger: { status: 'in-progress' } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'ledger', phase: 'discussion' }),
      `${HEADER}\nDiscussion paused for "Ledger" — awaiting research on the topic (parked — not yet started).\n`);
  });

  it('an epic names each paused conversation with its waits — research first, then the evidence', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { billing: { status: 'in-progress' }, auth: { status: 'completed' } } },
        discussion: {
          items: {
            billing: { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] },
            auth: { status: 'in-progress', awaiting_experiments: ['E1'] },
            done: { status: 'completed', awaiting_experiments: ['E9'] },
          },
        },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'pay', phase: 'discussion' }),
      `${HEADER}\nDiscussion paused for "Pay" — "Billing" awaits research on the topic (in flight) and experiment evidence (E1, E2); "Auth" awaits experiment evidence (E1).\n`,
      'only in-progress holders are paused conversations — a completed item\'s stale field is never a wait');
  });

  it('the research phase pauses on evidence alone — the spawn\'s pause', () => {
    writeManifest(dir, 'lab', {
      phases: { research: { items: { layout: { status: 'in-progress', awaiting_experiments: ['E1'] } } } },
    });
    assert.match(renderSurface(dir, 'phase-paused', { dotpath: 'lab', phase: 'research' }),
      /^.*\nResearch paused for "Lab" — "Layout" awaits experiment evidence \(E1\)\.\n$/);
  });

  it('nothing left awaited renders the bare line — a peer landed the wait between the gate and the banner', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        research: { items: { pay: { status: 'completed' } } },
        discussion: { items: { pay: { status: 'in-progress' } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'pay', phase: 'discussion' }),
      `${HEADER}\nDiscussion paused for "Pay".\n`);
  });

  it('a paused plan names the specification it awaits', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        specification: { items: { pay: { status: 'in-progress' } } },
        planning: { items: { pay: { status: 'in-progress' } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'pay', phase: 'planning' }),
      `${HEADER}\nPlanning paused for "Pay" — awaiting its specification (back in progress).\n`);
  });

  it('a paused specification names the sources it routed a gap into — reopened, or opened and parked', () => {
    writeManifest(dir, 'fumi', {
      phases: {
        discussion: {
          items: {
            'note-window': { status: 'in-progress' },
            sync: { status: 'unstarted' },
            layout: { status: 'completed' },
          },
        },
        specification: {
          items: {
            windows: {
              status: 'in-progress',
              sources: {
                'note-window': { status: 'stale' },
                sync: { status: 'pending' },
                layout: { status: 'pending' },
              },
            },
            panes: { status: 'in-progress', sources: { layout: { status: 'incorporated' } } },
          },
        },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'fumi', phase: 'specification' }),
      `${HEADER}\nSpecification paused for "Fumi" — "Windows" awaits the note-window and sync discussions.\n`,
      'a source still to extract whose discussion has concluded is the specification\'s own work, never a wait');
  });

  it('a linear specification names the record it awaits by its phase — a bugfix\'s investigation', () => {
    writeManifest(dir, 'crash-fix', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { 'crash-fix': { status: 'in-progress' } } },
        specification: { items: { 'crash-fix': { status: 'in-progress', sources: { 'crash-fix': { status: 'stale' } } } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'crash-fix', phase: 'specification' }),
      `${HEADER}\nSpecification paused for "Crash Fix" — awaiting the crash-fix investigation.\n`);
  });

  it('a specification whose routed work has concluded renders the bare line', () => {
    writeManifest(dir, 'fumi', {
      phases: {
        discussion: { items: { 'note-window': { status: 'completed' } } },
        specification: { items: { windows: { status: 'in-progress', sources: { 'note-window': { status: 'stale' } } } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'fumi', phase: 'specification' }),
      `${HEADER}\nSpecification paused for "Fumi".\n`);
  });

  it('is loud on a missing phase, a phase that never pauses, a dotted address, and an unknown unit', () => {
    writeManifest(dir, 'pay', { phases: { discussion: { items: { pay: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'pay' }), /--phase is required/);
    assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'pay', phase: 'implementation' }),
      /--phase must be <research\|discussion\|planning\|specification> — the phases that pause; got "implementation"/);
    assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'pay.discussion.pay', phase: 'discussion' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'nope', phase: 'discussion' }), /work unit "nope" not found/);
  });
});

describe('epic-soft-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  function orderedEpic() {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { alpha: { status: 'in-progress' }, beta: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' }, billing: { status: 'completed' } } },
        specification: {
          items: {
            auth: { status: 'completed', order: 1 },
            reports: { status: 'completed', order: 2 },
            billing: { status: 'completed', order: 3 },
          },
        },
        planning: { items: { billing: { status: 'completed' } } },
      },
    });
  }

  it('planning row names the lower-ordered unplanned topics', () => {
    orderedEpic();
    const out = renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning', topic: 'billing' });
    assert.match(out, /MENU: epic soft gate/);
    assert.match(unwrap(out), /You're about to plan "Billing" — "Auth" and "Reports" are ahead of it in the build order and unplanned\./);
    assert.match(out, /Proceed anyway\?/);
    assert.match(out, /The build order is advisory/);
  });

  it('a single ahead topic reads singular; three read as a comma list', () => {
    orderedEpic();
    const one = renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning', topic: 'reports' });
    assert.match(unwrap(one), /"Auth" is ahead of it in the build order and unplanned\./);

    writeManifest(dir, 'wide', {
      phases: {
        specification: {
          items: {
            a: { status: 'completed', order: 1 },
            b: { status: 'completed', order: 2 },
            c: { status: 'completed', order: 3 },
            d: { status: 'completed', order: 4 },
          },
        },
      },
    });
    const three = renderSurface(dir, 'epic-soft-gate', { dotpath: 'wide', action: 'continue_planning', topic: 'd' });
    assert.match(unwrap(three), /"A", "B" and "C" are ahead of it in the build order and unplanned\./);
  });

  it('continue_implementation reads the implementation phase; its --topic throw fires', () => {
    orderedEpic();
    assert.match(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'continue_implementation', topic: 'billing' }), /unbuilt/);
    assert.throws(() => renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'continue_implementation' }), /--topic is required/);
  });

  it('an unknown action refuses by name; a terminal or absent topic passes silently', () => {
    orderedEpic();
    assert.throws(() => renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planing', topic: 'billing' }),
      /unknown --action "start_planing"/);
    // A plan can legitimately outlive its spec (cancelled/superseded/promoted)
    // — the advisory gate must pass, never crash a routine menu selection.
    writeManifest(dir, 'outlived', {
      phases: {
        specification: { items: { auth: { status: 'cancelled', previous_status: 'completed', previous_order: 1 } } },
        planning: { items: { auth: { status: 'in-progress' } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'epic-soft-gate', { dotpath: 'outlived', action: 'continue_planning', topic: 'auth' }), '');
    assert.strictEqual(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning', topic: 'no-such' }), '');
  });

  it('empty when nothing sits ahead, when ahead topics are planned, and when the selection has no order', () => {
    orderedEpic();
    assert.strictEqual(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning', topic: 'auth' }), '');
    // billing (order 3) is the only implementation candidate; auth and
    // reports are unbuilt → gate fires for implementation…
    assert.match(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_implementation', topic: 'billing' }), /unbuilt/);
    // …but an unordered selection is silent (legacy epic, not yet sequenced).
    writeManifest(dir, 'legacy', {
      phases: { specification: { items: { a: { status: 'completed' }, b: { status: 'completed' } } } },
    });
    assert.strictEqual(renderSurface(dir, 'epic-soft-gate', { dotpath: 'legacy', action: 'start_planning', topic: 'a' }), '');
  });

  it('terminal topics never count as ahead', () => {
    writeManifest(dir, 'pay', {
      phases: {
        specification: {
          items: {
            auth: { status: 'cancelled', order: 1 },
            billing: { status: 'completed', order: 2 },
          },
        },
      },
    });
    assert.strictEqual(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning', topic: 'billing' }), '');
  });

  it('the specification row counts the discussions the grouping reads', () => {
    orderedEpic();
    const out = renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_specification' });
    assert.match(out, /1 of 2 discussions still in-progress/);
    assert.match(out, /re-analyse if you revisit later/);
  });

  it('a discussion entry carries no gate — research in flight elsewhere is no concern of it', () => {
    orderedEpic();
    for (const action of ['start_discussion', 'start_discussion_after_research', 'continue_discussion']) {
      assert.strictEqual(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action, topic: 'auth' }), '', action);
    }
  });

  it('parked and terminal discussions never inflate the specification count', () => {
    writeManifest(dir, 'stubs', {
      phases: {
        discussion: {
          items: {
            auth: { status: 'in-progress' },
            billing: { status: 'completed' },
            parked: { status: 'unstarted' },
            gone: { status: 'cancelled' },
            moved: { status: 'promoted', promoted_to: 'cc' },
          },
        },
      },
    });
    assert.match(renderSurface(dir, 'epic-soft-gate', { dotpath: 'stubs', action: 'start_specification' }),
      /1 of 2 discussions still in-progress/);
  });

  it('requires --action always and --topic for the order rows', () => {
    orderedEpic();
    assert.throws(() => renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay' }), /--action is required/);
    assert.throws(() => renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning' }), /--topic is required/);
  });
});

describe('surfaces primitives', () => {
  it('a timed instruction is built from its parts — the form, the moment, then the behaviour clause where there is one', () => {
    assert.strictEqual(timedInstruction('text', 'after the result summary', AUTO_GATE_CLAUSE),
      'emit verbatim as a text code block (```text fence) after the result summary — the user set this gate to auto: do not stop; continue as the workflow instructs');
    assert.strictEqual(timedInstruction('text', 'only at an analysis deferral', CONTINUE_CLAUSE),
      'emit verbatim as a text code block (```text fence) only at an analysis deferral — do not stop; continue as the workflow instructs');
    assert.strictEqual(timedInstruction('markdown', 'after the response', STOP_CLAUSE),
      "emit verbatim as markdown (not a code block) after the response, then STOP for the user's response");
    assert.strictEqual(timedInstruction('text', 'after the response'),
      'emit verbatim as a text code block (```text fence) after the response');
  });

  it('menu opens on the rule, glyphs a short label, and never closes the frame', () => {
    assert.strictEqual(
      menu('Approve?', ['**`y/yes`**', '**`n/no`**']),
      [DOTS, '**`◆ Approve?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('leaves a long or marked-up label as prose — the glyph span cannot nest markup', () => {
    const long = 'Whether the pipeline can expose **click windows** belongs to a different topic entirely';
    const out = menu(long, ['**`y/yes`**'], { question: 'Move it there?' });
    assert.strictEqual(out, [DOTS, long, '', '**`◆ Move it there?`**', '', '**`y/yes`**'].join('\n'));
  });

  it('refuses a y/yes row under a statement — a consent gate asks its question', () => {
    const yes = ['**`y/yes`**', '**`n/no`**'];
    assert.throws(() => menu('Proceed.', yes), /"Proceed\." is not one/);
    assert.throws(() => menu('The tree is dirty.', yes, { question: 'Carry on.' }), /"Carry on\." is not one/);
    assert.throws(() => menu('', ['**`y/yes`** → Apply it']), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses a y/yes row under a question the label cannot glyph — the split is the fix', () => {
    const long = 'Does the pipeline exposing **click windows** belong to a different topic entirely?';
    assert.throws(() => menu(long, ['**`y/yes`**']), /no `◆ …\?` line stands above the rows/);
    assert.throws(() => menu('The tree is dirty.', ['**`y/yes`**'], { question: long }), /"Does the pipeline exposing .*" is not one/);
  });

  it('holds a projection-composed frame to the same rule — the check reads the composed lines', () => {
    const rows = ['**`y/yes`** → Proceed anyway', '**`b/back`** → Return to menu'];
    const lines = menuFrame(['Two topics sit ahead.', '', '**`◆ Proceed anyway?`**', '', ...rows]).split('\n');
    assert.deepStrictEqual(lines.slice(0, 5), [DOTS, 'Two topics sit ahead.', '', '**`◆ Proceed anyway?`**', ''], 'a glyphed line makes the leading statement context');
    assert.throws(() => menuFrame(['Two topics sit ahead.', '', '**`◆ Proceed anyway.`**', '', ...rows]), /"Proceed anyway\." is not one/);
    assert.throws(() => menuFrame(['Two topics sit ahead.', '', ...rows]), /"Two topics sit ahead\." is not one/);
    assert.throws(() => menuFrame(['Two topics sit ahead:', ...rows]), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses an n/no row without a y/yes row — a refusal answers yes, never a verb synonym', () => {
    assert.throws(() => menu('Proceed?', ['**`p/proceed`** → Carry on', '**`n/no`** → Stop here']), /an n\/no row answers a y\/yes row/);
  });

  it('a y/yes row passes under a glyphable question — the label itself, or one split beneath a statement', () => {
    assert.strictEqual(menu('Proceed?', ['**`y/yes`** → Carry on', '**`n/no`** → Stop here']).split('\n')[1], '**`◆ Proceed?`**');
    assert.strictEqual(
      menu('The tree is dirty.', ['**`y/yes`**', '**`n/no`**'], { question: 'Carry on?' }),
      [DOTS, 'The tree is dirty.', '', '**`◆ Carry on?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('every menu asks — a route menu under a statement is refused, and passes once a question rides beneath it', () => {
    const rows = ['**`d/discussion`** → Discuss it', '**`r/research`** → Research it'];
    assert.throws(() => menu('Where this belongs.', rows), /every menu asks a glyphed question — "Where this belongs\." is not one/);
    assert.throws(() => menu('', rows), /no `◆ …\?` line stands above the rows/);
    assert.throws(() => menu('', rows, { question: 'Which one' }), /"Which one" is not one/);
    assert.deepStrictEqual(
      menu('Where this belongs.', rows, { question: 'Where should it go?' }).split('\n').slice(1, 4),
      ['Where this belongs.', '', '**`◆ Where should it go?`**'],
    );
  });

  it('the question stands above the rows — one beneath them asks nothing', () => {
    assert.throws(() => menuFrame(['**`1`** → A', '', '**`◆ Which one?`**']), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses a menu with no row to press — plain lines and prompt options alone are no menu', () => {
    assert.throws(() => menu('Which one?', ['a plain line']), /no row to press/);
    assert.throws(() => menu('Which one?', ['**Comment** → Tell me what you think']), /no row to press/);
    assert.throws(() => menuFrame(['**`◆ Which one?`**']), /no row to press/);
  });

  it('refuses a menu whose only keyed rows are ranges — a range is typed, never pressed', () => {
    const typedOnly = [rangeOption(1, 3, 'Select item(s)'), promptOption('Comment', 'Tell me what you think')];
    assert.throws(() => menu('Which items?', typedOnly), /no row to press — a menu offers at least one single key .*; a range row is typed, never pressed/);
    assert.throws(() => menu('Which items?', [rangeOption(1, 3, 'Select item(s)')]), /no row to press/);
  });

  it('a range row passes beside a single key — the ask still stands above the range', () => {
    const rows = [rangeOption(1, 3, 'Select item(s)'), cmdOption('b', 'back', 'Return to menu')];
    assert.match(menu('Which items?', rows), /◆ Which items\?/);
    assert.throws(() => menuFrame([rows[0], '', '**`◆ Which items?`**', '', rows[1]]), /no `◆ …\?` line stands above the rows/);
  });

  it('command and bare option builders make a row to press', () => {
    assert.match(menu('Which one?', [cmdOption('1', null, 'A'), promptOption('Ask', 'Ask about it')]), /◆ Which one\?/);
    assert.match(menu('Proceed?', [bareOption('y', 'yes'), bareOption('n', 'no')]), /◆ Proceed\?/);
  });

  it('aligns option arrows into one column, leaving non-option lines alone', () => {
    const out = menu('Which one?', ['**`c/continue`** → Carry on', '**`q`** → Quit', 'a plain line']);
    const lines = out.split('\n');
    const arrows = lines.filter((l) => l.includes(' → ')).map((l) => l.indexOf(' → '));
    assert.strictEqual(new Set(arrows).size, 1, 'arrows share a column');
    assert.ok(lines.includes('a plain line'), 'non-option lines pass through untouched');
  });

  // Every frame asks; its rows start three lines down, under the question.
  const ASK = ['Which one?', ''];

  it('wraps a long option label under the label column with NBSP continuations', () => {
    const out = menuFrame([
      ...ASK,
      '**`1`** → ' + 'alpha '.repeat(12).trim(),
      '**`i/discovery`** → Continue discovery',
    ], { width: 40 });
    const lines = out.split('\n');
    // column = 11 (i/discovery) → label column 14; every rendered line ≤ 40.
    assert.strictEqual(lines[3], '**`1`**           → alpha alpha alpha alpha');
    assert.strictEqual(lines[4], `${NB(14)}alpha alpha alpha alpha`);
    assert.strictEqual(lines[5], `${NB(14)}alpha alpha alpha alpha`);
    assert.strictEqual(lines[6], '**`i/discovery`** → Continue discovery');
  });

  it('closes and reopens spans at a wrap break — every emitted line is self-contained markdown', () => {
    const out = menuFrame([
      ...ASK,
      '**`1`** → Continue "Roles" — *implementation (Phase 5, Task roles-5-44)*',
      '**`i/discovery`** → Continue discovery',
    ], { width: 55 });
    const lines = out.split('\n');
    assert.strictEqual(lines[3], '**`1`**           → Continue "Roles" — *implementation (Phase*');
    assert.strictEqual(lines[4], `${NB(14)}*5, Task roles-5-44)*`);
  });

  it('an escaped marker is text, never a span — a break adds no closing marker', () => {
    const out = menuFrame([...ASK, '**`1`** → Fix 2\\*3 so every one of the pipeline stages agrees'], { width: 40 });
    const [first, ...continuations] = out.split('\n').slice(3);
    assert.ok(continuations.length > 0, 'the label wraps');
    for (const line of [first, ...continuations]) {
      assert.ok(!/(^|[^\\])\*$/.test(line), `no closing marker at the break: ${line}`);
    }
    for (const line of continuations) {
      assert.ok(!line.replace(/^ +/, '').startsWith('*'), `no reopened marker on the continuation: ${line}`);
    }
  });

  it('a struck in-session row and a code span both survive the break balanced', () => {
    const struck = menuFrame([
      ...ASK,
      '**`1`** → ~~Continue "Topic" — *discussion*~~ · in session (last active 2m ago)',
    ], { width: 55 });
    // the ~~…~~ closes before the break here; each line carries balanced markers
    for (const line of struck.split('\n')) {
      assert.strictEqual((line.match(/~~/g) || []).length % 2, 0, line);
    }
    const code = menuFrame([
      ...ASK,
      '**`1`** → Run `one two three four five six seven` now',
    ], { width: 40 });
    const codeLines = code.split('\n');
    assert.ok(codeLines[3].endsWith('`'), 'code span closes at the break');
    assert.ok(codeLines[4].startsWith(NB(4) + '`'), 'and reopens on the continuation');
  });

  it('an escaped marker is the character it escapes — it opens no span for a break to close', () => {
    const out = menuFrame([...ASK, '**`1`** → Fix \\*auth tokens across every service\\* now'], { width: 40 });
    const lines = out.split('\n');
    assert.strictEqual(lines[3], '**`1`** → Fix \\*auth tokens across every');
    assert.strictEqual(lines[4], `${NB(4)}service\\* now`);
  });

  it('keeps the line whole when the label budget falls below the floor', () => {
    const out = menuFrame([
      ...ASK,
      '**`x/extraordinarily-wide-key-column`** → Continue',
      '**`1`** → A long label that would wrap at any sane width but must stay whole here',
    ], { width: 40 });
    assert.ok(!out.includes(NB(1)), 'no continuation lines at a degenerate budget');
  });

  it('leaves a single oversized token whole rather than splitting markup', () => {
    const out = menuFrame([
      ...ASK,
      '**`1`** → See supercalifragilistic-hyphenated-identifier-that-cannot-fit for details',
    ], { width: 40 });
    const lines = out.split('\n');
    assert.strictEqual(lines[4], `${NB(4)}supercalifragilistic-hyphenated-identifier-that-cannot-fit`);
    assert.strictEqual(lines[5], `${NB(4)}for details`);
  });

  it('section wraps body in a named, instruction-carrying marker and strips trailing newlines', () => {
    assert.strictEqual(section('MENU: x', 'emit verbatim', 'body\n\n'), '=== MENU: x (emit verbatim) ===\nbody\n');
  });

  it('callout flags the first line and aligns continuations', () => {
    assert.strictEqual(callout(['first line', 'second line']), '  ⚑ first line\n    second line');
  });

  it('menuFrame opens its lines with the canonical rule and does not close them', () => {
    assert.strictEqual(menuFrame(['Which one?', '', '**`b`** → B']), [DOTS, '**`◆ Which one?`**', '', '**`b`** → B'].join('\n'));
  });

  it('menuFrame glyphs only a leading short label — no blank beneath means no glyph, so no question', () => {
    assert.throws(() => menuFrame(['Which one?', '**`b`** → B']), /no `◆ …\?` line stands above the rows/);
  });

  it('callout wraps a string to the width with the flag gutter subtracted', () => {
    const out = callout('word '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('  ⚑ ') && lines[1].startsWith('    '));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('subDetail glyphs the first line and aligns continuations under the text', () => {
    const out = subDetail('alpha '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('   · alpha') && lines[1].startsWith('     alpha'));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('treeList branches each item, gutters continuations, blanks under the last', () => {
    const out = treeList(['one '.repeat(12).trim(), 'two '.repeat(12).trim()], { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('     ├─ one'));
    assert.ok(lines[1].startsWith('     │  one'), 'non-last continuation carries the gutter');
    const lastBranch = lines.findIndex((l) => l.startsWith('     └─ two'));
    assert.ok(lastBranch > 0);
    assert.ok(lines[lastBranch + 1].startsWith('        two'), 'last continuation is blank-guttered');
  });

  it('indentedBody wraps each paragraph two columns in; indent moves the column and the budget with it', () => {
    assert.deepStrictEqual(indentedBody(['short', 'lines'], { width: 40 }), ['  short', '  lines']);
    assert.deepStrictEqual(indentedBody(['x'.repeat(50)], { width: 40 }), [`  ${'x'.repeat(38)}`, `  ${'x'.repeat(12)}`], 'the default budget is the width less two columns');
    const deep = indentedBody(['beta '.repeat(20).trim()], { indent: '      ', width: 40 });
    assert.ok(deep.length > 1 && deep.every((l) => l.startsWith('      beta') && [...l].length <= 40));
  });

  it('bulletRow glyphs at the callout indent by default; indent shifts the glyph, continuations stay under the text', () => {
    assert.deepStrictEqual(bulletRow('short row', { width: 40 }), ['  • short row']);
    assert.deepStrictEqual(bulletRow('x'.repeat(50), { width: 40 }), [`  • ${'x'.repeat(36)}`, `    ${'x'.repeat(14)}`], 'the default budget reserves the indent and the glyph');
    const lines = bulletRow('gamma '.repeat(20).trim(), { indent: '    ', width: 40 });
    assert.ok(lines[0].startsWith('    • gamma') && lines[1].startsWith('      gamma'));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });
});

describe('render resume-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the menu byte-exactly, artifact from the phase segment, topic titlecased', () => {
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow' });
    assert.strictEqual(out, [
      '=== MENU: resume gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      'Found existing discussion for **Auth Flow**.',
      '',
      '**`◆ How would you like to proceed?`**',
      '',
      '**`c/continue`** → Pick up where you left off',
      '**`r/restart`**  → Delete the discussion and start fresh',
      '',
    ].join('\n'));
  });

  it('prepends the mail warning display when --mail is passed', () => {
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', mail: '3' });
    assert.ok(out.startsWith([
      '=== DISPLAY: mail warning (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      "  ⚑ 3 message(s) from other topics wait in this topic's mailbox.",
      '    Restart leaves them there — the restarted session raises',
      '    them.',
      '',
    ].join('\n')));
    assert.ok(out.includes('=== MENU: resume gate'));
  });

  it('rejects a non-positive or non-integer mail count', () => {
    for (const bad of ['0', '-1', 'two', '']) {
      assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', mail: bad }), /--mail must be a positive integer/);
    }
  });

  it('rejects a malformed address and an unknown work unit', () => {
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion' }), /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'nope.discussion.x' }), /work unit "nope" not found/);
  });

  it('rejects an unknown variant and --mail combined with a variant', () => {
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', variant: 'nope' }), /--variant must be "plan", "review", "scoping", or "session"/);
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.scoping.auth-flow', variant: 'scoping', mail: '2' }), /--mail only applies to the default variant/);
  });
});

describe('render resume-gate variants', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  /** The prior run's planning files — what makes `continue` an option. */
  const planFiles = (workUnit, topic) => {
    fs.mkdirSync(path.join(dir, '.leeway', workUnit, 'planning', topic), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', workUnit, 'planning', topic, 'planning.md'), '# Plan\n');
  };

  it('plan derives the position parenthetical from the planning item', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: 2 } } } } });
    planFiles('pay', 'portal');
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan' });
    assert.ok(out.includes('Found existing plan for **Portal** (previously reached phase 3, task 2).'));
    assert.ok(/\*\*`c\/continue`\*\* +→ Walk through the plan from the start\. You can review, amend, or navigate at any point — including straight to the leading edge\./.test(unwrap(out)));
    assert.ok(/\*\*`r\/restart`\*\* +→ Erase all planning work for this topic and start fresh\. This deletes the planning file, authored tasks, and clears manifest state\. Other topics are unaffected\./.test(unwrap(out)));
  });

  it('plan omits the parenthetical when the position fields are absent', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    planFiles('pay', 'portal');
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan' });
    assert.ok(out.includes('Found existing plan for **Portal**.\n'));
    assert.ok(!out.includes('previously reached'));
  });

  it('plan keeps the phase anchor when only the phase is known (post-advance interrupt)', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: null } } } } });
    planFiles('pay', 'portal');
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan' });
    assert.ok(out.includes('Found existing plan for **Portal** (previously reached phase 3).'));
  });

  it('plan offers the restart alone when the prior run\'s files are already gone', () => {
    // A restart deletes the planning directory, then the manifest entry. A
    // crash between the two commits leaves an entry with nothing to continue,
    // and offering `continue` there sends the session at an empty directory.
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: 2 } } } } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan' });
    assert.ok(out.includes("Found a planning entry for **Portal**, but the prior run's files are already cleared."));
    assert.ok(out.includes('r/restart'));
    assert.ok(!out.includes('c/continue'), 'there is nothing to continue');
    assert.ok(!out.includes('previously reached'), 'and no position to report');
  });

  it('review renders the coverage menu while unreviewed tasks remain', () => {
    writeManifest(dir, 'pay', { phases: {
      implementation: { items: { portal: { status: 'completed', completed_tasks: ['a', 'b', 'c'] } } },
      review: { items: { portal: { status: 'in-progress', reviewed_tasks: ['a'] } } },
    } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.review.portal', variant: 'review' });
    assert.ok(out.includes('Found existing review for **Portal**.\nReview covered 1 of 3 tasks. 2 task(s) not yet reviewed.'));
    assert.ok(/\*\*`c\/continue`\*\* +→ Review the 2 unreviewed tasks/.test(out));
    assert.ok(/\*\*`r\/restart`\*\* +→ Delete review, re-review all 3 tasks/.test(out));
  });

  it('review coverage tolerates reviewed ids outside completed_tasks — restart-skips count as covered', () => {
    // The verifier flow records backend-skipped/cancelled ids as covered even
    // when they never entered completed_tasks (restart-skips). The negative
    // difference must fall through to all-reviewed, never a phantom count.
    writeManifest(dir, 'pay', { phases: {
      implementation: { items: { portal: { status: 'completed', completed_tasks: ['a', 'b'] } } },
      review: { items: { portal: { status: 'in-progress', reviewed_tasks: ['a', 'b', 'restart-skipped-1'] } } },
    } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.review.portal', variant: 'review' });
    assert.ok(out.includes('All 2 tasks have been reviewed.'), 'excluded-by-design ids never surface as unreviewed');
  });

  it('review coverage counts distinct ids — duplicate pushes never inflate it', () => {
    writeManifest(dir, 'pay', { phases: {
      implementation: { items: { portal: { status: 'completed', completed_tasks: ['a', 'b', 'c'] } } },
      review: { items: { portal: { status: 'in-progress', reviewed_tasks: ['a', 'a', 'b'] } } },
    } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.review.portal', variant: 'review' });
    assert.ok(out.includes('Review covered 2 of 3 tasks. 1 task(s) not yet reviewed.'));
  });

  it('review renders the all-reviewed menu when coverage is complete, and the bare menu with no tracking', () => {
    writeManifest(dir, 'pay', { phases: {
      implementation: { items: { portal: { status: 'completed', completed_tasks: ['a', 'b'] } } },
      review: { items: { portal: { status: 'in-progress', reviewed_tasks: ['a', 'b'] } } },
    } });
    const all = renderSurface(dir, 'resume-gate', { dotpath: 'pay.review.portal', variant: 'review' });
    assert.ok(all.includes('Found existing review for **Portal**.\nAll 2 tasks have been reviewed.'));
    assert.ok(/\*\*`c\/continue`\*\* +→ Continue from current review state/.test(all));

    writeManifest(dir, 'pay', { phases: { review: { items: { portal: { status: 'in-progress' } } } } });
    const bare = renderSurface(dir, 'resume-gate', { dotpath: 'pay.review.portal', variant: 'review' });
    assert.ok(bare.includes('Found existing review for **Portal**.\n\n'), 'no tracking — label only, no coverage line');
    assert.ok(/\*\*`r\/restart`\*\* +→ Delete review, start fresh/.test(bare));
  });

  it('scoping renders the revisit wording', () => {
    writeManifest(dir, 'pay', { phases: { scoping: { items: { pay: { status: 'in-progress' } } } } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.scoping.pay', variant: 'scoping' });
    assert.ok(out.includes('Found completed scoping for **Pay** — spec and plan are in place.'));
    assert.ok(/\*\*`c\/continue`\*\* +→ Adjust the existing spec and plan/.test(out));
    assert.ok(/\*\*`r\/restart`\*\* +→ Erase the spec, plan, and task files, then rescope from scratch/.test(unwrap(out)));
  });

  it('session takes a bare work-unit address and reads the active-session marker', () => {
    writeManifest(dir, 'pay', { phases: { discovery: { active_session: '002', items: {} } } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay', variant: 'session' });
    assert.ok(out.includes('Found an in-progress discovery session for **Pay** at `session-002.md`.'));
    assert.ok(/\*\*`r\/restart`\*\* +→ Discard the interrupted log and start a new session \(map edits already applied stay applied — only their session record is lost\)/.test(unwrap(out)));
  });

  it('session is loud when no active session exists', () => {
    writeManifest(dir, 'pay', { phases: { discovery: { items: {} } } });
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay', variant: 'session' }), /no active discovery session to resume/);
  });
});

describe('render task-list', () => {
  let dir;
  const payload = {
    phase: 1,
    phase_name: 'Adapter Wrapper',
    tasks: [
      { name: 'Wrap command', summary: 'Wrap the argv in a shell fallback', edge_cases: ['quotes', 'attach passthrough'] },
      { name: 'Drop wait', summary: 'Remove wait-after-command' },
    ],
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the canonical display plus the gate menu when gated', () => {
    const file = writePayload(dir, 'tl.json', payload);
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: task list (emit verbatim as a text code block (```text fence)) ===',
      'Phase 1: Adapter Wrapper — 2 tasks.',
      '',
      '1. Wrap command',
      '   · Wrap the argv in a shell fallback',
      '   · Edge cases',
      '     ├─ quotes',
      '     └─ attach passthrough',
      '',
      '2. Drop wait',
      '   · Remove wait-after-command',
      '   · Edge cases: none',
      '',
      '=== MENU: task list gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task list?`**',
      '',
      '**`y/yes`**                  → Proceed to authoring',
      '**`a/auto`**                 → Approve this and all remaining task list',
      `${NB(25)}gates automatically`,
      '**Tell me what to change** → which tasks to reorder, split, merge,',
      `${NB(25)}add, edit, or remove`,
      '**Navigate**               → Tell me where to go: a different phase',
      `${NB(25)}or task, or the leading edge`,
      '',
    ].join('\n'));
  });

  it('singular "1 task." and the auto-proceed line when the gate mode is auto', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'tl.json', { ...payload, tasks: [payload.tasks[0]] });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('Phase 1: Adapter Wrapper — 1 task.'));
    assert.ok(out.includes('=== DISPLAY: task list auto-approved (emit verbatim as a text code block (```text fence) — the user set this gate to auto: do not stop; continue as the workflow instructs) ==='));
    assert.ok(out.includes('Phase 1: Adapter Wrapper — task list approved. Proceeding to authoring.'));
    assert.ok(!out.includes('MENU: task list gate'));
  });

  it('defaults to gated when the topic carries no gate mode', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: {} } } });
    const file = writePayload(dir, 'tl.json', payload);
    assert.ok(renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file }).includes('MENU: task list gate'));
  });

  it('validates the payload loudly, naming the field', () => {
    const cases = [
      ['missing.json', 'nope', /payload file not found/],
      [writePayload(dir, 'a.json', 'not json'), null, /not valid JSON/],
      [writePayload(dir, 'b.json', []), null, /must be an object/],
      [writePayload(dir, 'c.json', { phase: 0, phase_name: 'x', tasks: [{ name: 'a', summary: 'b' }] }), null, /"phase" must be a positive integer/],
      [writePayload(dir, 'd.json', { phase: 1, phase_name: ' ', tasks: [{ name: 'a', summary: 'b' }] }), null, /"phase_name" must be a non-empty string/],
      [writePayload(dir, 'e.json', { phase: 1, phase_name: 'x', tasks: [] }), null, /"tasks" must be a non-empty array/],
      [writePayload(dir, 'f.json', { phase: 1, phase_name: 'x', tasks: [{ name: 'a' }] }), null, /task 1 is missing "summary"/],
      [writePayload(dir, 'g.json', { phase: 1, phase_name: 'x', tasks: [{ name: 'a', summary: 'b', edge_cases: [''] }] }), null, /"edge_cases" must be an array of non-empty strings/],
    ];
    for (const [file, , re] of cases) {
      assert.throws(() => renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file }), re);
    }
  });

  it('requires --file', () => {
    assert.throws(() => renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal' }), /--file <payload\.json> is required/);
  });

  it('wraps long summaries and edge cases with hanging indents — nothing lands at column zero', () => {
    const file = writePayload(dir, 'tl.json', {
      phase: 1,
      phase_name: 'X',
      tasks: [{
        name: 'Long task',
        summary: 'wrap '.repeat(40).trim(),
        edge_cases: ['edge '.repeat(30).trim()],
      }],
    });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    const display = out.split('=== MENU')[0].split('\n').slice(1);
    for (const line of display) {
      if (line === '' || line.startsWith('Phase 1:') || /^\d+\. /.test(line)) continue;
      assert.match(line, /^ {3,}/, `display line must be indented, got: "${line}"`);
      assert.ok([...line].length <= 72, `display line must fit the wrap width, got ${[...line].length}`);
    }
  });
});

describe('render plan-progress', () => {
  let dir;
  const CONTINUE_MD = '(emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs)';
  // Phase 1 authored in full, phase 2 half-way; the phase keys `portal-1` and
  // `portal-2` are phases, never tasks. A topic ending in digits keeps the
  // prefix honest: `portal-2` must not read as task 2 of a phase.
  const item = {
    status: 'in-progress',
    task_map: { 'portal-1': 'p1', 'portal-1-1': 'a', 'portal-1-2': 'b', 'portal-1-3': 'c', 'portal-2': 'p2', 'portal-2-1': 'd' },
  };
  const render = (/** @type {Record<string, string>} */ args) => renderSurface(dir, 'plan-progress', { dotpath: 'pay.planning.portal', ...args });
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: item } } } });
  });
  afterEach(() => teardown(dir));

  it('construction-complete and concluded count the plan\'s phases and tasks off task_map', () => {
    assert.strictEqual(render({ variant: 'construction-complete' }), [
      `=== DISPLAY: plan constructed ${CONTINUE_MD} ===`,
      'All phases are complete. The plan has **2 phases** with **4 tasks** total.',
      '',
    ].join('\n'));
    assert.strictEqual(render({ variant: 'concluded' }), [
      `=== DISPLAY: plan concluded ${CONTINUE_MD} ===`,
      'Planning is complete for **pay**.',
      '',
      'The plan contains **2 phases** with **4 tasks** total, reviewed for traceability against the specification and structural integrity.',
      '',
      'Status has been marked as `completed`. The plan is ready for implementation.',
      '',
    ].join('\n'));
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_map: { 'portal-1': 'p1', 'portal-1-1': 'a' } } } } } });
    assert.ok(render({ variant: 'construction-complete' }).includes('The plan has **1 phase** with **1 task** total.'));
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_map: { 'portal-1': 'p1' } } } } } });
    assert.throws(() => render({ variant: 'concluded' }), /"portal" has no authored tasks in task_map/);
  });

  it('a topic ending in digits never reads its phase keys as tasks', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { 'auth-2': {
      status: 'in-progress',
      task_map: { 'auth-2-1': 'p1', 'auth-2-1-1': 'a', 'auth-2-1-2': 'b', 'auth-2-2': 'p2', 'auth-2-2-1': 'c' },
    } } } } });
    assert.ok(renderSurface(dir, 'plan-progress', { dotpath: 'pay.planning.auth-2', variant: 'construction-complete' })
      .includes('The plan has **2 phases** with **3 tasks** total.'));
  });

  it('refuses an unknown variant and a non-planning address', () => {
    assert.throws(() => render({}), /--variant must be one of construction-complete, concluded, got "undefined"/);
    assert.throws(() => render({ variant: 'done' }), /--variant must be one of .*, got "done"/);
    assert.throws(() => renderSurface(dir, 'plan-progress', { dotpath: 'pay.discussion.portal', variant: 'concluded' }), /address must be <work_unit>\.planning\.<topic>/);
  });
});

describe('render findings-summary', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the worklist overview byte-exactly — glyphs, tags, notes', () => {
    const file = writePayload(dir, 's.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'add-to-task — Task 1-1 lacks the Outcome field.' },
        { title: 'Orphaned dependency', tag: 'Important', summary: 'update-task — Task 2-3 depends on a removed task.' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Integrity Review** — 2 findings',
      '',
      '○ 1. Missing Outcome field `[Minor]`',
      `${NB(7)}↳ add-to-task — Task 1-1 lacks the Outcome field.`,
      '○ 2. Orphaned dependency `[Important]`',
      `${NB(7)}↳ update-task — Task 2-3 depends on a removed task.`,
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('renders a resumed review — decided rows struck and note-shed, remaining counted', () => {
    const file = writePayload(dir, 'r.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'Task 1-1 lacks the Outcome field.', status: 'approved' },
        { title: 'Orphaned dependency', tag: 'Important', summary: 'Task 2-3 depends on a removed task.', status: 'skipped' },
        { title: 'Duplicated criteria', tag: 'Minor', summary: 'Two tasks share one criterion.', status: 'pending' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Integrity Review** — 3 findings · 1 remaining',
      '',
      '✓ 1. ~~Missing Outcome field~~ `[Minor]`',
      '⊘ 2. ~~Orphaned dependency~~ `[Important]`',
      '○ 3. Duplicated criteria `[Minor]`',
      `${NB(7)}↳ Two tasks share one criterion.`,
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { review_label: 'X', items: [] }) }), /"items" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { review_label: 'X', items: [{ title: 't', tag: 'g' }] }) }), /item 1 is missing "summary"/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'c.json', { review_label: 'X', items: [{ title: 't', tag: 'g', summary: 's', status: 'Fixed' }] }) }), /render findings-summary: item 1 carries unknown status "Fixed"/);
  });
});

describe('worklist shape', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  // Rendered width: escapes and code-span backticks are zero-width, `~~` is
  // consumed — byte length over-counts a correct row, so width properties
  // are asserted on the rendered measure, against the resolved width.
  const renderedLen = (line) => line.replace(/\\(.)/g, '$1').replace(/~~/g, '').replace(/`/g, '').length;
  const { displayWidth } = require('../../skills/workflow-engine/scripts/kernel/terminal.cjs');

  it('a tag that cannot fit the last title line drops to its own line at the title column', () => {
    const file = writePayload(dir, 't.json', { label: 'Cycle', tasks: [
      { title: 'The traceability matrix omits three acceptance criteria', severity: 'Important' },
    ] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    const body = out.split('===\n')[1].split('\n');
    assert.ok(body.some((l) => l === `${NB(5)}\`[Important]\``), `tag line missing: ${JSON.stringify(body)}`);
    for (const line of body) assert.ok(renderedLen(line) <= displayWidth(), `overflowing row: ${line}`);
  });

  it('every worklist surface holds the rendered width, tags and escapes included', () => {
    const long = 'Collapse the *duplicated* retry_budget into one constant shared by both callers';
    const width = displayWidth();
    const holdWidth = (out) => {
      // Rows, continuations, and notes hold the width; the header and a
      // batch intro are prose lines left to soft-wrap, so they are exempt.
      for (const line of out.split('===\n')[1].split('\n')) {
        if (!/^[○✓⊘\d ]/.test(line)) continue;
        assert.ok(renderedLen(line) <= width, `overflowing row: ${line}`);
      }
    };
    holdWidth(renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: writePayload(dir, 'w.json', { label: 'Cycle', tasks: [
      { title: long, severity: 'Important' },
      { title: 'Short', severity: 'low' },
    ] }) }));
    writeManifest(dir, 'wu3', { phases: { planning: { items: { portal: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    holdWidth(renderSurface(dir, 'findings-summary', { dotpath: 'wu3.planning.portal', file: writePayload(dir, 'w2.json', { review_label: 'Integrity Review', items: [
      { title: long, tag: 'Important', summary: 'A summary long enough to wrap beneath the arrow and hold its hang.' },
    ] }) }));
    holdWidth(renderSurface(dir, 'finding-batch', { dotpath: 'wu3.discussion.checkout', file: writePayload(dir, 'w3.json', { lane: 'route', items: [
      { title: long, target: 'payments-reconciliation-storage', detail: 'Their subtopic owns the claim.' },
    ] }) }));
  });

  it('the tag-fit boundary is exact — at budget it stays inline, one over it drops', () => {
    // Walked 1-digit head is 5 columns; budget 60 at width 65. Tag
    // `Important` costs 12 rendered (space + brackets + 9 letters). A
    // 48-char title fits inline at exactly the width; 49 forces the drop.
    const at = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: writePayload(dir, 'fit.json', { label: 'C', tasks: [
      { title: 'x'.repeat(48), severity: 'Important' },
    ] }) });
    assert.ok(at.includes('x'.repeat(48) + ' `[Important]`'), `expected inline tag: ${at}`);
    const over = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: writePayload(dir, 'over.json', { label: 'C', tasks: [
      { title: 'x'.repeat(49), severity: 'Important' },
    ] }) });
    assert.ok(over.includes(`${NB(5)}\`[Important]\``), `expected dropped tag: ${over}`);
    assert.ok(!over.includes('x `[Important]`'), 'tag not inline past the boundary');
  });

  it('rows pad 10+ numbering with NBSP, never a leading space', () => {
    writeManifest(dir, 'wu2', { phases: { planning: { items: { portal: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `Item ${i + 1}`, tag: 'low', summary: `Detail ${i + 1}` }));
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'wu2.planning.portal', file: writePayload(dir, 'b.json', { review_label: 'Rev', items }) });
    assert.ok(out.includes(`○ ${NB(1)}1. Item 1`), 'single-digit row pads with NBSP');
    assert.ok(out.includes('○ 11. Item 11'), 'two-digit row unpadded');
    // Batch rows are capped below padding range, but the leading column must
    // still never open on a real space — a markdown renderer would strip it.
    const batch = Array.from({ length: 5 }, (_, i) => ({ title: `Item ${i + 1}`, detail: `Detail ${i + 1}` }));
    const bout = renderSurface(dir, 'finding-batch', { dotpath: 'wu2.discussion.checkout', file: writePayload(dir, 'b2.json', { lane: 'apply', items: batch }) });
    assert.ok(bout.includes('1\\. Item 1'), 'unglyphed row opens on its number');
    for (const line of [...out.split('\n'), ...bout.split('\n')]) {
      assert.ok(!/^ /.test(line), `line leads with a real space: ${JSON.stringify(line)}`);
    }
  });

  it('escapes markdown-active characters in the label, title, and note', () => {
    const file = writePayload(dir, 'e.json', {
      review_label: 'Rev *2* [beta]',
      items: [{ title: 'Escape <script> and ~tilde~', tag: 'low', summary: 'see foo_bar and [link] and \\slash' }],
    });
    writeManifest(dir, 'pay2', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay2.planning.portal', file });
    assert.ok(out.includes('**Rev \\*2\\* \\[beta\\]**'), 'label escaped');
    assert.ok(out.includes('Escape \\<script\\> and \\~tilde\\~'), 'title escaped, angle brackets included');
    assert.ok(out.includes('↳ see foo\\_bar and \\[link\\] and \\\\slash'), 'note escaped');
  });

  it('a wrapped note hangs its continuation two columns past the arrow', () => {
    writeManifest(dir, 'pay3', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', {
      review_label: 'Rev',
      items: [{ title: 'T', tag: 'low', summary: 'This note is deliberately long enough that the wrap point lands inside it and produces a continuation line beneath the arrow.' }],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay3.planning.portal', file });
    const lines = out.split('\n');
    const noteAt = lines.findIndex((l) => l.includes('↳ '));
    assert.ok(noteAt > 0, 'note rendered');
    assert.ok(lines[noteAt].startsWith(`${NB(7)}↳ `), 'note at title column + 2');
    assert.ok(lines[noteAt + 1].startsWith(NB(9)), 'continuation hangs past the arrow');
  });

  it('worklist fails loudly on shape errors its callers cannot reach', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    assert.throws(() => worklist({ items: [{ title: 'x' }] }), /exactly one of "heading"\/"intro"/);
    assert.throws(() => worklist({ heading: { label: 'H', noun: 'x' }, intro: 'I', items: [{ title: 'x' }] }), /exactly one of "heading"\/"intro"/);
    assert.throws(() => worklist({ intro: 'I', items: [] }), /"items" must be a non-empty array/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', state: 'banana' }] }), /unknown state "banana"/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', tag: 'has`tick' }] }), /a tag must not contain backticks/);
    assert.throws(() => worklist({ intro: 'I', items: [{ detail: 'no title' }] }), /item 1 needs a non-empty string "title"/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', tag: 'y'.repeat(70) }] }), /cannot fit the display width/);
  });

  it('walked rows pad 10+ numbering with NBSP too', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `T${i + 1}` }));
    const out = worklist({ heading: { label: 'H', noun: 'item' }, items, walked: true });
    assert.ok(out.includes(`○ ${NB(1)}1. T1`), `walked pad is NBSP: ${out.split('\n')[2]}`);
    assert.ok(out.includes('○ 11. T11'), 'two-digit walked row unpadded');
  });

  it('unglyphed rows pad 10+ numbering with a leading NBSP, never a space', () => {
    // No production surface reaches an unglyphed list past the batch cap;
    // the mechanism is pinned directly so an uncapped future caller
    // inherits it working.
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `T${i + 1}` }));
    const out = worklist({ intro: 'I', items });
    assert.ok(out.includes(`${NB(1)}1\\. T1`), `unglyphed pad is a leading NBSP: ${out.split('\n')[2]}`);
    assert.ok(out.includes('11\\. T11'), 'two-digit unglyphed row unpadded');
    for (const line of out.split('\n')) {
      assert.ok(!/^ /.test(line), `line leads with a real space: ${JSON.stringify(line)}`);
    }
  });

  it('an unwalked heading never counts remaining', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const out = worklist({ heading: { label: 'H', noun: 'item' }, items: [{ title: 'a', state: 'approved' }, { title: 'b' }] });
    assert.ok(out.startsWith('**H** — 2 items\n'), `unexpected header: ${out.split('\n')[0]}`);
  });
});

describe('render research-conclude-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress' } } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('pins the research address — the gate concludes research and nothing else', () => {
    assert.throws(() => renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.discussion.checkout' }),
      /render research-conclude-gate: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
  });

  it('renders yes/keep without the flag — no dead-end row', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.match(out, /=== MENU: research conclude gate/);
    assert.match(out, /This topic looks ready to conclude\.\n\n\*\*`◆ Conclude it\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Mark this topic as complete, ready for discussion/);
    assert.match(out, /\*\*`k\/keep`\*\*\s+→ Keep digging, there's more to understand/);
    assert.ok(!out.includes('dead end'), 'no dead-end row without the flag');
  });

  it('adds the dead-end row under --dead-end, consequences stated', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout', 'dead-end': '1' });
    assert.match(out, /\*\*`d\/dead-end`\*\*\s+→ Close it as a dead end — completed/);
    assert.match(out, /no discussion owed/);
    assert.match(out, /reversible from the map/);
  });

  it('the menu stands alone while the register is empty', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.ok(out.startsWith('=== MENU: research conclude gate'), 'no display precedes the menu');
    assert.ok(!out.includes('DISPLAY: research threads'));
  });

  it('prepends the register above the menu whenever the topic holds a thread — with and without the dead-end row', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress', threads: {
          'cart-persistence': { question: 'Does the cart survive a session?', status: 'learned', origin: 'seed', parent: null },
          'guest-checkout': { question: 'Can a guest check out at all?', status: 'open', origin: 'brief', parent: null },
        } } } },
      },
    });
    for (const args of [{ dotpath: 'pay.research.checkout' }, { dotpath: 'pay.research.checkout', 'dead-end': '1' }]) {
      const out = renderSurface(dir, 'research-conclude-gate', args);
      assert.ok(out.startsWith('=== DISPLAY: research threads (emit verbatim as a text code block (```text fence)) ===\n'), 'the display opens the response — a menu follows, so it carries no continue instruction');
      assert.ok(out.indexOf('DISPLAY: research threads') < out.indexOf('=== MENU: research conclude gate'), 'display above the menu');
      assert.match(out, /Research Threads — Checkout \(2 threads — 1 open · 1 learned\)/);
      assert.match(out, /├─ ○ Can a guest check out at all\?\s+\[brief\]\n {2}└─ ● Does the cart survive a session\?\s+\[seed\]/);
      assert.match(out, /\*\*`y\/yes`\*\*\s+→ Mark this topic as complete, ready for discussion/);
      assert.strictEqual(out.includes('dead end'), 'dead-end' in args, 'the dead-end row still follows the flag alone');
    }
  });
});

describe('render defer-gate', () => {
  let dir;
  const withSubtopics = (subtopics) => writeManifest(dir, 'pay', {
    phases: {
      research: { items: { checkout: { status: 'completed' } } },
      discussion: { items: { checkout: { status: 'in-progress', subtopics } } },
    },
  });
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('draws the map, then the consent over what it holds undecided', () => {
    withSubtopics({
      'token-refresh': { status: 'exploring', parent: null },
      'session-storage': { status: 'decided', parent: null },
    });
    assert.strictEqual(renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.checkout' }), [
      '=== DISPLAY: discussion map (emit verbatim as a text code block (```text fence)) ===',
      'Discussion Map — Checkout (2 subtopics — 1 decided · 1 exploring)',
      '  ├─ ✓ Session Storage    [decided]',
      '  └─ ◐ Token Refresh      [exploring]',
      "=== MENU: defer gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'There is still 1 subtopic not yet decided — shown on the map above.',
      '',
      '**`◆ Defer and conclude?`**',
      '',
      '**`y/yes`** → Defer it and move toward concluding',
      '**`n/no`**  → Continue discussing',
      '',
    ].join('\n'));
  });

  it('counts every subtopic still open', () => {
    withSubtopics({ a: { status: 'pending', parent: null }, b: { status: 'converging', parent: null } });
    const out = renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.checkout' });
    assert.match(out, /There are still 2 subtopics not yet decided — shown on the map above\./);
    assert.match(out, /Defer them and move toward concluding/);
  });

  it('refuses a settled map, another phase, and a topic with no discussion', () => {
    withSubtopics({ a: { status: 'decided', parent: null }, b: { status: 'deferred', parent: null } });
    assert.throws(() => renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.checkout' }),
      /render defer-gate: nothing on "checkout"'s map is undecided — there is nothing to defer/);
    assert.throws(() => renderSurface(dir, 'defer-gate', { dotpath: 'pay.research.checkout' }),
      /render defer-gate: address must be <wu>\.discussion\.<topic> — the map is the discussion's; got phase "research"/);
    assert.throws(() => renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.ghost' }),
      /render defer-gate: no discussion item "ghost" — no map to defer from/);
  });
});

describe('render research-threads', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: {
          checkout: { status: 'in-progress', threads: {
            'cart-persistence': { question: 'Does the cart survive a session?', status: 'parked', origin: 'seed', parent: null, note: 'needs a device cycle' },
          } },
          shipping: { status: 'in-progress' },
        } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('renders the register as one DISPLAY section — the whole response, so it carries the continue instruction', () => {
    const out = renderSurface(dir, 'research-threads', { dotpath: 'pay.research.checkout' });
    assert.strictEqual(out, [
      '=== DISPLAY: research threads (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Research Threads — Checkout (1 thread)',
      '  └─ ◌ Does the cart survive a session?    [seed]',
      '       ↳ Needs a device cycle',
      '',
    ].join('\n'));
  });

  it('answers empty over an empty register — nothing to emit, no header over nothing', () => {
    assert.strictEqual(renderSurface(dir, 'research-threads', { dotpath: 'pay.research.shipping' }), '');
  });

  it('pins the research address and refuses a topic with no research item', () => {
    assert.throws(() => renderSurface(dir, 'research-threads', { dotpath: 'pay.discussion.checkout' }),
      /render research-threads: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'research-threads', { dotpath: 'pay.research.ghost' }),
      /no research item "ghost" in the manifest/);
  });
});

describe('render send-offer', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the clear-home offer byte-exactly — destination named, override in hand', () => {
    const file = writePayload(dir, 'o.json', {
      title: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
    });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      '=== MENU: send offer (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Whether the pipeline can expose click windows** belongs to a different topic, not this one.',
      'It reads as **behavioural-ranking**\'s ground, landing research-side — append a phase to override (e.g. `s discussion`).',
      '',
      '**`◆ Where should it live?`**',
      '',
      '**`s/send`** → Send it to the topic it belongs to; it picks it up later',
      '**`k/keep`** → Keep it here as part of this topic',
      '',
    ].join('\n'));
  });

  it('renders the bare offer when no home is resolved', () => {
    const file = writePayload(dir, 'b.json', { title: 'A stray worry' });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /\*\*A stray worry\*\* belongs to a different topic, not this one\.\n\n\*\*/);
    assert.ok(!out.includes('ground, landing'), 'no destination line without a resolved home');
  });

  it('a new target adds the creation line byte-exactly — the two existing lines are untouched', () => {
    const file = writePayload(dir, 'n.json', {
      title: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
      new_target: true,
    });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: send offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**Whether the pipeline can expose click windows** belongs to a different topic, not this one.',
      "It reads as **behavioural-ranking**'s ground, landing research-side — append a phase to override (e.g. `s discussion`).",
      "**behavioural-ranking** isn't on the map yet — sending it creates it.",
      '',
      '**`◆ Where should it live?`**',
      '',
      '**`s/send`** → Send it to the topic it belongs to; it picks it up later',
      '**`k/keep`** → Keep it here as part of this topic',
      '',
    ].join('\n'));
  });

  it('a grown thread reframes both lines byte-exactly — creation, not relocation', () => {
    const file = writePayload(dir, 'g.json', {
      title: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
      grown: true,
    });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: send offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**Whether the pipeline can expose click windows** has grown into its own topic here.',
      'Sending it creates **behavioural-ranking** on the map, landing research-side — the material stays in this file and feeds the new topic through the message and the provenance read at its discussion. Append a phase to override (e.g. `s discussion`).',
      '',
      '**`◆ Where should it live?`**',
      '',
      '**`s/send`** → Send it to the topic it belongs to; it picks it up later',
      '**`k/keep`** → Keep it here as part of this topic',
      '',
    ].join('\n'));
    assert.ok(!out.includes('belongs to a different topic'), 'a grown thread never reads as relocation');
    assert.ok(!out.includes("isn't on the map yet"), 'the creation line is folded into the grown wording');
  });

  it('validates loudly — title required, target and phase together, phase constrained, flags need a name', () => {
    const bad = (name, obj) => renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    assert.throws(() => bad('c.json', { target: 't', landing_phase: 'research' }), /"title" must be a non-empty string/);
    assert.throws(() => bad('t.json', { title: 'x', target: 't' }), /come together/);
    assert.throws(() => bad('p.json', { title: 'x', landing_phase: 'research' }), /come together/);
    assert.throws(() => bad('l.json', { title: 'x', target: 't', landing_phase: 'planning' }), /"landing_phase" must be "research" or "discussion"/);
    assert.throws(() => bad('g1.json', { title: 'x', grown: true }),
      /"grown" needs "target" and "landing_phase" — a thread that grew into its own topic carries the name it grew into/);
    assert.throws(() => bad('n1.json', { title: 'x', new_target: true }),
      /"new_target" needs "target" — there is no new topic without a name/);
    assert.throws(() => bad('ft.json', { title: 'x', target: 't', landing_phase: 'research', grown: 'yes' }), /"grown" must be true or false/);
    assert.throws(() => bad('fn.json', { title: 'x', target: 't', landing_phase: 'research', new_target: 1 }), /"new_target" must be true or false/);
    assert.throws(() => renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
  });
});

describe('render send-candidates', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('states the title and the research recommendation above the question, the numbered candidates and the new option beneath it, byte-exactly', () => {
    const file = writePayload(dir, 'c.json', {
      title: 'Click-window feasibility',
      landing_phase: 'research',
      candidates: [
        { name: 'behavioural-ranking', lifecycle: 'decided' },
        { name: 'relevance-measurement', lifecycle: 'fresh' },
      ],
    });
    const out = renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: send candidates (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      "**Click-window feasibility** belongs to a different topic, not this one. It reads as an open question — I'd land it research-side. Reply with an option, appending a phase to override (e.g. `1 discussion`).",
      '',
      '**`◆ Where should it land?`**',
      '',
      '**`1`**     → behavioural-ranking [decided]',
      '**`2`**     → relevance-measurement [fresh]',
      '**`n/new`** → Create a new topic for it',
      '',
    ].join('\n'));
  });

  it('a candidate wears the map\'s own words, never the raw manifest token', () => {
    const file = writePayload(dir, 'l.json', {
      title: 'x', landing_phase: 'research',
      candidates: [
        { name: 'behavioural-ranking', lifecycle: 'handled' },
        { name: 'relevance-measurement', lifecycle: 'ready_for_discussion' },
        { name: 'signal-freshness', lifecycle: 'ready_for_discussion', research_state: 'superseded' },
        { name: 'query-parsing', lifecycle: 'fresh', routing: 'discussion' },
      ],
    });
    const out = renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /→ behavioural-ranking \[dead end\]/);
    assert.match(out, /→ relevance-measurement \[research complete · ready for/);
    assert.match(out, /→ signal-freshness \[research superseded · ready for/);
    assert.match(out, /→ query-parsing \[fresh · routed to discussion\]/);
    assert.ok(!out.includes('[handled]'), 'the raw token never reaches the reader');
    assert.ok(!out.includes('[ready_for_discussion]'), 'the raw token never reaches the reader');
  });

  it('refuses a lifecycle outside the map vocabulary — a mislabel is worse than an echo', () => {
    const file = writePayload(dir, 'u.json', {
      title: 'x', landing_phase: 'research',
      candidates: [{ name: 'a', lifecycle: 'in-progress' }],
    });
    assert.throws(() => renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file }),
      /candidate 1 carries unknown lifecycle "in-progress" \(expected ready_for_discussion\/researching\/discussing\/decided\/fresh\/handled\/cancelled\/postponed\)/);
  });

  it('the discussion recommendation flips the wording and the override example', () => {
    const file = writePayload(dir, 'd.json', {
      title: 'x', landing_phase: 'discussion',
      candidates: [{ name: 'a', lifecycle: 'fresh' }],
    });
    const out = renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /a decision to make — I'd land it discussion-side/);
    assert.match(out, /e\.g\. `1 research`/);
  });

  it('validates loudly — phase constrained, candidates non-empty and complete', () => {
    const bad = (name, obj) => renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    assert.throws(() => bad('p.json', { title: 'x', landing_phase: 'scoping', candidates: [{ name: 'a', lifecycle: 'f' }] }), /"landing_phase" must be "research" or "discussion"/);
    assert.throws(() => bad('e.json', { title: 'x', landing_phase: 'research', candidates: [] }), /"candidates" must be a non-empty array/);
    assert.throws(() => bad('m.json', { title: 'x', landing_phase: 'research', candidates: [{ name: 'a' }] }), /candidate 1 is missing "lifecycle"/);
  });
});

describe('render finding-announce', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const agents = require('../../skills/workflow-engine/scripts/domain/agent-state.cjs');
  const announce = (id, file) => renderSurface(dir, 'finding-announce', { dotpath: 'pay.discussion.checkout', id, file });
  // A dispatched agent's report lands and the scan promotes it; the ack, when
  // given its findings, reads it.
  const landed = (opts, findings) => {
    const row = agents.dispatchAgent(dir, 'pay', 'discussion', 'checkout', opts);
    fs.writeFileSync(row.file, '# Report\n');
    agents.scanAgents(dir, 'pay', 'discussion', 'checkout');
    if (findings) agents.ackAgent(dir, 'pay', 'discussion', 'checkout', row.id, { findings });
    return row.id;
  };
  const shape = () => writePayload(dir, 'ann.json', { shape: '3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere' });

  it('renders the opt-in gate — the row\'s kind and finding count, the payload\'s lane split, glyphed question, y/l options', () => {
    const id = landed({ kind: 'review' }, Array.from({ length: 16 }, (_, i) => `F${i + 1}`));
    assert.strictEqual(announce(id, shape()), [
      '=== MENU: finding announce (emit verbatim as markdown (not a code block)) ===',
      DOTS,
      'Background review returned — 16 finding(s): 3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere.',
      '',
      '**`◆ Work through them now?`**',
      '',
      '**`y/yes`**   → Start on them',
      "**`l/later`** → Keep pulling on the current thread, I'll raise them at",
      `${NB(10)}the next pause`,
      '',
    ].join('\n'));
  });

  it('names a synthesis by its kind', () => {
    const { agents: pair } = agents.dispatchAgent(dir, 'pay', 'discussion', 'checkout', { kind: 'perspective', labels: ['ship-now', 'strategic-timing'] });
    for (const lens of pair) fs.writeFileSync(lens.file, '# Case\n');
    agents.scanAgents(dir, 'pay', 'discussion', 'checkout');
    const id = landed({ kind: 'synthesis', set: '001' }, ['T1', 'T2']);
    assert.match(announce(id, shape()), /^Background synthesis returned — 2 finding\(s\): /m);
  });

  it('refuses a row not yet read, one with findings already surfaced, and an id the store does not hold', () => {
    const unread = landed({ kind: 'review' });
    assert.throws(() => announce(unread, shape()),
      /render finding-announce: "review-001" is pending — the announce follows the first read, before any finding surfaces/);
    agents.ackAgent(dir, 'pay', 'discussion', 'checkout', unread, { findings: ['F1', 'F2'] });
    agents.surfaceFinding(dir, 'pay', 'discussion', 'checkout', unread, 'F1');
    assert.throws(() => announce(unread, shape()),
      /"review-001" is acknowledged with findings already surfaced — the announce follows the first read/);
    assert.throws(() => announce('review-009', shape()), /render finding-announce: no agent "review-009" for discussion\/checkout/);
  });

  it('refuses a missing id, a missing payload, and an empty shape by name', () => {
    const id = landed({ kind: 'review' }, ['F1']);
    assert.throws(() => announce(undefined, shape()), /render finding-announce: --id <agent id> is required/);
    assert.throws(() => announce(id, undefined), /render finding-announce: --file <payload\.json> is required/);
    assert.throws(() => announce(id, writePayload(dir, 'n1.json', {})), /"shape" must be a non-empty string/);
  });
});

describe('render finding-batch', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the apply lane — fixed intro, unglyphed worklist rows, y/Ask menu', () => {
    const file = writePayload(dir, 'a.json', {
      lane: 'apply',
      items: [
        { title: 'Self-containment is holed by `excluded`', detail: 'Restate the invariant as ownership, not transport.' },
        { title: 'A retracted rationale survives unmarked', detail: 'Superseded when copy-only won; mark it superseded.' },
      ],
    });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      '=== DISPLAY: finding batch (emit verbatim as markdown (not a code block)) ===',
      "The fix follows from what's already decided. Nothing here is a choice.",
      '',
      '1\\. Self-containment is holed by \\`excluded\\`',
      `${NB(5)}↳ Restate the invariant as ownership, not transport.`,
      '2\\. A retracted rationale survives unmarked',
      `${NB(5)}↳ Superseded when copy-only won; mark it superseded.`,
      '',
      "=== MENU: finding batch (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Apply them?`**',
      '',
      '**`y/yes`** → Apply all 2, then move on',
      "**Ask**   → Tell me a number to expand, or one you don't think is",
      `${NB(8)}settled`,
      '',
    ].join('\n'));
  });

  it('renders the settled lane — the call intro, the a/auto row above the prompts', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 's.json', {
      lane: 'settled',
      items: [
        { title: 'A repeated field name resolves to its last occurrence', detail: 'The sweep table leans this way; first-wins also fits the record.' },
        { title: 'An empty bare value writes a newline', detail: 'The output contract leans this way; zero bytes also fits the record.' },
      ],
    });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file });
    assert.strictEqual(out, [
      '=== DISPLAY: finding batch (emit verbatim as markdown (not a code block)) ===',
      "Each of these is a call I've made, with what it rests on named beside it.",
      '',
      '1\\. A repeated field name resolves to its last occurrence',
      `${NB(5)}↳ The sweep table leans this way; first-wins also fits the`,
      `${NB(7)}record.`,
      '2\\. An empty bare value writes a newline',
      `${NB(5)}↳ The output contract leans this way; zero bytes also fits`,
      `${NB(7)}the record.`,
      '',
      "=== MENU: finding batch (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Document them?`**',
      '',
      '**`y/yes`**   → Document all 2 and move on',
      '**`a/auto`**  → Document this screen and every remaining settled',
      `${NB(10)}finding automatically`,
      "**Discuss** → Say discuss and a number — I'll raise it after the rest",
      `${NB(10)}land`,
      '**Ask**     → Tell me a number to expand',
      '',
    ].join('\n'));
  });

  it('a settled screen under auto lands as a display — no menu, nothing overridden', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const two = writePayload(dir, 'auto.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }, { title: 'B', detail: 'b.' }] });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: two });
    assert.ok(out.startsWith('=== DISPLAY: finding batch auto-approved (emit verbatim as markdown (not a code block) — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\n'));
    assert.ok(out.includes("Each of these is a call I've made"), 'the screen still shows what landed');
    assert.ok(out.endsWith('\nDocumenting all 2 [auto].\n'), 'the line is true when it is emitted — the landings follow it');
    assert.ok(!out.includes('MENU'), 'the lane that carries the flip never stops once it is set');
    assert.ok(!out.includes('Auto is on'), 'a screen that does not stop overrides nothing');
    const one = writePayload(dir, 'auto1.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }] });
    assert.ok(renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: one })
      .endsWith('\nDocumenting it [auto].\n'), 'the singular reads singular');
  });

  it('the other lanes are scans a user is present for — auto never lands one', () => {
    // The gate mode is the findings walk's, and the planning walk holds one:
    // its call lane is `decide`, which has no flip of its own to answer.
    writeManifest(dir, 'pay', {
      phases: {
        planning: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'auto' } } },
        specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'auto' } } },
      },
    });
    for (const [dotpath, lane, items] of [
      ['pay.planning.checkout', 'decide', [{ title: 'A', detail: 'a.' }]],
      ['pay.planning.checkout', 'apply', [{ title: 'A', detail: 'a.' }]],
      ['pay.planning.checkout', 'route', [{ title: 'A', target: 't', detail: 'a.' }]],
      ['pay.specification.checkout', 'apply', [{ title: 'A', detail: 'a.' }]],
      ['pay.specification.checkout', 'route', [{ title: 'A', target: 't', detail: 'a.' }]],
    ]) {
      const file = writePayload(dir, `scan-${dotpath}-${lane}.json`, { lane, items });
      const out = renderSurface(dir, 'finding-batch', { dotpath, file });
      assert.ok(out.includes('=== MENU: finding batch'), `${dotpath} ${lane}: the screen still asks`);
      assert.ok(!out.includes('auto-approved'), `${dotpath} ${lane}: no lane but settled has an auto form`);
      assert.ok(!out.includes('Auto is on'), `${dotpath} ${lane}: a scan overrides nothing`);
    }
  });

  it("the call lane is the address's: settled at the specification, decide everywhere else", () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    const settled = writePayload(dir, 'cl1.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }] });
    const decide = writePayload(dir, 'cl2.json', { lane: 'decide', items: [{ title: 'A', detail: 'a.' }] });
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: settled }),
      /lane "settled" is not served at the discussion phase — its call lane is "decide"/,
    );
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: decide }),
      /lane "decide" is not served at the specification phase — its call lane is "settled"/,
    );
    assert.ok(renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: settled }).includes('`◆ Document it?`'));
    assert.ok(renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: decide }).includes('`◆ Document it?`'));
  });

  it('only the settled lane offers the flip — the other lanes have no gate to set', () => {
    for (const lane of ['apply', 'decide', 'route']) {
      const file = writePayload(dir, `na-${lane}.json`, { lane, items: [{ title: 'A', target: 't', detail: 'a.' }] });
      assert.ok(!renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file }).includes('`a/auto`'), lane);
    }
  });

  it('renders the decide lane — call intro, y/Discuss/Ask menu', () => {
    const file = writePayload(dir, 'd.json', {
      lane: 'decide',
      items: [
        { title: 'The drain signal carries intent', detail: 'All three exit routes sent one signal; determined by the exit table.' },
        { title: 'Unrecognised socket peer stamps `via: cli`', detail: 'A script you wired up is the same class as the CLI; determined by the enum.' },
      ],
    });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      '=== DISPLAY: finding batch (emit verbatim as markdown (not a code block)) ===',
      "Each of these is a call I've made, with what it rests on named beside it.",
      '',
      '1\\. The drain signal carries intent',
      `${NB(5)}↳ All three exit routes sent one signal; determined by the`,
      `${NB(7)}exit table.`,
      '2\\. Unrecognised socket peer stamps \\`via: cli\\`',
      `${NB(5)}↳ A script you wired up is the same class as the CLI;`,
      `${NB(7)}determined by the enum.`,
      '',
      "=== MENU: finding batch (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Document them?`**',
      '',
      '**`y/yes`**   → Document all 2 and move on',
      "**Discuss** → Say discuss and a number — I'll raise it after the rest",
      `${NB(10)}land`,
      '**Ask**     → Tell me a number to expand',
      '',
    ].join('\n'));
  });

  it('a remainder count rides the confirm; singleton screens read singular', () => {
    const two = writePayload(dir, 'rem.json', {
      lane: 'decide',
      remaining: 7,
      items: [
        { title: 'A', detail: 'a.' },
        { title: 'B', detail: 'b.' },
      ],
    });
    const plural = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: two });
    assert.match(plural, /`◆ Document them\?`/);
    assert.match(plural, /→ Document all 2 and move on \(7 more after this\)$/m);
    const one = writePayload(dir, 'one.json', { lane: 'decide', items: [{ title: 'A', detail: 'a.' }] });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: one });
    assert.match(out, /`◆ Document it\?`/);
    assert.match(out, /→ Document it and move on$/m);
    assert.match(out, /^This one is a call I've made/m);
    const applyOne = writePayload(dir, 'ap1.json', { lane: 'apply', items: [{ title: 'A', detail: 'a.' }] });
    const applied = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: applyOne });
    assert.match(applied, /`◆ Apply it\?`/);
    assert.match(applied, /→ Apply it, then move on$/m);
    const routeOne = writePayload(dir, 'ro1.json', { lane: 'route', items: [{ title: 'A', target: 't', detail: 'a.' }] });
    const routed = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: routeOne });
    assert.match(routed, /`◆ Send it\?`/);
    assert.match(routed, /→ Send it$/m);
    const bad = writePayload(dir, 'badrem.json', { lane: 'decide', remaining: -1, items: [{ title: 'A', detail: 'a.' }] });
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: bad }),
      /"remaining" must be a non-negative integer/,
    );
  });

  it('caps a screen at five items across every lane', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ title: `Item ${i + 1}`, detail: `Detail ${i + 1}` }));
    for (const lane of ['apply', 'decide']) {
      const file = writePayload(dir, `cap-${lane}.json`, { lane, items });
      assert.throws(
        () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file }),
        /a screen holds at most 5 items \(6 given\)/,
      );
    }
    const routeItems = items.map((it) => ({ ...it, target: 'storage' }));
    const rfile = writePayload(dir, 'cap-route.json', { lane: 'route', items: routeItems });
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: rfile }),
      /a screen holds at most 5 items/,
    );
  });

  it('renders the route lane — destination in the tag slot, send wording, no label line', () => {
    const file = writePayload(dir, 'r.json', {
      lane: 'route',
      items: [{ title: 'Spec readiness rests on window_state', target: 'storage-and-sync', detail: 'Their subtopic owns the claim.' }],
    });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /^1\\\. Spec readiness rests on window\\_state `\[→ storage-and-sync\]`$/m);
    assert.match(out, /\*\*`y\/yes`\*\* → Send it$/m);
    assert.match(out, /one that should stay here/);
    assert.ok(out.includes(`${DOTS}\n**\`◆ Send it?\`**\n\n**\`y/yes\`**`), 'a label-less menu opens on its question');
    const two = writePayload(dir, 'r2.json', {
      lane: 'route',
      items: [
        { title: 'Spec readiness rests on window_state', target: 'storage-and-sync', detail: 'Their subtopic owns the claim.' },
        { title: 'Retry budget belongs to the sync loop', target: 'storage-and-sync', detail: 'Their loop owns the budget.' },
      ],
    });
    const plural = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: two });
    assert.ok(plural.includes(`${DOTS}\n**\`◆ Send them?\`**\n\n**\`y/yes\`**`), 'the plural asks for the set');
    assert.match(plural, /\*\*`y\/yes`\*\* → Send all 2$/m);
  });

  it("--first opens the drain's first screen on its lane's marker, the menu unchanged", () => {
    for (const [lane, marker, item] of [
      ['apply', 'No Decision Needed', { title: 'A', detail: 'a.' }],
      ['decide', 'Decided From the Record', { title: 'A', detail: 'a.' }],
      ['route', 'Belongs Elsewhere', { title: 'A', target: 't', detail: 'a.' }],
    ]) {
      const file = writePayload(dir, `first-${lane}.json`, { lane, items: [item] });
      const later = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file });
      const opening = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file, first: '1' });
      const [display, menuPart] = opening.split(/(?==== MENU: finding batch)/);
      assert.ok(display.startsWith(`=== DISPLAY: finding batch (emit verbatim as markdown (not a code block)) ===\n**\`▪ ${marker}\`**\n\n`),
        `${lane}: the marker heads the section it names, a blank line before the worklist`);
      assert.strictEqual(display.replace(`**\`▪ ${marker}\`**\n\n`, ''), later.split(/(?==== MENU: finding batch)/)[0],
        `${lane}: the worklist beneath it is the screen's own`);
      assert.ok(later.endsWith(menuPart), `${lane}: the menu is the same either way`);
      assert.ok(!later.includes('▪'), `${lane}: a later screen or a re-render carries no marker`);
    }
  });

  it('refuses --first on the settled lane — the specification batch heads nothing', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'first-settled.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }] });
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file, first: '1' }),
      /--first opens a drain on its lane's marker, and lane "settled" carries none/,
    );
  });

  it('validates loudly — unknown lane, empty items, per-item fields by lane', () => {
    const bad = (name, obj) => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    // `ask` is the walked lane's name — the plausible producer mistake is
    // sending it to the batch surface, which has no walked screen.
    assert.throws(() => bad('l.json', { lane: 'ask', items: [{ title: 't', detail: 'd' }] }), /"lane" must be one of apply, settled, decide, route/);
    // An inherited property name is not a lane — the lookup is own-keys only.
    assert.throws(() => bad('proto.json', { lane: 'constructor', items: [{ title: 't', detail: 'd' }] }), /"lane" must be one of apply, settled, decide, route/);
    assert.throws(() => bad('e.json', { lane: 'apply', items: [] }), /"items" must be a non-empty array of \{title, detail\}/);
    assert.throws(() => bad('m.json', { lane: 'apply', items: [{ title: 't' }] }), /item 1 is missing "detail"/);
    assert.throws(() => bad('t.json', { lane: 'route', items: [{ title: 't', detail: 'd' }] }), /item 1 is missing "target"/);
    assert.throws(() => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
  });
});

describe('render mailbox surfaces', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'wu', {});
  });
  afterEach(() => teardown(dir));

  function writeMailbox(topic, files) {
    const mailbox = path.join(dir, '.leeway', 'wu', 'discussion', '.mailbox', topic);
    fs.mkdirSync(mailbox, { recursive: true });
    for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(mailbox, f), body);
  }

  it('mail-announce derives the count with verb agreement, refusing an empty mailbox', () => {
    assert.throws(() => renderSurface(dir, 'mail-announce', { dotpath: 'wu.discussion.measurement' }), /mailbox is empty — nothing to announce/);
    writeMailbox('measurement', { '001-a.md': 'x' });
    const one = renderSurface(dir, 'mail-announce', { dotpath: 'wu.discussion.measurement' });
    assert.ok(one.startsWith('=== DISPLAY: mail announce (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ==='), one);
    assert.ok(one.includes('1 message from another topic waits'), one);
    writeMailbox('measurement', { '002-b.md': 'y' });
    const two = renderSurface(dir, 'mail-announce', { dotpath: 'wu.discussion.measurement' });
    assert.ok(two.includes('2 messages from other topics wait'), two);
  });

  it('mail-offer renders the agenda in mailbox order and the yes/later menu', () => {
    writeMailbox('measurement', { '001-metrics.md': 'a', '002-tracking.md': 'b' });
    const file = writePayload(dir, 'offer.json', { items: [
      { file: '002-tracking.md', title: 'Expansion tracking', origin: 'synonyms', from_phase: 'discussion', from_date: '2026-08-02' },
      { file: '001-metrics.md', title: 'Offline metrics', origin: 'ranking', from_phase: 'discussion', from_date: '2026-08-01' },
    ] });
    const out = renderSurface(dir, 'mail-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.startsWith([
      '=== DISPLAY: mail agenda (emit verbatim as markdown (not a code block)) ===',
      '**Mailbox** — 2 messages',
      '',
      '○ 1. Offline metrics',
      `${NB(7)}↳ From ranking · discussion · 2026-08-01`,
      '○ 2. Expansion tracking',
      `${NB(7)}↳ From synonyms · discussion · 2026-08-02`,
    ].join('\n')), out);
    assert.ok(out.includes("=== MENU: mail offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ==="));
    assert.ok(out.includes('Work through them now?'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Surface and discuss them one at a time/.test(out));
    assert.ok(/\*\*`l\/later`\*\* +→ Carry on with the session/.test(out));
  });

  it('mail-offer wraps a sentence-length title under itself, with the note beneath', () => {
    writeMailbox('measurement', { '001-metrics.md': 'a' });
    const file = writePayload(dir, 'offer.json', { items: [
      { file: '001-metrics.md', title: 'A preset binding persists until broken — three revisions to the positioning model', origin: 'note-model', from_phase: 'discussion', from_date: '2026-07-30' },
    ] });
    const out = renderSurface(dir, 'mail-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.includes([
      '**Mailbox** — 1 message',
      '',
      '○ 1. A preset binding persists until broken — three revisions to',
      `${NB(5)}the positioning model`,
      `${NB(7)}↳ From note-model · discussion · 2026-07-30`,
    ].join('\n')), out);
    // No agenda row may overflow the width the display was sized to —
    // engine-wrapped even as markdown, so a soft-wrap never restarts a
    // continuation at column zero. Markers and menu lines reflow freely.
    const agenda = out.split('=== MENU')[0].split('===\n')[1];
    for (const line of agenda.split('\n')) assert.ok(line.length <= 65, `overflowing row: ${line}`);
  });

  it('mail-offer refuses an empty mailbox, a short payload, and a payload naming a file the mailbox lacks', () => {
    const file = writePayload(dir, 'offer.json', { items: [
      { file: '001-metrics.md', title: 'T', origin: 'o', from_phase: 'discussion', from_date: 'd' },
    ] });
    assert.throws(() => renderSurface(dir, 'mail-offer', { dotpath: 'wu.discussion.measurement', file }), /mailbox is empty — nothing to offer/);
    writeMailbox('measurement', { '001-metrics.md': 'a', '002-tracking.md': 'b' });
    assert.throws(() => renderSurface(dir, 'mail-offer', { dotpath: 'wu.discussion.measurement', file }), /payload items must cover the mailbox exactly/);
    const wrong = writePayload(dir, 'wrong.json', { items: [
      { file: '001-metrics.md', title: 'T', origin: 'o', from_phase: 'discussion', from_date: 'd' },
      { file: '999-ghost.md', title: 'G', origin: 'o', from_phase: 'discussion', from_date: 'd' },
    ] });
    assert.throws(() => renderSurface(dir, 'mail-offer', { dotpath: 'wu.discussion.measurement', file: wrong }), /payload items must cover the mailbox exactly/);
    const missing = writePayload(dir, 'missing.json', { items: [{ file: '001-metrics.md', title: 'T', origin: 'o', from_date: 'd' }] });
    assert.throws(() => renderSurface(dir, 'mail-offer', { dotpath: 'wu.discussion.measurement', file: missing }), /item 1 is missing "from_phase"/);
  });

  it('forward-offer renders the statement, the diamond question naming the other phase, and the yes/discuss menu', () => {
    writeMailbox('measurement', { '001-a-decision-owed.md': 'x' });
    const file = writePayload(dir, 'rq.json', {
      file: '001-a-decision-owed.md', title: 'A decision owed', reason: 'it asks this topic to decide, not to find out.',
    });
    const out = renderSurface(dir, 'forward-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.startsWith("=== MENU: forward offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ==="), out);
    assert.ok(out.includes('**A decision owed** — it asks this topic to decide, not to find out.'), out);
    assert.ok(out.includes('**`◆ Move it to research?`**'), out);
    assert.ok(/\*\*`y\/yes`\*\* +→ Move it to this topic's research mailbox/.test(out), out);
    assert.ok(/\*\*`d\/discuss`\*\* +→ Work it here now/.test(out), out);

    const rdir = path.join(dir, '.leeway', 'wu', 'research', '.mailbox', 'measurement');
    fs.mkdirSync(rdir, { recursive: true });
    fs.writeFileSync(path.join(rdir, '001-a-decision-owed.md'), 'x');
    const rout = renderSurface(dir, 'forward-offer', { dotpath: 'wu.research.measurement', file });
    assert.ok(rout.includes('**`◆ Move it to discussion?`**'), rout);
    assert.ok(rout.includes("Move it to this topic's discussion mailbox"), rout);
  });

  it('forward-offer refuses a missing payload field, a file the mailbox lacks, and a phase outside the pair', () => {
    writeMailbox('measurement', { '001-a.md': 'x' });
    assert.throws(() => renderSurface(dir, 'forward-offer', { dotpath: 'wu.discussion.measurement' }), /--file <payload\.json> is required/);
    const missing = writePayload(dir, 'missing.json', { file: '001-a.md', title: 'T' });
    assert.throws(() => renderSurface(dir, 'forward-offer', { dotpath: 'wu.discussion.measurement', file: missing }), /"reason" must be a non-empty string/);
    const ghost = writePayload(dir, 'ghost.json', { file: '009-ghost.md', title: 'T', reason: 'r' });
    assert.throws(() => renderSurface(dir, 'forward-offer', { dotpath: 'wu.discussion.measurement', file: ghost }), /is not in the measurement discussion mailbox/);
    const ok = writePayload(dir, 'ok.json', { file: '001-a.md', title: 'T', reason: 'r' });
    assert.throws(() => renderSurface(dir, 'forward-offer', { dotpath: 'wu.investigation.measurement', file: ok }), /research\/discussion pair only/);
  });

  it('mail-block derives the count and the phase word, refusing an empty mailbox', () => {
    assert.throws(() => renderSurface(dir, 'mail-block', { dotpath: 'wu.discussion.measurement' }), /mailbox is empty — nothing blocks conclusion/);
    writeMailbox('measurement', { '001-a.md': 'x' });
    const out = renderSurface(dir, 'mail-block', { dotpath: 'wu.discussion.measurement' });
    assert.ok(out.startsWith([
      '=== DISPLAY: mail block (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ Mailbox not empty — 1 message awaiting discussion',
      '',
      '=== DISPLAY: mail block guidance (emit verbatim as markdown (not a code block)) ===',
      '> Returning to the session to surface them before concluding.',
    ].join('\n')), out);
    const rdir = path.join(dir, '.leeway', 'wu', 'research', '.mailbox', 'measurement');
    fs.mkdirSync(rdir, { recursive: true });
    fs.writeFileSync(path.join(rdir, '001-a.md'), 'x');
    fs.writeFileSync(path.join(rdir, '002-b.md'), 'y');
    const rout = renderSurface(dir, 'mail-block', { dotpath: 'wu.research.measurement' });
    assert.ok(rout.includes('2 messages awaiting exploration'), rout);
  });
});

describe('render spec-review-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('continue variant renders the escape-hatch menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'continue' });
    assert.ok(out.includes('=== MENU: spec review continue gate'));
    assert.ok(out.includes('**`◆ Continue with review?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue review/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip review, proceed to completion/.test(out));
  });

  it('reloop variant renders the another-cycle menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'reloop' });
    assert.ok(out.includes('=== MENU: spec review reloop gate'));
    assert.ok(out.includes('**`◆ Run another review cycle?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Run another review cycle \(all three phases\)/.test(out));
    assert.ok(/\*\*`p\/proceed`\*\* +→ Proceed to completion/.test(out));
  });

  it('rejects a missing or unknown variant and a non-specification address', () => {
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal' }), /--variant must be "continue" or "reloop"/);
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'again' }), /--variant must be "continue" or "reloop"/);
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.planning.portal', variant: 'reloop' }), /address must be <work_unit>\.specification\.<topic>/);
  });
});

describe('render convergence-diagnostic', () => {
  let dir;
  const base = {
    loop_type: 'spec-review', latest_cycle: 5, trend: 'converging',
    resolved: [{ title: 'Marker semantics restated twice', last_seen_cycle: 4 }],
    recurring: [{ title: 'Guard scope drifts per section', cycles: '3, 4, 5', hypothesis: 'Each fix re-words the guard where it lands instead of at its home.' }],
    new: [{ title: 'Sweep table omits the two below-the-line files' }],
    stream_counts: [{ label: 'claims', count: 0 }, { label: 'input review', count: 1 }, { label: 'gap analysis', count: 1 }],
    review_baseline_words: 6835, live_words: 13637,
  };
  const flagText = (s) => s.slice(s.indexOf('⚑')).replace(/\n\s+/g, ' ').trim();
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the head, streams, signed growth, finding sections, and the growth note', () => {
    const file = writePayload(dir, 'c.json', base);
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: convergence diagnostic (emit verbatim as a text code block (```text fence)) ==='));
    assert.ok(out.includes('===\n── Spec Review — cycle 5 diagnostic ─'), 'the heading is the drawn in-fence divider');
    assert.strictEqual([...out.split('\n')[1]].length, 65, 'the divider fills the display width');
    assert.ok(out.includes('  Trend: converging'));
    assert.ok(out.includes('  Latest cycle: 2 findings (1 new, 1 recurring)'), 'counts derive from the arrays');
    assert.ok(out.includes('  Per stream: claims 0 · input review 1 · gap analysis 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.ok(out.includes('    • Marker semantics restated twice (fixed in cycle 4)'));
    assert.ok(out.includes('    • Guard scope drifts per section (cycles 3, 4, 5)\n      · Each fix re-words the guard where it lands instead of at\n        its home.'), 'the hypothesis is a sub-detail under the bullet text, wrapped under its own marker');
    assert.ok(out.includes('  ⚑ Resolved findings outnumber new ones — the cycles are closing\n    ground.'));
    assert.ok(out.includes('⚑ Review has added 6802 words to a 6835-word construction.'), 'the >25% growth note fires and names the spec loop\'s document');
    assert.match(flagText(out), /growth from review-authored rules is the review deciding for the user\./, 'the growth note names review-authored growth');
    assert.ok(!flagText(out).includes('writing rules the record never decided'), 'the churn warning stays quiet on a converging trend');
  });

  it('churning with growth fires both spec flags; negative growth renders signed and quiets the note', () => {
    const churn = writePayload(dir, 'c2.json', { ...base, trend: 'churning' });
    let out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: churn });
    assert.match(flagText(out), /the review is writing rules the record never decided/, 'the churn-growth warning fires');
    assert.match(flagText(out), /anything else is a decision nobody made/, 'the warning names the bar a finding clears');
    assert.ok(!flagText(out).includes('before running another cycle'), 'the warning describes the churn, it never orders the next cycle');
    assert.ok(out.includes('⚑ Review has added 6802 words'));
    const shrink = writePayload(dir, 'c3.json', { ...base, live_words: 6500 });
    out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: shrink });
    assert.ok(out.includes('(-335 net across review)'), 'shrink renders a signed value, never +-');
    assert.ok(!out.includes('Review has added'), 'no growth note on a shrinking document');
  });

  it('the churn trend is loop-neutral — a fix loop carries the same sentence, alone', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'ch.json', { loop_type: 'fix', latest_cycle: 2, trend: 'churning', resolved: [{ title: 'Off-by-one', last_seen_cycle: 1 }], recurring: [], new: [{ title: 'Missing guard' }] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(flagText(out), '⚑ Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.');
  });

  it('planning-review carries growth too — the flags name the plan and the mechanism', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'pr.json', {
      ...base, loop_type: 'planning-review', trend: 'churning',
      stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 1 }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('── Plan Review — cycle 5 diagnostic ─'));
    assert.ok(out.includes('  Per stream: traceability 1 · integrity 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.match(flagText(out), /the review is writing mechanism the specification never decided/, 'the churn-growth warning reads for the plan');
    assert.match(flagText(out), /a corrected mechanism is the builder's\./, 'the warning leaves mechanism to the builder');
    assert.match(flagText(out), /Review has added 6802 words to a 6835-word plan\./, 'the growth note names the plan, never a construction');
    assert.match(flagText(out), /growth from review-authored mechanism is the review deciding for the builder\./);
    assert.ok(!flagText(out).includes('writing rules the record never decided'), 'the spec loop\'s wording stays with the spec loop');
  });

  it('every trend callout describes what the cycles show — none prescribes a next move', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const lines = {
      churning: '⚑ Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.',
      converging: '⚑ Resolved findings outnumber new ones — the cycles are closing ground.',
      stable: '⚑ Resolved and new findings match cycle for cycle — the loop is holding where it is.',
      diverging: '⚑ New findings outnumber resolved ones — the fixes are introducing new issues.',
    };
    for (const [trend, line] of Object.entries(lines)) {
      const file = writePayload(dir, `t-${trend}.json`, { loop_type: 'fix', latest_cycle: 2, trend, resolved: [], recurring: [], new: [{ title: 'Missing guard' }] });
      const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
      assert.strictEqual(flagText(out), line, `the ${trend} callout states the reading and stops there`);
    }
  });

  it('single-stream loops skip streams and growth; a fix-loop shape renders lean', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'f.json', { loop_type: 'fix', latest_cycle: 3, trend: 'stable', resolved: [], recurring: [{ title: 'Assertion drifts', cycles: '2, 3', hypothesis: 'The fixture regenerates with a shifting seed.' }], new: [] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('── Fix Loop — cycle 3 diagnostic ─'));
    assert.ok(!out.includes('Per stream'));
    assert.ok(!out.includes('Document growth'));
    assert.ok(!out.includes('Resolved:'), 'empty sections are skipped');
    assert.ok(out.includes('  ⚑ Resolved and new findings match cycle for cycle — the loop is\n    holding where it is.'), 'the stable flag wraps via the callout');
  });

  it('a long finding wraps with its continuation under the text, never at column 0', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'w.json', {
      loop_type: 'fix', latest_cycle: 3, trend: 'converging',
      resolved: [{ title: 'Detached-element mute is a no-op — a re-parented <style> goes live in the app document', last_seen_cycle: 1 }],
      recurring: [{ title: 'A hostile document stylesheet still reaches the application chrome (criterion 3)', cycles: '1, 2, 3', hypothesis: 'Containment rests on two mechanisms of unequal strength — the engine\'s own @scope matching, which has held under every probe, and a fallback the tests never reach.' }],
      new: [{ title: 'Nothing verifies the composed stylesheet\'s structure before it is published' }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    const body = out.split('\n').slice(1).filter((l) => l !== '' && !l.startsWith('==='));
    assert.ok(body.every((l) => [...l].length <= 65), 'every line fits the pinned width');
    assert.ok(body.every((l) => l === body[0] || l.startsWith('  ')), 'only the heading sits at column 0');
    assert.ok(out.includes('    • Detached-element mute is a no-op — a re-parented <style>\n      goes live in the app document (fixed in cycle 1)'), 'a resolved row wraps under its text');
    assert.ok(out.includes('    • A hostile document stylesheet still reaches the application\n      chrome (criterion 3) (cycles 1, 2, 3)\n      · Containment rests on two mechanisms of unequal strength —\n        the engine\'s own @scope matching, which has held under\n        every probe, and a fallback the tests never reach.'), 'the hypothesis wraps under its own marker at the bullet-text column');
    assert.ok(out.includes('    • Nothing verifies the composed stylesheet\'s structure before\n      it is published'), 'a new row wraps under its text');
  });

  it('short content renders one line per item, unchanged', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 's.json', {
      loop_type: 'fix', latest_cycle: 2, trend: 'converging',
      resolved: [{ title: 'Off-by-one', last_seen_cycle: 1 }],
      recurring: [{ title: 'Flaky seed', cycles: '1, 2', hypothesis: 'The fixture reseeds.' }],
      new: [{ title: 'Missing guard' }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: convergence diagnostic (emit verbatim as a text code block (```text fence)) ===',
      `── Fix Loop — cycle 2 diagnostic ${'─'.repeat(32)}`,
      '',
      '  Trend: converging',
      '  Latest cycle: 2 findings (1 new, 1 recurring)',
      '',
      '  Resolved:',
      '    • Off-by-one (fixed in cycle 1)',
      '',
      '  Recurring:',
      '    • Flaky seed (cycles 1, 2)',
      '      · The fixture reseeds.',
      '',
      '  New this cycle:',
      '    • Missing guard',
      '',
      '  ⚑ Resolved findings outnumber new ones — the cycles are closing',
      '    ground.',
      '',
    ].join('\n'));
  });

  it('a head line past the budget wraps beneath its indent', () => {
    const file = writePayload(dir, 'g.json', { ...base, review_baseline_words: 123456, live_words: 234567 });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('  Document growth: 123456 → 234567 words (+111111 net across\n  review)'), 'the growth line wraps at the head indent');
  });

  it('validates loudly: enums, cycle floor, shapes, stream and growth pairing', () => {
    const cases = [
      [{ ...base, loop_type: 'review' }, /"loop_type" must be one of fix\/analysis\/planning-review\/spec-review/],
      [{ ...base, trend: 'oscillating' }, /"trend" must be one of/],
      [{ ...base, latest_cycle: 1 }, /"latest_cycle" must be an integer ≥ 2/],
      [{ ...base, recurring: [{ title: 'x', cycles: '2, 3' }] }, /recurring\[0\] is missing "hypothesis"/],
      [{ ...base, stream_counts: undefined }, /"spec-review" carries "stream_counts"/],
      [{ ...base, loop_type: 'fix', review_baseline_words: undefined, live_words: undefined, stream_counts: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }] }, /"fix" is single-stream/],
      [{ ...base, loop_type: 'analysis', stream_counts: undefined }, /document growth belongs to spec-review and planning-review/],
      [{ ...base, live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
      [{ ...base, loop_type: 'planning-review', stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 0 }], live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
    ];
    cases.forEach(([payload, re], i) => {
      const file = writePayload(dir, `bad-${i}.json`, payload);
      assert.throws(() => renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file }), re);
    });
  });
});

describe('render spec-completion-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const ASSESSMENT_MENU = [
    "=== MENU: spec assessment gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
    DOTS,
    '**`◆ Confirm this assessment?`**',
    '',
    '**`y/yes`**   → Confirm assessment',
    '**Comment** → Suggest a different classification',
    '',
  ];
  const assess = (payload) => renderSurface(dir, 'spec-completion-gate', {
    dotpath: 'pay.specification.portal', variant: 'assessment', file: writePayload(dir, 'assessment.json', payload),
  });

  it('assessment variant renders a cross-cutting verdict and its wrapped rationale above the confirm menu', () => {
    assert.strictEqual(assess({
      cross_cutting: true,
      rationale: 'It defines a caching strategy that will inform how multiple features handle data retrieval, rather than being a standalone piece of functionality to build.',
    }), [
      '=== DISPLAY: cross-cutting assessment (emit verbatim as a text code block (```text fence)) ===',
      'Cross-Cutting Assessment',
      '',
      'This specification appears to be cross-cutting.',
      '',
      'It defines a caching strategy that will inform how multiple',
      'features handle data retrieval, rather than being a standalone',
      'piece of functionality to build.',
      '',
      ...ASSESSMENT_MENU,
    ].join('\n'));
  });

  it('assessment variant renders the directly plannable verdict', () => {
    const out = assess({ cross_cutting: false, rationale: 'It builds the refund endpoint.' });
    assert.match(out, /^Cross-Cutting Assessment\n\nThis specification is directly plannable — no cross-cutting promotion needed\.\n\nIt builds the refund endpoint\.\n$/m);
    assert.ok(out.endsWith(ASSESSMENT_MENU.join('\n')));
  });

  it('assessment variant refuses a missing payload, a verdict that is not a boolean, and an empty rationale; signoff takes no payload', () => {
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'assessment' }),
      /--variant assessment takes --file <payload\.json>/);
    assert.throws(() => assess({ cross_cutting: 'yes', rationale: 'r' }), /"cross_cutting" must be true or false/);
    assert.throws(() => assess({ rationale: 'r' }), /"cross_cutting" must be true or false/);
    assert.throws(() => assess({ cross_cutting: true, rationale: '  ' }), /"rationale" must be a non-empty string/);
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', {
      dotpath: 'pay.specification.portal', variant: 'signoff', file: writePayload(dir, 'assessment.json', { cross_cutting: true, rationale: 'r' }),
    }), /--variant signoff takes no --file/);
  });

  it('signoff variant renders the conclude consent', () => {
    const out = renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'signoff' });
    assert.ok(out.includes('=== MENU: spec signoff gate'));
    assert.ok(out.includes('**`◆ Ready to conclude?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Conclude specification and mark as completed/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Add context before concluding/.test(out));
  });

  it('rejects a missing or unknown variant and a non-specification address', () => {
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal' }), /--variant must be "assessment" or "signoff"/);
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'sign-off' }), /--variant must be "assessment" or "signoff"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.discussion.portal', variant: 'signoff' }), /address must be <work_unit>\.specification\.<topic>/);
  });
});

describe('render carry-note-gate', () => {
  let dir;
  const payload = { note: ['→ search-cache: the eviction rule this session settled invalidates its TTL note.'], target: 'search-cache', landing_phase: 'discussion' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { research: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the note, the addressed-to line, and the landing menu', () => {
    const file = writePayload(dir, 'n.json', payload);
    const out = renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file });
    assert.ok(out.includes('=== DISPLAY: carry note'));
    assert.ok(out.includes(payload.note[0]));
    assert.ok(out.includes('*Addressed to: search-cache — lands in its discussion mailbox*'));
    assert.ok(out.includes('=== MENU: carry note gate'));
    assert.ok(out.includes('This note lands in "search-cache"\'s mailbox; if "search-cache" is completed, landing reopens it.'));
    assert.ok(out.includes('**`◆ Land it there?`**'), 'a consent gate carries its glyphed question');
    assert.ok(/\*\*`y\/yes`\*\* +→ Land it there; this document keeps a record of the send/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Leave it as prose in this document/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what to change \(target, phase, or content\)/.test(out));
  });

  it('validates the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal' }), /--file <payload\.json> is required/);
    const bad = writePayload(dir, 'bad.json', { ...payload, note: [] });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: bad }), /"note" must be non-empty/);
    const noTarget = writePayload(dir, 'bad2.json', { ...payload, target: ' ' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: noTarget }), /"target" must be a non-empty string/);
    const badPhase = writePayload(dir, 'bad3.json', { ...payload, landing_phase: 'specification' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: badPhase }), /"landing_phase" must be "research" or "discussion", got "specification"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', payload);
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.discussion.portal', file }), /address must be <work_unit>\.research\.<topic>/);
  });
});

describe('render hypothesis-board', () => {
  let dir;
  const dot = 'hooks.investigation.resume-hooks-silently-lost';
  // One long evidence line — the bug this surface exists to kill was a
  // hand-wrapped board, so the pins below check it survives as one line.
  const EVIDENCE = "The cleanup interval is 10s on the daemon's IDLE branch — exactly when a user is rearranging panes, so a moved pane is reaped within ~10s of the move.";
  const confirmed = {
    id: 'H2', claim: "Coordinate drift orphans a live pane's hook", status: 'confirmed',
    rows: [['Evidence', EVIDENCE], ['Measured', '`grep hookCleanupInterval daemon/reaper.go` → 10s, IDLE branch']],
  };
  const tracing = { id: 'H3', claim: 'Identity design half-finished is the root cause', status: 'tracing', rows: [['Basis', 'Half the key was fixed in July.']] };
  const ruledOut = { id: 'H1', claim: 'Restore races the daemon', status: 'ruled-out', rows: [['Evidence', 'Restore completes before the first prune pass.']] };

  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { 'resume-hooks-silently-lost': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (variant, payload) => renderSurface(dir, 'hypothesis-board', {
    dotpath: dot, variant, file: writePayload(dir, `${variant}.json`, payload),
  });

  it('check-in names what resolved, counts the board, and gates', () => {
    const out = render('check-in', { hypotheses: [ruledOut, confirmed, tracing], resolved_now: ['H1', 'H2'], next: 'Synthesise the root cause' });
    assert.ok(out.includes('=== DISPLAY: hypothesis board (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Hypothesis board — Resume Hooks Silently Lost** (3 tracked, 1 confirmed, 1 ruled out, 1 open)'));
    assert.ok(out.includes('Resolved this check-in: H1, H2'));
    assert.ok(out.includes("**H2 — Coordinate drift orphans a live pane's hook** — *confirmed*"));
    assert.ok(out.includes('- **Measured**: `grep hookCleanupInterval daemon/reaper.go` → 10s, IDLE branch'));
    assert.ok(out.includes('**Next**: Synthesise the root cause'));
    assert.ok(out.includes('=== MENU: check-in gate'));
    assert.ok(out.includes('**`◆ Continue as planned?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue with the next trace line/.test(out));
    assert.ok(/\*\*Steer\*\* +→ Tell me what to look at instead, or what this changes/.test(out));
  });

  it('never hand-wraps: an evidence row is one authored line whatever its length', () => {
    const out = render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'x' });
    assert.ok(out.includes(`- **Evidence**: ${EVIDENCE}`), 'the evidence survives as a single line for the renderer to reflow');
    const display = out.split('=== MENU')[0];
    assert.ok(!/\n {2,}\S/.test(display), 'no drawn indentation — the display is markdown, not a laid-out block');
  });

  it('plan carries trace lines and the depth, with the plan gate', () => {
    const out = render('plan', {
      hypotheses: [{ ...tracing, status: 'suspected' }],
      trace_lines: ['daemon/reaper.go — the prune pass', 'hooks/key.go — the key-producing sites'],
      depth: 'check-ins', depth_reasoning: 'two systems and an intermittent symptom',
    });
    assert.ok(out.includes('=== DISPLAY: investigation plan (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Investigation plan — Resume Hooks Silently Lost**'));
    assert.ok(out.includes('**Trace lines**\n- daemon/reaper.go — the prune pass\n- hooks/key.go — the key-producing sites'));
    assert.ok(out.includes('**Depth**: check-ins — two systems and an intermittent symptom'));
    assert.ok(out.includes('**`◆ Does this plan look right?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed with the analysis as planned/.test(out));
    assert.ok(unwrap(out).includes('**Adjust** → Tell me what to change: hypotheses, trace lines, or depth'));
    assert.ok(!out.includes('Resolved this check-in'), 'a plan resolves nothing');
  });

  it('resume re-renders the ledger with what is left', () => {
    const out = render('resume', { hypotheses: [ruledOut, tracing], depth: 'check-ins', remaining: 'H3 is mid-trace' });
    assert.ok(out.includes('=== DISPLAY: resumed plan (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Investigation plan — Resume Hooks Silently Lost · resumed** (2 tracked, 1 ruled out, 1 open)'));
    assert.ok(out.includes('**Depth**: check-ins\n**Remaining**: H3 is mid-trace'));
    assert.ok(out.includes('**`◆ Picking up where we left off — still good?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue as agreed/.test(out));
  });

  it('pivot leads with what changed, then the replacement direction', () => {
    const out = render('pivot', {
      changed: 'The key format itself is malformed.',
      hypotheses: [{ ...tracing, status: 'suspected' }],
      trace_lines: ['hooks/key.go — the four key-producing sites'],
    });
    assert.ok(out.includes('=== DISPLAY: plan pivot (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Plan pivot — Resume Hooks Silently Lost**'));
    assert.ok(out.includes('**What changed**: The key format itself is malformed.'));
    assert.ok(out.includes('**Proposed direction**'));
    assert.ok(out.includes('**`◆ Proceed on the new direction?`**'));
    assert.ok(!out.includes('**Depth**'), 'a pivot proposes a direction, never a new checkpoint depth');
  });

  it('validates the variant, the address, and the ledger', () => {
    const file = writePayload(dir, 'v.json', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'x' });
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, file }), /--variant must be one of plan\/resume\/check-in\/pivot/);
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, variant: 'board' }), /--variant must be one of/);
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, variant: 'check-in' }), /--file <payload\.json> is required/);
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { discussion: { items: { hooks: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'hypothesis-board', { dotpath: 'hooks.discussion.hooks', variant: 'check-in', file }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/,
    );
  });

  it('validates the ledger entries', () => {
    const bad = (h) => () => render('check-in', { hypotheses: h, resolved_now: ['H2'], next: 'x' });
    assert.throws(bad([]), /"hypotheses" must be a non-empty array/);
    assert.throws(bad([{ ...confirmed, id: ' ' }]), /hypotheses\[0\] is missing "id"/);
    assert.throws(bad([confirmed, confirmed]), /duplicate hypothesis id "H2"/);
    assert.throws(bad([{ ...confirmed, claim: '' }]), /hypotheses\[0\] is missing "claim"/);
    assert.throws(bad([{ ...confirmed, status: 'proven' }]), /unknown status "proven" \(expected suspected\/tracing\/confirmed\/ruled-out\)/);
    assert.throws(bad([{ ...confirmed, rows: [] }]), /needs "rows"/);
    assert.throws(bad([{ ...confirmed, rows: [['Evidence']] }]), /row 1 must be a \[label, value\] pair/);
  });

  it('refuses a field that runs to more than one line — it would break the markdown around it', () => {
    const bad = (h) => () => render('check-in', { hypotheses: [h], resolved_now: ['H2'], next: 'x' });
    assert.throws(bad({ ...confirmed, claim: 'Coordinate drift\norphans a hook' }), /hypotheses\[0\] claim runs to more than one line — split it across rows, or leave the detail in the investigation file/);
    assert.throws(bad({ ...confirmed, rows: [['Evidence', 'line one\nline two']] }), /hypotheses\[0\] row 1 value runs to more than one line/);
    assert.throws(bad({ ...confirmed, rows: [['Ev\nidence', 'x']] }), /hypotheses\[0\] row 1 label runs to more than one line/);
    assert.throws(
      () => render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'Trace the reaper\nthen the doctor' }),
      /"next" runs to more than one line/,
    );
    assert.throws(
      () => render('plan', { hypotheses: [confirmed], trace_lines: ['daemon/reaper.go\nhooks/key.go'], depth: 'check-ins', depth_reasoning: 'x' }),
      /trace_lines\[0\] runs to more than one line/,
    );
  });

  it('carries any ledger shape — free row labels, however many a hypothesis needs', () => {
    const out = render('check-in', {
      hypotheses: [
        { id: 'A', claim: 'One line of basis is enough', status: 'ruled-out', rows: [['Ruled out by', 'The sampled runs disagree with it.']] },
        {
          id: 'B',
          claim: 'This one earned six rows',
          status: 'confirmed',
          rows: [['Evidence', 'a'], ['Measured', 'b'], ['Reproduced', 'c'], ['Blast radius', 'd'], ['Why it hid', 'e'], ['Owner', 'f']],
        },
      ],
      resolved_now: ['A', 'B'],
      next: 'x',
    });
    assert.ok(out.includes('**A — One line of basis is enough** — *ruled-out*'));
    assert.ok(out.includes('- **Ruled out by**: The sampled runs disagree with it.'));
    assert.ok(out.includes('- **Why it hid**: e'), 'a label the surface has never seen renders like any other');
    assert.ok(out.includes('(2 tracked, 1 confirmed, 1 ruled out, 0 open)'));
  });

  it('validates each variant against what it must carry', () => {
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: [], next: 'x' }), /"resolved_now" must be a non-empty array/);
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: ['H9'], next: 'x' }), /"resolved_now" names "H9", which is not on the board/);
    assert.throws(
      () => render('check-in', { hypotheses: [tracing], resolved_now: ['H3'], next: 'x' }),
      /"H3" is named in "resolved_now" but its status is "tracing" — a resolved hypothesis is confirmed or ruled-out/,
    );
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'] }), /"next" must be a non-empty string/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: [], depth: 'check-ins', depth_reasoning: 'x' }), /"trace_lines" must be a non-empty array/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: ['t'] }), /"depth_reasoning" must be a non-empty string/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: ['t'], depth: 'deep', depth_reasoning: 'x' }), /"depth" must be one of straight-through\/check-ins/);
    assert.throws(() => render('resume', { hypotheses: [confirmed], depth: 'check-ins' }), /"remaining" must be a non-empty string/);
    assert.throws(() => render('pivot', { hypotheses: [confirmed], trace_lines: ['t'] }), /"changed" must be a non-empty string/);
  });
});

describe('render findings-signoff-gate', () => {
  let dir;
  const dot = 'hooks.investigation.crash';
  const record = () => {
    const p = path.join(dir, '.leeway', 'hooks', 'investigation', 'crash.md');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '# Investigation — crash\n');
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('asks the sign-off over the retelling, the technical lens and the record itself', () => {
    record();
    assert.strictEqual(renderSurface(dir, 'findings-signoff-gate', { dotpath: dot }), [
      "=== MENU: findings sign-off gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Do these findings match your understanding?`**',
      '',
      '**`y/yes`**            → Findings are correct, move to fix exploration',
      "**`t/technical`**      → Retell the findings from the code's",
      `${NB(19)}perspective`,
      '**`v/view`**           → Show the full investigation file',
      "**Provide feedback** → Tell me what's off or unclear",
      '',
    ].join('\n'));
  });

  it('refuses another phase, an unknown unit, and a topic with no investigation file', () => {
    record();
    assert.throws(() => renderSurface(dir, 'findings-signoff-gate', { dotpath: 'hooks.discussion.crash' }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'findings-signoff-gate', { dotpath: 'ghost.investigation.crash' }),
      /work unit "ghost" not found/);
    assert.throws(() => renderSurface(dir, 'findings-signoff-gate', { dotpath: 'hooks.investigation.other' }),
      /no investigation file for "other" — the sign-off is read from the record/);
  });
});

describe('render validation-gate / validation-report', () => {
  let dir;
  const inv = 'hooks.investigation.crash';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const report = (variant, payload) => renderSurface(dir, 'validation-report', {
    dotpath: inv, variant, file: writePayload(dir, `v-${variant}.json`, payload),
  });

  const RC_CHECKS = [['Symptom coverage', 'all three trace to the same call'], ['Blast radius', 'two further callers share the path']];
  const FX_CHECKS = [['Root cause coverage', 'every symptom resolved'], ['Side effects', 'none identified']];
  const rcClean = {
    status: 'validated', confidence: 'high', checks: RC_CHECKS,
    summary: 'The diagnosis holds against a fresh trace.',
    analysis_path: '.leeway/.cache/hooks/investigation/crash/agents/002.md',
  };
  const fxClean = {
    status: 'validated', confidence: 'medium', direction: 'Make the address optional', checks: FX_CHECKS,
    summary: 'The direction breaks the causal chain and no caller depends on the throw.',
    analysis_path: 'p.md',
  };

  it('offers the root cause validation in its own words, payload-less', () => {
    const rc = renderSurface(dir, 'validation-gate', { dotpath: inv, variant: 'root-cause' });
    assert.ok(rc.includes('=== MENU: root-cause validation offer'));
    assert.ok(rc.includes('**`◆ Root cause documented. Run validation?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Run root cause validation/.test(rc));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip straight to findings sign-off/.test(rc));
  });

  it('never offers the fix validation — an agreed direction is always pressure-tested', () => {
    assert.throws(
      () => renderSurface(dir, 'validation-gate', { dotpath: inv, variant: 'fix' }),
      /--variant must be root-cause — the fix direction is always pressure-tested/,
    );
    assert.throws(() => renderSurface(dir, 'validation-gate', { dotpath: inv }), /--variant must be root-cause/);
  });

  it('a clean pass carries the same readout as a failing one, and no menu', () => {
    const out = report('root-cause', rcClean);
    assert.ok(out.includes('**Root cause validation · high confidence** — validated, no gaps found'));
    assert.ok(out.includes('- **Symptom coverage**: all three trace to the same call'));
    assert.ok(out.includes('The diagnosis holds against a fresh trace.'));
    assert.ok(out.includes('*Full analysis: `.leeway/.cache/hooks/investigation/crash/agents/002.md`*'));
    assert.ok(!out.includes('=== MENU'), 'a validated verdict asks nothing');
    const fx = report('fix', fxClean);
    assert.ok(fx.includes('**Fix validation · "Make the address optional" · medium confidence** — confirmed, no unaddressed risks'));
    assert.ok(fx.includes('- **Root cause coverage**: every symptom resolved'));
  });

  it('findings list under the confidence, with the checks, the analysis path and the handling gate', () => {
    const long = 'The trace stops at the tax context, but nothing checks whether the billing address is reliably present on a digital-only order.';
    const out = report('root-cause', {
      ...rcClean, status: 'gaps_found', confidence: 'medium',
      items: [long, 'Empty-string addresses were never exercised.'],
      analysis_path: '.leeway/.cache/hooks/investigation/crash/agents/003.md',
    });
    assert.ok(out.includes('**Root cause validation · medium confidence** — 2 gaps'));
    assert.ok(out.includes('1\\. The trace stops at the tax context'), 'a batch list numbers its rows and never walks them');
    assert.ok(!out.includes('○ 1.'), 'nothing here is walked, so no state glyph');
    assert.ok(out.includes('- **Blast radius**: two further callers share the path'), 'the findings say what was examined too');
    assert.ok(out.includes('*Full analysis: `.leeway/.cache/hooks/investigation/crash/agents/003.md`*'));
    assert.ok(out.includes('**`◆ How should these gaps be handled?`**'));
    assert.ok(unwrap(out).includes('**`a/address`** → Work through them and fold the answers into the investigation'));
    const fx = report('fix', { ...fxClean, status: 'risks_found', confidence: 'low', items: ['x'] });
    assert.ok(fx.includes('**Fix validation · "Make the address optional" · low confidence** — 1 risk'));
    assert.ok(unwrap(fx).includes('**`a/address`** → Work through them and fold the outcome into the fix direction'));
  });

  it('refuses a verdict that disagrees with its own findings', () => {
    assert.throws(
      () => report('root-cause', { ...rcClean, items: ['a gap'] }),
      /"status" is "validated" but 1 gap\(s\) are listed — the verdict and the findings must agree/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, status: 'gaps_found', items: [] }),
      /"status" is "gaps_found" but no gaps are listed/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, status: 'risks_found', items: ['x'] }),
      /"status" must be "validated" or "gaps_found" for the root-cause variant/,
    );
    assert.throws(
      () => report('fix', { ...fxClean, confidence: 'certain' }),
      /"confidence" must be one of high\/medium\/low/,
    );
  });

  it('holds every verdict to naming what it checked, concluded and confirmed', () => {
    assert.throws(
      () => report('fix', { ...fxClean, direction: undefined }),
      /"direction" must name the agreed approach/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, direction: 'Make the address optional' }),
      /"direction" belongs to the fix variant — root-cause validation has no chosen approach to name/,
    );
    assert.throws(() => report('fix', { ...fxClean, checks: [] }), /"checks" must be a non-empty array/);
    assert.throws(() => report('fix', { ...fxClean, checks: [['Testing']] }), /checks\[0\] must be a \[label, outcome\] pair/);
    assert.throws(() => report('fix', { ...fxClean, summary: undefined }), /"summary" must be a non-empty string/);
    assert.throws(() => report('fix', { ...fxClean, analysis_path: undefined }), /"analysis_path" must be a non-empty string/);
  });

  it('holds the address to the investigation phase', () => {
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { discussion: { items: { crash: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'validation-gate', { dotpath: 'hooks.discussion.crash', variant: 'root-cause' }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/,
    );
  });
});

describe('render project-skills / linters', () => {
  let dir;
  const imp = 'hooks.implementation.crash';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { implementation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (surface, variant, payload) => renderSurface(dir, surface, {
    dotpath: imp, variant, file: payload && writePayload(dir, `${surface}-${variant}.json`, payload),
  });

  it('project skills: a stored set confirms compact, a fresh scan is chosen from the full list', () => {
    const c = render('project-skills', 'confirm', { skills: ['laravel-conventions', 'laravel-testing'] });
    assert.ok(c.includes('**Project skills** — 2 from the project default'));
    assert.ok(c.includes('laravel-conventions, laravel-testing'));
    assert.ok(!c.includes('1\\.'), 'a confirm is a comma run, not a numbered worklist');
    assert.ok(c.includes('**`◆ Use these project skills?`**'));
    const d = render('project-skills', 'discovery', { skills: [{ name: 'a', detail: 'x' }, { name: 'b', detail: 'y' }] });
    assert.ok(d.includes('**Project skills** — 2 skills'));
    assert.ok(d.includes('1\\. a — x'));
    assert.ok(d.includes('**`◆ Which project skills should be used?`**'));
    assert.ok(unwrap(d).includes('**List the ones you want** → Name them — e.g. "golang-pro, react-patterns"'));
  });

  it('linters: a discovery carries installed state as the row tag and its recommendations beneath', () => {
    const out = render('linters', 'discovery', {
      linters: [{ name: 'pint', detail: 'vendor/bin/pint', installed: true }, { name: 'phpstan', detail: 'vendor/bin/phpstan', installed: false }],
      recommendations: 'phpstan is not installed — `composer require --dev phpstan/phpstan`.',
    });
    assert.ok(out.includes('**Linter discovery** — 2 linters'));
    assert.ok(out.includes('1\\. pint — vendor/bin/pint `[installed]`'));
    assert.ok(out.includes('2\\. phpstan — vendor/bin/phpstan `[missing]`'));
    assert.ok(out.includes('**Recommended**: phpstan is not installed'));
    assert.ok(out.includes('**`◆ Approve these linters?`**'));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip linter setup \(no linting during TDD\)/.test(out));
  });

  it('linters: a stored set confirms compact with no installed state and no recommendations', () => {
    const out = render('linters', 'confirm', { linters: ['pint', 'phpstan'] });
    assert.ok(out.includes('**Linters** — 2 from the project default'));
    assert.ok(out.includes('pint, phpstan'));
    assert.ok(!out.includes('`[installed]`'), 'an approved set was already checked');
    assert.ok(out.includes('**`◆ Use these linters?`**'));
    assert.throws(
      () => render('linters', 'discovery', { linters: [{ name: 'pint', detail: 'vendor/bin/pint' }] }),
      /every row of a discovery needs "installed"/,
    );
  });

  it('the skipped variants ask again without a payload', () => {
    const s = render('project-skills', 'skipped');
    assert.ok(s.includes('Previous implementations used no project skills.'));
    assert.ok(s.includes('**`◆ Skip project skills again?`**'));
    assert.ok(/\*\*`n\/no`\*\* +→ Analyse for project skills/.test(s));
    const l = render('linters', 'skipped');
    assert.ok(l.includes('Previous implementations skipped linters.'));
    assert.ok(l.includes('**`◆ Skip linters again?`**'));
    assert.ok(/\*\*`n\/no`\*\* +→ Run full linter discovery/.test(l));
  });

  it('validates the variant, the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'linters', { dotpath: imp }), /--variant must be one of confirm\/discovery\/skipped/);
    assert.throws(() => renderSurface(dir, 'linters', { dotpath: imp, variant: 'confirm' }), /--file <payload\.json> is required/);
    assert.throws(() => render('linters', 'confirm', { linters: [] }), /"linters" must be a non-empty array/);
    assert.throws(() => render('project-skills', 'confirm', { skills: [{ name: 'a', detail: 'b' }] }), /skills\[0\] must be a non-empty string/);
    assert.throws(() => render('project-skills', 'discovery', { skills: [{ name: 'a' }] }), /skills\[0\] is missing "detail"/);
    assert.throws(() => render('project-skills', 'discovery', { skills: [{ detail: 'a' }] }), /skills\[0\] is missing "name"/);
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { planning: { items: { crash: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'project-skills', { dotpath: 'hooks.planning.crash', variant: 'skipped' }),
      /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/,
    );
  });
});

describe('render fix-direction', () => {
  let dir;
  const dot = 'hooks.investigation.checkout-crash';
  const rows = [['Changes', 'The constructor takes an optional address.'], ['Risk', 'A caller relying on the throw would start succeeding.']];
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { 'checkout-crash': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (payload) => renderSurface(dir, 'fix-direction', { dotpath: dot, file: writePayload(dir, 'fd.json', payload) });

  it('a lone option is unlettered and uncounted', () => {
    const out = render({ options: [{ name: 'Make the address optional', rows }] });
    assert.ok(out.includes('=== DISPLAY: fix direction (emit verbatim as markdown (not a code block)) ==='));
    assert.ok(out.includes('**Fix direction — Checkout Crash**\n'));
    assert.ok(!out.includes('approaches)'), 'one approach is not a comparison');
    assert.ok(out.includes('**Make the address optional**\n'), 'no letter where there is nothing to compare against');
    assert.ok(out.includes('- **Changes**: The constructor takes an optional address.'));
    assert.ok(out.includes('=== MENU: fix direction gate'));
    assert.ok(out.includes('**`◆ What are your thoughts?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Agree with this direction and pressure-test it/.test(out), 'agreement commissions the validation');
    assert.ok(unwrap(out).includes('**Provide feedback** → Tell me your thoughts: discuss, challenge, or suggest alternatives'));
  });

  it('several options letter themselves, count themselves, and carry the mark', () => {
    const out = render({
      options: [
        { name: 'Make the address optional', recommended: true, rows },
        { name: 'Guard at the call site', rows },
        { name: 'Backfill the address', rows },
      ],
      recommendation: 'A — it fixes the assumption rather than working around it.',
      open_question: 'Whether the empty-string case is the same bug.',
    });
    assert.ok(out.includes('**Fix direction — Checkout Crash** (3 approaches)'));
    assert.ok(out.includes('**A — Make the address optional** — *recommended*'));
    assert.ok(out.includes('**B — Guard at the call site**\n'));
    assert.ok(out.includes('**C — Backfill the address**\n'));
    assert.ok(out.includes('**Recommendation**: A — it fixes the assumption rather than working around it.'));
    assert.ok(out.includes('**Open question**: Whether the empty-string case is the same bug.'));
  });

  it('a recommendation must say which and why, and only where there is a comparison', () => {
    assert.throws(
      () => render({ options: [{ name: 'a', rows }, { name: 'b', recommended: true, rows }] }),
      /a recommended option needs "recommendation" — the deciding factor, not just the mark/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', rows }, { name: 'b', rows }], recommendation: 'b is better' }),
      /"recommendation" was given but no option is marked "recommended"/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', recommended: true, rows }], recommendation: 'x' }),
      /a lone option cannot be "recommended" — there is nothing to recommend it over/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', recommended: true, rows }, { name: 'b', recommended: true, rows }], recommendation: 'x' }),
      /only one option can be "recommended"/,
    );
  });

  it('validates the options, their rows, and the address', () => {
    assert.throws(() => renderSurface(dir, 'fix-direction', { dotpath: dot }), /--file <payload\.json> is required/);
    assert.throws(() => render({ options: [] }), /"options" must be a non-empty array .* one obvious fix is a valid outcome, none is not/);
    assert.throws(() => render({ options: [{ rows }] }), /options\[0\] is missing "name"/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [] }] }), /options\[0\] needs "rows"/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [['Changes']] }] }), /options\[0\] row 1 must be a \[label, value\] pair/);
    assert.throws(() => render({ options: [{ name: 'a\nb', rows }] }), /options\[0\] name runs to more than one line/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [['Changes', 'one\ntwo']] }] }), /options\[0\] row 1 value runs to more than one line/);
    assert.throws(
      () => render({ options: Array.from({ length: 9 }, (_, i) => ({ name: `o${i}`, rows })) }),
      /9 options is past comparing — this surface letters at most 8/,
    );
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { specification: { items: { 'checkout-crash': { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'fix-direction', { dotpath: 'hooks.specification.checkout-crash', file: writePayload(dir, 'fd2.json', { options: [{ name: 'a', rows }] }) }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "specification"/,
    );
  });
});

describe('render finding', () => {
  let dir;
  const base = {
    n: 1, total: 2, title: 'Missing Outcome field',
    meta: [['Severity', 'Minor'], ['Change Type', 'add-to-task']],
    problem: 'A task with no Outcome leaves the builder guessing what done looks like.',
  };
  const settled = { ...base, move: 'settled', proposal: 'The template fixes this — I would add the Outcome line the other tasks carry.' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('leads with the problem and the call, renders the diff in place, and gates on a question', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      diff: { context_above: ['**Solution**: shared adapter.'], current: [], proposed: ['**Outcome**: lands at a live shell.'], context_below: ['**Do**:'] },
      apply_label: 'Apply to the plan verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.startsWith([
      '=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ===',
      '**Finding 1 of 2: Missing Outcome field**',
      '',
      '- **Severity**: Minor',
      '- **Change Type**: add-to-task',
      '',
      'A task with no Outcome leaves the builder guessing what done looks like.',
      '',
      'The template fixes this — I would add the Outcome line the other tasks carry.',
      '',
    ].join('\n')));
    assert.ok(out.includes('=== DISPLAY: diff (emit verbatim as a diff code block (```diff fence)) ===\n **Solution**: shared adapter.\n+**Outcome**: lands at a live shell.\n **Do**:'));
    assert.ok(!/frame|╭|╰/.test(out), 'drawn borders never frame content — no drawn borders, no frame sections');
    assert.ok(out.includes('=== MENU: finding gate'));
    assert.ok(/\*\*`◆ Apply this\?`\*\*/.test(out), 'the menu opens with a question, never a second copy of the heading');
    assert.strictEqual(out.match(/\*\*Finding 1 of 2: Missing Outcome field\*\*/g).length, 1, 'the heading renders exactly once');
    assert.ok(/\*\*`y\/yes`\*\* +→ Apply to the plan verbatim/.test(out));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining settled findings automatically/.test(unwrap(out)));
    assert.ok(/\*\*Discuss\*\* +→ Challenge it, adjust it, or decline it/.test(unwrap(out)));
  });

  it('never offers skip — a found problem is settled, chosen, or routed, never waved past', () => {
    const file = writePayload(dir, 'f.json', { ...settled, content: { label: 'Proposed Addition', lines: ['New spec section body.'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!/skip/i.test(out), 'no skip option at any gate');
  });

  it('holds whole proposed content behind v/view instead of dumping it as source', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', '> Retries are bounded at four attempts.'] },
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!out.includes('DISPLAY: finding content'), 'the proposed section is not rendered at the gate');
    assert.ok(!out.includes('## Delivery'), 'artifact source never reaches the presentation');
    assert.ok(/\*\*`v\/view`\*\* +→ Show the exact wording/.test(out), 'the wording is reachable, not imposed');
    assert.ok(!out.includes('view full'), 'view full is gone — there is no full copy to re-show');
  });

  it('--view full answers the v/view row: the wording and the gate again, the report not repeated', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', 'Retries are bounded at four attempts.'] },
      apply_label: 'Apply to the specification verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file, view: 'full' });
    assert.ok(out.startsWith('=== DISPLAY: finding wording (emit verbatim as markdown (not a code block)) ===\n**Proposed Addition**\n\n## Delivery'));
    assert.ok(!out.includes('DISPLAY: finding ('), 'the report is not re-rendered — one finding never fills a screen twice');
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!/`v\/view`/.test(out), 'the view row is spent');
    assert.ok(/\*\*`y\/yes`\*\* +→ Apply to the specification verbatim/.test(out));
    assert.ok(/\*\*Discuss\*\*/.test(out), 'the view menu is the gate menu minus the view row');
  });

  it('--view full validates the wording it shows — malformed content refuses in the surface vocabulary', () => {
    const noLabel = writePayload(dir, 'v1.json', { ...settled, content: { lines: ['x'] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: noLabel, view: 'full' }),
      /"content.label" must be a non-empty string/);
    const noLines = writePayload(dir, 'v2.json', { ...settled, content: { label: 'L' } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: noLines, view: 'full' }),
      /"content.lines" must be an array of strings/);
    const emptyLines = writePayload(dir, 'v3.json', { ...settled, content: { label: 'L', lines: [] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: emptyLines, view: 'full' }),
      /"content.lines" must be non-empty/);
  });

  it('--view full over an auto address offers no a/auto row — the mode is already set', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'va.json', { ...settled, content: { label: 'L', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file, view: 'full' });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!/`a\/auto`/.test(out));
  });

  it('--view full is refused where there is no wording to show, and on a choice', () => {
    const diffFile = writePayload(dir, 'd.json', { ...settled, diff: { current: [], proposed: ['x'] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: diffFile, view: 'full' }),
      /--view needs "content" — a diff finding shows its change in place/);
    const choiceFile = writePayload(dir, 'c.json', { ...base, move: 'choice', options: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: choiceFile, view: 'full' }),
      /--view serves a settled finding's wording; a choice proposes none/);
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: diffFile, view: 'part' }),
      /--view only accepts "full"/);
  });

  it('a diff finding offers no view — the change is already visible in place', () => {
    const file = writePayload(dir, 'f.json', { ...settled, diff: { current: ['old'], proposed: ['new'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!/`v\/view`/.test(out));
  });

  it('wide diff lines pass through untouched — no border, no wrap', () => {
    const long = 'x'.repeat(150);
    const file = writePayload(dir, 'f.json', { ...settled, diff: { current: [], proposed: [long] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes(`\n+${long}\n`), 'the fence re-flows in the host; the engine never wraps diff lines');
  });

  it('a settled finding rides auto: the report renders, the gate does not', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['New plan section body.'] },
      applied_label: 'approved. Added to the plan.',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ==='), 'auto drops the stop, never the showing');
    assert.ok(out.includes('=== DISPLAY: finding auto-approved (emit verbatim as a text code block (```text fence) after applying the fix — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nFinding 1 of 2: Missing Outcome field — approved. Added to the plan.'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('a settled finding at the specification is display-only — its batch screen is the gate', () => {
    for (const mode of ['gated', 'auto']) {
      writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: mode } } } } });
      const file = writePayload(dir, `sb-${mode}.json`, {
        ...settled,
        diff: { current: ['old'], proposed: ['new'] },
      });
      const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
      assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ==='), `${mode}: the expansion still shows the report`);
      assert.ok(out.includes('=== DISPLAY: diff ('), `${mode}: the diff rides along — the expansion is problem, call, and change`);
      assert.ok(!out.includes('DISPLAY: finding wording'), `${mode}: a diff finding has no wording to show`);
      assert.ok(!out.includes('MENU: finding'), `${mode}: the batch already asked`);
      assert.ok(!out.includes('finding auto-approved'), `${mode}: the batch already said what landed`);
    }
  });

  it('a settled finding at the specification shows its whole wording — the expansion is the ask', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'sw.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', 'Retries are bounded at four attempts.'] },
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown (not a code block)) ==='), 'the report leads');
    assert.ok(out.endsWith('=== DISPLAY: finding wording (emit verbatim as markdown (not a code block)) ===\n**Proposed Addition**\n\n## Delivery\n\nRetries are bounded at four attempts.\n'),
      `the wording closes the expansion: ${out}`);
    assert.ok(!out.includes('MENU: finding'), 'the batch screen is the gate — the expansion asks nothing');
    assert.ok(!/`v\/view`/.test(out), 'there is no row left to ask the wording with');
  });

  it('--view full at the specification returns the wording alone', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'sv.json', { ...settled, content: { label: 'Proposed Addition', lines: ['Retries are bounded at four attempts.'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file, view: 'full' });
    assert.strictEqual(out, '=== DISPLAY: finding wording (emit verbatim as markdown (not a code block)) ===\n**Proposed Addition**\n\nRetries are bounded at four attempts.\n');
  });

  it('a choice stops over auto, numbers its options recommended-first, and offers no a/auto row', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...base,
      move: 'choice',
      options: [{ summary: 'Hold the queue slot and keep retrying' }, { summary: 'Bound retries at four, then dead-letter', recommended: true }],
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== MENU: finding choice'), 'auto never decides what only the user can');
    assert.ok(!out.includes('finding auto-approved'));
    assert.ok(unwrap(out).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'a stop over auto announces itself in the engine\'s one voice');
    assert.ok(/\*\*`◆ Which way\?`\*\*/.test(out));
    assert.ok(/\*\*`1`\*\* +→ Bound retries at four, then dead-letter \(recommended\)/.test(out), 'the recommendation sorts first');
    assert.ok(/\*\*`2`\*\* +→ Hold the queue slot and keep retrying/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what you're thinking/.test(out));
    assert.ok(!/`a\/auto`/.test(out), 'a choice never offers the auto opt-in');
    assert.ok(!/skip/i.test(out));
  });

  it('a gated choice carries no auto-override line — there is nothing being overridden', () => {
    const file = writePayload(dir, 'cg.json', {
      ...base,
      move: 'choice',
      options: [{ summary: 'a' }, { summary: 'b', recommended: true }],
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding choice'));
    assert.ok(!out.includes('Auto is on'));
  });

  it('contradiction is a legal category token — cosmetic, deciding nothing', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'ct.json', { ...settled, category: 'contradiction' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('finding auto-approved'), 'the move rides auto whatever the category reads');
  });

  it('the category no longer picks the shape — a gap rides auto when the record settles it', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', { ...settled, category: 'gap' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('finding auto-approved'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('validates loudly: move, shape, exclusivity, and empty diff', () => {
    const cases = [
      [{ ...settled, n: 0 }, /"n" must be a positive integer/],
      [{ ...settled, total: 0 }, /"total" must be an integer/],
      [{ ...settled, meta: [['x']] }, /"meta" must be an array of \[label, value\] pairs/],
      [{ ...settled, problem: ' ' }, /"problem" must be a non-empty string/],
      [{ ...base, move: 'route' }, /a "route" finding goes to resolve-source-incoherence and never renders at the gate/],
      [{ ...base }, /"move" must be one of settled\/choice/],
      [{ ...base, move: 'apply' }, /"move" must be one of settled\/choice/],
      [{ ...base, move: 'decide' }, /"move" must be one of settled\/choice/],
      [{ ...settled, category: 'source-defect' }, /"source-defect" findings route via resolve-source-incoherence and never render at the gate/],
      [{ ...settled, category: 'unsourced-decision' }, /"unsourced-decision" findings route via resolve-source-incoherence/],
      [{ ...settled, category: 'severity' }, /unknown category "severity"/],
      [{ ...base, move: 'settled' }, /a "settled" finding must carry a "proposal"/],
      [{ ...settled, options: [{ summary: 'a' }, { summary: 'b' }] }, /a "settled" finding carries no "options"/],
      [{ ...settled, diff: { current: [], proposed: ['x'] }, content: { label: 'X', lines: ['y'] } }, /pass "diff" or "content", not both/],
      [{ ...settled, diff: { current: [], proposed: [] } }, /"diff" must carry at least one/],
      [{ ...settled, content: { label: 'X', lines: [] } }, /"content.lines" must be non-empty/],
      [{ ...settled, content: { lines: ['x'] } }, /"content.label" must be a non-empty string/],
      [{ ...settled, content: { label: 'X', lines: 'not an array' } }, /"content.lines" must be an array of strings/],
      [{ ...base, move: 'choice', options: [{ summary: 'only one' }] }, /a "choice" finding must carry at least 2 "options"/],
      [{ ...base, move: 'choice', options: [{ summary: 'a' }, { notASummary: true }] }, /options\[1\]\.summary must be a non-empty string/],
      [{ ...base, move: 'choice', options: [{ summary: 'a' }, { summary: 'b\nfake row' }] }, /a side is one menu row — sides\[1\]\.summary must be a single line/],
      [{ ...base, move: 'choice', options: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] }, /at most one option may be recommended/],
      [{ ...base, move: 'choice', proposal: 'already decided', options: [{ summary: 'a' }, { summary: 'b' }] }, /a "choice" finding carries no "proposal"/],
      [{ ...base, move: 'choice', content: { label: 'X', lines: ['y'] }, options: [{ summary: 'a' }, { summary: 'b' }] }, /a "choice" finding carries no "content"/],
    ];
    cases.forEach(([payload, re], i) => {
      const file = writePayload(dir, `bad-${i}.json`, payload);
      assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file }), re);
    });
  });
});

describe('render proposed-task', () => {
  let dir;
  const payload = {
    current: 2, total: 3, title: 'Fix adapter leak', severity: 'Important',
    sources: 'reviewer cycle 1',
    problem: 'The adapter never closes.', solution: 'Close on detach.', outcome: 'No leaked handles.',
    steps: ['1. Add Close()', '2. Call it on detach'],
    criteria: ['- no leaked handles after detach'],
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the task detail plus the approval menu when gated, byte-exactly', () => {
    const file = writePayload(dir, 'p.json', payload);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Fix adapter leak (2 of 3)`** (Important)',
      'Sources: reviewer cycle 1',
      '',
      '**Problem**: The adapter never closes.',
      '',
      '**Solution**: Close on detach.',
      '',
      '**Outcome**: No leaked handles.',
      '',
      '**Acceptance Criteria**:',
      '- no leaked handles after detach',
      '',
      '**Do**:',
      '1. Add Close()',
      '2. Call it on detach',
      '',
      '=== MENU: task approval (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**     → Approve this task',
      '**`a/auto`**    → Approve this and all remaining tasks automatically',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
    assert.ok(!out.includes('t/technical'), 'the technical arm belongs to the decision menu alone');
  });

  it('honours a custom comment hint and the auto gate', () => {
    const file = writePayload(dir, 'p.json', payload);
    const gated = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(gated));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('=== DISPLAY: task auto-approved (emit verbatim as a text code block (```text fence) after recording the approval — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nTask 2 of 3: Fix adapter leak — approved [auto].'));
    assert.ok(!auto.includes('MENU: task approval'));
  });

  it('requires --gate and validates the payload loudly', () => {
    const file = writePayload(dir, 'p.json', payload);
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file }), /--gate must be "gated" or "auto"/);
    const noCriteria = writePayload(dir, 'bad.json', { ...payload, criteria: [] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noCriteria, gate: 'gated' }), /"criteria" must be non-empty/);
    const noProblem = writePayload(dir, 'bad2.json', { ...payload, problem: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }), /"problem" must be a non-empty string/);
    const emptySeverity = writePayload(dir, 'bad3.json', { ...payload, severity: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptySeverity, gate: 'gated' }), /"severity" must be a non-empty string when present/);
  });

  // Proposal altitude — the judge's output, before any authoring: problem and
  // solution alone, both blocks and outcome absent.
  const proposal = {
    current: 1, total: 4, title: 'Merge the near-miss helpers', severity: 'near-miss',
    placement: 'phase 3',
    problem: 'Two helpers differ only in their error text.',
    solution: 'Fold them into one and take the caller-supplied message.',
  };

  it('renders a proposal — no blocks, no outcome, the approval menu unchanged, byte-exactly', () => {
    const file = writePayload(dir, 'pr.json', proposal);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Merge the near-miss helpers (1 of 4)`** (near-miss)',
      'Placement: phase 3',
      '',
      '**Problem**: Two helpers differ only in their error text.',
      '',
      '**Solution**: Fold them into one and take the caller-supplied message.',
      '',
      '=== MENU: task approval (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**     → Approve this task',
      '**`a/auto`**    → Approve this and all remaining tasks automatically',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
  });

  it('mixes present and absent blocks — each renders under its own heading, none leaves a hole', () => {
    const file = writePayload(dir, 'mx.json', {
      current: 2, total: 4, title: 'Drop the dead formatter', severity: 'dead-code',
      problem: 'Nothing calls it.', solution: 'Delete it.', outcome: 'One fewer surface to keep true.',
      criteria: ['- the suite stays green'],
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.startsWith([
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Drop the dead formatter (2 of 4)`** (dead-code)',
      '',
      '**Problem**: Nothing calls it.',
      '',
      '**Solution**: Delete it.',
      '',
      '**Outcome**: One fewer surface to keep true.',
      '',
      '**Acceptance Criteria**:',
      '- the suite stays green',
      '',
      '=== MENU: task approval',
    ].join('\n')), out);
    assert.ok(!out.includes('**Do**:'), 'an absent block leaves no heading behind');
    assert.ok(!/\n\n\n/.test(out), 'an omitted block leaves no doubled blank line');
    const withTests = writePayload(dir, 'mt.json', {
      current: 2, total: 4, title: 'Drop the dead formatter', severity: 'dead-code',
      problem: 'Nothing calls it.', solution: 'Delete it.', criteria: ['- the suite stays green'], tests: ['- it is gone'],
    });
    const rendered = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withTests, gate: 'gated' });
    assert.ok(!rendered.includes('**Tests**') && !rendered.includes('it is gone'), 'a tests key is no block the surface renders');
  });

  it('outcome is optional both ways, and the detail blocks stay non-empty when present', () => {
    const withOutcome = writePayload(dir, 'o1.json', { ...proposal, outcome: 'One helper, one message path.' });
    assert.ok(renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' })
      .includes('**Solution**: Fold them into one and take the caller-supplied message.\n\n**Outcome**: One helper, one message path.\n'));
    const without = writePayload(dir, 'o2.json', proposal);
    assert.ok(!renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: without, gate: 'gated' }).includes('**Outcome**'));
    const emptyOutcome = writePayload(dir, 'o3.json', { ...proposal, outcome: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptyOutcome, gate: 'gated' }), /"outcome" must be a non-empty string when present/);
    for (const field of ['steps', 'criteria']) {
      const empty = writePayload(dir, `e-${field}.json`, { ...proposal, [field]: [] });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }), new RegExp(`"${field}" must be non-empty`));
      const notLines = writePayload(dir, `n-${field}.json`, { ...proposal, [field]: 'one long string' });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notLines, gate: 'gated' }), new RegExp(`"${field}" must be an array of strings`));
    }
  });

  it('a decision emits its slim header and the sides as the menu — the record stays staged — byte-exactly', () => {
    const file = writePayload(dir, 'dc.json', {
      current: 3, total: 4, title: 'Settle the page size', severity: 'behaviour',
      sources: 'finder cycle 1', placement: 'phase 1',
      problem: 'Two page sizes are configured at once.', solution: 'Pick one and record it.',
      stakes: 'A4 fixes print output; preferCssPageSize hands it to themes. No measurement picks between them.',
      decision: { question: 'Which page size stands?', options: ['A4 on the PDF renderer', 'preferCssPageSize from the stylesheet'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown (not a code block)) ===',
      '**`▪ Settle the page size (3 of 4)`** (behaviour)',
      'Sources: finder cycle 1',
      'Placement: phase 1',
      '',
      '=== MENU: task decision (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Decision**: Which page size stands?',
      '',
      '**`◆ Which way?`**',
      '',
      '**`1`**           → A4 on the PDF renderer',
      '**`2`**           → preferCssPageSize from the stylesheet',
      "**`t/technical`** → Retell the fork from the code's perspective",
      '**`d/decline`**   → Decline this task — it will not be built',
      '**Comment**     → Tell me what to change',
      '',
    ].join('\n'));
    const display = out.slice(0, out.indexOf('=== MENU'));
    for (const line of ['**Problem**', '**Solution**', '**Stakes**', '**Decision**']) {
      assert.ok(!display.includes(line), `the slim header carries no ${line} line — the record stays in the staging file`);
    }
    assert.ok(out.includes('**Decision**: Which page size stands?'), 'the menu carries the question as its statement label');
    assert.ok(!out.includes('a/auto'), 'an open decision is never one of the calls auto makes');
    assert.ok(!out.includes('Auto is on'), 'a gated decision carries no auto-override line — there is nothing being overridden');
  });

  it('a recommended side orders first with its suffix; plain strings mix in unchanged', () => {
    const file = writePayload(dir, 'dr.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's',
      stakes: 'Each side changes what ships; nothing measurable breaks the tie.',
      decision: { question: 'Which page size stands?', options: [
        'A4 on the PDF renderer',
        { summary: 'preferCssPageSize from the stylesheet', recommended: true },
        { summary: 'Neither — leave it configurable' },
      ] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.includes([
      '**`1`**           → preferCssPageSize from the stylesheet (recommended)',
      '**`2`**           → A4 on the PDF renderer',
      '**`3`**           → Neither — leave it configurable',
      "**`t/technical`** → Retell the fork from the code's perspective",
      '**`d/decline`**   → Decline this task — it will not be built',
    ].join('\n')), out);
  });

  it('a decision requires its stakes — absent, empty, or orphaned stakes refuse by name', () => {
    const decision = { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize'] };
    const missing = writePayload(dir, 'st1.json', { ...proposal, decision });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: missing, gate: 'gated' }),
      /"stakes" must be a non-empty string when "decision" is present/);
    const empty = writePayload(dir, 'st2.json', { ...proposal, decision, stakes: '  ' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }),
      /"stakes" must be a non-empty string when "decision" is present/);
    const orphan = writePayload(dir, 'st3.json', { ...proposal, stakes: 'each side matters' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: orphan, gate: 'gated' }),
      /"stakes" requires "decision"/);
  });

  it('a decision stops under --gate auto — and takes the comment hint', () => {
    const file = writePayload(dir, 'dc2.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's', stakes: 'the fork is product-shaped',
      decision: { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize', 'Neither — leave it configurable'] },
    });
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(auto.includes('MENU: task decision'), 'a decision item always stops');
    assert.ok(!auto.includes('DISPLAY: task auto-approved'));
    assert.ok(!auto.includes('MENU: task approval'));
    assert.ok(auto.includes('**Decision**: Which page size stands?\n\n**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'the question is the menu\'s statement label, the auto-override line beneath it — never the glyphed chrome');
    assert.ok(/\*\*`3`\*\* +→ Neither — leave it configurable/.test(auto));
    assert.ok(/\*\*`t\/technical`\*\* +→ Retell the fork from the code's perspective/.test(auto), 'the technical arm rides the decision menu');
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(auto));
  });

  it('a decision excludes authored blocks, and the malformed shapes are refused by name', () => {
    for (const [field, value] of [['steps', ['1. x']], ['criteria', ['- c']]]) {
      const file = writePayload(dir, `dx-${field}.json`, {
        ...proposal, [field]: value, stakes: 'the fork is product-shaped',
        decision: { question: 'Which way?', options: ['a', 'b'] },
      });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" excludes steps\/criteria/);
    }
    for (const [name, decision] of [['null', null], ['a bare string', 'yes']]) {
      const file = writePayload(dir, `dshape-${name.replace(/ /g, '-')}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" must be an object carrying "question" and "options"/, `decision as ${name} is refused`);
    }
    const withOutcome = writePayload(dir, 'dx-outcome.json', {
      ...proposal, outcome: 'One page size everywhere.', stakes: 'the fork is product-shaped',
      decision: { question: 'Which way?', options: ['a', 'b'] },
    });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' }),
      /"decision" excludes outcome/, 'a decision payload never carries a field the path would silently drop');
    const noProblem = writePayload(dir, 'dx-problem.json', {
      current: 1, total: 1, title: 'T', solution: 's', stakes: 'the fork is product-shaped',
      decision: { question: 'Which way?', options: ['a', 'b'] },
    });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }),
      /"problem" must be a non-empty string/, 'the payload mirrors its staging row — a decision with no record behind it is refused');
  });

  it('the question is head chrome — an option-shaped question never captures the arrow column', () => {
    const file = writePayload(dir, 'dq.json', {
      ...proposal, stakes: 'the fork is product-shaped',
      decision: { question: 'Ship **now** → later?', options: ['A4 on the PDF renderer', 'preferCssPageSize'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.includes('**Decision**: Ship **now** → later?'), 'the label passes through untouched');
    assert.ok(out.includes('**`1`**           → A4 on the PDF renderer'),
      'the arrow column is measured from the option rows alone — t/technical, at 11, stays the widest key');
  });

  it('a long end-state side wraps under its own row, the recommendation suffix riding the last segment', () => {
    const side = 'Unmatched captures land on an operator-visible record and a person resolves each one — nothing redelivers, nothing vanishes';
    const file = writePayload(dir, 'dw.json', {
      ...proposal, stakes: 'the fork is product-shaped',
      decision: { question: 'Where does an unmatched capture surface?', options: [{ summary: side, recommended: true }, 'Refused — the gateway redelivers'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    const lines = out.split('\n');
    const row = lines.findIndex((l) => l.startsWith('**`1`**'));
    assert.ok(row > 0, out);
    // NB(14) = the 11-wide t/technical key column + the three arrow columns.
    assert.ok(lines[row + 1].startsWith(NB(14)), 'continuations align under the label column in non-breaking spaces');
    const last = [lines[row], lines[row + 1], lines[row + 2] ?? ''].filter((l) => l.startsWith('**`1`**') || l.startsWith(NB(14))).pop();
    assert.ok(last && last.endsWith('(recommended)'), 'the suffix rides the wrapped row\'s last segment');
  });

  it('a malformed decision is refused by name', () => {
    const cases = [
      [{ options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: '  ', options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: 'Which?\nAnd how?', options: ['a', 'b'] }, /"decision\.question" must be a single line/],
      [{ question: 'Which?', options: ['a', 'b\nfake row'] }, /a side is one menu row — sides\[1\]\.summary must be a single line/],
      [{ question: 'Which?' }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['only one'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', 'b', 'c', 'd', 'e'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', ''] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', { summary: '  ' }] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', { recommended: true }] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', 7] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] }, /at most one option may be recommended/],
    ];
    cases.forEach(([decision, re], i) => {
      const file = writePayload(dir, `dbad-${i}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }), re);
    });
    const notObject = writePayload(dir, 'dbad-shape.json', { ...proposal, decision: ['a', 'b'] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notObject, gate: 'gated' }),
      /"decision" must be an object carrying "question" and "options"/);
  });

  it('incoherence-gate conflict: payload-driven display then the menu, recommended side first, byte-exact', () => {
    const file = writePayload(dir, 'ig.json', {
      doc: 'synonym-handling',
      lane: 'review',
      title: 'Expansion freshness rests on a stream that will not be built',
      context: 'The two decisions cannot both be implemented.',
      quotes: [
        { doc: 'behavioural-ranking', section: 'Signal Ingestion · Decision', quote: 'No live signal stream will be built.' },
        { doc: 'synonym-handling', section: 'Expansion Source · Decision', quote: 'Reading the live click-signal stream at query time.' },
      ],
      stakes: 'A spec extracting both sides describes a panel the record cannot produce.',
      sides: [
        { summary: 'Live click-signal stream at query time' },
        { summary: 'Batch-derived expansion, daily refresh', recommended: true },
      ],
    });
    const out = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'conflict' });
    assert.strictEqual(out, [
      '=== DISPLAY: incoherence conflict (emit verbatim as markdown (not a code block)) ===',
      '**Conflict — Expansion freshness rests on a stream that will not be built**',
      '',
      '- **behavioural-ranking · Signal Ingestion · Decision**: "No live signal stream will be built."',
      '- **synonym-handling · Expansion Source · Decision**: "Reading the live click-signal stream at query time."',
      '',
      '**Details**: The two decisions cannot both be implemented.',
      '',
      'A spec extracting both sides describes a panel the record cannot produce.',
      '',
      "=== MENU: incoherence conflict (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which decision stands?`**',
      '',
      '**`1`**       → Batch-derived expansion, daily refresh (recommended)',
      '**`2`**       → Live click-signal stream at query time',
      "**Comment** → Tell me what you're thinking; we'll work it through",
      '',
    ].join('\n'));
  });

  it('incoherence-gate gap-route: the raise plus its acknowledgement gate, byte-exact; held-doc keeps its menu', () => {
    const file = writePayload(dir, 'ig2.json', {
      lane: 'review',
      doc: 'synonym-handling',
      title: 'Ranking interaction is undecided',
      context: 'Neither source decides how expanded matches rank.',
      quotes: [{ doc: 'behavioural-ranking', section: 'Scoring · Decision', quote: 'Score blending is out of scope.' }],
      stakes: 'The ranking chapter cannot be written until this is decided.',
    });
    const gap = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'gap-route' });
    assert.strictEqual(gap, [
      '=== DISPLAY: incoherence gap (emit verbatim as markdown (not a code block)) ===',
      '**Gap — Ranking interaction is undecided**',
      '',
      '- **behavioural-ranking · Scoring · Decision**: "Score blending is out of scope."',
      '',
      '**Details**: Neither source decides how expanded matches rank.',
      '',
      'The ranking chapter cannot be written until this is decided.',
      '',
      "=== MENU: incoherence gap (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'The gap needs the room. Reopening "synonym-handling" with it pauses this specification until the answer lands; the map offers two other homes.',
      '',
      '**`◆ Reopen it?`**',
      '',
      '**`y/yes`**     → Reopen "synonym-handling" with the gap and pause here',
      '**`t/topic`**   → Open a new topic on the map for it — this',
      `${NB(12)}specification waits for it to conclude`,
      "**`r/roadmap`** → Park it on the roadmap — outside this specification's",
      `${NB(12)}scope`,
      "**Comment**   → Tell me what you're thinking before it moves",
      '',
    ].join('\n'));
    const docOnly = writePayload(dir, 'ig2b.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: docOnly, variant: 'held-doc' });
    assert.ok(held.includes('MENU: incoherence held doc'));
    assert.ok(held.includes('**`◆ How do you want to continue?`**'));
    assert.ok(/\*\*`n\/next`\*\* +→ Send the resolution to its mailbox and carry on here/.test(unwrap(held)), held);
    assert.ok(/\*\*`s\/stop`\*\* +→ Stop here/.test(held));
    assert.ok(unwrap(held).includes('"synonym-handling" is open in another session, so the fix belongs there; this topic waits for it.'),
      `no holder found at render time — the gate names no age: ${held}`);
  });

  it('incoherence-gate gap-route: the map destinations are the epic\'s — a linear work unit keeps the reopen alone', () => {
    writeManifest(dir, 'solo', {
      work_type: 'feature',
      phases: { implementation: { items: { solo: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'ig3.json', { lane: 'review', doc: 'solo', title: 't', context: 'c' });
    const linear = unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'solo.implementation.solo', file, variant: 'gap-route' }));
    assert.ok(linear.includes('Routing this to "solo" — it reopens with the gap, and this specification pauses until the answer lands.'),
      'one home is a statement, not a fork');
    assert.ok(/\*\*`◆ Proceed\?`\*\*/.test(linear));
    assert.ok(/\*\*`y\/yes`\*\* +→ Land the gap and pause here/.test(linear));
    assert.ok(!linear.includes('`t/topic`'), 'a feature has no map to open a topic on');
    assert.ok(!linear.includes('`r/roadmap`'), 'the park is the map\'s neighbour, offered where the map is');
    const epic = unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'gap-route' }));
    assert.ok(epic.includes('The gap needs the room. Reopening "solo" with it pauses this specification until the answer lands; the map offers two other homes.'),
      'three homes make it a fork — and the reopen names its cost');
    assert.ok(/\*\*`◆ Reopen it\?`\*\*/.test(epic));
    assert.ok(epic.includes('**`y/yes`**     → Reopen "solo" with the gap and pause here'));
    assert.ok(epic.includes('**`t/topic`**   → Open a new topic on the map for it — this specification waits for it to conclude'));
    assert.ok(epic.includes('**`r/roadmap`** → Park it on the roadmap — outside this specification\'s scope'));
  });

  it('incoherence-gate held-doc names the holder\'s last-active age, however long idle', () => {
    const peer = path.join(dir, '.leeway', '.cache', 'pay', 'discussion', 'synonym-handling', 'presence');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');
    const idle = new Date(Date.now() - 3 * 3600 * 1000);
    fs.utimesSync(peer, idle, idle);
    const file = writePayload(dir, 'ig2c.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'held-doc' });
    assert.ok(unwrap(held).includes('"synonym-handling" is open in another session — last active 3h ago — so the fix belongs there; this topic waits for it.'), held);
  });

  it('the incoherence stops announce over their own lane\'s auto — and stay silent over the other lane\'s', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'auto', construction_gate_mode: 'gated',
    } } } } });
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const conflict = writePayload(dir, 'al1.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    const out = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: conflict, variant: 'conflict' });
    assert.ok(unwrap(out).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'));
    // The same stop called from the construction lane is not overriding anything.
    const conflictC = writePayload(dir, 'al2.json', { doc: 'x', lane: 'construction', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    const outC = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: conflictC, variant: 'conflict' });
    assert.ok(!outC.includes('Auto is on'), 'a construction-lane stop does not announce the findings walk\'s auto');
    const gap = writePayload(dir, 'al3.json', { doc: 'x', lane: 'review', title: 't', context: 'c' });
    assert.ok(unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: gap, variant: 'gap-route' })).includes('Auto is on — stopping anyway'));
    const held = writePayload(dir, 'al4.json', { doc: 'x', lane: 'review' });
    assert.ok(unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: held, variant: 'held-doc' })).includes('Auto is on — stopping anyway'));
  });

  it('resurface-gate announces over construction auto only — it is construction-lane machinery', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'auto', construction_gate_mode: 'gated',
    } } } } });
    const payload = { section: 'S', diff: { current: ['old'], proposed: ['new'] } };
    const quiet = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.specification.portal', file: writePayload(dir, 'rs1.json', payload) });
    assert.ok(!quiet.includes('Auto is on'), 'findings auto is not resurface-gate\'s lane');
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'gated', construction_gate_mode: 'auto',
    } } } } });
    const loud = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.specification.portal', file: writePayload(dir, 'rs2.json', payload) });
    assert.ok(unwrap(loud).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'));
  });

  it('a payload without a legal lane is refused by name', () => {
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const badLane = writePayload(dir, 'al5.json', { doc: 'x', lane: 'planning', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: badLane, variant: 'conflict' }),
      /"lane" must be "construction" or "review"/);
    const noLane = writePayload(dir, 'al6.json', { doc: 'x', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noLane, variant: 'conflict' }),
      /"lane" must be "construction" or "review"/);
  });

  it('a conflict must quote the documents it collides — composed sides are refused', () => {
    const noQuotes = writePayload(dir, 'igq.json', { doc: 'x', lane: 'review', title: 't', context: 'c', sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(
      () => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noQuotes, variant: 'conflict' }),
      /a conflict must quote the sides it collides — sides you would compose yourself are not documented, and belong in a conversation, not this gate/,
    );
    const empty = writePayload(dir, 'igq2.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: [], sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: empty, variant: 'conflict' }), /"quotes" must be a non-empty array when present/);
    // gap-route keeps quotes optional: a gap has no collision to cite.
    const gap = writePayload(dir, 'igq3.json', { doc: 'x', lane: 'review', title: 't', context: 'c' });
    assert.ok(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: gap, variant: 'gap-route' }).includes('MENU: incoherence gap'));
  });

  it('incoherence-gate validates loudly: variant, doc, sides floor, single recommended', () => {
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const file = writePayload(dir, 'ig3.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file }), /--variant must be/);
    const noDoc = writePayload(dir, 'ig4.json', { lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noDoc, variant: 'conflict' }), /"doc" must be a non-empty string/);
    const oneSide = writePayload(dir, 'ig5.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: oneSide, variant: 'conflict' }), /at least 2 entries/);
    const twoRec = writePayload(dir, 'ig6.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: twoRec, variant: 'conflict' }), /at most one side/);
    const nlSide = writePayload(dir, 'ig6b.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b\nfake row' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: nlSide, variant: 'conflict' }), /a side is one menu row — sides\[1\]\.summary must be a single line/);
    const noTitle = writePayload(dir, 'ig7.json', { doc: 'x', lane: 'review', context: 'c', sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noTitle, variant: 'gap-route' }), /"title" must be a non-empty string/);
    const badQuote = writePayload(dir, 'ig8.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: [{ doc: 'a', section: 's' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: badQuote, variant: 'gap-route' }), /quotes\[0\] must carry doc, section, and quote/);
  });

  it('resurface-gate: header, diff fence, and the always-gated menu; --view full swaps the body and drops the view option', () => {
    const file = writePayload(dir, 'rs.json', {
      section: 'Expansion Source',
      diff: { context_above: ['ctx above'], current: ['old line'], proposed: ['new line'], context_below: ['ctx below'] },
      full: ['Full updated section body'],
    });
    const out = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('=== DISPLAY: resurfacing (emit verbatim as markdown (not a code block)) ===\n**Resurfacing: Expansion Source**'));
    assert.ok(out.includes('=== DISPLAY: resurfacing diff (emit verbatim as a diff code block (```diff fence)) ===\n ctx above\n-old line\n+new line\n ctx below'));
    assert.ok(out.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`v\/view full`\*\* +→ Show the full updated section/.test(out));
    const full = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file, view: 'full' });
    assert.ok(full.includes('**Resurfacing: Expansion Source** — full updated section\n\nFull updated section body'));
    assert.ok(!full.includes('view full'), 'the full view drops the view option');
    const noDiff = writePayload(dir, 'rs2.json', { section: 'X' });
    assert.throws(() => renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file: noDiff }), /"diff" is required/);
    const emptyDiff = writePayload(dir, 'rs3.json', { section: 'X', diff: { current: [], proposed: [] } });
    assert.throws(() => renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file: emptyDiff }), /at least one current\/proposed line/);
  });

  it('construction-gate: reads the manifest gate mode — menu when gated, announcement when auto', () => {
    const gated = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' });
    assert.ok(gated.includes('MENU: construction gate'));
    assert.ok(gated.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining topics automatically/.test(unwrap(gated)));
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'pay', 'manifest.json'), 'utf8'));
    m.phases.implementation.items.portal.construction_gate_mode = 'auto';
    fs.writeFileSync(path.join(dir, '.leeway', 'pay', 'manifest.json'), JSON.stringify(m, null, 2));
    const auto = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' });
    assert.ok(auto.includes('DISPLAY: construction auto-approved'));
    assert.ok(auto.includes('Portal — auto-approved. Recording to the specification.'));
    assert.ok(!auto.includes('MENU:'));
  });

  it('renders the ad hoc shape: no severity/sources, placement lines present', () => {
    const adhoc = {
      current: 1, total: 1, title: 'Fix login redirect',
      problem: 'Redirect loops on expired session.', solution: 'Clear the cookie first.', outcome: 'Login lands on the dashboard.',
      placement: 'phase 2', priority: '1', depends_on: 'portal-2-3',
      steps: ['1. Clear cookie', '2. Redirect'],
      criteria: ['- no loop on expired session'],
    };
    const file = writePayload(dir, 'a.json', adhoc);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    const lines = out.split('\n');
    assert.strictEqual(lines[1], '**`▪ Fix login redirect`**');
    assert.strictEqual(lines[2], 'Placement: phase 2');
    assert.strictEqual(lines[3], 'Priority: 1');
    assert.strictEqual(lines[4], 'Depends on: portal-2-3');
    assert.strictEqual(lines[5], '');
    assert.ok(!out.includes('Sources:'));
    assert.ok(out.includes('MENU: task approval'));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('Fix login redirect — approved [auto].'));
    assert.ok(!auto.includes('Task 1 of 1'));
  });
});

describe('render tasks-overview', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders a fresh cycle byte-exactly — all rows pending, no remaining count', () => {
    const file = writePayload(dir, 'o.json', { label: 'Analysis cycle 2', tasks: [{ title: 'Fix leak', severity: 'Important' }, { title: 'Add test', severity: 'Minor' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Analysis cycle 2** — 2 proposed tasks',
      '',
      '○ 1. Fix leak `[Important]`',
      '○ 2. Add test `[Minor]`',
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('renders a mid-walk resume — decided rows struck, remaining counted', () => {
    const file = writePayload(dir, 'r.json', { label: 'Analysis cycle 1', tasks: [
      { title: 'Fix leak', severity: 'Important', status: 'approved' },
      { title: 'Add test', severity: 'Minor', status: 'skipped' },
      { title: 'Type the selector', severity: 'Minor', status: 'pending' },
    ] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Analysis cycle 1** — 3 proposed tasks · 1 remaining',
      '',
      '✓ 1. ~~Fix leak~~ `[Important]`',
      '⊘ 2. ~~Add test~~ `[Minor]`',
      '○ 3. Type the selector `[Minor]`',
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('escapes markdown-active title text', () => {
    const file = writePayload(dir, 'e.json', { label: 'Cycle', tasks: [{ title: 'Collapse *both* fakes', severity: 'low' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.match(out, /○ 1\. Collapse \\\*both\\\* fakes `\[low\]`/);
  });

  it('validates loudly', () => {
    const file = writePayload(dir, 'o.json', { label: 'X', tasks: [{ title: 't' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file }), /task 1 needs "title" and "severity"/);
    const bad = writePayload(dir, 'b.json', { label: 'X', tasks: [{ title: 't', severity: 's', status: 'done' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: bad }), /render tasks-overview: task 1 carries unknown status "done" \(expected pending\/approved\/skipped\)/);
    const empty = writePayload(dir, 'empty.json', { label: 'X', tasks: [] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: empty }), /"tasks" must be a non-empty array/, 'an empty overview refuses — the zero-proposal branches route around this surface');
  });
});

describe('render author-task-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the task\'s detail above the authoring menu byte-exactly', () => {
    const file = writePayload(dir, 'at.json', { content: '## portal-1-2\n\n### Task 2: Wrap command\n\n**Problem**: the argv runs bare.' });
    const out = renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '5', title: 'Wrap command', file });
    assert.strictEqual(out, [
      '=== DISPLAY: authored task (emit verbatim as markdown (not a code block)) ===',
      '## portal-1-2',
      '',
      '### Task 2: Wrap command',
      '',
      '**Problem**: the argv runs bare.',
      '',
      '=== MENU: author task gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Task 2 of 5: Wrap command**',
      '',
      '**`◆ Write it to the plan?`**',
      '',
      '**`y/yes`**                  → Write it to the plan',
      '**`a/auto`**                 → Approve this and all remaining tasks',
      `${NB(25)}automatically`,
      '**Tell me what to change** → what to revise in this task',
      '**Navigate**               → Tell me where to go: a different phase',
      `${NB(25)}or task, or the leading edge`,
      '',
    ].join('\n'));
  });

  it('validates the scalars and the payload loudly', () => {
    const file = writePayload(dir, 'at.json', { content: 'x' });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '0', total: '5', title: 'X', file }), /--m must be a positive integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '1', title: 'X', file }), /--total must be an integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', file }), /--title is required/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', title: 'X' }), /--file <payload\.json> is required — the task's detail/);
    const blank = writePayload(dir, 'blank.json', { content: '  ' });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', title: 'X', file: blank }), /"content" must be the task's full detail, a non-empty string/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.implementation.portal', m: '1', total: '2', title: 'X', file }), /address must be <work_unit>\.planning\.<topic>/);
  });

  it('--phase is the gate-mode check: the auto line counts the phase\'s rows, gated answers empty', () => {
    const rows = { 'portal-1-1': 'pending', 'portal-1-2': 'approved', 'portal-1-3': 'rejected' };
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', author_gate_mode: 'auto', staging: { 'author-p1': { tasks: rows } } } } } } });
    assert.strictEqual(renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), [
      '=== DISPLAY: author tasks auto-approved (emit verbatim as a text code block (```text fence) after recording the approvals — the user set this gate to auto: do not stop; continue as the workflow instructs) ===',
      'Phase 1: 3 tasks authored. Auto-approved. Writing to plan.',
      '',
    ].join('\n'));

    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', author_gate_mode: 'gated', staging: { 'author-p1': { tasks: rows } } } } } } });
    assert.strictEqual(renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), '');
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', staging: { 'author-p1': { tasks: rows } } } } } } });
    assert.strictEqual(renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), '', 'no recorded mode reads gated');
  });

  it('--phase refuses a phase with no authoring rows, a bad number, and the task flags beside it', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', author_gate_mode: 'auto' } } } } });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1' }), /phase 1 has no authoring rows — register them before the check/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: 'one' }), /--phase must be a positive integer/);
    const file = writePayload(dir, 'at.json', { content: 'x' });
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', phase: '1', file }), /--phase is the phase's gate-mode check — it takes no task flags/);
  });
});

describe('render phase-tree', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders numbered phase nodes with wrapped tree detail, byte-exactly', () => {
    const file = writePayload(dir, 'ph.json', {
      phases: [
        { name: 'Adapter Wrapper', detail: [['Goal', 'burst windows land at a live shell'], ['Criteria', 'no dead-end prompt']] },
        { name: 'Regression Net', detail: [['Goal', 'attach flows pinned by tests']] },
      ],
    });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: phase tree (emit verbatim as a text code block (```text fence)) ===',
      'Phase structure — 2 phases.',
      '',
      '1. Adapter Wrapper',
      '   ├─ Goal: burst windows land at a live shell',
      '   └─ Criteria: no dead-end prompt',
      '',
      '2. Regression Net',
      '   └─ Goal: attach flows pinned by tests',
      '',
    ].join('\n'));
  });

  it('appends the structure gate with --approve; long detail wraps with the gutter', () => {
    const file = writePayload(dir, 'ph.json', {
      phases: [{ name: 'X', detail: [['Goal', 'goal '.repeat(30).trim()], ['Criteria', 'done']] }],
    });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    assert.ok(out.includes('MENU: phase structure gate'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed to task breakdown/.test(out));
    const lines = out.split('\n');
    const goalIdx = lines.findIndex((l) => l.startsWith('   ├─ Goal:'));
    assert.ok(lines[goalIdx + 1].startsWith('   │  goal'), 'wrapped detail carries the gutter');
  });

  it('--menu-only is the structure gate alone — byte-identical to the one --approve appends, no payload read', () => {
    const file = writePayload(dir, 'ph.json', { phases: [{ name: 'X', detail: [['Goal', 'g']] }] });
    const approve = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    const gate = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', 'menu-only': '1' });
    assert.ok(gate.startsWith('=== MENU: phase structure gate'), gate);
    assert.strictEqual(approve.slice(approve.indexOf('=== MENU: phase structure gate')), gate);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning', 'menu-only': '1' }), /address must be <work_unit>\.<phase>\.<topic>/);
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { phases: [] }) }), /"phases" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { phases: [{ name: 'X', detail: [] }] }) }), /"detail" must be a non-empty array/);
  });
});

describe('render task-list --variant existing', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('gated menu drops the auto option; auto mode says confirmed', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 'b' }] });
    const gated = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(/\*\*Tell me what to change\*\* +→ which tasks to revise in this phase/.test(gated));
    assert.ok(!gated.includes('`a/auto`'), 'existing variant offers no auto opt-in');

    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const auto = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(auto.includes('Phase 1: X — task list confirmed. Proceeding to authoring.'));
  });
});

describe('pipeline continuation surfaces', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    // A feature with everything before review completed — the
    // implementation → review hop, every way forward on offer.
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'completed' } } },
        specification: { items: { pay: { status: 'completed' } } },
        planning: { items: { pay: { status: 'completed' } } },
        implementation: { items: { pay: { status: 'completed' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('next-phase-gate: the review hop offers proceed, complete without review, and revisit — byte-stable', () => {
    assert.strictEqual(renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'review' }), [
      "=== MENU: next phase gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Implementation completed for "Pay".',
      '',
      '**`◆ Proceed to review?`**',
      '',
      '**`y/yes`**     → Proceed to review',
      '**`d/done`**    → Complete without review',
      '**`r/revisit`** → Revisit an earlier phase',
      '',
    ].join('\n'));
  });

  it('next-phase-gate: a non-review hop carries no d/done — proceed or revisit', () => {
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'specification', next: 'planning' });
    assert.ok(out.includes('Specification completed for "Pay".'), out);
    assert.match(out, /`◆ Proceed to planning\?`/);
    assert.match(out, /\*\*`y\/yes`\*\* +→ Proceed to planning/);
    assert.match(out, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!out.includes('d/done'), 'skip-review belongs to the review hop alone');
  });

  it('next-phase-gate: no r/revisit while no earlier phase is completed — the review hop still offers d/done', () => {
    writeManifest(dir, 'fresh', {
      work_type: 'feature',
      phases: { implementation: { items: { fresh: { status: 'in-progress' } } } },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'fresh', prev: 'implementation', next: 'review' });
    assert.match(out, /\*\*`y\/yes`\*\*  → Proceed to review/);
    assert.match(out, /\*\*`d\/done`\*\* → Complete without review/);
    assert.ok(!out.includes('r/revisit'), out);
  });

  it('next-phase-gate: empty when continuing is the only way forward — nothing to skip, nothing to revisit', () => {
    writeManifest(dir, 'lab', {
      work_type: 'feature',
      phases: { discussion: { items: { lab: { status: 'in-progress' } } } },
    });
    assert.strictEqual(renderSurface(dir, 'next-phase-gate', { dotpath: 'lab', prev: 'experiment', next: 'discussion' }), '');
  });

  it('next-phase-gate: the review hop names a live reconcile flag — skipping review is an informed choice', () => {
    writeManifest(dir, 'moved', {
      work_type: 'feature',
      phases: {
        specification: { items: { moved: { status: 'completed' } } },
        implementation: { items: { moved: { status: 'completed' } } },
        review: { items: { moved: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved', prev: 'implementation', next: 'review' });
    assert.ok(out.includes('Implementation completed for "Moved". ⚑ Input moved beneath review/moved (implementation) — completing without review carries the pending reconcile unresolved.'), out);
    // The cue informs the skip — a hop with no d/done carries none, flag or not.
    const planning = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved', prev: 'specification', next: 'planning' });
    assert.ok(planning.includes('Specification completed for "Moved".') && !planning.includes('⚑'), planning);
    // No flag, no cue.
    assert.ok(!renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'review' }).includes('⚑'));
  });

  it('a derived phase says the session is complete, never the phase — sibling records may still live', () => {
    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'experiment' });
    assert.ok(note.includes('Experiment session complete for "Pay".'), note);
    assert.ok(!note.includes('Experiment completed'), 'never claims the phase completed');

    writeManifest(dir, 'lab', {
      work_type: 'feature',
      phases: { research: { items: { lab: { status: 'completed' } } } },
    });
    const gate = renderSurface(dir, 'next-phase-gate', { dotpath: 'lab', prev: 'experiment', next: 'discussion' });
    assert.ok(gate.includes('Experiment session complete for "Lab".'), gate);
    assert.match(gate, /\*\*`y\/yes`\*\* +→ Proceed to discussion/);
  });

  it('epic-all-done-gate and phase-completed carry their statements', () => {
    const allDone = renderSurface(dir, 'epic-all-done-gate', { dotpath: 'pay' });
    assert.ok(allDone.includes('All topics have completed review for "Pay".'));

    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'discussion' });
    assert.ok(note.includes('Discussion completed for "Pay".'));
  });

  it('work-unit addressing is loud on dotted paths, unknown units, missing flags, and an epic', () => {
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay.review.pay', phase: 'review' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'nope', phase: 'review' }), /work unit "nope" not found/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', next: 'planning' }), /--prev is required/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'specification' }), /--next is required/);
    writeManifest(dir, 'big', { work_type: 'epic' });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'big', prev: 'implementation', next: 'review' }), /"big" is typed "epic" — the gate serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'revisit-phases', { dotpath: 'big' }), /"big" is typed "epic" — the revisit menu serves the linear work types/);
    writeManifest(dir, 'raw', { work_type: undefined });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'raw', prev: 'implementation', next: 'review' }), /"raw" is untyped — the gate serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay' }), /--phase is required/);
  });

  it('next-phase-gate: refuses a phase outside the type\'s pipeline — a typo, done, or review on a type that has none', () => {
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'reveiw' }),
      /unknown --next "reveiw" for a feature \(pipeline: research, experiment, discussion, specification, planning, implementation, review\)/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'review', next: 'done' }), /unknown --next "done" for a feature/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'banana', next: 'review' }), /unknown --prev "banana" for a feature/);
    // Cross-cutting ends at specification: a review hop is a relay slip, and
    // the skip-review row it would render has no arm in that continuation.
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { discussion: { items: { xc: { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'xc', prev: 'discussion', next: 'review' }),
      /unknown --next "review" for a cross-cutting \(pipeline: research, experiment, discussion, specification\)/);
    const hop = renderSurface(dir, 'next-phase-gate', { dotpath: 'xc', prev: 'discussion', next: 'specification' });
    assert.match(hop, /\*\*`y\/yes`\*\* +→ Proceed to specification/);
    assert.match(hop, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!hop.includes('d/done'), hop);
  });

  it('next-phase-gate: several live reconcile flags join into one cue', () => {
    writeManifest(dir, 'moved2', {
      work_type: 'feature',
      phases: {
        specification: { items: { moved2: { status: 'completed', reconcile_needed: 'discussion' } } },
        implementation: { items: { moved2: { status: 'completed' } } },
        review: { items: { moved2: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved2', prev: 'implementation', next: 'review' });
    assert.ok(out.includes('⚑ Input moved beneath specification/moved2 (discussion), review/moved2 (implementation) — completing without review carries the pending reconcile unresolved.'), out);
  });
});

describe('review fixes — gap coverage', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: {
      planning: { items: {
        portal: { status: 'in-progress', finding_gate_mode: 'gated' },
        live: { status: 'in-progress', finding_gate_mode: 'auto' },
      } },
      specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } },
    } });
  });
  afterEach(() => teardown(dir));

  const base = {
    n: 1, total: 1, title: 'T', meta: [['Severity', 'Minor']],
    move: 'settled', problem: 'P', proposal: 'Q',
  };

  it('finding content × gated offers v/view, never view full', () => {
    const file = writePayload(dir, 'f.json', { ...base, content: { label: 'Proposed Addition', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!out.includes('view full'), 'there is no full copy to re-show');
    assert.ok(/`v\/view`/.test(out), 'the wording stays reachable');
  });

  it('finding diff × auto renders the diff fence plus the applied line, no menu', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.live', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!/frame/.test(out), 'no frame sections survive the D8 retirement');
    assert.ok(out.includes('DISPLAY: finding auto-approved'));
    assert.ok(!out.includes('MENU: finding gate'));
  });

  it('finding diff × a batched address renders the fence and stops there', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!out.includes('DISPLAY: finding auto-approved'));
    assert.ok(!out.includes('MENU: finding gate'));
  });

  it('null payload is a loud named error, not a TypeError', () => {
    const file = writePayload(dir, 'n.json', 'null');
    for (const surface of ['finding', 'findings-summary', 'proposed-task', 'tasks-overview', 'phase-tree']) {
      assert.throws(
        () => renderSurface(dir, surface, { dotpath: 'pay.planning.portal', file, gate: 'gated' }),
        /payload must be a JSON object or array/,
        surface,
      );
    }
  });

  it('a context-only diff is refused loudly', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { context_above: ['ctx'], current: [], proposed: [] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file }), /"diff" must carry at least one current\/proposed line/);
  });

  it('null meta values and null phase-tree detail values are refused', () => {
    const bad = writePayload(dir, 'm.json', { ...base, meta: [['Severity', null]] });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: bad }), /"meta" must be an array of \[label, value\] pairs/);
    const badTree = writePayload(dir, 'pt.json', { phases: [{ name: 'X', detail: [['Goal', null]] }] });
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: badTree }), /"detail" must be a non-empty array of \[label, value\] pairs/);
  });

  it('phase-tree --approve menu offers view full', () => {
    const file = writePayload(dir, 'pt.json', { phases: [{ name: 'X' }] });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    assert.ok(/\*\*`v\/view full`\*\* +→ Show the full phase structure — goals, ordering rationale, acceptance criteria/.test(unwrap(out)));
  });
});

describe('CLI boundary — engine render through the argv entry', () => {
  const harness = require('./engine-harness.cjs');
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'in-progress' } } },
        planning: { items: { pay: { status: 'in-progress', task_list_gate_mode: 'auto' } } },
        specification: { items: { pay: { status: 'superseded', superseded_by: 'core' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  const run = (/** @type {string[]} */ args) => harness.output(dir, ['render', ...args]);

  it('flags survive argv: --mail, --variant, --approve, --gate, scalar flags', () => {
    assert.ok(run(['resume-gate', 'pay.discussion.pay', '--mail', '2']).includes('2 message(s)'));
    const tl = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 's' }] });
    assert.ok(run(['task-list', 'pay.planning.pay', '--file', tl, '--variant', 'existing']).includes('task list confirmed'));
    const pt = writePayload(dir, 'pt.json', { phases: [{ name: 'P' }] });
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--file', pt, '--approve']).includes('MENU: phase structure gate'));
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--menu-only']).startsWith('=== MENU: phase structure gate'));
    const task = writePayload(dir, 'task.json', { current: 1, total: 1, title: 'T', severity: 'Minor', sources: 's', problem: 'p', solution: 's', outcome: 'o', steps: ['1'], criteria: ['c'] });
    assert.ok(run(['proposed-task', 'pay.planning.pay', '--file', task, '--gate', 'auto']).includes('approved [auto]'));
    const detail = writePayload(dir, 'at.json', { content: 'The task.' });
    assert.ok(run(['author-task-gate', 'pay.planning.pay', '--m', '1', '--total', '2', '--title', 'T', '--file', detail]).includes('**Task 1 of 2: T**'));
    const gate = run(['next-phase-gate', 'pay', '--prev', 'implementation', '--next', 'review']);
    assert.ok(gate.includes('Implementation completed for "Pay".') && gate.includes('Complete without review'), gate);
    assert.ok(run(['phase-completed', 'pay', '--phase', 'discussion']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['phase-paused', 'pay', '--phase', 'discussion']).includes('Discussion paused for "Pay".'));
    assert.ok(run(['epic-all-done-gate', 'pay']).includes('Mark this epic as completed'));
    assert.ok(run(['entry-gate', 'pay.specification.pay', '--own']).includes('was consolidated into'),
      '--own must survive boolean-flag registration through argv');
    assert.ok(run(['phase-completed', 'pay', '--phase', 'scoping', '--paths']).includes(`  Spec: ${dir}/.leeway/pay/specification/pay/specification.md`),
      '--paths must survive boolean-flag registration through argv');
  });

  it('surface errors surface as failJson on stderr with exit 1', () => {
    assert.match(harness.refuses(dir, ['render', 'proposed-task', 'pay.planning.pay', '--file', 'missing.json', '--gate', 'nope']).error,
      /--gate must be "gated" or "auto"/);
  });
});

describe('render phase-note', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { 'auth-flow': { status: 'completed' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the one-liner with the phase noun by default and an override when given', () => {
    assert.strictEqual(renderSurface(dir, 'phase-note', { dotpath: 'pay.research.auth-flow', verb: 'Resuming' }),
      '=== DISPLAY: phase note (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===\nResuming research: Auth Flow\n');
    assert.ok(renderSurface(dir, 'phase-note', { dotpath: 'pay.planning.auth-flow', verb: 'Reopening', noun: 'plan' })
      .includes('Reopening plan: Auth Flow'));
    assert.throws(() => renderSurface(dir, 'phase-note', { dotpath: 'pay.research.auth-flow' }), /--verb is required/);
  });
});

describe('render step-opening', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const MARKER = '=== DISPLAY: step opening (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===';
  const opening = (name, signpost) => [MARKER, `**\`□ ${name}\`**`, '', `> ${signpost}`, ''].join('\n');

  it('session: the research and discussion sessions open fresh, or picked back up where --resumed', () => {
    writeManifest(dir, 'pay', {});
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.research.auth', step: 'session' }), opening('Research Session',
      "Starting the research session. This is open-ended exploration — follow threads, surface options, and document findings; I'll keep a register of what we set out to learn and where each question stands. No decisions needed at this stage."));
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.research.auth', step: 'session', resumed: '1' }), opening('Research Session',
      "Picking the research back up where it left off. This is open-ended exploration — follow threads, surface options, and document findings; I'll keep a register of what we set out to learn and where each question stands. No decisions needed at this stage."));
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.discussion.auth', step: 'session' }), opening('Discussion Session',
      "Discussion starting. I'll track our conversation on a Discussion Map. You can lead wherever you want — I'll challenge thinking, explore edge cases, and capture decisions as we go."));
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.discussion.auth', step: 'session', resumed: '1' }), opening('Discussion Session',
      "Picking the discussion back up where the map leaves it. You can lead wherever you want — I'll challenge thinking, explore edge cases, and capture decisions as we go."));
  });

  it('conclude: a cross-cutting specification closes the pipeline, every other hands over to planning — read from the work type', () => {
    writeManifest(dir, 'pay', {});
    writeManifest(dir, 'caching', { work_type: 'cross-cutting' });
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.specification.checkout', step: 'conclude' }),
      opening('Conclude', 'Wrapping up. Final assessment, sign-off, and handover to the planning phase.'));
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'caching.specification.caching', step: 'conclude' }),
      opening('Conclude', 'Wrapping up. Final assessment, sign-off, and closure — the pipeline completes here.'));
  });

  it('consolidation: the pass names the phase in flight, read from the implementation item', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { checkout: { status: 'in-progress', current_phase: 2 } } } } });
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.implementation.checkout', step: 'consolidation' }), opening('Consolidation Pass (phase 2)',
      "Phase 2's tasks are done. Before the phase closes: one sweep over what they built side by side — consolidation the plan could not author, plus everything banked along the way."));
    assert.throws(() => renderSurface(dir, 'step-opening', { dotpath: 'pay.implementation.other', step: 'consolidation' }),
      /implementation "other" records no current_phase — the pass runs at a phase boundary/);
  });

  it('do-now: counts the do-now actions the review synthesis wrote, the noun following the count', () => {
    writeManifest(dir, 'pay', {});
    const actions = (list) => writePayload(dir, '.leeway/.cache/pay/review/checkout/actions.json', { verdict: 'pass', actions: list });
    actions([{ id: 'A1', route: 'do-now' }, { id: 'A2', route: 'replan' }, { id: 'A3', route: 'do-now' }]);
    assert.strictEqual(renderSurface(dir, 'step-opening', { dotpath: 'pay.review.checkout', step: 'do-now' }), opening('Apply Do-Now',
      'Applying 2 contained corrections — low-impact, blast radius minimised. The whole body of work is verified and the suite run before anything lands.'));
    actions([{ id: 'A1', route: 'do-now' }]);
    assert.match(renderSurface(dir, 'step-opening', { dotpath: 'pay.review.checkout', step: 'do-now' }), /> Applying 1 contained correction — /);
    actions([{ id: 'A1', route: 'out-of-scope' }]);
    assert.throws(() => renderSurface(dir, 'step-opening', { dotpath: 'pay.review.checkout', step: 'do-now' }),
      /actions\.json holds no do-now action — the step opens only over work to apply/);
    assert.throws(() => renderSurface(dir, 'step-opening', { dotpath: 'pay.review.other', step: 'do-now' }),
      /\.leeway\/\.cache\/pay\/review\/other\/actions\.json is missing or not valid JSON — the do-now step follows the review synthesis/);
  });

  it('refuses a missing or unknown step, and a step outside its phase', () => {
    writeManifest(dir, 'pay', {});
    assert.throws(() => renderSurface(dir, 'step-opening', { dotpath: 'pay.research.auth' }),
      /--step must be one of session, conclude, consolidation, do-now, got ""/);
    assert.throws(() => renderSurface(dir, 'step-opening', { dotpath: 'pay.research.auth', step: 'wrap' }), /got "wrap"/);
    assert.throws(() => renderSurface(dir, 'step-opening', { dotpath: 'pay.planning.auth', step: 'session' }),
      /the session step opens in research or discussion, got phase "planning"/);
  });
});

describe('render format-version-check', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const found = { tool: 'acme', installed: '0.2.1', format: 'some-format', required: '>=0.3.*', update_instructions: 'the format\'s about.md' };
  const payload = (obj) => writePayload(dir, '.leeway/.cache/pay/planning/checkout/format-version.json', obj);

  it('the red blocker, then the guidance naming the tool, both versions and the format the payload carries — waiting on the user', () => {
    assert.strictEqual(renderSurface(dir, 'format-version-check', { file: payload(found) }), [
      '=== DISPLAY: version blocker (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The installed tool does not meet the version this plan format requires',
      '',
      "=== DISPLAY: version guidance (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "> acme 0.2.1 is installed; the some-format format requires `>=0.3.*`. See the format's about.md to update.",
      '',
    ].join('\n'));
  });

  it('a tool not installed — `installed` absent or null — reads as missing and asks for an install', () => {
    const absent = { ...found };
    delete absent.installed;
    for (const missing of [absent, { ...found, installed: null }]) {
      assert.strictEqual(renderSurface(dir, 'format-version-check', { file: payload(missing) }), [
        '=== DISPLAY: version blocker (emit verbatim as a properties code block (```properties fence)) ===',
        '⚑ The tool this plan format requires is not installed',
        '',
        "=== DISPLAY: version guidance (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
        "> acme is not installed; the some-format format requires `>=0.3.*`. See the format's about.md to install.",
        '',
      ].join('\n'));
    }
  });

  it('refuses no payload, any required field missing or blank, and a blank installed version, by name', () => {
    assert.throws(() => renderSurface(dir, 'format-version-check', {}), /--file <payload\.json> is required/);
    for (const field of ['tool', 'format', 'required', 'update_instructions']) {
      assert.throws(() => renderSurface(dir, 'format-version-check', { file: payload({ ...found, [field]: ' ' }) }),
        new RegExp(`render format-version-check: "${field}" must be a non-empty string`));
    }
    assert.throws(() => renderSurface(dir, 'format-version-check', { file: payload({ ...found, installed: ' ' }) }),
      /render format-version-check: "installed" must be a non-empty string, or left out where the tool is not installed/);
  });
});

describe('render code-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { work_type: 'feature', phases: { implementation: { items: { pay: { status: 'in-progress' } } } } });
    writeManifest(dir, 'ship', { work_type: 'feature', phases: {} });
  });
  afterEach(() => teardown(dir));

  // Sessions are processes. `mine` runs as this process — alive with a real
  // start time, so its beats are verifiable. `theirs` is only ever the gated
  // entrant, which stamps nothing, so a reaped pid serves: never this
  // process, never the pid-1 holder, so neither owns the other's rows.
  const PID_OF = { mine: process.pid, theirs: require('child_process').spawnSync('node', ['-e', '']).pid };

  /**
   * A held heartbeat owned by another session — pid 1, always alive and never
   * a session here — working in `checkout`, this one by default.
   */
  function holdCode(workUnit, phase, topic, ageSeconds = 0, checkout = dir) {
    const file = path.join(dir, '.leeway', '.cache', workUnit, phase, topic, 'presence');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer', checkout }) + '\n');
    if (ageSeconds) {
      const when = new Date(Date.now() - ageSeconds * 1000);
      fs.utimesSync(file, when, when);
    }
    return file;
  }

  /**
   * Render as a named session. Identity is what presence records and what
   * every consumer compares against, so a test about two sessions is a test
   * about two identities — session id and pid both, from PID_OF.
   * @param {'mine'|'theirs'} sessionId @param {string} dotpath
   */
  function renderAs(sessionId, dotpath) {
    const session = process.env.CLAUDE_CODE_SESSION_ID;
    const pid = process.env.CLAUDE_PID;
    process.env.CLAUDE_CODE_SESSION_ID = sessionId;
    process.env.CLAUDE_PID = String(PID_OF[/** @type {keyof typeof PID_OF} */ (sessionId)]);
    try {
      return renderSurface(dir, 'code-gate', { dotpath });
    } finally {
      if (session === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = session;
      if (pid === undefined) delete process.env.CLAUDE_PID;
      else process.env.CLAUDE_PID = pid;
    }
  }

  const slotOf = (workUnit, phase, topic) =>
    path.join(dir, '.leeway', '.cache', workUnit, phase, topic, 'presence');

  it('renders nothing when no session holds the code slot', () => {
    assert.strictEqual(renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' }), '');
  });

  it('taking a free slot is the same act as reading it — the empty path beats', () => {
    const slot = slotOf('pay', 'implementation', 'pay');
    assert.ok(!fs.existsSync(slot), 'nothing holds the slot yet');

    assert.strictEqual(renderAs('mine', 'pay.implementation.pay'), '');

    assert.strictEqual(JSON.parse(fs.readFileSync(slot, 'utf8')).session_id, 'mine',
      'the entrant holds the slot from entry, not from its first code commit');
  });

  it('the entrant then holds it against the next session, and never against itself', () => {
    assert.strictEqual(renderAs('mine', 'pay.implementation.pay'), '');

    const out = renderAs('theirs', 'pay.review.pay');
    assert.match(out, /⚑ Another session is implementing "Pay" \(pay\)/, out);

    // The holder re-reading its own gate stays empty and refreshes its hold —
    // backdated, the re-render brings its last-active age back to now.
    const slot = slotOf('pay', 'implementation', 'pay');
    const stale = new Date(Date.now() - 600 * 1000);
    fs.utimesSync(slot, stale, stale);
    assert.strictEqual(renderAs('mine', 'pay.implementation.pay'), '');
    assert.ok((Date.now() - fs.statSync(slot).mtimeMs) / 1000 < 60, 'the re-render refreshed the beat');
    assert.strictEqual(JSON.parse(fs.readFileSync(slot, 'utf8')).session_id, 'mine');
  });

  it('a gated entrant never stamps the slot it was refused', () => {
    holdCode('ship', 'implementation', 'checkout-flow');
    assert.notStrictEqual(renderAs('mine', 'pay.review.pay'), '');
    assert.ok(!fs.existsSync(slotOf('pay', 'review', 'pay')),
      'the gate is a stop, not an entry — nothing is held until the slot is free');
  });

  it('a holder idle for hours still holds the slot — the gate names its age and nothing else changes', () => {
    holdCode('ship', 'implementation', 'checkout-flow', 3 * 3600);
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' });
    assert.match(out, /⚑ Another session is implementing "Checkout Flow" \(ship\) — last active 3h ago\./, out);
    assert.match(out, /=== MENU: code gate/, out);
  });

  it('states the holder in the red register and offers back first, proceed second', () => {
    holdCode('ship', 'implementation', 'checkout-flow', 120);
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' });

    assert.match(out, /=== DISPLAY: code gate \(emit verbatim as a properties code block/, out);
    assert.match(out, /⚑ Another session is implementing "Checkout Flow" \(ship\) — last active 2m ago\./, out);
    assert.match(out, /=== MENU: code gate \(emit verbatim as markdown \(not a code block\), then STOP/, out);
    const menu = unwrap(out);
    assert.match(menu, /Code phases run one at a time — concurrent sessions write the same files/, menu);
    assert.match(menu, /Only proceed if you know that session is no longer working/, menu);
    assert.match(menu, /presence clear ship implementation checkout-flow/, menu);
    assert.match(menu, /\*\*`◆ Proceed anyway\?`\*\*/, menu);
    assert.ok(menu.indexOf('`b/back`') < menu.indexOf('`y/yes`'), 'back leads');
    assert.match(menu, /`b\/back`\*\* +→ Leave that session to it \(recommended\)/, menu);
  });

  it('a review holder reads as reviewing, and any work unit takes the one slot', () => {
    holdCode('ship', 'review', 'checkout-flow');
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.review.pay' });
    assert.match(out, /Another session is reviewing "Checkout Flow" \(ship\)/, out);
    assert.match(unwrap(out), /presence clear ship review checkout-flow/, out);
  });

  it('a hold from another checkout never takes this one\'s slot — each code worktree has its own', () => {
    const { git } = require('./engine-harness.cjs');
    const wt = path.join(dir, 'wt');
    git(dir, ['worktree', 'add', '-q', '-b', 'side', wt]);
    holdCode('ship', 'implementation', 'checkout-flow', 0, wt);
    assert.strictEqual(renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' }), '',
      'the main checkout is free');
    assert.match(renderSurface(wt, 'code-gate', { dotpath: 'pay.implementation.pay' }),
      /⚑ Another session is implementing "Checkout Flow" \(ship\)/, 'the worktree is held');
  });

  it('a doc-phase hold never takes the code slot', () => {
    holdCode('ship', 'discussion', 'checkout-flow');
    assert.strictEqual(renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' }), '');
  });

  it('the calling session\'s own hold is not a gate against itself', () => {
    holdCode('pay', 'implementation', 'pay');
    const before = process.env.CLAUDE_CODE_SESSION_ID;
    process.env.CLAUDE_CODE_SESSION_ID = 'peer';
    try {
      assert.strictEqual(renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' }), '');
    } finally {
      if (before === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = before;
    }
  });

  it('names every holder when more than one slot is somehow held', () => {
    holdCode('ship', 'implementation', 'checkout-flow');
    holdCode('pay', 'review', 'pay');
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' });
    assert.match(out, /⚑ Another session is [\s\S]*⚑ Another session is /, out);
  });

  it('refuses an address outside the code phases', () => {
    assert.throws(() => renderSurface(dir, 'code-gate', { dotpath: 'pay.discussion.pay' }),
      /the code rule covers implementation\|review only/);
  });

  it('refuses an unknown work unit and a topic that is not a name', () => {
    // The empty path claims the slot by beating this address, and a beat is
    // silent on a name it cannot write — so a bad address would render a free
    // slot and hold nothing.
    assert.throws(() => renderSurface(dir, 'code-gate', { dotpath: 'ghost.implementation.pay' }),
      /work unit "ghost" not found/);
    assert.throws(() => renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.a/b' }),
      /invalid topic name "a\/b"/);
    assert.strictEqual(fs.existsSync(path.join(dir, '.leeway/.cache/pay/implementation')), false,
      'a refusal claims nothing');
  });

  it('gates before the item exists — a fresh entry has initialised nothing', () => {
    assert.strictEqual(renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.never-inited' }), '');
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.cache/pay/implementation/never-inited/presence')),
      'and the slot is claimed all the same');
  });
});

describe('render entry-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  function manifestWith(phases, workType = 'feature') {
    writeManifest(dir, 'pay', { work_type: workType, phases });
  }

  it('planning: every specification state maps to its blocker; completed is clear', () => {
    manifestWith({});
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /⚑ No specification found for "Auth"/);
    manifestWith({ specification: { items: { auth: { status: 'in-progress' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /⚑ The specification for "Auth" is not yet completed/);
    manifestWith({ specification: { items: { auth: { status: 'proposed' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /proposed grouping[\s\S]*Start the specification first/);
    manifestWith({ specification: { items: { auth: { status: 'superseded', superseded_by: 'core-auth' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /consolidated into "Core Auth"[\s\S]*Plan the superseding specification/);
    manifestWith({ specification: { items: { auth: { status: 'promoted', promoted_to: 'cc-auth' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), /promoted to the cross-cutting work unit "cc-auth"/);
    manifestWith({ specification: { items: { auth: { status: 'completed' } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), '');
  });

  it('planning: a completed specification still in motion holds the entry — the flag and the open source row alike', () => {
    manifestWith({ specification: { items: { auth: { status: 'completed', reconcile_needed: 'discussion' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }),
      /⚑ Entry blocked — the specification for "Auth" is unsettled \(its own input moved\)[\s\S]*Continue the work unit — the specification is its next step\./);
    manifestWith({ specification: { items: { auth: { status: 'completed', sources: { talks: { status: 'stale' }, roles: { status: 'pending' } } } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }),
      /unsettled \(a source is not yet extracted \(roles\), a source has moved beneath the extraction \(talks\)\)/);
    // An epic's way back is its menu's specification row, never a next step.
    manifestWith({ specification: { items: { auth: { status: 'completed', sources: { talks: { status: 'stale' } } } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }),
      /Return to the epic menu — the specification is the way in: its row, or c\/completed while it still reads completed\./);
    // Every row incorporated and no flag: the record has stopped moving.
    manifestWith({ specification: { items: { auth: { status: 'completed', sources: { talks: { status: 'incorporated' } } } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }), '');
  });

  it('implementation and review derive their plan/implementation blockers', () => {
    manifestWith({});
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.implementation.auth' }), /⚑ No plan found for "Auth"[\s\S]*A completed plan is required for implementation\./);
    manifestWith({ planning: { items: { auth: { status: 'in-progress' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.implementation.auth' }), /⚑ The plan for "Auth" is not yet completed/);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.implementation.auth' }), '');

    manifestWith({});
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), /⚑ No plan found for "Auth"[\s\S]*plan and completed implementation are required for review\./);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), /⚑ No implementation found for "Auth"/);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } }, implementation: { items: { auth: { status: 'in-progress' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), /⚑ The implementation for "Auth" is not yet completed/);
    manifestWith({ planning: { items: { auth: { status: 'completed' } } }, implementation: { items: { auth: { status: 'completed' } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.review.auth' }), '');
  });

  it('specification is work-type-aware: feature discussion, bugfix investigation, epic any-completed', () => {
    manifestWith({}, 'feature');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ No discussion found for "Pay"/);
    manifestWith({ discussion: { items: { auth: { status: 'in-progress' } } } }, 'feature');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ The discussion for "Auth" is not yet completed/);
    manifestWith({ discussion: { items: { auth: { status: 'completed' } } } }, 'feature');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');

    // A promoted cross-cutting unit's specification stands on its moved
    // discussions, each under its own name — never one named after the unit.
    manifestWith({ discussion: { items: { 'fee-rules': { status: 'completed' }, 'fee-display': { status: 'in-progress' } } } }, 'cross-cutting');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.pay' }), /⚑ The discussion for "Fee Display" is not yet completed/);
    manifestWith({ discussion: { items: { 'fee-rules': { status: 'completed' }, 'fee-display': { status: 'completed' } } } }, 'cross-cutting');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.pay' }), '');

    manifestWith({}, 'bugfix');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ No investigation found/);
    manifestWith({ investigation: { items: { auth: { status: 'in-progress' } } } }, 'bugfix');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ The investigation for "Pay" is not yet completed/);

    manifestWith({}, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ No discussions found/);
    manifestWith({ discussion: { items: { a: { status: 'in-progress' }, b: { status: 'in-progress' } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ No completed discussions found[\s\S]*continue an in-progress discussion/);
    manifestWith({ discussion: { items: { a: { status: 'completed' } } } }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');
  });

  it('epic specification with a topic: a source discussion that has not concluded blocks that spec', () => {
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'stale' }, b: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }),
      /⚑ Sources for "Auth" are not concluded: a[\s\S]*cannot be built from a record still open/);
    // A topic the gap exit opened and parked waits the same way — it has
    // never concluded, and the specification is its reader.
    manifestWith({
      discussion: { items: { a: { status: 'unstarted' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'pending' }, b: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }),
      /⚑ Sources for "Auth" are not concluded: a[\s\S]*conclude the discussion\(s\), then re-enter/);
    // The legacy array form decodes the same way.
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: [{ name: 'a', status: 'stale' }] } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ Sources for "Auth" are not concluded: a/);
    // Settled sources are clear; an open discussion outside the spec's sources does not block it.
    manifestWith({
      discussion: { items: { a: { status: 'completed' }, c: { status: 'in-progress' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');
    // Plural open sources list every holder, whichever way each is open.
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'unstarted' }, c: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'stale' }, b: { status: 'pending' }, c: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ Sources for "Auth" are not concluded: a, b/);
  });

  it('discussion: outstanding research holds the entry shut, every work type — landed, absent, or closed research clears it', () => {
    const feature = (research) => manifestWith({
      ...(research ? { research: { items: { pay: research } } } : {}),
      discussion: { items: { pay: { status: 'in-progress' } } },
    }, 'feature');
    feature({ status: 'in-progress' });
    const out = renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.pay' });
    assert.match(out, /DISPLAY: entry blocker/);
    assert.match(out, /⚑ Entry blocked — this discussion awaits research on "Pay" \(in flight\)/);
    assert.match(out, /DISPLAY: blocker guidance[\s\S]*> Continue the work unit — the research is its next step\./);
    feature({ status: 'unstarted' });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.pay' }), /awaits research on "Pay" \(parked — not yet started\)/);
    for (const research of [undefined, { status: 'completed' }, { status: 'cancelled', previous_status: 'in-progress' }, { status: 'superseded', superseded_by: 'other' }]) {
      feature(research);
      assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.pay' }), '', JSON.stringify(research));
    }
    // An epic's guidance names its menu; the discussion item need not exist yet, and a concluded one is held the same way.
    manifestWith({ research: { items: { auth: { status: 'unstarted' } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }),
      /awaits research on "Auth" \(parked — not yet started\)[\s\S]*> Return to the epic menu — its research row is the way in\./);
    manifestWith({ research: { items: { auth: { status: 'in-progress' } } }, discussion: { items: { auth: { status: 'completed', reconcile_needed: 'research' } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }), /awaits research on "Auth" \(in flight\)/);
    manifestWith({ research: { items: { other: { status: 'in-progress' } } }, discussion: { items: { auth: { status: 'in-progress' } } } }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }), '', 'another topic\'s research holds nothing');
  });

  it('an unsupported phase is a loud error', () => {
    manifestWith({});
    assert.throws(() => renderSurface(dir, 'entry-gate', { dotpath: 'pay.research.auth' }), /no prerequisite rules for phase "research"/);
  });
});

describe('render entry-gate --own', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  function specWith(item) {
    writeManifest(dir, 'pay', { work_type: 'epic', phases: { specification: { items: { auth: item } } } });
  }

  it('renders the superseded and promoted terminals byte-exactly', () => {
    specWith({ status: 'superseded', superseded_by: 'core-auth' });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth', own: '1' }), [
      '=== DISPLAY: entry blocker (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The specification for "Auth" was consolidated into "Core Auth"',
      '',
      '=== DISPLAY: blocker guidance (emit verbatim as markdown (not a code block), then STOP — terminal condition) ===',
      '> Work on that specification instead.',
      '',
    ].join('\n'));
    specWith({ status: 'promoted', promoted_to: 'auth-platform' });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth', own: '1' }),
      /⚑ "Auth" was promoted to the cross-cutting work unit "auth-platform"[\s\S]*> Continue it from that work unit\./);
  });

  it('is clear for live statuses and a missing item', () => {
    for (const item of [{ status: 'in-progress' }, { status: 'completed' }, { status: 'proposed' }]) {
      specWith(item);
      assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth', own: '1' }), '');
    }
    writeManifest(dir, 'pay', { work_type: 'epic', phases: {} });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth', own: '1' }), '');
  });

  it('is loud outside research, discussion and specification', () => {
    writeManifest(dir, 'pay', { work_type: 'feature', phases: {} });
    assert.throws(() => renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth', own: '1' }),
      /--own is only supported for research, discussion and specification, got "planning"/);
  });

  /** An epic whose auth topic holds a research and a discussion item, both at `status`. */
  function topicWith(status) {
    writeManifest(dir, 'pay', { work_type: 'epic', phases: {
      research: { items: { auth: { status } } },
      discussion: { items: { auth: { status } } },
    } });
  }

  /** The project's roadmap, holding auth's postponed item — `pulled_to` another epic when `taken`. */
  function writeRoadmap(taken) {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        auth: {
          horizon: 'next', summary: 's', origin: 'postpone:pay', postponed_from: { work_unit: 'pay', topic: 'auth' },
          ...(taken ? { pulled_to: { work_unit: 'other', topic: 'auth' } } : {}),
        },
      } },
    }, null, 2));
  }

  it('a cancelled research, discussion or specification item renders the cancelled terminal byte-exactly, naming the reactivate', () => {
    const phases = ['research', 'discussion', 'specification'];
    writeManifest(dir, 'pay', { work_type: 'epic', phases: Object.fromEntries(
      phases.map((phase) => [phase, { items: { auth: { status: 'cancelled' } } }])) });
    for (const phase of phases) {
      assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: `pay.${phase}.auth`, own: '1' }), [
        '=== DISPLAY: entry blocker (emit verbatim as a properties code block (```properties fence)) ===',
        '⚑ "Auth" is cancelled',
        '',
        '=== DISPLAY: blocker guidance (emit verbatim as markdown (not a code block), then STOP — terminal condition) ===',
        '> Reactivate it from the epic menu (`e/reactivate`).',
        '',
      ].join('\n'), phase);
    }
  });

  it('a postponed one names the pull forward while its roadmap item waits, and no way back once another epic took it', () => {
    topicWith('postponed');
    writeRoadmap(false);
    for (const phase of ['research', 'discussion']) {
      assert.match(renderSurface(dir, 'entry-gate', { dotpath: `pay.${phase}.auth`, own: '1' }),
        /⚑ "Auth" is postponed to the roadmap\n\n=== DISPLAY: blocker guidance [^\n]*===\n> Pull it forward from the epic menu \(`f\/forward`\)\.\n$/, phase);
    }
    writeRoadmap(true);
    for (const phase of ['research', 'discussion']) {
      const out = renderSurface(dir, 'entry-gate', { dotpath: `pay.${phase}.auth`, own: '1' });
      assert.match(out, /> Its roadmap item has gone to another epic — the topic stays postponed here, with no way back\.\n$/, phase);
      assert.ok(!out.includes('f/forward'), phase);
    }
  });

  it('a promoted discussion renders the promoted terminal byte-exactly, naming the unit it moved to', () => {
    writeManifest(dir, 'pay', { work_type: 'epic', phases: { discussion: { items: { auth: { status: 'promoted', promoted_to: 'auth-platform' } } } } });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth', own: '1' }), [
      '=== DISPLAY: entry blocker (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ "Auth" was promoted to the cross-cutting work unit "auth-platform"',
      '',
      '=== DISPLAY: blocker guidance (emit verbatim as markdown (not a code block), then STOP — terminal condition) ===',
      '> Continue it from that work unit.',
      '',
    ].join('\n'));
  });

  it('is clear for a research or discussion item that is live, unstarted, or absent', () => {
    for (const status of ['in-progress', 'completed', 'unstarted']) {
      topicWith(status);
      for (const phase of ['research', 'discussion']) {
        assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: `pay.${phase}.auth`, own: '1' }), '', `${phase} ${status}`);
      }
    }
    writeManifest(dir, 'pay', { work_type: 'epic', phases: {} });
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.research.auth', own: '1' }), '');
  });

  it('a promoted item missing its target degrades to an empty quoted name, never "undefined"', () => {
    specWith({ status: 'promoted' });
    const out = renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth', own: '1' });
    assert.ok(out.includes('cross-cutting work unit ""'));
    assert.ok(out.includes('> Continue it from that work unit.'));
    assert.ok(!out.includes('undefined'));
  });
});

describe('render phase-completed --paths', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hotfix', { work_type: 'quick-fix', phases: {} });
  });
  afterEach(() => teardown(dir));

  it('appends the derived spec and plan paths', () => {
    assert.strictEqual(renderSurface(dir, 'phase-completed', { dotpath: 'hotfix', phase: 'scoping', paths: '1' }), [
      '=== DISPLAY: phase completed (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Scoping completed for "Hotfix".',
      '',
      `  Spec: ${dir}/.leeway/hotfix/specification/hotfix/specification.md`,
      `  Plan: ${dir}/.leeway/hotfix/planning/hotfix/`,
      '',
    ].join('\n'));
  });
});

describe('selection not-found display', () => {
  const { selectionNotFound } = require('../../skills/workflow-engine/scripts/domain/projections/selection.cjs');
  it('renders the terminal byte-exactly, in the noun the menu continues', () => {
    assert.strictEqual(selectionNotFound('work unit', 'ghost'), [
      '=== DISPLAY: not found (emit verbatim as a text code block (```text fence), then STOP — terminal condition) ===',
      'No active work unit named "ghost" found.',
      '',
      'Run /workflow-start to see available work units or begin a new one.',
      '',
    ].join('\n'));
    assert.ok(selectionNotFound('epic', 'x').includes('No active epic named "x" found.\n\nRun /workflow-start to see available epics'));
  });
});

describe('render review-findings-gate', () => {
  let dir;
  const store = (phase, row) => writePayload(dir, `.leeway/.cache/pay/${phase}/checkout/state.json`, { agents: { 'review-001': {
    id: 'review-001', kind: 'review', phase, topic: 'checkout', set: 1, announced: false, created: '2026-09-11T10:00:00.000Z', ...row,
  } } });
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress' } } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('counts the acknowledged row\'s unsurfaced findings and names no pass — byte-exact', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1', 'F2', 'F3'], surfaced: ['F2'] });
    const out = renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' });
    assert.strictEqual(out, [
      "=== MENU: review findings gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'The review left 2 findings still to walk.',
      '',
      '**`◆ Walk them now?`**',
      '',
      '**`y/yes`**  → Work through them now',
      '**`s/skip`** → Acknowledge and conclude the topic',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /final review/i);
  });

  it('a lone finding takes the singular', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 1 finding still to walk\.\n\n\*\*`◆ Walk them now\?`\*\*/);
  });

  it('a research address is refused whatever its store holds — the gate is the discussion close\'s', () => {
    store('research', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.research.checkout' }),
      /render review-findings-gate: address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "research"/);
  });

  it('refuses every state the calling prose never renders it from', () => {
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /render review-findings-gate: no review has been dispatched on this topic/);
    store('discussion', { status: 'pending', findings: [], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /the latest review row "review-001" is pending — the gate follows an acknowledged report/);
    store('discussion', { status: 'incorporated', findings: ['F1'], surfaced: ['F1'] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /"review-001" is incorporated/);
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.planning.checkout' }),
      /address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "planning"/);
  });

  it('anchors on the latest review row, not an earlier drained one', () => {
    writePayload(dir, '.leeway/.cache/pay/discussion/checkout/state.json', { agents: {
      'review-001': { id: 'review-001', kind: 'review', phase: 'discussion', topic: 'checkout', set: 1, status: 'incorporated', announced: true, findings: ['F1'], surfaced: ['F1'], created: '2026-09-11T09:00:00.000Z' },
      'review-002': { id: 'review-002', kind: 'review', phase: 'discussion', topic: 'checkout', set: 2, status: 'acknowledged', announced: false, findings: ['F1', 'F2'], surfaced: [], created: '2026-09-11T10:00:00.000Z' },
    } });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 2 findings still to walk\./);
  });
});

describe('catalogue dispatch', () => {
  it('the CLI usage banner lists every registered surface', () => {
    // A surface reachable from the catalogue but absent from the banner is
    // invisible to anyone who mistypes a command — the way finding-batch was.
    let catalogue;
    try {
      renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' });
    } catch (err) {
      catalogue = String(err.message).match(/surfaces: ([^)]+)\)/)[1].split(', ');
    }
    const engineSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts', 'engine.cjs'), 'utf8');
    const banner = [...engineSrc.matchAll(/^ {2}render (\S+)/gm)].map((m) => m[1]);
    const missing = catalogue.filter((n) => !banner.includes(n));
    assert.deepStrictEqual(missing, [], `surfaces missing from the usage banner: ${missing.join(', ')}`);
  });

  it('unknown surface errors with the catalogue listing', () => {
    assert.throws(() => renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' }), /unknown surface "nope" \(surfaces: resume-gate, task-list, plan-progress, findings-summary, finding-announce, finding-batch, finding, review-presentation, review-gate, spec-review-gate, spec-completion-gate, convergence-diagnostic, carry-note-gate, hypothesis-board, findings-signoff-gate, fix-direction, validation-gate, validation-report, project-skills, linters, mail-announce, mail-offer, mail-block, forward-offer, send-offer, research-threads, research-conclude-gate, deep-dive-offer, perspective-offer, in-flight-agents-gate, review-findings-gate, send-candidates, off-topic-offer, backlog-gate, map-op-gate, candidate-gate, dismissed-topics, send-closed-target, conclude-gate, closing-gate, defer-gate, experiment-register, experiment-approval-gate, experiment-pick, experiment-next-gate, experiment-spawn-gate, wait-gate, summary-backfill-gate, external-dependency-gate, checkpoint-files-gate, change-set-tree, executor-block-gate, dependency-approval-gate, task-count-gate, plan-context-gate, cross-cutting-gate, cross-cutting-references, plan-format-gate, plan-review-gate, scoping-questions, complexity-gate, first-phase-gate, correction-gate, analysis-proceed-gate, spec-confirm-gate, proposed-task, incoherence-gate, resurface-gate, construction-gate, tasks-overview, author-task-gate, phase-tree, phase-completed, phase-paused, phase-note, step-opening, format-version-check, entry-gate, direct-entry-gate, code-gate, next-phase-gate, cancel-gate, postpone-gate, epic-all-done-gate, epic-soft-gate, task-brief, task-result, task-gate, fix-gate, blocked-tasks, cycle-limit, cycle-gate, workunit-receipt, topic-receipt, absorb-summary, absorb-receipt, absorb-continuation, promote-receipt, import-reprompt, pivot-continuation, session-receipt, absorb-target, absorb-confirm-gate, plan-topics, plan-summary, archived-actions, archived-delete-gate, inbox-content, inbox-restore-receipt, inbox-delete-receipt, completed-actions, revisit-phases, roadmap-view, roadmap-add-gate, horizon-pick, park-gate, inbox-roadmap-gate, roadmap-session-receipt, roadmap-harvest-gate, roadmap-parks-gate, roadmap-shape-gate, shape-gate, opener, synthesis-gate, query-failure-gate, baseline-progress, baseline-area-gate, baseline-paused, baseline-receipt, baseline-scope-gate, baseline-area, baseline-round, baseline-doc-gate, baseline-manage-gate, baseline-doc-pick, baseline-offer-gate, walkthrough-offer, walkthrough-screen, walkthrough-home, walkthrough-topics, walkthrough-topic, migrations-applied, migration-gate, label-gate, knowledge-gate, knowledge-ready, legacy-split-gate, legacy-split-display\)/);
  });
});

describe('single-source invariants', () => {
  it('the menu dot rule literal exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && fs.readFileSync(p, 'utf8').includes('· · · · · · · · · · · ·')) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'menus must frame through surfaces.menuFrame — inline dot rules reintroduce the pre-consolidation drift class');
  });

  it('the option-line grammar exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && /\*\*\\?`[^`]+\\?`\*\* →/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'option lines must build through cmdOption/rangeOption — hand-formatted options reintroduce the drift class');
  });

  it('the render forms, the menu\'s stop and the continuation exist in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const { RENDER_FORMS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
    const phrases = ['emit verbatim as', ...Object.values(RENDER_FORMS), "then STOP for the user's response", 'do not stop; continue as the workflow instructs'];
    /** @type {Record<string, string[]>} */
    const homes = Object.fromEntries(phrases.map((phrase) => [phrase, []]));
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs')) {
          const src = fs.readFileSync(p, 'utf8');
          for (const phrase of phrases) if (src.includes(phrase)) homes[phrase].push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    const surfaces = [path.join('domain', 'projections', 'surfaces.cjs')];
    assert.deepStrictEqual(homes, Object.fromEntries(phrases.map((phrase) => [phrase, surfaces])),
      'a marker instruction is composed from surfaces.cjs (emitAs, timedInstruction, MENU_INSTRUCTION, the clauses) — a second literal drifts on the next reword');
  });

  // No equivalent invariant for the ⚑ callout: the glyph legitimately appears
  // in inline one-line display headers (arrivals lines, not-ready blocks), so
  // a content grep cannot isolate the wrapped-callout idiom without false
  // positives. Single-sourcing there is enforced structurally — flaggedCallout
  // delegates to surfaces.callout — and guarded by review.

  it('every drawn walkthrough diagram fits the pinned width — an untagged fence cannot re-flow (D8)', () => {
    const contentRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        if (!entry.isFile() || !p.endsWith('.md')) continue;
        // A tagged fence is notation, not a drawing: the engine lays it out
        // at the pane's width, and its own suite drives it at the floor and
        // the cap. Only what emits as drawn is measured here.
        let fence = null;
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (line.startsWith('```')) { fence = fence === null ? line.slice(3).trim() : null; return; }
          // Characters, not bytes: the diagrams are drawn with arrows and
          // box-drawing glyphs, each of which is several bytes wide.
          if (fence === '' && [...line].length > 65) offenders.push(`${path.relative(contentRoot, p)}:${i + 1}`);
        });
      }
    })(contentRoot);
    assert.deepStrictEqual(offenders, [],
      'a fenced line renders as drawn — past the narrowest pane it wraps and the diagram breaks');
  });

  it('box-glyph frames are retired everywhere — drawn borders never frame content', () => {
    const skillsRoot = path.join(__dirname, '..', '..', 'skills');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && (p.endsWith('.cjs') || p.endsWith('.md')) && /[╭╰]/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(skillsRoot, p));
        }
      }
    })(skillsRoot);
    assert.deepStrictEqual(offenders, [],
      'drawn borders never frame content — a box glyph reintroduces a fixed-width commitment the terminal cannot honour');
  });
});

describe('roadmap surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {object} roadmap @param {Record<string, object>} [workUnits] */
  function writeRoadmap(roadmap, workUnits = {}) {
    const wf = path.join(dir, '.leeway');
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, 'manifest.json'), JSON.stringify({ work_units: {}, roadmap }, null, 2));
    for (const [name, manifest] of Object.entries(workUnits)) {
      fs.mkdirSync(path.join(wf, name), { recursive: true });
      fs.writeFileSync(path.join(wf, name, 'manifest.json'), JSON.stringify({ name, phases: {}, ...manifest }, null, 2));
    }
  }

  const TWO_HORIZONS = {
    horizons: ['mvp', 'v1'],
    items: {
      ordering: { horizon: 'mvp', summary: 'customers order from a menu', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
      menus: { horizon: 'mvp', summary: 'operators maintain the menu', kind: 'idea', origin: 'harvest' },
      loyalty: { horizon: 'v1', summary: 'repeat-customer rewards', kind: 'idea', origin: 'park:mvp' },
    },
  };

  it('roadmap-view: horizon groups, join notes, the breakdown header', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-view', {});
    assert.match(out, /^=== DISPLAY: roadmap \(emit verbatim as a text code block \(```text fence\)\) ===/);
    assert.match(out, /Roadmap \(3 items — 1 in flight · 2 waiting\)/);
    assert.match(out, /mvp\n/);
    assert.match(out, /◐ Ordering/);
    assert.match(out, /↳ In flight: mvp/);
    assert.match(out, /○ Menus/);
    assert.match(out, /operators maintain the menu/);
    assert.match(out, /v1\n/);
    assert.match(out, /○ Loyalty/);
  });

  it('roadmap-view: refuses a never-born roadmap', () => {
    assert.throws(() => renderSurface(dir, 'roadmap-view', {}), /no roadmap on the project manifest/);
  });

  it('roadmap-view: shipped and orphaned rows carry their glyphs and join notes; strays group last', () => {
    writeRoadmap({
      horizons: ['mvp'],
      items: {
        ordering: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'done-unit' } },
        ghosted: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'never-created' } },
        stray: { horizon: 'unlisted', summary: 'hand-edited home', origin: 'harvest' },
      },
    }, { 'done-unit': { work_type: 'epic', status: 'completed' } });
    const out = renderSurface(dir, 'roadmap-view', {});
    assert.match(out, /✓ Ordering/);
    assert.match(out, /↳ Shipped: done-unit/);
    assert.match(out, /⚑ Ghosted/);
    // Wrap-tolerant: the full note breaks across lines at the pinned width.
    assert.match(out, /↳ Orphaned — work unit/);
    assert.match(out, /"never-created"/);
    assert.match(out, /\(no horizon\)\n/);
    assert.match(out, /○ Stray/);
  });

  it('roadmap-add-gate: two delivering units render the name-which label and both units in DATA', () => {
    writeRoadmap({
      horizons: ['mvp'],
      items: {
        ordering: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'mvp-core' } },
        kds: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'mvp-2' } },
        menus: { horizon: 'mvp', summary: 's', origin: 'harvest' },
        extra: { horizon: 'mvp', summary: 's', origin: 'harvest' },
      },
    }, {
      'mvp-core': { work_type: 'epic', status: 'in-progress' },
      'mvp-2': { work_type: 'epic', status: 'in-progress' },
    });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' });
    assert.match(out, /^=== DATA [^\n]*===\nwork_units: mvp-core, mvp-2\n/, 'the units the delivery row pulls into ride DATA, never the label');
    assert.ok(out.includes(`Into the work underway — a new topic in one of its\n${NB(13)}work units (name which)`), 'the multi-unit label, wrapped');
    assert.ok(out.includes(`On the roadmap in "mvp", waiting with its 2 other\n${NB(13)}items`), 'the plural form');
  });

  it('roadmap-add-gate: fully-in-delivery renders the strict two-way menu naming the unit', () => {
    writeRoadmap({
      horizons: ['mvp', 'v1'],
      items: {
        ordering: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
        loyalty: { horizon: 'v1', summary: 's', origin: 'harvest' },
      },
    }, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' });
    assert.match(out, /^=== DATA [^\n]*===\nwork_units: mvp\n\n=== MENU: roadmap add gate/);
    assert.match(out, /"mvp" is being built right now\.\n\n\*\*`◆ Where does this go\?`\*\*/);
    assert.match(out, /\*\*`d\/delivery`\*\* → Into the work underway — a new topic in "mvp"/);
    assert.match(out, /\*\*`h\/horizon`\*\* +→ Another horizon/);
    assert.ok(!out.includes('w/waiting') && !out.includes('On the roadmap in'), 'no waiting side-door into a fully-delivered horizon');
  });

  it('roadmap-add-gate: a partly-composed horizon keeps the waiting option — every row keyed by its word', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' });
    assert.strictEqual(out, [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'work_units: mvp',
      '',
      "=== MENU: roadmap add gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '"mvp" is partly being built.',
      '',
      '**`◆ Where does this go?`**',
      '',
      '**`d/delivery`** → Into the work underway — a new topic in "mvp"',
      '**`w/waiting`**  → On the roadmap in "mvp", waiting with its 1 other',
      `${NB(13)}item`,
      '**`h/horizon`**  → Another horizon (name it)',
      '**Ask**        → Talk it through first',
      '',
    ].join('\n'));
  });

  it('roadmap-add-gate: a long horizon name stays in the statement — the question keeps its glyph', () => {
    writeRoadmap({
      horizons: ['the long-awaited mobile launch'],
      items: {
        ordering: { horizon: 'the long-awaited mobile launch', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
      },
    }, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'the long-awaited mobile launch' });
    assert.match(out, /"the long-awaited mobile launch" is being built right now\.\n\n\*\*`◆ Where does this go\?`\*\*/);
  });

  it('roadmap-add-gate: empty where the add passes — a horizon with no delivery, a horizon not yet born, a roadmap not yet born', () => {
    assert.strictEqual(renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' }), '', 'no roadmap yet');
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    assert.strictEqual(renderSurface(dir, 'roadmap-add-gate', { horizon: 'v1' }), '', 'nothing of v1 is in an epic');
    assert.strictEqual(renderSurface(dir, 'roadmap-add-gate', { horizon: 'later' }), '', 'a horizon the add would create');
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', {}), /--horizon is required/);
  });

  it('roadmap-add-gate: empty over a horizon whose epic has shipped — finished work takes no topic', () => {
    writeRoadmap({
      horizons: ['mvp'],
      items: {
        ordering: { horizon: 'mvp', summary: 's', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'mvp', topic: 'ordering' } },
        menus: { horizon: 'mvp', summary: 's', kind: 'idea', origin: 'harvest' },
      },
    }, { mvp: { work_type: 'epic', status: 'completed' } });
    assert.strictEqual(renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' }), '');
  });

  it('roadmap-add-gate: a horizon pulled into a bugfix, a quick-fix and a feature has no delivery — no unit of theirs takes a topic', () => {
    writeRoadmap({
      horizons: ['next'],
      items: {
        crash: { horizon: 'next', summary: 's', kind: 'bug', origin: 'harvest', pulled_to: { work_unit: 'crash' } },
        typo: { horizon: 'next', summary: 's', kind: 'quick-fix', origin: 'harvest', pulled_to: { work_unit: 'typo' } },
        views: { horizon: 'next', summary: 's', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'views' } },
      },
    }, {
      crash: { work_type: 'bugfix', status: 'in-progress' },
      typo: { work_type: 'quick-fix', status: 'in-progress' },
      views: { work_type: 'feature', status: 'in-progress' },
    });
    assert.strictEqual(renderSurface(dir, 'roadmap-add-gate', { horizon: 'next' }), '');
  });

  it('roadmap-add-gate: beside an epic, a member pulled into a bugfix is no delivery and keeps the horizon from reading wholly built', () => {
    writeRoadmap({
      horizons: ['next'],
      items: {
        ordering: { horizon: 'next', summary: 's', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
        crash: { horizon: 'next', summary: 's', kind: 'bug', origin: 'harvest', pulled_to: { work_unit: 'crash' } },
      },
    }, {
      mvp: { work_type: 'epic', status: 'in-progress' },
      crash: { work_type: 'bugfix', status: 'in-progress' },
    });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'next' });
    assert.match(out, /^=== DATA [^\n]*===\nwork_units: mvp\n/, 'the bugfix is never a delivery unit');
    assert.match(out, /"next" is partly being built\./);
    assert.match(out, /\*\*`w\/waiting`\*\* +→ On the roadmap in "next", waiting\n/, 'the waiting row, nothing else waiting beside it');
  });

  it('horizon-pick: the horizons in map order, each with what waits in it, then the new row', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'horizon-pick', {});
    assert.strictEqual(out, [
      "=== MENU: horizon pick (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which horizon?`**',
      '',
      '**`1`**     → mvp — *1 waiting*',
      '**`2`**     → v1 — *1 waiting*',
      '**`n/new`** → A new horizon — name it',
      '',
    ].join('\n'), 'the pulled item counts against no horizon — only what waits is offered');
  });

  it('horizon-pick: refuses a never-born roadmap and one with no horizons', () => {
    assert.throws(() => renderSurface(dir, 'horizon-pick', {}),
      /render horizon-pick: no roadmap on the project manifest — the caller names its first horizon in prose/);
    writeRoadmap({ horizons: [], items: {} });
    assert.throws(() => renderSurface(dir, 'horizon-pick', {}),
      /render horizon-pick: the roadmap holds no horizons — the caller names one in prose/);
  });

  it('park-gate: an existing horizon, no source', () => {
    writeRoadmap(TWO_HORIZONS);
    const out = renderSurface(dir, 'park-gate', {
      name: 'csv-export', horizon: 'v1', summary: "operators export a day's orders as CSV",
    });
    assert.strictEqual(out, [
      "=== MENU: park gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Parking **Csv Export** — operators export a day\'s orders as CSV — puts it on the roadmap under "v1", waiting until it is pulled into work.',
      '',
      '**`◆ Park it on the roadmap?`**',
      '',
      '**`y/yes`**   → Park it',
      '**`n/no`**    → Leave it — nothing is recorded',
      '**Comment** → Tell me what to change (name, kind, horizon, or',
      `${NB(10)}summary)`,
      '',
    ].join('\n'));
  });

  it('park-gate: a horizon the map does not hold is flagged new, and the source rides the statement', () => {
    writeRoadmap(TWO_HORIZONS);
    const out = unwrap(renderSurface(dir, 'park-gate', {
      name: 'csv-export', horizon: 'v2', summary: 'operators export orders as CSV',
      source: '.leeway/mvp/specification/orders/specification.md',
    }));
    assert.match(out, /under "v2" \(new\), waiting until it is pulled into work\. Its source is `\.leeway\/mvp\/specification\/orders\/specification\.md`\./);
    assert.ok(!out.includes('The roadmap is created with it.'), 'the map exists — only its horizon is new');
  });

  it('park-gate: with no roadmap at all the statement says the map is created with it', () => {
    const out = unwrap(renderSurface(dir, 'park-gate', {
      name: 'csv-export', horizon: 'v1', summary: 'operators export orders as CSV',
    }));
    assert.match(out, /puts it on the roadmap under "v1", waiting until it is pulled into work\. The roadmap is created with it\./);
    assert.ok(!out.includes('(new)'), 'the map\'s own birth already says the horizon is new');
    assert.ok(!out.includes('Its source is'), 'no --source, no source line');
  });

  it('park-gate: a name the map already holds refuses in the add verb\'s own words', () => {
    writeRoadmap(TWO_HORIZONS);
    assert.throws(() => renderSurface(dir, 'park-gate', { name: 'loyalty', horizon: 'v1', summary: 's' }),
      /render park-gate: "loyalty" is already on the roadmap — edit it, or pick a different name/);
  });

  it('park-gate: a bug or a quick-fix is named by its kind; an idea, the default, is not', () => {
    writeRoadmap(TWO_HORIZONS);
    const bug = unwrap(renderSurface(dir, 'park-gate', { name: 'login-crash', horizon: 'v1', summary: 'sign-in crashes', kind: 'bug' }));
    assert.match(bug, /^Parking the bug \*\*Login Crash\*\* — sign-in crashes — puts it on the roadmap under "v1"/m);
    const fix = unwrap(renderSurface(dir, 'park-gate', { name: 'typo', horizon: 'v1', summary: 'the footer typo', kind: 'quick-fix' }));
    assert.match(fix, /^Parking the quick-fix \*\*Typo\*\* — /m);
    const idea = unwrap(renderSurface(dir, 'park-gate', { name: 'csv', horizon: 'v1', summary: 's', kind: 'idea' }));
    assert.match(idea, /^Parking \*\*Csv\*\* — /m);
    assert.throws(() => renderSurface(dir, 'park-gate', { name: 'csv', horizon: 'v1', summary: 's', kind: 'feature' }),
      /render park-gate: unknown kind "feature" — one of: idea, bug, quick-fix/);
  });

  // The gate takes the file `roadmap add-batch` takes; its notes are live inbox files.
  const IDEA = '.leeway/.inbox/ideas/2026-03-01--dark-mode.md';
  const BUG = '.leeway/.inbox/bugs/2026-03-02--login-crash.md';
  const FIX = '.leeway/.inbox/quickfixes/2026-03-03--footer-typo.md';
  function inbox() {
    for (const rel of [IDEA, BUG, FIX]) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), '# note\n');
    }
  }
  const gate = (entries) => renderSurface(dir, 'inbox-roadmap-gate', { file: writePayload(dir, 'entries.json', entries) });

  it('inbox-roadmap-gate: every item — the kind its note\'s folder gives it, where not an idea — and the horizon, y/n and Comment', () => {
    writeRoadmap(TWO_HORIZONS);
    inbox();
    assert.strictEqual(gate([
      { name: 'login-crash', horizon: 'v1', summary: 'sign-in crashes', note: BUG },
      { name: 'dark-mode', horizon: 'v1', summary: 'a dark theme', note: IDEA },
      { name: 'footer-typo', horizon: 'v1', summary: 'the footer typo', note: FIX },
    ]), [
      "=== MENU: inbox roadmap gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Putting these on the roadmap under "v1", waiting until each is pulled into work — their notes leave the inbox with them:',
      '',
      '- **Login Crash** [bug] — sign-in crashes',
      '- **Dark Mode** — a dark theme',
      '- **Footer Typo** [quick-fix] — the footer typo',
      '',
      '**`◆ Put them on the roadmap?`**',
      '',
      '**`y/yes`**   → Put them on the roadmap',
      '**`n/no`**    → Leave them in the inbox — nothing moves',
      '**Comment** → Tell me what to change (name, horizon, or summary)',
      '',
    ].join('\n'));
    assert.ok(fs.existsSync(path.join(dir, BUG)), 'a dry run — nothing moves');
  });

  it('inbox-roadmap-gate: one item reads in the singular; a new horizon is flagged, a never-born map says its birth instead', () => {
    inbox();
    const one = (horizon) => [{ name: 'dark-mode', horizon, summary: 'a dark theme', note: IDEA }];
    const born = unwrap(gate(one('later')));
    assert.match(born, /^Putting this on the roadmap under "later", waiting until it is pulled into work — its note leaves the inbox with it:$/m);
    assert.match(born, /^The roadmap is created with it\.$/m);
    assert.ok(!born.includes('(new)'));
    assert.match(born, /`◆ Put it on the roadmap\?`/);
    assert.match(born, /`n\/no`.*Leave it in the inbox — nothing moves/);

    writeRoadmap(TWO_HORIZONS);
    const flagged = unwrap(gate(one('later')));
    assert.match(flagged, /under "later" \(new\), waiting/);
    assert.ok(!flagged.includes('The roadmap is created'));
    assert.ok(!unwrap(gate(one('v1'))).includes('(new)'));
  });

  it('inbox-roadmap-gate: refuses exactly where add-batch would — the verb\'s own words — and nothing moves', () => {
    writeRoadmap(TWO_HORIZONS);
    inbox();
    const item = { name: 'dark-mode', horizon: 'v1', summary: 's', note: IDEA };
    const refused = (entries, pattern) => assert.throws(() => gate(entries), pattern);
    refused([item, { name: 'loyalty', horizon: 'v1', summary: 's', note: BUG }],
      /^Error: render inbox-roadmap-gate: "loyalty" is already on the roadmap — edit it, or pick a different name$/);
    refused([item, { ...item, note: BUG }], /render inbox-roadmap-gate: "dark-mode" appears more than once in the batch/);
    refused([item, { ...item, name: 'twin' }], /render inbox-roadmap-gate: duplicate inbox path/);
    refused([{ ...item, horizon: 'v1.5' }], /render inbox-roadmap-gate: entry 1 — .*not a legal horizon name/);
    refused([{ ...item, horizon: 'q3/q4' }], /render inbox-roadmap-gate: entry 1 — .*not a legal horizon name/);
    refused([{ ...item, name: 'dark.mode' }], /render inbox-roadmap-gate: entry 1 — .*not a legal item name/);
    refused([{ ...item, note: '.leeway/.inbox/ideas/2026-09-09--gone.md' }], /render inbox-roadmap-gate: inbox file not found/);
    refused([{ ...item, kind: 'bug' }], /render inbox-roadmap-gate: entry 1 — "kind" is bug, but the note .* is a idea/);
    fs.writeFileSync(path.join(dir, '.leeway/.inbox/ideas/2026-03-04--dark mode.md'), '# x\n');
    refused([{ ...item, note: '.leeway/.inbox/ideas/2026-03-04--dark mode.md' }], /render inbox-roadmap-gate: entry 1 — the note "\.leeway\/\.inbox\/ideas\/2026-03-04--dark mode\.md" has a space in its file name — a note's name can't carry spaces; rename the file$/);
    fs.mkdirSync(path.join(dir, '.leeway/.roadmap/notes/ideas'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/.roadmap/notes/ideas/2026-03-01--dark-mode.md'), 'taken\n');
    refused([item], /render inbox-roadmap-gate: destination already exists/);
    refused([{ name: 'login-crash', horizon: 'v1', summary: 's', note: BUG }, { name: 'typo', horizon: 'v2', summary: 's', note: FIX }],
      /render inbox-roadmap-gate: every entry goes under the one horizon/);
    refused([{ name: 'loose', horizon: 'v1', summary: 's' }], /render inbox-roadmap-gate: every entry names its inbox note/);
    refused([], /render inbox-roadmap-gate: entries must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'inbox-roadmap-gate', {}), /--file <entries.json> is required/);
    assert.ok(fs.existsSync(path.join(dir, BUG)) && fs.existsSync(path.join(dir, IDEA)), 'nothing moved');
  });

  it('park-gate: every required flag is refused by name', () => {
    writeRoadmap(TWO_HORIZONS);
    assert.throws(() => renderSurface(dir, 'park-gate', { horizon: 'v1', summary: 's' }),
      /render park-gate: --name is required/);
    assert.throws(() => renderSurface(dir, 'park-gate', { name: 'csv-export', summary: 's' }),
      /render park-gate: --horizon is required/);
    assert.throws(() => renderSurface(dir, 'park-gate', { name: 'csv-export', horizon: 'v1' }),
      /render park-gate: --summary is required/);
    assert.throws(() => renderSurface(dir, 'park-gate', { name: '  ', horizon: 'v1', summary: 's' }),
      /render park-gate: --name is required/);
  });

  it('roadmap-session-receipt: empty without --warn, the advisory with it', () => {
    assert.strictEqual(renderSurface(dir, 'roadmap-session-receipt', {}), '');
    const out = renderSurface(dir, 'roadmap-session-receipt', { warn: '1' });
    assert.match(out, /Knowledge indexing warning/);
  });
});

describe('baseline surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  function writeBaseline(baseline) {
    const wf = path.join(dir, '.leeway');
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, 'manifest.json'), JSON.stringify({ work_units: {}, baseline }, null, 2));
  }

  it('baseline-progress: in-progress shows statuses and the remaining count', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'pending' } });
    const out = renderSurface(dir, 'baseline-progress', {});
    assert.strictEqual(out, [
      '=== DISPLAY: baseline progress (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Baseline in progress:',
      '',
      '  overview    [completed]',
      '  glossary    [researched]',
      '  dispatcher  [pending]',
      '',
      '2 area(s) remain.',
      '',
    ].join('\n'));
  });

  it('baseline-progress: completed lists the landed docs', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', glossary: 'completed' } });
    const out = renderSurface(dir, 'baseline-progress', {});
    assert.match(out, /Baseline — 2 area\(s\) documented:/);
    assert.match(out, /  • overview\.md\n  • glossary\.md/);
  });

  it('baseline-progress: refuses a missing baseline and an empty area map', () => {
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /the baseline is "none" — no assessment has been started/);
    writeBaseline({ status: 'in-progress', areas: {} });
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /no areas/);
  });

  it('baseline-area-gate: statement, glyphed question, and both options', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    const out = renderSurface(dir, 'baseline-area-gate', { area: 'overview' });
    assert.match(out, /^=== MENU: baseline area gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /\*\*Overview\*\* is documented\. 1 area\(s\) remain\./);
    assert.match(out, /\*\*`◆ Keep going\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Interview the next area/);
    assert.match(out, /\*\*`p\/pause`\*\*\s+→ Stop here — resume any time from workflow-start/);
  });

  it('baseline-area-gate: refuses a missing --area, an unknown area, an unlanded area, and a drained map', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', {}), /--area is required/);
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'ghost' }), /unknown area/);
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'glossary' }), /not completed/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'overview' }), /no areas remain/);
  });

  it('baseline-paused: counts the documented areas and points back at workflow-start', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'researched' } });
    const out = renderSurface(dir, 'baseline-paused', {});
    assert.match(out, /Paused — 1 of 3 area\(s\) documented\./);
    assert.match(out, /Resume from the workflow-start menu\./);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-paused', {}), /not in-progress/);
  });

  it('baseline-receipt: lists the docs and requires the completion write first', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', glossary: 'completed' } });
    const out = renderSurface(dir, 'baseline-receipt', {});
    assert.match(out, /Baseline complete — 2 area\(s\) documented and indexed\./);
    assert.match(out, /  • overview\.md\n  • glossary\.md/);
    assert.match(out, /\[baseline \| …\] context/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-receipt', {}), /not completed/);
  });

  it('baseline-receipt: refuses to name a doc that was never landed', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', dispatcher: 'pending' } });
    assert.throws(() => renderSurface(dir, 'baseline-receipt', {}), /"dispatcher" is "pending", not completed/);
  });

  it('baseline-scope-gate: renders the proposed list as markdown above the gate, stateless', () => {
    const file = writePayload(dir, 'payload.json', {
      mode: 'fresh',
      areas: [{ name: 'overview', detail: 'What the product is' }, { name: 'dispatcher', detail: 'The downstream push pipeline' }],
    });
    const out = renderSurface(dir, 'baseline-scope-gate', { file });
    assert.match(out, /=== DISPLAY: baseline scope \(emit verbatim as markdown \(not a code block\)\) ===/);
    assert.match(out, /\*\*overview\*\* — What the product is\n\*\*dispatcher\*\* — The downstream push pipeline/);
    assert.match(out, /\*\*`◆ Assess these areas\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Lock the list and start the research/);
    assert.match(out, /\*\*`b\/back`\*\*\s+→ Leave without changing anything/);
    assert.match(out, /\*\*Adjust\*\*\s+→ Tell me what to add, drop, rename, or merge/);
  });

  it('baseline-scope-gate: refuses illegal names, bad modes, and empty payloads', () => {
    const bad = (payload) => writePayload(dir, 'payload.json', payload);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', {}), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'weird', areas: [{ name: 'a', detail: 'x' }] }) }), /"mode" must be/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [] }) }), /non-empty array/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [{ name: 'api.v2', detail: 'x' }] }) }), /kebab-case/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [{ name: 'ok-area', detail: ' ' }] }) }), /missing "detail"/);
  });

  it('baseline-area: the area\'s step marker counted across every area, the documented ones first, then the session\'s line and the answer guidance', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', boundaries: 'completed', 'job-dispatcher': 'researched', glossary: 'researched' } });
    const file = writePayload(dir, '.leeway/.cache/baseline/area.json', { area: 'job-dispatcher', summary: 'How work reaches the workers, and why it polls.' });
    assert.strictEqual(renderSurface(dir, 'baseline-area', { file }), [
      '=== DISPLAY: baseline area (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**`□ Interviewing Job Dispatcher (3 of 4)`**',
      '',
      '> How work reaches the workers, and why it polls. Answer in your own words, pick a candidate, or say "don\'t know" — an unanswered question is recorded as open, never guessed at.',
      '',
    ].join('\n'));
  });

  it('baseline-area: refuses no payload, an unknown or unresearched area, and a summary missing or past one line', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', dispatcher: 'researched' } });
    const area = (obj) => writePayload(dir, '.leeway/.cache/baseline/area.json', obj);
    assert.throws(() => renderSurface(dir, 'baseline-area', {}), /render baseline-area: --file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'baseline-area', { file: area({ area: 'ghost', summary: 'x' }) }), /unknown area "ghost"/);
    assert.throws(() => renderSurface(dir, 'baseline-area', { file: area({ area: 'overview', summary: 'x' }) }),
      /area "overview" is "completed", not researched — the interview opens on a researched area/);
    for (const summary of [undefined, ' ', 'one\ntwo']) {
      assert.throws(() => renderSurface(dir, 'baseline-area', { file: area({ area: 'dispatcher', summary }) }),
        /"summary" must be one non-empty line — what the area covers and what the questions are after/);
    }
  });

  it('baseline-round: numbers questions, letters candidates, closes on the any-mix line', () => {
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'researched' } });
    const file = writePayload(dir, 'payload.json', {
      area: 'dispatcher',
      questions: [
        { text: 'The dispatcher polls behind four guards — what is the story?', candidates: ['Incident accretion', 'Partner rate agreement'] },
        { text: 'Why does Closed exist as a state?' },
      ],
    });
    const out = renderSurface(dir, 'baseline-round', { file });
    assert.match(out, /=== DISPLAY: baseline round \(emit verbatim as a text code block \(```text fence\), then STOP for the user's response\) ===/);
    assert.match(out, /1\. The dispatcher polls behind four guards/);
    assert.match(out, /   a\. Incident accretion\n   b\. Partner rate agreement/);
    assert.match(out, /2\. Why does Closed exist as a state\?/);
    assert.match(out, /Answer in your own words, pick letters, or say "don't know" —/);
  });

  it('baseline-round: refuses an unresearched area and malformed questions', () => {
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'completed' } });
    const file = writePayload(dir, 'payload.json', { area: 'dispatcher', questions: [{ text: 'x' }] });
    assert.throws(() => renderSurface(dir, 'baseline-round', { file }), /not researched/);
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'researched' } });
    const many = writePayload(dir, 'payload.json', { area: 'dispatcher', questions: [1, 2, 3, 4, 5].map((n) => ({ text: `q${n}` })) });
    assert.throws(() => renderSurface(dir, 'baseline-round', { file: many }), /1-4/);
  });

  it('baseline-offer-gate: renders only while nothing is recorded', () => {
    const out = renderSurface(dir, 'baseline-offer-gate', {});
    assert.match(out, /\*\*`◆ Run a baseline assessment\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\* → Start the assessment now/);
    assert.match(unwrap(out), /\*\*`n\/no`\*\*\s+→ Skip — you can start it later from the workflow-start menus/);
    writeBaseline({ status: 'skipped' });
    assert.throws(() => renderSurface(dir, 'baseline-offer-gate', {}), /the offer fires once/);
    // A native verdict is recorded state too — the offer never fires over it,
    // and the mid-flight surfaces read it as never started.
    writeBaseline({ status: 'native' });
    assert.throws(() => renderSurface(dir, 'baseline-offer-gate', {}), /the offer fires once/);
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /the baseline is "native" — no assessment has been started/);
  });

  it('migrations-applied: the session\'s summary above the run\'s counts, the counts left out where no file was updated', () => {
    const counted = writePayload(dir, '.leeway/.cache/migrations-applied.json', {
      summary: 'Recovered a message the converter missed.', migrations: 2, files: 3,
    });
    assert.strictEqual(renderSurface(dir, 'migrations-applied', { file: counted }), [
      '=== DISPLAY: migrations applied (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Migrations Applied**',
      '',
      'Recovered a message the converter missed.',
      '',
      '2 migration(s), 3 file(s) updated.',
      '',
    ].join('\n'));
    const fixesOnly = writePayload(dir, '.leeway/.cache/migrations-applied.json', { summary: 'Recovered a message.' });
    assert.ok(renderSurface(dir, 'migrations-applied', { file: fixesOnly }).endsWith('**Migrations Applied**\n\nRecovered a message.\n'));
  });

  it('migrations-applied: each notice the run handed back stands beneath the summary, above the counts', () => {
    const told = writePayload(dir, '.leeway/.cache/migrations-applied.json', {
      summary: 'Removed a setting the workflows no longer use.',
      notices: ['Removed `showClearContextOnPlanAccept` — add it back if you want it. ', 'A second thing to know.'],
      migrations: 1,
      files: 1,
    });
    assert.ok(renderSurface(dir, 'migrations-applied', { file: told }).endsWith([
      '**Migrations Applied**',
      '',
      'Removed a setting the workflows no longer use.',
      '',
      'Removed `showClearContextOnPlanAccept` — add it back if you want it.',
      '',
      'A second thing to know.',
      '',
      '1 migration(s), 1 file(s) updated.',
      '',
    ].join('\n')));
  });

  it('migrations-applied: refuses a payload it cannot render truthfully', () => {
    assert.throws(() => renderSurface(dir, 'migrations-applied', {}), /--file <payload\.json> is required/);
    const blank = writePayload(dir, '.leeway/.cache/migrations-applied.json', { summary: ' ' });
    assert.throws(() => renderSurface(dir, 'migrations-applied', { file: blank }), /"summary" must be a non-empty string/);
    const half = writePayload(dir, '.leeway/.cache/migrations-applied.json', { summary: 'x', migrations: 1 });
    assert.throws(() => renderSurface(dir, 'migrations-applied', { file: half }), /come together/);
    const zero = writePayload(dir, '.leeway/.cache/migrations-applied.json', { summary: 'x', migrations: 1, files: 0 });
    assert.throws(() => renderSurface(dir, 'migrations-applied', { file: zero }), /"files" must be a positive integer/);
    for (const notices of ['one notice', [''], [3]]) {
      const bad = writePayload(dir, '.leeway/.cache/migrations-applied.json', { summary: 'x', notices });
      assert.throws(() => renderSurface(dir, 'migrations-applied', { file: bad }), /"notices" must be a list of non-empty strings/);
    }
  });

  it('the boot gates are static menus: the migration confirm and the tmux label opt-in', () => {
    const migration = renderSurface(dir, 'migration-gate', {});
    assert.match(migration, /=== MENU: migration gate/);
    assert.match(migration, /\*\*`◆ Ready to continue\?`\*\*/);
    assert.match(migration, /\*\*`y\/yes`\*\*\s+→ Proceed/);
    assert.match(unwrap(migration), /\*\*Ask\*\*\s+→ Ask questions about the changes/);
    const label = renderSurface(dir, 'label-gate', {});
    assert.match(label, /=== MENU: label gate/);
    assert.match(label, /\*\*`◆ Label your tmux session as you work\?`\*\*/);
    assert.match(label, /\*\*`y\/yes`\*\* → Turn session labels on/);
    assert.match(unwrap(label), /\*\*`n\/no`\*\*\s+→ Leave session names alone/);
  });

  it('the knowledge gate: four menus keyed by what each asks; the reuse row names the configuration it adopts', () => {
    assert.strictEqual(renderSurface(dir, 'knowledge-gate', { variant: 'reuse', provider: 'openai', model: 'text-embedding-3-small' }), [
      "=== MENU: knowledge reuse gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Use the existing configuration for this project?`**',
      '',
      '**`y/yes`**       → Use the existing configuration (openai ·',
      `${NB(14)}text-embedding-3-small)`,
      '**`d/different`** → Choose a different mode for this project',
      '**`t/terminal`**  → Run the interactive wizard in your terminal instead',
      '',
    ].join('\n'));
    assert.strictEqual(renderSurface(dir, 'knowledge-gate', { variant: 'reuse' }), [
      "=== MENU: knowledge reuse gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Use the existing configuration for this project?`**',
      '',
      '**`y/yes`**       → Use the existing configuration (keyword-only)',
      '**`d/different`** → Choose a different mode for this project',
      '**`t/terminal`**  → Run the interactive wizard in your terminal instead',
      '',
    ].join('\n'));

    const deviate = renderSurface(dir, 'knowledge-gate', { variant: 'deviate' });
    assert.match(deviate, /=== MENU: knowledge deviate gate/);
    assert.match(deviate, /\*\*`◆ How should this project deviate\?`\*\*/);
    assert.match(unwrap(deviate), /\*\*`k\/keyword`\*\*\s+→ Keyword-only for this project \(the system configuration stays untouched for every other project\)/);
    assert.match(unwrap(deviate), /\*\*`t\/terminal`\*\* → Run the interactive wizard to change the system-wide configuration/);

    const mode = renderSurface(dir, 'knowledge-gate', { variant: 'mode' });
    assert.match(mode, /=== MENU: knowledge mode gate/);
    assert.match(mode, /\*\*`◆ How should this project's knowledge base work\?`\*\*/);
    assert.match(unwrap(mode), /\*\*`o\/openai`\*\*\s+→ OpenAI embeddings — full semantic search \(recommended; needs an API key\)/);
    assert.match(unwrap(mode), /\*\*`c\/compatible`\*\* → A local or self-hosted OpenAI-compatible endpoint \(LM Studio, Ollama, vLLM\)/);
    assert.match(unwrap(mode), /\*\*`k\/keyword`\*\*\s+→ Keyword-only search — the no-key backstop; upgrade anytime later/);
    assert.match(unwrap(mode), /\*\*`t\/terminal`\*\*\s+→ Run the interactive wizard in your terminal instead/);

    const retry = renderSurface(dir, 'knowledge-gate', { variant: 'retry', provider: 'openai' });
    assert.match(retry, /=== MENU: knowledge retry gate/);
    assert.match(retry, /\*\*`◆ Ready to retry\?`\*\*/);
    assert.match(unwrap(retry), /\*\*`y\/yes`\*\*\s+→ The key is stored — re-run the setup/);
    assert.match(unwrap(retry), /\*\*`k\/keyword`\*\* → Skip the key for now — use keyword-only search instead/);
    assert.doesNotMatch(retry, /d\/done/);
  });

  it('the knowledge gate\'s retry: an OpenAI key is stored at the private prompt or the shell, the guidance against pasting it going between the commands and the menu', () => {
    assert.strictEqual(renderSurface(dir, 'knowledge-gate', { variant: 'retry', provider: 'openai' }), [
      '=== DISPLAY: knowledge retry (emit verbatim as a text code block (```text fence)) ===',
      'No OpenAI API key was found. Store one without it touching this',
      'chat — run ONE of these in your terminal, then come back:',
      '',
      '  node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup --key-only',
      '      Private prompt, input hidden. Stored at',
      '      ~/.config/workflows/credentials.json (mode 0600).',
      '',
      '  export OPENAI_API_KEY=<your key>   # note: inline export lands in shell history — --key-only avoids that',
      '      Shell environment — takes precedence over the stored key.',
      '',
      "=== MENU: knowledge retry gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Ready to retry?`**',
      '',
      '**`y/yes`**     → The key is stored — re-run the setup',
      '**`k/keyword`** → Skip the key for now — use keyword-only search',
      `${NB(12)}instead`,
      '',
    ].join('\n'));
  });

  it('the knowledge gate\'s retry: an OpenAI-compatible endpoint\'s key is stored at the private prompt alone', () => {
    const out = renderSurface(dir, 'knowledge-gate', { variant: 'retry', provider: 'openai-compatible' });
    assert.ok(out.startsWith([
      '=== DISPLAY: knowledge retry (emit verbatim as a text code block (```text fence)) ===',
      'The endpoint requires an API key. Store one without it touching',
      'this chat — run this in your terminal, then come back:',
      '',
      '  node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup --key-only --provider openai-compatible',
      '      Private prompt, input hidden. Stored at',
      '      ~/.config/workflows/credentials.json (mode 0600).',
      '',
      "=== MENU: knowledge retry gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
    ].join('\n')), out);
    assert.doesNotMatch(out, /OPENAI_API_KEY/);
  });

  it('the knowledge gate\'s wizard wait: the command to run above a gate that asks whether it completed', () => {
    assert.strictEqual(renderSurface(dir, 'knowledge-gate', { variant: 'wizard' }), [
      '=== DISPLAY: knowledge wizard (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Run the wizard in your terminal:',
      '',
      '  node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup',
      '',
      'It configures system defaults, initialises the project store, and',
      'runs the initial indexing pass.',
      '',
      "=== MENU: knowledge wizard gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Has the wizard completed?`**',
      '',
      '**`y/yes`** → It completed — check the knowledge base again',
      '',
    ].join('\n'));
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'wizard', provider: 'openai' }), /--provider does not belong to the wizard variant/);
  });

  it('knowledge-ready names the configuration this checkout\'s store was built with, read from its metadata', () => {
    const metadata = path.join(dir, '.leeway/.knowledge/metadata.json');
    assert.throws(() => renderSurface(dir, 'knowledge-ready', {}), new RegExp(`render knowledge-ready: no ${esc(metadata)} — this checkout has no knowledge store yet`));
    fs.mkdirSync(path.dirname(metadata), { recursive: true });
    fs.writeFileSync(metadata, JSON.stringify({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 }));
    assert.strictEqual(renderSurface(dir, 'knowledge-ready', {}), [
      '=== DISPLAY: knowledge ready (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Knowledge base ready — openai · text-embedding-3-small.',
      '',
    ].join('\n'));
    fs.writeFileSync(metadata, JSON.stringify({ provider: null, model: null, dimensions: null }));
    assert.match(renderSurface(dir, 'knowledge-ready', {}), /^Knowledge base ready — keyword-only\.$/m);
    fs.writeFileSync(metadata, '{not json');
    assert.throws(() => renderSurface(dir, 'knowledge-ready', {}), new RegExp(`render knowledge-ready: ${esc(metadata)} is not valid JSON`));
  });

  it('the knowledge gate refuses a missing or unknown variant, a lone model, a configuration off the reuse variant, and a retry naming no provider it can store a key for', () => {
    assert.throws(() => renderSurface(dir, 'knowledge-gate', {}), /--variant must be one of reuse, deviate, mode, retry, wizard, got ""/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'setup' }), /--variant must be one of reuse, deviate, mode, retry, wizard, got "setup"/);
    assert.match(renderSurface(dir, 'knowledge-gate', { variant: 'reuse', provider: 'openai' }), /Use the existing configuration \(openai\)/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'reuse', model: 'text-embedding-3-small' }), /--model names nothing without --provider/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'mode', provider: 'openai', model: 'text-embedding-3-small' }), /--provider does not belong to the mode variant/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'deviate', model: 'x' }), /--model does not belong to the deviate variant/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'retry', provider: 'openai', model: 'x' }), /--model does not belong to the retry variant/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'retry' }), /the retry variant needs --provider openai\|openai-compatible — the provider whose key the setup could not find, got ""/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'retry', provider: 'ollama' }), /the retry variant needs --provider openai\|openai-compatible — .*got "ollama"/);
  });

  it('the static baseline gates render their menus; the completed-only pair refuse mid-flight', () => {
    assert.match(renderSurface(dir, 'baseline-doc-gate', {}), /\*\*`◆ Land it\?`\*\*[\s\S]*\*\*`y\/yes`\*\*\s+→ Index and commit the doc/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-manage-gate', {}), /not completed/);
    assert.throws(() => renderSurface(dir, 'baseline-doc-pick', {}), /not completed/);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`◆ What would you like to do\?`\*\*[\s\S]*\*\*`e\/expand`\*\* → Add a new area, or deepen an existing one/);
    // The way out of the baseline is the surface it was entered from.
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`b\/back`\*\*\s+→ Return to the start menu/);
  });

  it('the doc pick numbers every area doc beneath its question, back last, each number\'s area on its DATA row', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', payments: 'completed' } });
    assert.strictEqual(renderSurface(dir, 'baseline-doc-pick', {}), [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'DOCS (key  area):',
      '  1  overview',
      '  2  payments',
      '',
      "=== MENU: baseline doc pick (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which doc?`**',
      '',
      '**`1`**      → overview.md',
      '**`2`**      → payments.md',
      '**`b/back`** → Return to the baseline menu',
      '',
    ].join('\n'));
  });
});

describe('walkthrough surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  const SCREENS = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough', 'screens');
  const screenFiles = () => fs.readdirSync(SCREENS).filter((f) => f.endsWith('.md')).sort();
  const screenText = (n) => fs.readFileSync(path.join(SCREENS, screenFiles()[n - 1]), 'utf8');
  const titleOf = (n) => screenText(n).split('\n').find((l) => l.startsWith('# ')).slice(2).trim();

  const TOPICS = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough', 'topics');
  const cardFiles = () => fs.readdirSync(TOPICS).filter((f) => f.endsWith('.md')).sort();
  const cardText = (n) => fs.readFileSync(path.join(TOPICS, cardFiles()[n - 1]), 'utf8');
  const cardTitle = (n) => cardText(n).split('\n').find((l) => l.startsWith('# ')).slice(2).trim();
  // The addresses `walkthrough-topic` takes. Pinned rather than re-derived
  // from the filenames the projection reads: a slug is what a session routes
  // on, and a card renamed out from under one has to fail here.
  const SLUGS = [
    'kinds-of-work', 'the-phases', 'epics-the-map-and-the-dashboard', 'the-roadmap', 'gates-and-auto',
    'the-knowledge-base-and-the-baseline', 'the-inbox', 'reshaping-work', 'working-in-parallel',
  ];
  /** The section markers of a render, in order — the shape the emitting prose walks. */
  const markers = (out) => out.split('\n').filter((l) => l.startsWith('=== ')).map((l) => l.slice(4, l.indexOf(' (')));
  /** A content file's chunks in order, each carrying its fence tag ('' when untagged, null for prose). */
  const fenceChunks = (text) => {
    const chunks = [];
    let tag = null;
    let buffer = [];
    const flush = () => {
      const body = buffer.join('\n').replace(/^\n+|\n+$/g, '');
      if (body !== '' || tag) chunks.push({ tag, text: body });
      buffer = [];
    };
    for (const line of text.split('\n').slice(1)) {
      if (line.startsWith('```')) { const open = line.slice(3).trim(); flush(); tag = tag === null ? open : null; continue; }
      buffer.push(line);
    }
    flush();
    return chunks;
  };
  const menuOf = (out) => out.slice(out.indexOf('=== MENU:'));

  it('a screen is its heading, its content in file order, then its menu', () => {
    const out = renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' });
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'DISPLAY: walkthrough diagram', 'DISPLAY: walkthrough prose', 'MENU: walkthrough screen']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      `# **\`■ How the workflows work · 1 of ${screenFiles().length} · ${titleOf(1)}\`**`,
      '',
      '=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===',
    ].join('\n')), out.slice(0, 400));

    // Every chunk the file marks off reaches the render in file order: the
    // prose as written, an untagged diagram as drawn. A tagged fence is
    // notation the engine lays out, so what reaches the render is the
    // layout's output, not the source — its own suite pins that.
    const chunks = fenceChunks(screenText(1));
    assert.strictEqual(chunks.length, 3, 'screen 1 is prose, diagram, prose');
    let cursor = 0;
    for (const chunk of chunks) {
      if (chunk.tag) continue;
      const at = out.indexOf(chunk.text, cursor);
      assert.ok(at > cursor, `chunk missing or out of order:\n${chunk.text.slice(0, 60)}…`);
      cursor = at;
    }
  });

  it('the first screen: a first run goes on or stops, the offer before it already answered; from help it goes on or back', () => {
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(2)}`,
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));

    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'help' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(2)}`,
      '**`b/back`** → Back to help',
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));
  });

  it('a middle screen: next, back, and a stop that names where stopping lands', () => {
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '2', from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(3)}`,
      '**`b/back`** → Go back a screen',
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));

    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '2', from: 'help' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(3)}`,
      '**`b/back`** → Go back a screen',
      '**`s/stop`** → Stop here and go back to help',
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));
  });

  it('the last screen: one way out, and the closing invitation beside the standing one', () => {
    const last = screenFiles().length;
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: String(last), from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      '**`d/done`**  → Go to the start menu',
      "**Ask**     → Ask anything about what's on this screen",
      "**Tell me** → Tell me what you're likely to start with, and I'll say",
      `${NB(10)}what path it will take`,
      '',
    ].join('\n'));

    assert.match(renderSurface(dir, 'walkthrough-screen', { screen: String(last), from: 'help' }), /\*\*`d\/done`\*\*\s+→ Back to help/);
  });

  it('--menu-only is the menu alone — the return from a question, not the screen again', () => {
    for (const from of ['first-run', 'help']) {
      const full = renderSurface(dir, 'walkthrough-screen', { screen: '2', from });
      const menuOnly = renderSurface(dir, 'walkthrough-screen', { screen: '2', from, 'menu-only': '1' });
      assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough screen']);
      assert.strictEqual(menuOnly, menuOf(full), `${from}: the keys come back exactly as they stood`);
    }
  });

  it('refuses a screen outside the walk, a missing or unknown origin', () => {
    const total = screenFiles().length;
    for (const screen of [undefined, '', '0', String(total + 1), 'two', '1.5']) {
      assert.throws(
        () => renderSurface(dir, 'walkthrough-screen', { screen, from: 'help' }),
        new RegExp(`--screen is 1–${total} — got "${screen ?? ''}"`),
        JSON.stringify(screen),
      );
    }
    assert.throws(() => renderSurface(dir, 'walkthrough-screen', { screen: '1' }), /--from must be one of first-run, help, got ""/);
    assert.throws(() => renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'menu' }), /--from must be one of first-run, help, got "menu"/);
  });

  it('walkthrough-offer: the heading with no position, the offer\'s prose, and a yes/skip menu with a question', () => {
    const out = renderSurface(dir, 'walkthrough-offer', {});
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'MENU: walkthrough offer']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      '# **`■ How the workflows work`**',
    ].join('\n')), out.slice(0, 200));
    assert.strictEqual(menuOf(out), [
      "=== MENU: walkthrough offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Take the walkthrough?`**',
      '',
      "**`y/yes`**  → Let's do it",
      "**`s/skip`** → Skip for now — it's under h/help whenever you want it",
      '**Ask**    → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('walkthrough-offer --menu-only is the menu alone — the return from a question', () => {
    const menuOnly = renderSurface(dir, 'walkthrough-offer', { 'menu-only': '1' });
    assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough offer']);
    assert.strictEqual(menuOnly, menuOf(renderSurface(dir, 'walkthrough-offer', {})));
  });

  it('the offer stands outside the walk — no screen of it, and the walk\'s length is the screens alone', () => {
    const total = screenFiles().length;
    assert.ok(!screenFiles().some((f) => f.includes('offer')), 'the offer is not a screen file');
    assert.match(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' }), new RegExp(`· 1 of ${total} · ${titleOf(1)}`));
    assert.match(renderSurface(dir, 'walkthrough-home', {}), new RegExp(`\\(${total} short screens\\)`));
  });

  it('walkthrough-home: the walk, the cards, a question, and the way back', () => {
    assert.strictEqual(renderSurface(dir, 'walkthrough-home', {}), [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      '# **`■ Help`**',
      '',
      "=== MENU: walkthrough home (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What would you like to do?`**',
      '',
      `**\`w/walk\`**   → Walk through how the workflows work (${screenFiles().length} short screens)`,
      '**`t/topics`** → Read about one area in more depth',
      '**`b/back`**   → Back to the start menu',
      '**Ask**      → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('walkthrough-topics: every card numbered in file order, its slug on the DATA row', () => {
    assert.strictEqual(renderSurface(dir, 'walkthrough-topics', {}), [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      '# **`■ Help · Topics`**',
      '',
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'CARDS (key  name):',
      ...SLUGS.map((slug, i) => `  ${i + 1}  ${slug}`),
      '',
      "=== MENU: walkthrough topics (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which area?`**',
      '',
      ...SLUGS.map((_slug, i) => `**\`${i + 1}\`**      → ${cardTitle(i + 1)}`),
      '**`b/back`** → Back to help',
      '**Ask**    → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('a card is its heading, then its content in file order — no gate; --menu-only is the menu every card wears', () => {
    const out = renderSurface(dir, 'walkthrough-topic', { name: SLUGS[0] });
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'DISPLAY: walkthrough diagram', 'DISPLAY: walkthrough prose']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      `# **\`■ Help · ${cardTitle(1)}\`**`,
      '',
      '=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===',
    ].join('\n')), out.slice(0, 400));

    const body = cardText(1).split('\n').slice(1).join('\n');
    const chunks = body.split(/^```$/m).map((c) => c.replace(/^\n+|\n+$/g, '')).filter(Boolean);
    assert.strictEqual(chunks.length, 3, 'the first card is prose, diagram, prose');
    let cursor = 0;
    for (const chunk of chunks) {
      const at = out.indexOf(chunk, cursor);
      assert.ok(at > cursor, `chunk missing or out of order:\n${chunk.slice(0, 60)}…`);
      cursor = at;
    }

    assert.strictEqual(renderSurface(dir, 'walkthrough-topic', { name: SLUGS[0], 'menu-only': '1' }), [
      "=== MENU: walkthrough card (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      '**`t/topics`** → Back to the topics',
      '**`b/back`**   → Back to help',
      "**Ask**      → Ask anything about what's on this card",
      '',
    ].join('\n'));
  });

  it('every card renders without a gate, and every card wears the same menu', () => {
    const menus = new Set();
    for (const slug of SLUGS) {
      assert.ok(!markers(renderSurface(dir, 'walkthrough-topic', { name: slug })).some((m) => m.startsWith('MENU')), slug);
      const menuOnly = renderSurface(dir, 'walkthrough-topic', { name: slug, 'menu-only': '1' });
      assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough card'], slug);
      menus.add(menuOnly);
    }
    assert.strictEqual(menus.size, 1);
  });

  it('refuses a missing or unknown card, naming the ones there are', () => {
    const named = new RegExp(`--name is one of ${SLUGS.join(', ')} — got`);
    for (const name of [undefined, '', 'the-map', '01-kinds-of-work', 'Kinds-Of-Work']) {
      assert.throws(() => renderSurface(dir, 'walkthrough-topic', { name }), named, JSON.stringify(name));
      // The return from a question is addressed the same way: a menu never
      // comes back for a card that does not exist.
      assert.throws(() => renderSurface(dir, 'walkthrough-topic', { name, 'menu-only': '1' }), named, JSON.stringify(name));
    }
  });
});

describe('render review-presentation', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (payload) => {
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(payload));
    return renderSurface(dir, 'review-presentation', { dotpath: 'pay.review.checkout', file: 'p.json' });
  };

  it('a fail carries full chrome: title anchor, red verdict tier, then the list', () => {
    const out = render({
      topic: 'checkout', verdict: 'fail',
      corrected: { applied: 180, reverted: 2, suite: 'green' }, discarded: 45, out_of_scope: 2,
      replan: [
        { summary: 'the badge key collides for two row shapes', ref: 'union.go:190', fails: 'both rows render the badge' },
        { summary: 'the guard scans comments only', fails: 'ten retired names pass green' },
      ],
    });
    assert.match(out, /=== TITLE \(emit verbatim as markdown \(not a code block\) — the view's chrome heading\) ===\n# \*\*`■ Review — Checkout`\*\*/);
    assert.match(out, /DISPLAY: review verdict \(emit verbatim as a properties code block/);
    assert.match(out, /⚑ Failed — 2 findings must be planned and built before this work is delivered/);
    assert.match(out, /\*\*Needs planning\*\* — 2 findings/);
    assert.match(out, /1\\\. the badge key collides/);
    assert.match(out, /↳ union\.go:190 — both rows render the badge/);
    assert.match(out, /↳ ten retired names pass green/);
    assert.match(out, /Corrected in this session: 180 applied · suite green · 2 reverted, still owed\./);
    assert.match(out, /Outside this spec: 2 findings — held until the review closes\./);
    assert.match(out, /Discarded: 45 — reasons in the report\./);
    const vi = out.indexOf('⚑ Failed');
    assert.ok(out.indexOf('■ Review') < vi && vi < out.indexOf('Needs planning'), 'verdict sits between the title and the list');
  });

  it('a pass keeps the chrome and stays calm — no red, nothing listed', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', corrected: { applied: 180, suite: 'green' }, discarded: 45 });
    assert.match(out, /# \*\*`■ Review — Checkout`\*\*/);
    assert.match(out, /\*\*Passed\*\* — nothing needs planning\./);
    assert.ok(!out.includes('⚑'), 'red is the fail register only');
    assert.match(out, /180 applied · suite green\./);
    assert.ok(!out.includes('Needs planning'));
    assert.ok(!/^\d+\\\. /m.test(out), 'nothing is listed on a pass');
  });

  it('a clean pass is the title and the verdict alone', () => {
    const out = render({ topic: 'checkout', verdict: 'pass' });
    assert.match(out, /\*\*Passed\*\*/);
    assert.ok(!out.includes('DISPLAY: review findings'), 'no findings section when there is nothing to say');
    assert.ok(!out.includes('Corrected'));
    assert.ok(!out.includes('Discarded'));
  });

  it('names the criteria the review could not measure, singular at one', () => {
    const three = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 3 });
    assert.match(three, /Not measured: 3 criteria — named in the report\./);
    const one = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 1 });
    assert.match(one, /Not measured: 1 criterion — named in the report\./);
  });

  it('says nothing about measurement when every criterion was measured', () => {
    const zero = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 0 });
    assert.ok(!zero.includes('Not measured'), 'zero renders nothing');
    const absent = render({ topic: 'checkout', verdict: 'pass', discarded: 45 });
    assert.ok(!absent.includes('Not measured'), 'absent renders nothing');
  });

  it('the out-of-scope line says what happens to the set: decided at a pass, held at a fail', () => {
    const pass = render({ topic: 'checkout', verdict: 'pass', out_of_scope: 1 });
    assert.match(pass, /Outside this spec: 1 finding — each decided below\./);
    const fail = render({
      topic: 'checkout', verdict: 'fail', out_of_scope: 3,
      replan: [{ summary: 'the guard scans comments only', fails: 'ten retired names pass green' }],
    });
    assert.match(fail, /Outside this spec: 3 findings — held until the review closes\./);
  });

  it('the not-measured line closes the tail, after the held and discarded counts', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', corrected: { applied: 4, suite: 'green' }, out_of_scope: 2, discarded: 45, not_measured: 3 });
    const oi = out.indexOf('Outside this spec: 2');
    const di = out.indexOf('Discarded: 45');
    const ni = out.indexOf('Not measured: 3');
    assert.ok(out.indexOf('Corrected in this session') < oi && oi < di && di < ni, 'the tail keeps its order');
  });

  it('a pass with nothing but unmeasured criteria still opens the findings section', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', not_measured: 3 });
    assert.match(out, /DISPLAY: review findings/);
    assert.match(out, /Not measured: 3 criteria — named in the report\./);
    assert.ok(!out.includes('Corrected'));
    assert.ok(!out.includes('Discarded'));
  });

  it('refuses a not-measured count that is not a non-negative integer', () => {
    const message = /render review-presentation: "not_measured" must be a non-negative integer/;
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: -1 }), message);
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: 1.5 }), message);
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: '3' }), message);
  });

  it('refuses a verdict that disagrees with the list', () => {
    assert.throws(() => render({ topic: 'checkout', verdict: 'fail' }), /a fail must carry at least one "replan" finding/);
    assert.throws(
      () => render({ topic: 'checkout', verdict: 'pass', replan: [{ summary: 'x', fails: 'y' }] }),
      /a pass cannot carry "replan" findings/,
    );
  });

  it('refuses a bad payload and a bad address', () => {
    assert.throws(() => render({ topic: 'checkout', verdict: 'ship-it' }), /"verdict" must be "pass" or "fail"/);
    assert.throws(() => render({ verdict: 'pass' }), /"topic" must be a non-empty string/);
    writeManifest(dir, 'pay2', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify({ topic: 'x', verdict: 'pass' }));
    assert.throws(
      () => renderSurface(dir, 'review-presentation', { dotpath: 'pay2.discussion.checkout', file: 'p.json' }),
      /address must be <work_unit>\.review\.<topic>/,
    );
  });
});

describe('render review-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('a fail routes to planning and offers nothing else', () => {
    const out = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'fail', replan: '9' });
    assert.match(out, /\*\*`◆ What next\?`\*\*/);
    assert.match(out, /\*\*`p\/plan`\*\* → Plan the 9 failures and reopen implementation/);
    assert.match(out, /\*\*Ask\*\*/);
    assert.ok(!out.includes('c/complete'), 'a failing review cannot be completed');
  });

  it('the completion names where it lands — an epic returns, every other type finishes', () => {
    const landing = (workType) => {
      writeManifest(dir, 'pay', { work_type: workType, phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
      return renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    };
    assert.match(landing('epic'), /\*\*`c\/complete`\*\* → Complete the review and return to the epic/);
    assert.match(landing('feature'), /\*\*`c\/complete`\*\* → Complete the review and finish the feature/);
    assert.match(landing('bugfix'), /\*\*`c\/complete`\*\* → Complete the review and finish the bugfix/);
    assert.match(landing('quick-fix'), /\*\*`c\/complete`\*\* → Complete the review and finish the quick-fix/);
  });

  it('an unknown or absent work type still names a landing', () => {
    writeManifest(dir, 'pay', { work_type: 'rebuild', phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
    assert.match(renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' }),
      /\*\*`c\/complete`\*\* → Complete the review and finish the work/);
    writeManifest(dir, 'pay', { work_type: undefined, phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
    assert.match(renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' }),
      /\*\*`c\/complete`\*\* → Complete the review and finish the work/);
  });

  it('the banked set is decided before the gate, so the gate never offers it', () => {
    const clean = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    assert.ok(!clean.includes('i/inbox'), 'the out-of-scope decision is not a gate option');
    assert.ok(!clean.includes('p/plan'));
    const flagged = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass', 'out-of-scope': '2' });
    assert.strictEqual(flagged, clean, 'the surface no longer reads --out-of-scope');
  });

  it('refuses a fail with no replan count, a bad verdict, and a bad address', () => {
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'fail' }),
      /a fail needs --replan <count>/,
    );
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'maybe' }),
      /--verdict must be "pass" or "fail"/,
    );
    writeManifest(dir, 'pay2', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay2.discussion.checkout', verdict: 'pass' }),
      /address must be <work_unit>\.review\.<topic>/,
    );
  });
});

describe('render off-topic-offer', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const feature = () => writeManifest(dir, 'pay', {
    work_type: 'feature',
    phases: { research: { items: { pay: { status: 'in-progress' } } } },
  });

  it('offers the pivot for a feature, aligned across three rows', () => {
    feature();
    const file = writePayload(dir, 'o.json', { title: 'Rate limiting on the public API' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Rate limiting on the public API** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`p/pivot`**  → Convert this work to an epic so it can hold it as its',
      `${NB(11)}own topic`,
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('drops the pivot for a non-feature and re-aligns the pair', () => {
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { research: { items: { xc: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { title: 'Audit logging' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'xc.research.xc', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Audit logging** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload and an empty title', () => {
    feature();
    assert.throws(() => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay' }), /--file <payload\.json> is required/);
    const blank = writePayload(dir, 'b.json', { title: '  ' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file: blank }),
      /"title" must be a non-empty string/,
    );
  });

  it('the discussion variant adds the roadmap park and speaks the Summary register', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: { discussion: { items: { pay: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { title: 'Gift cards' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.discussion.pay', file, variant: 'discussion' });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Gift cards** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**     → Capture it as an idea in the inbox for later',
      '**`r/roadmap`** → Put it on the product roadmap for a later release',
      '**`p/pivot`**   → Convert this work to an epic so it can hold it as its',
      `${NB(12)}own topic`,
      '**`i/ignore`**  → Note it in the Summary and move on',
      '',
    ].join('\n'));
  });

  it('refuses an unknown variant', () => {
    feature();
    const file = writePayload(dir, 'o.json', { title: 'X' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file, variant: 'nope' }),
      /--variant takes "discussion"/,
    );
  });
});

describe('render inbox-content and the archived item receipts', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const IDEA = '.leeway/.inbox/ideas/2026-06-01--smart-retry.md';
  const BUG = '.leeway/.inbox/.archived/bugs/2026-06-02--login-loop.md';
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  const CONTENT_MARKER = `=== DISPLAY: inbox content (emit verbatim as markdown (not a code block)${CONTINUE_CLAUSE}) ===`;

  it('shows each item in full, in the order given — its type-and-date line, then its content as written, frontmatter skipped', () => {
    write(IDEA, '---\nsource: chat\n---\n\n# Smart Retry\n\nRetry failed payments **twice**.\n\n');
    write(BUG, '# Login Loop\n\n- signs out\n- signs back in\n');
    const out = renderSurface(dir, 'inbox-content', { dotpath: undefined, path: `${BUG},${IDEA}` });
    assert.strictEqual(out, [
      CONTENT_MARKER,
      '*[bug] — 2026-06-02*',
      '',
      '# Login Loop',
      '',
      '- signs out',
      '- signs back in',
      '',
      '*[idea] — 2026-06-01*',
      '',
      '# Smart Retry',
      '',
      'Retry failed payments **twice**.',
      '',
    ].join('\n'));
  });

  it('shows a lone type-and-date line for an item with nothing beneath its frontmatter', () => {
    write(IDEA, '---\nsource: chat\n---\n');
    assert.strictEqual(renderSurface(dir, 'inbox-content', { dotpath: undefined, path: IDEA }),
      `${CONTENT_MARKER}\n*[idea] — 2026-06-01*\n`);
  });

  it('inbox-content refuses no path, a path outside the inbox, and one nothing sits at', () => {
    write(IDEA, '# Smart Retry\n');
    assert.throws(() => renderSurface(dir, 'inbox-content', { dotpath: undefined }),
      /render inbox-content: --path is required — the inbox items to show, comma-joined/);
    assert.throws(() => renderSurface(dir, 'inbox-content', { dotpath: undefined, path: `${IDEA},.leeway/pay/manifest.json` }),
      /render inbox-content: not a live inbox path/);
    assert.throws(() => renderSurface(dir, 'inbox-content', { dotpath: undefined, path: '.leeway/.inbox/bugs/2026-06-09--ghost.md' }),
      /render inbox-content: not in the live inbox: ".leeway\/.inbox\/bugs\/2026-06-09--ghost.md"/);
  });

  const RECEIPT = '=== DISPLAY: confirmation (emit verbatim as a text code block (```text fence) after the response) ===';

  it('inbox-restore-receipt names the item back in the inbox by its own title — its slug where it has none', () => {
    write(IDEA, '---\nsource: chat\n---\n\n# Smart Retry\n');
    assert.strictEqual(renderSurface(dir, 'inbox-restore-receipt', { dotpath: undefined, path: IDEA }),
      `${RECEIPT}\nRestored "Smart Retry" to the inbox.\n`);
    write(IDEA, 'no heading here\n');
    assert.strictEqual(renderSurface(dir, 'inbox-restore-receipt', { dotpath: undefined, path: IDEA }),
      `${RECEIPT}\nRestored "smart-retry" to the inbox.\n`);
  });

  it('inbox-restore-receipt refuses no path, an archived path, and a live path nothing sits at — the inbox is the state it receipts', () => {
    write(BUG, '# Login Loop\n');
    assert.throws(() => renderSurface(dir, 'inbox-restore-receipt', { dotpath: undefined }),
      /render inbox-restore-receipt: --path is required — the live path `inbox restore` answered/);
    assert.throws(() => renderSurface(dir, 'inbox-restore-receipt', { dotpath: undefined, path: BUG }),
      /render inbox-restore-receipt: not a live inbox path/);
    assert.throws(() => renderSurface(dir, 'inbox-restore-receipt', { dotpath: undefined, path: IDEA }),
      /render inbox-restore-receipt: not in the live inbox: "\.leeway\/\.inbox\/ideas\/2026-06-01--smart-retry\.md"/);
  });

  // The inbox's history is the state branch's: git runs in the state worktree.
  const git = (...args) => {
    const res = require('child_process').spawnSync('git', args, { cwd: path.join(dir, '.leeway'), encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
  };
  const committed = (rel, text) => {
    write(rel, text);
    git('add', '--', path.join(dir, rel));
    git('commit', '-q', '-m', `add ${rel}`);
  };

  it('inbox-delete-receipt names the deleted item by the title git last held — the deleting commit\'s parent, however many commits sit above it', () => {
    committed(BUG, '# Login Loop\n');
    git('rm', '-q', '--', path.join(dir, BUG));
    git('commit', '-q', '-m', 'delete');
    committed('.leeway/notes.md', 'later work\n');
    assert.strictEqual(renderSurface(dir, 'inbox-delete-receipt', { dotpath: undefined, path: BUG }),
      `${RECEIPT}\nDeleted "Login Loop".\n`);
  });

  it('inbox-delete-receipt reads HEAD while the deletion is only staged — a commit the delete could not land', () => {
    committed(BUG, 'no heading here\n');
    git('rm', '-q', '--', path.join(dir, BUG));
    assert.strictEqual(renderSurface(dir, 'inbox-delete-receipt', { dotpath: undefined, path: BUG }),
      `${RECEIPT}\nDeleted "login-loop".\n`);
  });

  it('inbox-delete-receipt refuses no path, a live path, a path the archive still holds, and one git holds no copy of', () => {
    committed(BUG, '# Login Loop\n');
    assert.throws(() => renderSurface(dir, 'inbox-delete-receipt', { dotpath: undefined }),
      /render inbox-delete-receipt: --path is required — the archived path `inbox delete` answered/);
    assert.throws(() => renderSurface(dir, 'inbox-delete-receipt', { dotpath: undefined, path: IDEA }),
      /render inbox-delete-receipt: not an archived inbox path/);
    assert.throws(() => renderSurface(dir, 'inbox-delete-receipt', { dotpath: undefined, path: BUG }),
      /render inbox-delete-receipt: still in the archived store, so nothing was deleted: "\.leeway\/\.inbox\/\.archived\/bugs\/2026-06-02--login-loop\.md"/);
    const ghost = '.leeway/.inbox/.archived/ideas/2026-06-09--ghost.md';
    assert.throws(() => renderSurface(dir, 'inbox-delete-receipt', { dotpath: undefined, path: ghost }),
      /render inbox-delete-receipt: git holds no deleted file at "\.leeway\/\.inbox\/\.archived\/ideas\/2026-06-09--ghost\.md"/);
  });
});

describe('render backlog-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const live = () => writeManifest(dir, 'pay', {
    work_type: 'feature',
    phases: { implementation: { items: { pay: { status: 'in-progress' } } } },
  });

  it('names what is set aside and offers the two places it can wait', () => {
    live();
    const file = writePayload(dir, 'b.json', { title: "a CSV export of the day's orders" });
    const out = renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay', file });
    assert.strictEqual(out, [
      "=== MENU: backlog gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "Setting **a CSV export of the day's orders** aside.",
      '',
      '**`◆ Where should it wait?`**',
      '',
      "**`r/roadmap`** → On the roadmap — you've decided to do it; it waits",
      `${NB(12)}under a horizon`,
      "**`i/inbox`**   → In the inbox — not decided yet; you'll triage it",
      `${NB(12)}later`,
      '',
    ].join('\n'));
  });

  it('refuses a missing payload, a missing title, and an empty one', () => {
    live();
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay' }),
      /render backlog-gate: --file <payload\.json> is required/);
    const absent = writePayload(dir, 'a.json', { idea: 'the old key' });
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay', file: absent }),
      /render backlog-gate: "title" must be a non-empty string/);
    const blank = writePayload(dir, 'e.json', { title: '   ' });
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay', file: blank }),
      /render backlog-gate: "title" must be a non-empty string/);
  });

  it('refuses a dead address', () => {
    live();
    const file = writePayload(dir, 'b.json', { title: 'gift cards' });
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'ghost.implementation.ghost', file }),
      /render backlog-gate: work unit "ghost" not found/);
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation', file }),
      /render backlog-gate: address must be <work_unit>\.<phase>\.<topic>/);
  });
});

describe('render roadmap gate menus — static sets, engine-rendered like every menu', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('roadmap-harvest-gate: the sort confirm', () => {
    const out = renderSurface(dir, 'roadmap-harvest-gate', {});
    assert.match(out, /^=== MENU: roadmap harvest gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /`◆ Put these on the roadmap as shown\?`/);
    assert.match(out, /`y\/yes`.*Add these items to the roadmap/);
    assert.match(out, /`e\/explore`.*Go back to the conversation; not ready yet/);
    assert.match(out, /\*\*Adjust\*\*.*Tell me what to change \(move, split, merge, rename,/);
  });

  it('roadmap-parks-gate: the parks-only confirm in the park register', () => {
    const out = renderSurface(dir, 'roadmap-parks-gate', {});
    assert.match(out, /`◆ Park these on the roadmap\?`/);
    assert.match(out, /`y\/yes`.*Add these items to the roadmap and conclude/);
    assert.match(out, /\*\*Adjust\*\*.*move between horizons/);
  });

  it('roadmap-shape-gate: the pull ceremony confirm', () => {
    const shape = renderSurface(dir, 'roadmap-shape-gate', {});
    assert.match(shape, /`◆ Shape it this way\?`/);
    assert.match(shape, /`y\/yes`.*Create it and carry on into it/);
    assert.ok(shape.includes('**Adjust** → Tell me what to change (the shape, the description)'), 'the Adjust label names no shape');
  });
});

describe('render — the adopted cross-flow static gates', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('shape-gate: the work-type commit confirm', () => {
    const out = renderSurface(dir, 'shape-gate', {});
    assert.match(out, /`◆ Have I read this right\?`/);
    assert.match(out, /`y\/yes`.*That's the right shape, set it up/);
    assert.match(out, /`o\/other`.*It's something else \(tell me what\)/);
    assert.match(out, /\*\*Keep shaping\*\*.*Tell me what I'm missing/);
  });

  it('synthesis-gate: the epic topic sort confirm', () => {
    const out = renderSurface(dir, 'synthesis-gate', {});
    assert.match(out, /`◆ Commit these topics\?`/);
    assert.match(out, /`y\/yes`.*Commit these topics and conclude/);
    assert.match(out, /`e\/explore`.*Go back to exploration; not ready to commit yet/);
    assert.match(out, /\*\*Adjust\*\*.*split, merge, rename,/);
  });

  it('query-failure-gate: the error output and its diagnosis above retry or proceed without context', () => {
    const file = writePayload(dir, '.leeway/.cache/pay/discussion/pay/query-failure.json', {
      error: 'Error: metadata.json missing but store exists. Run the rebuild to fix it before the next query.\n  Provide the key and retry:\n\n    • export OPENAI_API_KEY=...\n',
    });
    assert.strictEqual(renderSurface(dir, 'query-failure-gate', { file }), [
      '=== DISPLAY: query failure (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      '⚑ Knowledge query failed',
      '  Error: metadata.json missing but store exists. Run the rebuild',
      '  to fix it before the next query.',
      '    Provide the key and retry:',
      '',
      '      • export OPENAI_API_KEY=...',
      '',
      "  Likely causes: a knowledge config that can't be read or names a",
      "  provider it can't use, or a store that can't be read or has",
      '  lost its metadata. Run this to diagnose:',
      '',
      '    node .claude/skills/workflow-engine/scripts/engine.cjs knowledge status',
      '',
      "=== MENU: query failure gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ How should I proceed?`**',
      '',
      "**`r/retry`** → I'll fix the issue; retry the query",
      '**`s/skip`**  → Proceed without knowledge context for this phase',
      '',
    ].join('\n'));
  });

  it('query-failure-gate: refuses without the error output it shows', () => {
    assert.throws(() => renderSurface(dir, 'query-failure-gate', {}), /--file <payload\.json> is required/);
    const blank = writePayload(dir, '.leeway/.cache/pay/discussion/pay/query-failure.json', { error: '  ' });
    assert.throws(() => renderSurface(dir, 'query-failure-gate', { file: blank }), /"error" must be the query's error output, a non-empty string/);
  });

  it('legacy-split-gate: three dialog gates keyed by what each asks; the remove confirm says what the removal drops, then asks on its diamond line', () => {
    assert.strictEqual(renderSurface(dir, 'legacy-split-gate', { variant: 'remove', theme: 'caching' }), [
      '=== DISPLAY: legacy split removal (emit verbatim as markdown (not a code block)) ===',
      '> Removing "caching" drops its drafted content — gone unless another theme has already reabsorbed it.',
      '',
      "=== MENU: legacy split remove gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Remove the theme?`**',
      '',
      '**`y/yes`** → Remove the theme and drop its content',
      '**`n/no`**  → Back out',
      '',
    ].join('\n'));

    const themes = renderSurface(dir, 'legacy-split-gate', { variant: 'themes' });
    assert.match(themes, /^=== MENU: legacy split themes gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(themes, /`◆ Proceed with these themes\?`/);
    assert.match(themes, /\*\*`y\/yes`\*\*\s+→ Proceed to draft cache files/);
    assert.match(themes, /\*\*`a\/abandon`\*\* → Skip this source file/);
    assert.match(unwrap(themes), /\*\*Redirect\*\*\s+→ Adjust the theme list \(rename, merge two, split one, add, remove\)/);

    const plan = renderSurface(dir, 'legacy-split-gate', { variant: 'plan' });
    assert.match(plan, /=== MENU: legacy split plan gate/);
    assert.match(plan, /`◆ Apply this plan\?`/);
    assert.match(plan, /\*\*`y\/yes`\*\*\s+→ Apply this plan/);
    assert.match(plan, /\*\*`a\/abandon`\*\* → Skip this source file/);
    assert.match(unwrap(plan), /\*\*Edit\*\*\s+→ Modify cache files or plan\.json \(rename, merge, split, add, remove\)\. To rewrite a draft, edit the cache file directly between renders\./);

    assert.throws(() => renderSurface(dir, 'legacy-split-gate', {}), /--variant must be one of themes, plan, remove, got ""/);
    assert.throws(() => renderSurface(dir, 'legacy-split-gate', { variant: 'apply' }), /--variant must be one of themes, plan, remove, got "apply"/);
    assert.throws(() => renderSurface(dir, 'legacy-split-gate', { variant: 'remove' }), /--theme is required with --variant remove — the theme the removal drops/);
    assert.throws(() => renderSurface(dir, 'legacy-split-gate', { variant: 'remove', theme: ' ' }), /--theme is required/);
  });
});

describe('render opener', () => {
  const STOP_MARKER = '=== DISPLAY: opener (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===';
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const inbox = (rel) => writePayload(dir, `.leeway/.inbox/${rel}`, '# Item\n');
  const opener = (args) => renderSurface(dir, 'opener', args);

  describe('inbox — before any work unit exists', () => {
    it('names the set by kind and counts each kind where several, then the sketch and the question that closes on the files invite', () => {
      const paths = [inbox('ideas/2026-01-01--a.md'), inbox('bugs/2026-01-02--b.md'), inbox('ideas/2026-01-03--c.md')];
      const file = writePayload(dir, 'o.json', { sketch: 'Saved filters that follow the user.', question: 'Who reaches for them first?' });
      assert.strictEqual(opener({ variant: 'inbox', path: paths.join(','), file }), [
        STOP_MARKER,
        "I've read your 2 ideas and a bug. Here's the shape I'm picking up:",
        '',
        'Saved filters that follow the user.',
        '',
        "Who reaches for them first? If you have any related notes, screenshots, or files, share the path(s) and I'll read them too.",
        '',
      ].join('\n'));
    });

    it('a lone item is its bare noun; several of one kind are counted; a lone first kind takes no article', () => {
      const file = writePayload(dir, 'o.json', { sketch: 's', question: 'q?' });
      const read = (paths) => opener({ variant: 'inbox', path: paths.join(','), file }).split('\n')[1];
      assert.strictEqual(read([inbox('bugs/2026-01-01--a.md')]), "I've read your bug. Here's the shape I'm picking up:");
      assert.strictEqual(read([inbox('ideas/2026-01-01--a.md'), inbox('ideas/2026-01-02--b.md'), inbox('ideas/2026-01-03--c.md')]),
        "I've read your 3 ideas. Here's the shape I'm picking up:");
      assert.strictEqual(read([inbox('quickfixes/2026-01-01--q.md'), inbox('ideas/2026-01-01--a.md'), inbox('bugs/2026-01-01--b.md')]),
        "I've read your idea, a bug and a quick-fix. Here's the shape I'm picking up:");
      assert.strictEqual(read([inbox('quickfixes/2026-01-01--q.md'), inbox('quickfixes/2026-01-02--r.md'), inbox('bugs/2026-01-01--b.md')]),
        "I've read your bug and 2 quick-fixes. Here's the shape I'm picking up:");
    });

    it('refuses an address, a path outside the live inbox, a missing payload, and an empty field by name', () => {
      const path1 = inbox('ideas/2026-01-01--a.md');
      const file = writePayload(dir, 'o.json', { sketch: 's', question: 'q?' });
      assert.throws(() => opener({ variant: 'inbox', dotpath: 'pay', path: path1, file }),
        /render opener: --variant inbox takes no address — no work unit exists yet/);
      assert.throws(() => opener({ variant: 'inbox', file }), /render opener: --path is required — the inbox seeds read, comma-joined/);
      assert.throws(() => opener({ variant: 'inbox', path: '.leeway/.inbox/ideas/2026-09-09--gone.md', file }),
        /render opener: inbox file not found/);
      assert.throws(() => opener({ variant: 'inbox', path: '.leeway/.inbox/.archived/ideas/x.md', file }), /render opener: not a live inbox path/);
      assert.throws(() => opener({ variant: 'inbox', path: path1 }), /render opener: --file <payload\.json> is required/);
      assert.throws(() => opener({ variant: 'inbox', path: path1, file: writePayload(dir, 'n.json', { question: 'q?' }) }),
        /render opener: "sketch" must be a non-empty string/);
      assert.throws(() => opener({ variant: 'inbox', path: path1, file: writePayload(dir, 'n.json', { sketch: 's' }) }),
        /render opener: "question" must be a non-empty string/);
    });
  });

  describe('seeded — an epic\'s first session over its seeds and imports', () => {
    const seeds = (...sources) => sources.map((source, i) => ({ path: `seeds/s${i}.md`, source }));
    const imports = (n) => Array.from({ length: n }, (_, i) => ({ path: `imports/i${i}.md`, imported_at: '2026-01-01', origin: 'discovery' }));

    it('names the seeds by their source tags and the imports, then the sketch and the questions after the dash', () => {
      writeManifest(dir, 'pay', { seeds: seeds('inbox:idea'), imports: imports(2) });
      const file = writePayload(dir, 'o.json', { sketch: 'A checkout that survives a dropped connection.', questions: 'where does a retry start, and who sees it?' });
      assert.strictEqual(opener({ variant: 'seeded', dotpath: 'pay', file }), [
        STOP_MARKER,
        "Read your idea and 2 imports. Here's the shape I'm picking up:",
        '',
        'A checkout that survives a dropped connection.',
        '',
        "Before we name topics, let's pull on a few things — where does a retry start, and who sees it?",
        '',
      ].join('\n'));
    });

    it('questions that end on no mark take the full stop; seeds alone, imports alone, and a mix read as they hold', () => {
      const file = writePayload(dir, 'o.json', { sketch: 's', questions: 'the retry boundary' });
      const read = () => opener({ variant: 'seeded', dotpath: 'pay', file });
      writeManifest(dir, 'pay', { seeds: seeds('inbox:bug', 'inbox:quickfix', 'inbox:bug'), imports: [] });
      assert.match(read(), /^Read your 2 bugs and a quick-fix\. Here's/m);
      assert.match(read(), /let's pull on a few things — the retry boundary\.$/m);
      writeManifest(dir, 'pay', { imports: imports(1) });
      assert.match(read(), /^Read your import\. Here's/m);
      writeManifest(dir, 'pay', { seeds: seeds('inbox:idea', 'inbox:bug'), imports: imports(1) });
      assert.match(read(), /^Read your idea, a bug and an import\. Here's/m);
    });

    it('refuses a unit holding neither, and a payload missing its questions', () => {
      writeManifest(dir, 'pay', {});
      const file = writePayload(dir, 'o.json', { sketch: 's', questions: 'q?' });
      assert.throws(() => opener({ variant: 'seeded', dotpath: 'pay', file }),
        /render opener: "pay" holds no seeds or imports — the seeded opener reads what they describe/);
      writeManifest(dir, 'pay', { imports: imports(1) });
      assert.throws(() => opener({ variant: 'seeded', dotpath: 'pay', file: writePayload(dir, 'n.json', { sketch: 's', question: 'q?' }) }),
        /render opener: "questions" must be a non-empty string/);
      assert.throws(() => opener({ variant: 'seeded', dotpath: 'pay.discovery.x', file }), /address must be a bare <work_unit>/);
    });
  });

  describe('discussion — a fresh discussion\'s core-problem question', () => {
    it('names the topic from the address', () => {
      writeManifest(dir, 'pay', { phases: { discussion: { items: { 'retry-policy': { status: 'in-progress' } } } } });
      assert.strictEqual(opener({ variant: 'discussion', dotpath: 'pay.discussion.retry-policy' }), [
        STOP_MARKER,
        'New discussion: retry-policy',
        '',
        "What's the core problem or decision we need to work through?",
        '',
      ].join('\n'));
    });

    it('refuses an address in another phase', () => {
      writeManifest(dir, 'pay', {});
      assert.throws(() => opener({ variant: 'discussion', dotpath: 'pay.research.retry-policy' }),
        /render opener: --variant discussion takes <work_unit>\.discussion\.<topic>, got phase "research"/);
    });
  });

  it('refuses an unknown variant', () => {
    assert.throws(() => opener({ variant: 'roadmap' }), /render opener: --variant must be one of inbox, seeded, discussion, got "roadmap"/);
    assert.throws(() => opener({}), /--variant must be one of inbox, seeded, discussion, got ""/);
  });
});

describe('render import-reprompt', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('names the refused paths in the fence, and offers the correction or the skip', () => {
    const file = writePayload(dir, 'reprompt.json', { missing: ['shots/dockset 05.JPEG', 'notes/ghost.md'] });
    assert.strictEqual(renderSurface(dir, 'import-reprompt', { file }), [
      '=== DISPLAY: missing imports (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'One or more paths could not be landed — nothing at the path, a',
      'folder rather than a file, or unreadable:',
      '',
      '  • shots/dockset 05.JPEG',
      '  • notes/ghost.md',
      '',
      "=== MENU: import reprompt (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`s/skip`**             → Land nothing for these paths',
      '**Provide file paths** → one or more, space or newline separated',
      '',
    ].join('\n'));
  });

  it('wraps a long path inside the fence, under the bullet text column', () => {
    const file = writePayload(dir, 'long.json', {
      missing: ['design/Dockset onboarding screenshots/05 permissions ask — final.png'],
    });
    const out = renderSurface(dir, 'import-reprompt', { file });
    assert.ok(out.includes([
      '  • design/Dockset onboarding screenshots/05 permissions ask —',
      '    final.png',
    ].join('\n')), out);
    // The fence does not re-flow, so every line the engine puts in it is
    // already inside the display width.
    for (const line of out.slice(out.indexOf('\n') + 1, out.indexOf('=== MENU')).split('\n')) {
      assert.ok(line.length <= 65, `overflows the fence: ${line}`);
    }
  });

  it('takes no address — the work unit a refused landing was aimed at may not exist yet', () => {
    const file = writePayload(dir, 'one.json', { missing: ['notes/ghost.md'] });
    assert.ok(renderSurface(dir, 'import-reprompt', { file, dotpath: 'no-such-unit.research.nope' })
      .includes('  • notes/ghost.md'));
  });

  it('refuses an absent file and a payload short of its one field', () => {
    assert.throws(() => renderSurface(dir, 'import-reprompt', {}), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'import-reprompt', { file: 'nope.json' }), /payload file not found: nope\.json/);
    const bad = (name, obj) => () => renderSurface(dir, 'import-reprompt', { file: writePayload(dir, name, obj) });
    assert.throws(bad('m.json', {}), /"missing" must be a non-empty array of the refused paths/);
    assert.throws(bad('e.json', { missing: [] }), /"missing" must be a non-empty array of the refused paths/);
    assert.throws(bad('b.json', { missing: ['ok', ''] }), /missing\[1\] must be a non-empty string/);
  });
});

describe('render legacy-split-display', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const themes = [
    { kebab_name: 'auth', summary: 'Login, sessions, and token refresh' },
    { kebab_name: 'caching', summary: 'Response caching and invalidation' },
  ];

  it('candidates: the theme list as a batch worklist — the name per row, its summary beneath', () => {
    const file = writePayload(dir, 'candidates.json', { source: 'auth', themes });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'candidates', file }), [
      '=== DISPLAY: legacy split candidates (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      'Candidate themes for auth.md:',
      '',
      '1\\. auth',
      `${NB(5)}↳ Login, sessions, and token refresh`,
      '2\\. caching',
      `${NB(5)}↳ Response caching and invalidation`,
      '',
    ].join('\n'));
  });

  // A cache row carries the absolute path, wrapped to the width wherever the
  // fixture's temp folder puts the breaks: the rows are pinned with the path
  // set aside, and each path is read back with its breaks taken out.
  const CACHE_ROW = /   └─ Cache:[^\n]*(?:\n {6}\S[^\n]*)*/g;
  const cachePaths = (out) => (out.match(CACHE_ROW) || [])
    .map((row) => row.replace(/^ {3}└─ Cache:\s*/, '').replace(/\n {6}/g, ''));
  const withoutCachePaths = (out) => out.replace(CACHE_ROW, '   └─ Cache: …');

  it('plan: each theme as a numbered summary/content/cache tree, then the rename footer naming the stamp apply mints', () => {
    const file = writePayload(dir, 'plan-display.json', { source: 'auth', work_unit: 'pay', themes: [
      { ...themes[0], paragraph_count: 4, content_preview: 'The auth flow begins at login' },
      { ...themes[1], paragraph_count: 2, content_preview: 'Responses are cached per route' },
    ] });
    const out = renderSurface(dir, 'legacy-split-display', { variant: 'plan', file });
    assert.deepStrictEqual(cachePaths(out), ['auth', 'caching']
      .map((name) => path.join(dir, `.leeway/.cache/pay/legacy-split/auth/${name}.md`)));
    assert.strictEqual(withoutCachePaths(out), [
      '=== DISPLAY: legacy split plan (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Plan for auth.md:',
      '',
      '1. auth',
      '   ├─ Summary: Login, sessions, and token refresh',
      '   ├─ Content: 4 para(s) — "The auth flow begins at login..."',
      '   └─ Cache: …',
      '',
      '2. caching',
      '   ├─ Summary: Response caching and invalidation',
      '   ├─ Content: 2 para(s) — "Responses are cached per route..."',
      '   └─ Cache: …',
      '',
      'Source file will be renamed to auth-superseded-<datetime>.md.',
      '',
    ].join('\n'));
  });

  it('plan: a long preview wraps under its text column with the rail intact, and no row overflows the width', () => {
    const file = writePayload(dir, 'plan-display.json', { source: 'auth', work_unit: 'pay', themes: [
      { ...themes[0], paragraph_count: 4, content_preview: 'The auth flow begins at the login form and hands a session to' },
    ] });
    const out = renderSurface(dir, 'legacy-split-display', { variant: 'plan', file });
    assert.ok(withoutCachePaths(out).includes([
      '   ├─ Content: 4 para(s) — "The auth flow begins at the login',
      '   │  form and hands a session to..."',
      '   └─ Cache: …',
    ].join('\n')), out);
    for (const line of out.split('\n').slice(1)) assert.ok(line.length <= 65, `overflowing row: ${line}`);
  });

  it('errors: the validator\'s lines as bullets under the source', () => {
    const file = writePayload(dir, 'errors.json', { source: 'auth', errors: [
      "theme 'auth' has empty summary",
      "theme 'caching' has no cache file at caching.md",
    ] });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'errors', file }), [
      '=== DISPLAY: legacy split errors (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Validation failed for auth:',
      '',
      "  • theme 'auth' has empty summary",
      "  • theme 'caching' has no cache file at caching.md",
      '',
    ].join('\n'));
  });

  it('refuses a missing or unknown variant, a missing or absent file, and a payload short of its variant\'s fields', () => {
    const bad = (name, variant, obj) => () => renderSurface(dir, 'legacy-split-display', { variant, file: writePayload(dir, name, obj) });
    assert.throws(() => renderSurface(dir, 'legacy-split-display', {}), /--variant must be one of sources, processing, complete, candidates, plan, errors, apply, got ""/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'themes' }), /--variant must be one of sources, processing, complete, candidates, plan, errors, apply, got "themes"/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'candidates' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'candidates', file: 'nope.json' }), /payload file not found: nope\.json/);
    assert.throws(bad('s.json', 'candidates', { themes }), /"source" must be a non-empty string/);
    assert.throws(bad('e.json', 'candidates', { source: 'auth', themes: [] }), /"themes" must be a non-empty array of \{kebab_name, summary\}/);
    assert.throws(bad('m.json', 'candidates', { source: 'auth', themes: [themes[0], { kebab_name: 'caching' }] }), /theme 2 is missing "summary"/);
    assert.throws(bad('w.json', 'plan', { source: 'auth', themes }), /"work_unit" must be a non-empty string/);
    assert.throws(bad('pe.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [] }), /"themes" must be a non-empty array of \{kebab_name, summary, content_preview, paragraph_count\}/);
    assert.throws(bad('pp.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: 1 }] }), /theme 1 is missing "content_preview"/);
    assert.throws(bad('pc.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: '3', content_preview: 'x' }] }), /theme 1 "paragraph_count" must be a non-negative integer/);
    assert.throws(bad('pn.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: -1, content_preview: 'x' }] }), /theme 1 "paragraph_count" must be a non-negative integer/);
    assert.throws(bad('ee.json', 'errors', { source: 'auth', errors: [] }), /"errors" must be a non-empty array of strings/);
    assert.throws(bad('eb.json', 'errors', { source: 'auth', errors: ['ok', ''] }), /errors\[1\] must be a non-empty string/);
  });

  // An epic whose map holds a qualifying source, one a crashed apply left
  // mid-split, one whose name the split cannot process, and two that do not
  // qualify — a parked research item, and a source whose file is gone.
  const legacyEpic = () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: {
          auth: { routing: 'research', source: 'migration-seeded' },
          'bad.name': { routing: 'research', source: 'migration-seeded' },
          billing: { routing: 'research', source: 'discovery', legacy_split_state: 'in-progress' },
          parked: { routing: 'research', source: 'migration-seeded' },
          vanished: { routing: 'research', source: 'migration-seeded' },
        } },
        research: { items: {
          auth: { status: 'in-progress' },
          'bad.name': { status: 'in-progress' },
          parked: { status: 'unstarted' },
          vanished: { status: 'in-progress' },
        } },
      },
    });
    for (const name of ['auth', 'bad.name', 'parked']) writePayload(dir, `.leeway/pay/research/${name}.md`, '# Research\n');
  };

  it('sources: the scan read from the epic — the interrupted splits, the unsplittable sources, then the qualifying files', () => {
    legacyEpic();
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'sources' }), [
      '=== DISPLAY: legacy split interrupted (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '  ⚑ Interrupted split(s) detected — a prior apply crashed',
      '    mid-flight.',
      '    Clear each, then reopen the epic via /workflow-start to',
      '    retry:',
      '',
      '    • billing',
      '',
      '    Per-item recovery is under "Recovery from Interrupted Apply"',
      '    at the end of this skill.',
      '',
      '=== DISPLAY: legacy split unsplittable (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '  ⚑ Unsplittable source(s) — rename each on the discovery map to',
      '    a kebab name, then reopen the epic to split:',
      '',
      '    • bad.name — name must match ^[a-z0-9][a-z0-9-]*$ (engine',
      '      dot-paths reject dots/slashes)',
      '',
      '=== DISPLAY: legacy split sources (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Qualifying source files (in-progress, migration-seeded):',
      '',
      '  • auth.md',
      '',
    ].join('\n'));
  });

  it('sources: each section stands only where the scan found its kind, and a scan that found nothing answers empty', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'research', source: 'migration-seeded' } } },
        research: { items: { auth: { status: 'in-progress' } } },
      },
    });
    writePayload(dir, '.leeway/pay/research/auth.md', '# Auth\n');
    const out = renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'sources' });
    assert.match(out, /^=== DISPLAY: legacy split sources /);
    assert.doesNotMatch(out, /interrupted|unsplittable/);

    writeManifest(dir, 'pay', { phases: { discovery: { items: { auth: { routing: 'research', source: 'discovery' } } } } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'sources' }), '');
  });

  it('processing: the sub-step a qualifying source opens on, and the signpost beneath it', () => {
    legacyEpic();
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'processing', source: 'auth' }), [
      '=== DISPLAY: legacy split processing (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**`▪ Processing auth`**',
      '',
      '> Working on auth.md.',
      '',
    ].join('\n'));
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'processing' }), /--source is required — the source the split takes up/);
  });

  describe('complete: the split\'s conclusion from the session\'s tallies, under its step marker', () => {
    const complete = (applied, abandoned, errored) => renderSurface(dir, 'legacy-split-display', {
      variant: 'complete', applied: String(applied), abandoned: String(abandoned), errored: String(errored),
    });
    const MARKER = '=== DISPLAY: legacy split complete (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===';
    const closing = (line) => [MARKER, '**`□ Legacy Split Complete`**', '', `> ${line}`, ''].join('\n');

    it('an aborted apply leads, whatever else the split did', () => {
      assert.strictEqual(complete(2, 1, 1), closing('1 source file(s) aborted mid-apply; 2 decomposed; 1 skipped. See "Recovery from Interrupted Apply" below to clear stuck sentinels before you reopen the epic via /workflow-start.'));
    });

    it('nothing done, everything decomposed, a mix, and everything skipped each close on their own line', () => {
      assert.strictEqual(complete(0, 0, 0), closing('No legacy source files needed decomposition.'));
      assert.strictEqual(complete(3, 0, 0), closing('Legacy broad research files decomposed. The discovery map now reflects topic-scoped items.'));
      assert.strictEqual(complete(2, 1, 0), closing('2 source file(s) decomposed; 1 skipped. Skipped files remain on the map and can be revisited next time you open the epic via /workflow-start.'));
      assert.strictEqual(complete(0, 2, 0), closing('No source files decomposed — every qualifying file was skipped. They remain on the map and can be revisited next time you open the epic via /workflow-start.'));
    });

    it('refuses a tally missing, negative, or not a whole number, by name', () => {
      assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'complete', abandoned: '0', errored: '0' }), /--applied must be a non-negative integer, got ""/);
      assert.throws(() => complete(1, -1, 0), /--abandoned must be a non-negative integer, got "-1"/);
      assert.throws(() => complete(1, 0, 1.5), /--errored must be a non-negative integer, got "1\.5"/);
    });
  });

  it('sources and processing refuse a non-bare address and an unknown unit; processing refuses a source the scan does not find qualifying', () => {
    legacyEpic();
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'pay.discovery.auth', variant: 'sources' }), /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'ghost', variant: 'sources' }), /work unit "ghost" not found/);
    for (const source of ['billing', 'bad.name', 'parked', 'vanished', 'ghost']) {
      assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'processing', source }),
        new RegExp(`"${source.replace('.', '\\.')}" is not a qualifying source of "pay" — the split works through the qualifying sources alone`));
    }
  });

  it('apply: a landed split names its themes; knowledge-base cleanup warnings follow as a markdown advisory', () => {
    const applied = '=== DISPLAY: legacy split applied (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===\nApplied auth: 3 new file(s).\n';
    const clean = writePayload(dir, 'apply.json', { source: 'auth', result: { ok: true, applied: { themes: 3 } } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: clean }), applied);
    const empty = writePayload(dir, 'apply-empty.json', { source: 'auth', result: { ok: true, applied: { themes: 3 }, kb_warnings: [] } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: empty }), applied);

    const warned = writePayload(dir, 'apply-warned.json', { source: 'auth', result: {
      ok: true, applied: { themes: 3 }, kb_warnings: ['knowledge remove (research/auth) failed: store_locked', 'chunk *42* left'],
    } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: warned }), [
      applied,
      '=== DISPLAY: legacy split kb warnings (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '> ⚑ Knowledge-base cleanup reported warnings:',
      '> - knowledge remove (research/auth) failed: store\\_locked',
      '> - chunk \\*42\\* left',
      '>',
      '> The next start brings the knowledge base up to date.',
      '',
    ].join('\n'));
  });

  it('apply: a failed split names the stage it stopped at, its error, and the recovery', () => {
    const file = writePayload(dir, 'apply.json', { source: 'auth', result: {
      ok: false,
      stage: 'rename_source_file',
      error: "ENOENT: no such file or directory, rename 'auth.md'",
      recovery_hint: 'source file rename failed. Clear sentinel manually: engine manifest delete pay.discovery.auth legacy_split_state',
    } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file }), [
      '=== DISPLAY: legacy split apply failed (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Apply failed for auth at stage "rename_source_file":',
      "  ENOENT: no such file or directory, rename 'auth.md'",
      '',
      'Recovery: source file rename failed. Clear sentinel manually:',
      'engine manifest delete pay.discovery.auth legacy_split_state',
      '',
    ].join('\n'));
  });

  it('apply: refuses a result that is not apply.cjs\'s answer — no ok, a landed split without its theme count or with blank warnings, a failure short of its stage, error or recovery', () => {
    const bad = (name, result) => () => renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: writePayload(dir, name, { source: 'auth', result }) });
    assert.throws(bad('a1.json', undefined), /"result" must be the JSON apply\.cjs answered, its "ok" a boolean/);
    assert.throws(bad('a2.json', { applied: { themes: 1 } }), /"result" must be the JSON apply\.cjs answered, its "ok" a boolean/);
    assert.throws(bad('a3.json', { ok: true }), /"result\.applied\.themes" must be a positive integer/);
    assert.throws(bad('a4.json', { ok: true, applied: { themes: 0 } }), /"result\.applied\.themes" must be a positive integer/);
    assert.throws(bad('a5.json', { ok: true, applied: { themes: 1 }, kb_warnings: ['ok', ' '] }), /"result\.kb_warnings" must be an array of non-empty strings when present/);
    assert.throws(bad('a6.json', { ok: true, applied: { themes: 1 }, kb_warnings: 'one' }), /"result\.kb_warnings" must be an array of non-empty strings when present/);
    for (const field of ['stage', 'error', 'recovery_hint']) {
      const result = { ok: false, stage: 'git_commit', error: 'hook failed', recovery_hint: 'commit by hand' };
      delete result[field];
      assert.throws(bad(`f-${field}.json`, result), new RegExp(`"result\\.${field}" must be a non-empty string — a failed apply names it`));
    }
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: writePayload(dir, 'ns.json', { result: { ok: true, applied: { themes: 1 } } }) }),
      /"source" must be a non-empty string/);
  });
});

describe('render map-op-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        discovery: {
          items: {
            'auth-flow': { routing: 'discussion', source: 'discovery' },
            'legacy-bits': { routing: 'research', source: 'discovery' },
            'dead-end': { routing: 'research', source: 'discovery', handled: true },
            'in-flight': { routing: 'discussion', source: 'discovery' },
            gone: { routing: 'discussion', source: 'discovery', cancelled: true },
            away: { routing: 'discussion', source: 'discovery', postponed: true },
          },
        },
        discussion: { items: { 'in-flight': { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  const render = (op, obj, name = 'op.json') => renderSurface(dir, 'map-op-gate', {
    dotpath: 'pay', op, file: writePayload(dir, name, obj),
  });

  it('renders the summary batch byte-exactly — one gate for the whole run', () => {
    const out = render('edit-summary', {
      items: [
        { name: 'auth-flow', summary: 'How sign-in survives a session drop' },
        { name: 'legacy-bits', summary: 'What the old importer still owns' },
      ],
    });
    assert.strictEqual(out, [
      '=== DISPLAY: map operation (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Updating 2 summary(ies):',
      '',
      '  • auth-flow: "How sign-in survives a session drop"',
      '  • legacy-bits: "What the old importer still owns"',
      '',
      "=== MENU: map operation gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Apply?`**',
      '',
      '**`y/yes`**',
      '**`n/no`**',
      '',
    ].join('\n'));
  });

  it('renders the remove proposal byte-exactly — body wrapped at the display width', () => {
    const out = render('remove', { name: 'auth-flow' });
    assert.strictEqual(out, [
      '=== DISPLAY: map operation (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Remove "auth-flow" from the map.',
      '',
      '  Lifecycle: fresh — no work has started on this topic.',
      '  The name will be added to the dismissed list so the analysis',
      "  won't auto-re-propose it.",
      '',
      "=== MENU: map operation gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Confirm removal?`**',
      '',
      '**`y/yes`**',
      '**`n/no`**',
      '',
    ].join('\n'));
  });

  it('each remaining op carries its own headline and confirm question', () => {
    const rename = render('rename', { name: 'auth-flow', new_name: 'sign-in-flow' });
    assert.match(rename, /Rename "auth-flow" → "sign-in-flow"\./);
    assert.match(rename, /no files exist under\n {2}this name\. Manifest mutation only\./);
    assert.match(rename, /`◆ Confirm rename\?`/);

    const reroute = render('reroute', { name: 'auth-flow', from: 'research', to: 'discussion' });
    assert.match(reroute, /Change routing of "auth-flow": research → discussion\./);
    assert.match(reroute.replace(/\n {2}/g, ' '), /Lifecycle: fresh — no work has started, so the routing hint is mutable\./);
    assert.match(reroute, /`◆ Confirm routing change\?`/);

    const close = render('close', { name: 'auth-flow' });
    assert.match(close, /Close "auth-flow" as a dead end\./);
    assert.match(close, /Reversible with "reopen auth-flow"\./);
    assert.match(close, /`◆ Confirm close as dead end\?`/);

    const reopen = render('reopen', { name: 'dead-end' });
    assert.match(reopen, /Reopen "dead-end"\./);
    assert.match(reopen, /Clears the dead-end marker\./);
    assert.match(reopen, /`◆ Confirm reopen\?`/);

    const descriptions = render('edit-description', { items: [{ name: 'auth-flow', description: 'A long one…' }] });
    assert.match(descriptions, /Updating 1 description\(s\):/);
    assert.match(descriptions, /`◆ Apply\?`/);
  });

  it('validates loudly — op vocabulary, payload shape, routing pair', () => {
    assert.throws(() => render('edit', { name: 'x' }), /--op must be one of edit-summary, edit-description, remove, rename, reroute, close, reopen/);
    assert.throws(() => renderSurface(dir, 'map-op-gate', { dotpath: 'pay', op: 'remove' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'map-op-gate', { dotpath: 'pay.discovery.auth-flow', op: 'remove', file: writePayload(dir, 'a.json', { name: 'x' }) }), /address must be a bare <work_unit>/);
    assert.throws(() => render('remove', {}), /"name" must be a non-empty string/);
    assert.throws(() => render('rename', { name: 'auth-flow' }), /"new_name" must be a non-empty string/);
    assert.throws(() => render('edit-summary', { items: [] }), /"items" must be a non-empty array of \{name, summary\}/);
    assert.throws(() => render('edit-summary', { items: [{ name: 'a' }] }), /item 1 is missing "summary"/);
    assert.throws(() => render('edit-description', { items: [{ description: 'd' }] }), /item 1 is missing "name"/);
    assert.throws(() => render('reroute', { name: 'auth-flow', from: 'planning', to: 'discussion' }), /"from" must be "research" or "discussion"/);
    assert.throws(() => render('reroute', { name: 'auth-flow', from: 'research', to: 'research' }), /name the same routing/);
  });

  it('refuses a name the map does not hold — every op, batch rows included', () => {
    for (const op of ['remove', 'close', 'reopen']) {
      assert.throws(() => render('' + op, { name: 'ghost' }, `${op}-ghost.json`), /render map-op-gate: no discovery item "ghost" on the map/);
    }
    assert.throws(() => render('rename', { name: 'ghost', new_name: 'spectre' }, 'rn.json'), /no discovery item "ghost" on the map/);
    assert.throws(() => render('reroute', { name: 'ghost', from: 'research', to: 'discussion' }, 'rr.json'), /no discovery item "ghost" on the map/);
    assert.throws(() => render('edit-summary', { items: [{ name: 'auth-flow', summary: 'a' }, { name: 'ghost', summary: 'b' }] }, 'es.json'),
      /no discovery item "ghost" on the map/);
    assert.throws(() => render('edit-description', { items: [{ name: 'ghost', description: 'd' }] }, 'ed.json'),
      /no discovery item "ghost" on the map/);
  });

  const REFUSED = '=== DISPLAY: map operation refused (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';
  // The refusal's one sentence, its display-width wrap undone.
  const refusal = (out) => {
    assert.ok(out.startsWith(`${REFUSED}\n`), out);
    assert.doesNotMatch(out, /MENU/, 'a refused op is never confirmed');
    return out.slice(REFUSED.length + 1).trimEnd().replace(/\n/g, ' ');
  };

  it('a destructive op its lifecycle forbids answers its refusal alone, wrapped — no menu, nothing to confirm', () => {
    assert.strictEqual(render('remove', { name: 'in-flight' }, 'r1.json'), [
      REFUSED,
      '"in-flight" can\'t be removed from the map — discussion is in',
      'flight on it. To stop work on it, use `a`/`cancel` from the epic',
      'menu instead — or postpone it to the roadmap for later.',
      '',
    ].join('\n'));
    assert.strictEqual(refusal(render('rename', { name: 'in-flight', new_name: 'x' }, 'r2.json')),
      '"in-flight" can\'t be renamed from the map — discussion is in flight on it. To stop work on it, use `a`/`cancel` from the epic menu instead — or postpone it to the roadmap for later.');
    assert.strictEqual(refusal(render('reroute', { name: 'in-flight', from: 'research', to: 'discussion' }, 'r3.json')),
      '"in-flight" can\'t be re-routed from the map — discussion is in flight on it. To stop work on it, use `a`/`cancel` from the epic menu instead — or postpone it to the roadmap for later.');
  });

  it('the destructive refusal names where the topic stands from its own state — a superseded research is never named completed', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: {
          researching: { routing: 'research', source: 'discovery' },
          queued: { routing: 'research', source: 'discovery' },
          superseded: { routing: 'research', source: 'discovery' },
          settled: { routing: 'discussion', source: 'discovery' },
        } },
        research: { items: {
          researching: { status: 'in-progress' },
          queued: { status: 'completed' },
          superseded: { status: 'superseded' },
        } },
        discussion: { items: { settled: { status: 'completed' } } },
      },
    });
    const phrase = (name) => refusal(render('remove', { name }, `${name}.json`)).match(/— (.*)\. To stop/)[1];
    assert.strictEqual(phrase('researching'), 'research is in flight on it');
    assert.strictEqual(phrase('queued'), 'research has completed and discussion is queued');
    assert.strictEqual(phrase('superseded'), 'its research was superseded and discussion is queued');
    assert.strictEqual(phrase('settled'), 'discussion has concluded');
  });

  it('a closed row names its way back on every destructive op — the reopen, the reactivate, the pull', () => {
    for (const [op, extra, verb] of [['remove', {}, 'removed'], ['rename', { new_name: 'x' }, 'renamed'], ['reroute', { from: 'discussion', to: 'research' }, 're-routed']]) {
      assert.strictEqual(refusal(render(op, { name: 'dead-end', ...extra }, `${op}-h.json`)),
        `"dead-end" can't be ${verb} from the map — it is closed as a dead end and stays on the map as record. Say "reopen dead-end" to make it actionable again.`);
      assert.strictEqual(refusal(render(op, { name: 'gone', ...extra }, `${op}-c.json`)),
        `"gone" can't be ${verb} from the map — it is cancelled and stays on the map as record. Reactivate it from the epic menu first.`);
      assert.strictEqual(refusal(render(op, { name: 'away', ...extra }, `${op}-p.json`)),
        `"away" can't be ${verb} from the map — it is postponed and waits on the roadmap. Pull it forward from the roadmap first.`);
    }
  });

  it('a marker op its lifecycle forbids answers the very refusal its transaction throws', () => {
    assert.strictEqual(render('close', { name: 'dead-end' }, 'm1.json'), `${REFUSED}\n"dead-end" can't be closed as a dead end — it's already closed.\n`);
    assert.strictEqual(refusal(render('close', { name: 'gone' }, 'm2.json')),
      '"gone" can\'t be closed as a dead end — it\'s cancelled; reactivate it from the epic menu first.');
    assert.strictEqual(refusal(render('close', { name: 'away' }, 'm3.json')),
      '"away" can\'t be closed as a dead end — it\'s postponed; pull it forward from the roadmap first.');
    assert.strictEqual(refusal(render('reopen', { name: 'auth-flow' }, 'm4.json')),
      '"auth-flow" can\'t be reopened — it isn\'t closed as a dead end, so there\'s nothing to reopen.');
    assert.strictEqual(refusal(render('reopen', { name: 'gone' }, 'm5.json')),
      '"gone" can\'t be reopened — it\'s cancelled; reactivate it from the epic menu first.');
    assert.strictEqual(refusal(render('reopen', { name: 'away' }, 'm6.json')),
      '"away" can\'t be reopened — it\'s postponed; pull it forward from the roadmap first.');
  });

  it('a close over messages waiting in the topic\'s mailbox is refused, naming each mailbox that holds them', () => {
    writePayload(dir, '.leeway/pay/research/.mailbox/auth-flow/001.md', 'a point\n');
    writePayload(dir, '.leeway/pay/discussion/.mailbox/auth-flow/001.md', 'another\n');
    assert.strictEqual(refusal(render('close', { name: 'auth-flow' }, 'w.json')),
      '"auth-flow" can\'t be closed as a dead end — messages wait in its research and discussion mailbox; start the topic to drain them, or cancel the topic from the epic menu instead.');
  });

  it('a cancelled topic refuses the close, and an edit rides any lifecycle', () => {
    assert.match(render('edit-summary', { items: [{ name: 'away', summary: 'Still editable' }] }, 'p6.json'),
      /Updating 1 summary\(ies\):/);
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { 'auth-flow': { routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'auth-flow': { status: 'cancelled' } } },
      },
    });
    assert.strictEqual(refusal(render('close', { name: 'auth-flow' }, 'c1.json')),
      '"auth-flow" can\'t be closed as a dead end — it\'s cancelled; reactivate it from the epic menu first.');
    assert.match(render('edit-summary', { items: [{ name: 'auth-flow', summary: 'Still editable' }] }, 'c2.json'),
      /Updating 1 summary\(ies\):/);
  });
});

describe('render dismissed-topics', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const withDismissed = (dismissed) => {
    writeManifest(dir, 'pay', { phases: { discovery: { dismissed } } });
    return renderSurface(dir, 'dismissed-topics', { dotpath: 'pay' });
  };

  it('the names removed from the map, then the re-add offer', () => {
    assert.strictEqual(withDismissed(['reporting', 'menu-management']), [
      '=== DISPLAY: dismissed topics (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Dismissed Topics',
      '',
      '  • reporting',
      '  • menu-management',
      '',
      "=== MENU: dismissed topics (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Re-add any of these to the map?`**',
      '',
      '**`b/back`**    → Return to the session',
      '**Name them** → Tell me which to re-add (and routing if known)',
      '',
    ].join('\n'));
  });

  it('one name renders one row — the offer is the same', () => {
    const out = withDismissed(['reporting']);
    assert.match(out, /Dismissed Topics\n\n {2}• reporting\n/);
    assert.match(out, /◆ Re-add any of these to the map\?/);
  });

  it('nothing dismissed answers the display alone — no menu, nothing to re-add', () => {
    const empty = [
      '=== DISPLAY: dismissed topics (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Dismissed Topics',
      '',
      '  (none)',
      '',
    ].join('\n');
    assert.strictEqual(withDismissed([]), empty);
    writeManifest(dir, 'pay', { phases: {} });
    assert.strictEqual(renderSurface(dir, 'dismissed-topics', { dotpath: 'pay' }), empty);
  });

  it('refuses a non-bare address and an unknown work unit', () => {
    assert.throws(() => renderSurface(dir, 'dismissed-topics', { dotpath: 'pay.discovery.auth' }),
      /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'dismissed-topics', { dotpath: 'ghost' }),
      /work unit "ghost" not found/);
  });
});

describe('render candidate-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  function staged(gateMode, status = 'pending') {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: {
          items: {},
          analysis_staging: {
            'discovery-gap-analysis': {
              gate_mode: gateMode,
              candidates: { 'signal-freshness-contract': { status } },
            },
          },
        },
      },
    });
  }

  const payload = {
    name: 'signal-freshness-contract',
    routing: 'discussion',
    summary: 'What freshness the ranking signals must guarantee downstream',
  };
  const render = (obj = payload, name = 'c.json') => renderSurface(dir, 'candidate-gate', {
    dotpath: 'pay', file: writePayload(dir, name, obj),
  });

  it('renders the gated candidate byte-exactly — display then the five-way gate', () => {
    staged('gated');
    assert.strictEqual(render(), [
      '=== DISPLAY: candidate (emit verbatim as a text code block (```text fence)) ===',
      'Signal Freshness Contract [discussion]',
      '  What freshness the ranking signals must guarantee downstream',
      '  surfaced by gap analysis',
      '',
      "=== MENU: candidate gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Add this topic to the map?`**',
      '',
      '**`y/yes`**      → Approve — the topic joins the map and its phase can',
      `${NB(13)}start from the epic menu`,
      '**`a/auto`**     → Approve this and all remaining candidates',
      `${NB(13)}automatically`,
      '**`s/skip`**     → Skip and dismiss — the analysis never re-proposes',
      `${NB(13)}this name`,
      '**`p/postpone`** → Postpone — the topic joins the map with its brief',
      `${NB(13)}and waits on the roadmap under a horizon you name`,
      '**Comment**    → Tell me what to change (routing, summary, or',
      `${NB(13)}description)`,
      '',
    ].join('\n'));
  });

  it('an auto gate mode renders the approval line and no menu — the branch is the surface\'s', () => {
    staged('auto');
    const out = render();
    assert.match(out, /=== DISPLAY: candidate \(/);
    assert.match(out, /=== DISPLAY: candidate approved \(emit verbatim as a text code block \(```text fence\) after recording the approval — /);
    assert.match(out, /Signal Freshness Contract — approved \[auto\]\./);
    assert.ok(!out.includes('MENU:'), 'auto never stops');
  });

  it('validates loudly — staging present, candidate pending, payload fields, gate mode', () => {
    staged('gated');
    assert.throws(() => renderSurface(dir, 'candidate-gate', { dotpath: 'pay' }), /--file <payload\.json> is required/);
    assert.throws(() => render({ ...payload, name: 'nope' }, 'n.json'), /"nope" is not a pending candidate — a stale payload never renders/);
    assert.throws(() => render({ ...payload, routing: 'planning' }, 'r.json'), /"routing" must be "research" or "discussion"/);
    assert.throws(() => render({ name: 'signal-freshness-contract', routing: 'discussion' }, 's.json'), /"summary" must be a non-empty string/);

    staged('gated', 'approved');
    assert.throws(() => render(), /is not a pending candidate/);

    staged('sometimes');
    assert.throws(() => render(), /gate_mode must be "gated" or "auto", got "sometimes"/);

    writeManifest(dir, 'bare', { phases: { discovery: { items: {} } } });
    assert.throws(() => renderSurface(dir, 'candidate-gate', { dotpath: 'bare', file: writePayload(dir, 'b.json', payload) }),
      /no staged gap-analysis candidates for "bare"/);
  });

  const ANNOUNCED = '=== DISPLAY: candidates announced (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';
  const announce = () => renderSurface(dir, 'candidate-gate', { dotpath: 'pay', variant: 'announce' });

  it('announce: counts the candidates the staging subtree marks pending — the decided ones never count', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { analysis_staging: { 'discovery-gap-analysis': {
        gate_mode: 'gated',
        candidates: { a: { status: 'pending' }, b: { status: 'approved' }, c: { status: 'pending' }, d: { status: 'skipped' } },
      } } } },
    });
    assert.strictEqual(announce(), `${ANNOUNCED}\nGap analysis surfaced 2 candidate topic(s).\n`);
  });

  it('announce: nothing new to review where none wait pending, or the analysis staged nothing', () => {
    staged('gated', 'approved');
    assert.strictEqual(announce(), `${ANNOUNCED}\nNothing new to review.\n`);
    writeManifest(dir, 'pay', { phases: { discovery: { items: {} } } });
    assert.strictEqual(announce(), `${ANNOUNCED}\nNothing new to review.\n`);
  });

  it('announce: refuses an unknown variant, a non-bare address and an unknown unit', () => {
    staged('gated');
    assert.throws(() => renderSurface(dir, 'candidate-gate', { dotpath: 'pay', variant: 'count' }),
      /--variant takes "announce" alone — the per-candidate gate takes none, got "count"/);
    assert.throws(() => renderSurface(dir, 'candidate-gate', { dotpath: 'pay.discovery.x', variant: 'announce' }), /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'candidate-gate', { dotpath: 'ghost', variant: 'announce' }), /work unit "ghost" not found/);
  });
});

describe('render send-closed-target', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        discovery: {
          items: {
            'auth-flow': { routing: 'discussion', source: 'discovery', handled: true },
            'legacy-bits': { routing: 'research', source: 'discovery' },
            live: { routing: 'research', source: 'discovery' },
          },
        },
        discussion: { items: { 'legacy-bits': { status: 'cancelled' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('renders the dead-end target byte-exactly — the statement, then the ask over three destinations', () => {
    assert.strictEqual(renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.auth-flow' }), [
      "=== MENU: closed target gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '"auth-flow" is closed as a dead end, so it won\'t pick up messages.',
      '',
      '**`◆ Where should the message go?`**',
      '',
      '**`o/open`**      → Reopen it and send the message there — it returns',
      `${NB(14)}to its name-matched lifecycle and counts as open`,
      `${NB(14)}again`,
      '**`e/elsewhere`** → Pick a different target',
      "**`d/drop`**      → Don't send it; it stays with the current topic",
      '',
    ].join('\n'));
  });

  it('a cancelled target flips both words the lifecycle owns', () => {
    const out = renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.legacy-bits' });
    assert.match(out, /"legacy-bits" is cancelled, so it won't pick up messages\./);
    assert.match(out, /\*\*`o\/open`\*\*\s+→ Reactivate it and send the message there — the/);
    assert.match(out, /topic returns to its previous state and counts as\n/);
    assert.match(out, /open again/);
  });

  it('refuses a live target, an unknown name, and a non-discovery address', () => {
    assert.throws(() => renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.live' }),
      /"live" is "fresh", not closed — the gate serves handled and cancelled targets/);
    assert.throws(() => renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.ghost' }),
      /no discovery item "ghost" on the map/);
    assert.throws(() => renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discussion.legacy-bits' }),
      /address must be <work_unit>\.discovery\.<target>, got phase "discussion"/);
  });
});

describe('render deep-dive-offer / in-flight-agents-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress' } } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('deep-dive-offer renders the statement then the ask byte-exactly — the question takes the glyph', () => {
    const file = writePayload(dir, 'd.json', { thread: 'How does the competitor rank a query it has never seen?' });
    assert.strictEqual(renderSurface(dir, 'deep-dive-offer', { dotpath: 'pay.research.checkout', file }), [
      "=== MENU: deep dive offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'A thread worth digging: How does the competitor rank a query it has never seen?',
      '',
      '**`◆ Send a deep dive after it while we keep going?`**',
      '',
      '**`y/yes`** → Dispatch a deep-dive agent',
      "**`n/no`**  → Skip, we'll cover it in conversation",
      '',
    ].join('\n'));
  });

  it('in-flight-agents-gate renders the wait/proceed pair byte-exactly — the statement, then the ask', () => {
    assert.strictEqual(renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout', count: '2' }), [
      "=== MENU: in-flight agents gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'There are still 2 background agents working.',
      '',
      '**`◆ Wait, or conclude now?`**',
      '',
      '**`w/wait`**    → Wait for results before concluding',
      '**`p/proceed`** → Conclude now (results will persist in cache for',
      `${NB(12)}reference)`,
      '',
    ].join('\n'));
  });

  it('a lone agent takes the singular — the count never reads "1 agents"', () => {
    assert.strictEqual(renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout', count: '1' }), [
      "=== MENU: in-flight agents gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'There is still 1 background agent working.',
      '',
      '**`◆ Wait, or conclude now?`**',
      '',
      '**`w/wait`**    → Wait for results before concluding',
      '**`p/proceed`** → Conclude now (results will persist in cache for',
      `${NB(12)}reference)`,
      '',
    ].join('\n'));
  });

  it('the in-flight gate serves discussion too — both phases dispatch and both conclude', () => {
    const out = renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.discussion.checkout', count: '2' });
    assert.match(out, /There are still 2 background agents working\./);
    assert.match(out, /\*\*`w\/wait`\*\*/);
  });

  it('a pause words the ask and both rows for the pause — the statement and the keys are the conclusion\'s', () => {
    assert.strictEqual(renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.discussion.checkout', count: '1', pause: '1' }), [
      "=== MENU: in-flight agents gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'There is still 1 background agent working.',
      '',
      '**`◆ Wait, or pause now?`**',
      '',
      '**`w/wait`**    → Wait for results before pausing',
      '**`p/proceed`** → Pause now (results will persist in cache for the next',
      `${NB(12)}session)`,
      '',
    ].join('\n'));
    assert.match(renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout', count: '3', pause: '1' }),
      /There are still 3 background agents working\.\n\n\*\*`◆ Wait, or pause now\?`\*\*/);
  });

  it('perspective-offer renders the tension statement then the ask byte-exactly — discussion only', () => {
    const file = writePayload(dir, 'p.json', { tension: 'Ship Now ↔ Strategic Timing' });
    assert.strictEqual(renderSurface(dir, 'perspective-offer', { dotpath: 'pay.discussion.checkout', file }), [
      "=== MENU: perspective offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'This decision sits on a Ship Now ↔ Strategic Timing tension.',
      '',
      '**`◆ Want to explore both lenses?`**',
      '',
      '**`y/yes`** → Spin up perspective agents arguing each lens',
      '**`n/no`**  → Continue without perspectives',
      '',
    ].join('\n'));
    assert.throws(() => renderSurface(dir, 'perspective-offer', { dotpath: 'pay.research.checkout', file }),
      /render perspective-offer: address must be <work_unit>\.discussion\.<topic>, got phase "research"/);
    assert.throws(() => renderSurface(dir, 'perspective-offer', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'perspective-offer', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, 'q.json', {}) }),
      /"tension" must be a non-empty string/);
  });

  it('both validate their own input; the deep dive stays research-only, the gate stays on the pair', () => {
    const file = writePayload(dir, 'd.json', { thread: 'x' });
    assert.throws(() => renderSurface(dir, 'deep-dive-offer', { dotpath: 'pay.discussion.checkout', file }),
      /render deep-dive-offer: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'deep-dive-offer', { dotpath: 'pay.research.checkout' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'deep-dive-offer', { dotpath: 'pay.research.checkout', file: writePayload(dir, 'e.json', {}) }),
      /"thread" must be a non-empty string/);
    assert.throws(() => renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.planning.checkout', count: '2' }),
      /render in-flight-agents-gate: address must be <work_unit>\.research\|discussion\.<topic>, got phase "planning"/);
    assert.throws(() => renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout' }),
      /--count must be a positive integer, got "undefined"/);
    assert.throws(() => renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout', count: '0' }),
      /--count must be a positive integer, got "0"/);
  });
});

describe('render — the adopted phase gates', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        discussion: { items: { checkout: { status: 'in-progress' } } },
        investigation: { items: { checkout: { status: 'in-progress' } } },
        implementation: { items: { checkout: { status: 'in-progress' } } },
        planning: {
          items: {
            checkout: {
              status: 'in-progress',
              external_dependencies: {
                'data-model': { description: 'the shared row shape', state: 'unresolved' },
                'auth-flow': { description: 'session tokens', state: 'resolved', internal_id: 'auth-1-2' },
              },
            },
          },
        },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('conclude-gate: one surface, the address\'s phase picking the wording', () => {
    assert.strictEqual(renderSurface(dir, 'conclude-gate', { dotpath: 'pay.discussion.checkout' }), [
      "=== MENU: conclude gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Conclude this discussion and mark as completed?`**',
      '',
      '**`y/yes`** → Conclude discussion',
      '**`n/no`**  → Continue discussing',
      '',
    ].join('\n'));

    const investigation = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.investigation.checkout' });
    assert.match(investigation, /`◆ Investigation complete\. Ready to conclude\?`/);
    assert.match(investigation, /\*\*`y\/yes`\*\*\s+→ Conclude investigation/);
    assert.match(investigation, /\*\*Keep going\*\* → Tell me what else to explore/);

    // Implementation and planning have hit their end — the arm beside yes is
    // an ask, never a way back.
    const implementation = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.implementation.checkout' });
    assert.strictEqual(implementation, [
      "=== MENU: conclude gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Ready to mark implementation as completed?`**',
      '',
      '**`y/yes`** → Mark as completed',
      "**Ask**   → Ask questions about the implementation (doesn't mark it",
      `${NB(8)}complete)`,
      '',
    ].join('\n'));
    assert.doesNotMatch(implementation, /`n\/no`/);

    const planning = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.planning.checkout' });
    assert.strictEqual(planning, [
      "=== MENU: conclude gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Ready to conclude?`**',
      '',
      '**`y/yes`** → Conclude plan and mark as completed',
      "**Ask**   → Ask questions about the plan (doesn't mark it complete)",
      '',
    ].join('\n'));
    assert.doesNotMatch(planning, /`n\/no`/);
  });

  it('conclude-gate: refuses a phase that concludes some other way', () => {
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.research.checkout' }),
      /phase must be one of discussion, investigation, implementation, planning, got "research"/);
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.planning' }),
      /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.implementation.ghost' }),
      /no implementation item "ghost" — nothing to conclude/);
  });

  it('closing-gate: the discussion close\'s five consents, variant-keyed', () => {
    const reReview = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 're-review' });
    assert.match(reReview, /MENU: re-review gate/);
    assert.match(unwrap(reReview), /The discussion has moved since the last review read it\. One more pass can catch what that movement opened — or conclude without one\./);
    assert.match(reReview, /`◆ Run one more review\?`/);
    assert.match(unwrap(reReview), /\*\*`y\/yes`\*\*\s+→ Run one more review before concluding/);
    assert.match(unwrap(reReview), /\*\*`n\/no`\*\*\s+→ Conclude without it — the movement stays unreviewed/);
    assert.doesNotMatch(unwrap(reReview), /final review/);
    assert.match(unwrap(reReview), /\*\*Keep going\*\* → Tell me what else to explore/);

    const owed = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'findings-owed' });
    assert.match(owed, /MENU: findings-owed gate/);
    assert.match(unwrap(owed), /Background findings have come back and are still to be walked — they must be heard before concluding\./);
    assert.match(owed, /`◆ Walk them now\?`/);
    assert.match(unwrap(owed), /\*\*`y\/yes`\*\*\s+→ Walk what came back/);

    // A review still in flight at the close: yes is the wait, never a
    // fresh dispatch — the surface must not read as "run another".
    const running = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'review-running' });
    assert.match(running, /MENU: review-running gate/);
    assert.match(unwrap(running), /A review is still running over this discussion — what it finds must be heard before concluding\. Nothing new is dispatched\./);
    assert.match(running, /`◆ Wait for it\?`/);
    assert.match(unwrap(running), /\*\*`y\/yes`\*\*\s+→ Wait for it and walk what it finds/);
    assert.doesNotMatch(unwrap(running), /[Rr]un the final review|final review/);
    assert.doesNotMatch(unwrap(running), /`n\/no`|`p\/proceed`/);
    assert.match(unwrap(running), /\*\*Keep going\*\* → Tell me what else to explore/);

    const finalReview = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'final-review' });
    assert.match(finalReview, /MENU: final-review gate/);
    assert.match(unwrap(finalReview), /Next: a final gap review before concluding — no review has run yet\./);
    assert.match(finalReview, /`◆ Proceed\?`/);
    assert.match(unwrap(finalReview), /\*\*`y\/yes`\*\*\s+→ Run the final review/);

    assert.strictEqual(renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'wrap-up' }), [
      "=== MENU: wrap-up gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      "I'll reconcile the document against our conversation, then confirm before marking complete.",
      '',
      '**`◆ Do you wish to conclude?`**',
      '',
      '**`y/yes`** → Conclude — begin wrap-up',
      '**`n/no`**  → Continue the conversation',
      '',
    ].join('\n'));
  });

  it('closing-gate: refuses out of place — wrong phase, unknown variant, a reason on any variant', () => {
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.research.checkout', variant: 'wrap-up' }),
      /address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs these gates; got phase "research"/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout' }),
      /--variant must be one of re-review, findings-owed, review-running, final-review, wrap-up, got ""/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'conclude' }),
      /--variant must be one of/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'final-review', reason: 'no review has run yet' }),
      /takes no --reason — every variant carries its own wording/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'review-running', reason: 'x' }),
      /takes no --reason/);
  });

  // A map whose rows are missing a summary (one drafted, one with no source
  // to draft from), a description alone, or nothing at all — the last never
  // part of the batch.
  const backfillMap = () => writeManifest(dir, 'pay', {
    phases: { discovery: { items: {
      'auth-flow': { routing: 'research', source: 'discovery', order: 1 },
      billing: { routing: 'discussion', source: 'discovery', order: 2, summary: 'How invoices are raised and settled' },
      'legacy-bits': { routing: 'discussion', source: 'discovery', order: 3 },
      settled: { routing: 'discussion', source: 'discovery', order: 4, summary: 'Whole', description: 'Whole' },
    } } },
  });
  const drafted = (summaries, name = 'summaries.json') => writePayload(dir, `.leeway/.cache/pay/discovery/${name}`, { summaries });
  const backfill = (variant, extra = {}) => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay', variant, ...extra });
  const PROPOSED_ROWS = [
    'Proposed summaries for 3 topic(s):',
    '',
    '  1. Auth Flow  (research)',
    '       How sign-in survives a dropped session and a token refresh',
    '       mid-request',
    '  2. Billing  (discussion)',
    '       How invoices are raised and settled  (already populated)',
    '  3. Legacy Bits  (discussion)',
    '       (source file missing — please provide)',
  ];
  const DRAFTS = { 'auth-flow': 'How sign-in survives a dropped session and a token refresh mid-request', 'legacy-bits': null };

  it('summary-backfill-gate: the batch — the rows missing a summary or description, read from the map, their drafts from the payload, above the accept gate', () => {
    backfillMap();
    assert.strictEqual(backfill('batch', { file: drafted(DRAFTS) }), [
      '=== DISPLAY: proposed summaries (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      ...PROPOSED_ROWS,
      '',
      "=== MENU: summary batch gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Accept these summaries?`**',
      '',
      '**`y/yes`**  → Accept all summaries as drafted (description is',
      `${NB(9)}auto-drafted silently)`,
      '**`e/edit`** → Edit one or more summary lines before accepting',
      '**`s/skip`** → Skip the whole batch (leave fields blank)',
      '',
    ].join('\n'));
  });

  it('summary-backfill-gate: proposed is the batch display alone, the edit loop\'s re-render — never a gate', () => {
    backfillMap();
    assert.strictEqual(backfill('proposed', { file: drafted(DRAFTS) }), [
      '=== DISPLAY: proposed summaries (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      ...PROPOSED_ROWS,
      '',
    ].join('\n'));
  });

  it('summary-backfill-gate: a populated summary\'s tag drops to its own line where the last line has no room for it', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { billing: { routing: 'discussion', source: 'discovery', summary: 'How invoices are raised, reconciled, and settled each month end' } } } },
    });
    assert.ok(backfill('proposed', { file: drafted({}) }).includes([
      '  1. Billing  (discussion)',
      '       How invoices are raised, reconciled, and settled each',
      '       month end  (already populated)',
    ].join('\n')));
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { billing: { routing: 'discussion', source: 'discovery', summary: 'How invoices are raised, reconciled, and settled monthly' } } } },
    });
    assert.ok(backfill('proposed', { file: drafted({}) }).includes([
      '       How invoices are raised, reconciled, and settled monthly',
      '       (already populated)',
    ].join('\n')));
  });

  it('summary-backfill-gate: the drafts are keyed by exactly the rows missing a summary, each a line or null', () => {
    backfillMap();
    assert.throws(() => backfill('batch'), /--file <payload\.json> is required — the drafted summaries/);
    assert.throws(() => backfill('batch', { file: writePayload(dir, 'x.json', { summaries: ['a'] }) }), /"summaries" must be an object keyed by topic name/);
    assert.throws(() => backfill('batch', { file: drafted({ 'auth-flow': 'a' }) }),
      /"summaries\.legacy-bits" must be its drafted line, or null where its source file is missing/);
    assert.throws(() => backfill('proposed', { file: drafted({ 'auth-flow': ' ', 'legacy-bits': null }) }),
      /"summaries\.auth-flow" must be its drafted line/);
    assert.throws(() => backfill('batch', { file: drafted({ ...DRAFTS, billing: 'b' }) }),
      /"billing" is not a topic missing its summary — only those take a drafted line/);
    assert.throws(() => backfill('batch', { file: drafted({ ...DRAFTS, ghost: 'g' }) }), /"ghost" is not a topic missing its summary/);
  });

  it('summary-backfill-gate: a map with nothing to backfill refuses every variant over it', () => {
    writeManifest(dir, 'pay', { phases: { discovery: { items: { settled: { routing: 'discussion', summary: 'Whole', description: 'Whole' } } } } });
    for (const variant of ['batch', 'proposed']) {
      assert.throws(() => backfill(variant, { file: drafted({}) }),
        /"pay" has no discovery item missing a summary or description — nothing to backfill/);
    }
  });

  it('summary-backfill-gate: the payload-named unsourced set', () => {
    const unsourced = renderSurface(dir, 'summary-backfill-gate', {
      dotpath: 'pay', variant: 'unsourced', file: writePayload(dir, 'u.json', { names: ['auth-flow', 'legacy-bits'] }),
    });
    assert.match(unsourced, /\n2 topic\(s\) have no source file to draft from:\n\n- Auth Flow\n- Legacy Bits\n\n\*\*`◆ How do you want to handle them\?`\*\*\n\n/);
    assert.match(unwrap(unsourced), /\*\*`p\/provide`\*\* → Tell me the summary for each and I'll write it/);
    assert.match(unwrap(unsourced), /\*\*`l\/leave`\*\*\s+→ Leave them unset; this flow re-offers next time/);
  });

  it('summary-backfill-gate: validates the variant, the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay' }),
      /--variant must be one of batch, proposed, unsourced, got ""/);
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay.discovery.x', variant: 'batch' }),
      /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay', variant: 'unsourced' }),
      /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', {
      dotpath: 'pay', variant: 'unsourced', file: writePayload(dir, 'u.json', { names: [] }),
    }), /"names" must be a non-empty array of topic names/);
  });

  it('external-dependency-gate: the blocking gate stands beneath the named set, the pick reads its descriptions from the plan', () => {
    const blocking = renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'blocking', blocking: 'auth-flow,data-model',
    });
    assert.strictEqual(blocking, [
      '=== DISPLAY: missing dependencies (emit verbatim as a text code block (```text fence)) ===',
      'Missing Dependencies',
      '',
      '  Data Model',
      '  ├─ the shared row shape',
      '  └─ No plan exists',
      '',
      '  Auth Flow',
      '  ├─ session tokens',
      '  └─ Waiting on auth-flow:auth-1-2',
      '',
      "=== MENU: blocking dependencies gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`s/satisfied`** → Mark a dependency as satisfied externally',
      '**`i/implement`** → Exit to implement blocking dependencies first',
      '',
    ].join('\n'), 'no-plan dependencies first, then those waiting on a task');

    const pick = renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'pick', blocking: 'data-model,auth-flow',
    });
    assert.strictEqual(pick, [
      "=== MENU: dependency pick (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which dependency has been satisfied?`**',
      '',
      '**`1`** → Data Model — the shared row shape',
      '**`2`** → Auth Flow — session tokens',
      '',
    ].join('\n'));
  });

  it('external-dependency-gate: a set of one leaves nothing to pick — the pick proceeds with it', () => {
    assert.strictEqual(renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'pick', blocking: 'data-model',
    }), [
      '=== DISPLAY: auto-select (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Automatically proceeding with "Data Model".',
      '',
    ].join('\n'));
  });

  it('external-dependency-gate: the exit is the terminal blocker over the plan', () => {
    assert.strictEqual(renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'exit', blocking: 'data-model,auth-flow',
    }), [
      '=== DISPLAY: entry blocker (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ "Checkout" is blocked until these dependencies are resolved',
      '',
      '=== DISPLAY: blocker guidance (emit verbatim as markdown (not a code block), then STOP — terminal condition) ===',
      '> Use /workflow-start to navigate to the blocking work.',
      '',
    ].join('\n'));
  });

  it('external-dependency-gate: refuses a foreign name, an empty set, a dependency that does not block and a non-planning address', () => {
    for (const variant of ['blocking', 'pick', 'exit']) {
      assert.throws(() => renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.planning.checkout', variant }),
        /--blocking <topic,topic,…> is required/);
    }
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'pick', blocking: 'ghost',
    }), /"ghost" is not an external dependency of "checkout"/);
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.implementation.checkout', variant: 'blocking' }),
      /address must be <work_unit>\.planning\.<topic>, got phase "implementation"/);
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.planning.checkout', variant: 'nope' }),
      /--variant must be "blocking", "pick" or "exit", got "nope"/);
    writeManifest(dir, 'pay', {
      phases: {
        planning: {
          items: {
            checkout: {
              status: 'in-progress',
              external_dependencies: {
                billing: { description: 'invoices', state: 'satisfied_externally' },
                reports: { description: 'the export', state: 'resolved' },
              },
            },
          },
        },
      },
    });
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'blocking', blocking: 'billing',
    }), /"billing" is satisfied_externally — only an unresolved or resolved dependency blocks/);
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'blocking', blocking: 'reports',
    }), /"reports" is resolved but names no internal_id/);
  });

  describe('checkpoint-files-gate: the dirty code read from git', () => {
    const { git, initRepo } = require('./engine-harness.cjs');
    const write = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    };
    const commit = (message, ...paths) => {
      git(dir, ['add', '--', ...paths]);
      git(dir, ['commit', '-q', '-m', message]);
    };
    beforeEach(() => {
      git(dir, ['init', '-q', '-b', 'main']);
      git(dir, ['config', 'user.email', 'test@example.com']);
      git(dir, ['config', 'user.name', 'Test']);
      git(dir, ['config', 'commit.gpgsign', 'false']);
      write('src/cart.js', '1');
      write('src/billing file.js', '1');
      write('README.md', '1');
      commit('impl(pay): Tcheckout-1-1 — the cart', 'src/cart.js', 'src/billing file.js');
      commit('docs: impl(pay): named mid-subject, not a task commit', 'README.md');
    });
    const checkpoint = () => renderSurface(dir, 'checkpoint-files-gate', { dotpath: 'pay.implementation.checkout' });

    it('names both sets in DATA, lists the unexpected files with their state, and asks what the commit carries', () => {
      write('src/cart.js', '2');
      write('src/billing file.js', '2');
      write('README.md', '2');
      write('scratch/notes.txt', 'x');
      write('.leeway/pay/implementation/checkout/notes.md', 'x');
      assert.strictEqual(checkpoint(), [
        '=== DATA (reason from this — never display or parse the sections below) ===',
        'implementation_files (2):',
        '  src/billing file.js',
        '  src/cart.js',
        'unexpected_files (2):',
        '  README.md',
        '  scratch/notes.txt',
        '',
        '=== DISPLAY: unexpected files (emit verbatim as a text code block (```text fence)) ===',
        'Pre-analysis checkpoint — unexpected files detected:',
        '- README.md (modified)',
        '- scratch/notes.txt (untracked)',
        '',
        "=== MENU: checkpoint files gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
        DOTS,
        '**`◆ Include unexpected files in the checkpoint commit?`**',
        '',
        '**`y/yes`**   → Include all',
        '**`s/skip`**  → Exclude unexpected files, commit only implementation',
        `${NB(10)}files`,
        '**Comment** → Specify which to include',
        '',
      ].join('\n'));
    });

    it('with nothing unexpected, the DATA alone — no display, no gate', () => {
      write('src/cart.js', '2');
      assert.strictEqual(checkpoint(), [
        '=== DATA (reason from this — never display or parse the sections below) ===',
        'implementation_files (1):',
        '  src/cart.js',
        'unexpected_files (0):',
        '',
      ].join('\n'));
    });

    it('refuses a non-implementation address', () => {
      assert.throws(() => renderSurface(dir, 'checkpoint-files-gate', { dotpath: 'pay.planning.checkout' }),
        /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/);
    });

    it('reads every repo in the project — a nested repo\'s file its own impl commit touched is an implementation file', () => {
      write('.gitignore', 'api/\n');
      commit('chore: the clone is its own repo', '.gitignore');
      const api = initRepo(path.join(dir, 'api'));
      write('api/src/routes.js', '1');
      git(api, ['add', '-A']);
      git(api, ['commit', '-q', '-m', 'init']);
      write('api/src/handler.js', '1');
      git(api, ['add', '-A']);
      git(api, ['commit', '-q', '-m', 'impl(pay): Tcheckout-1-2 — the handler']);
      initRepo(path.join(dir, 'fresh'));
      write('fresh/notes.txt', 'x');
      write('api/src/handler.js', '2');
      write('api/src/routes.js', '2');

      const out = checkpoint();

      assert.ok(out.startsWith([
        '=== DATA (reason from this — never display or parse the sections below) ===',
        'implementation_files (1):',
        '  api/src/handler.js',
        'unexpected_files (2):',
        '  api/src/routes.js',
        '  fresh/notes.txt',
        '',
      ].join('\n')), out);
      assert.match(out, /- api\/src\/routes\.js \(modified\)\n- fresh\/notes\.txt \(untracked\)\n/,
        'a repo with no commits yet is read too — its folder in the parent never is');
    });
  });

  it('executor-block-gate: a block renders the fork\'s sides recommended-first, a failure offers the retry', () => {
    const sides = writePayload(dir, 'sides.json', {
      options: ['Restore the order as paid, refund behind it', { summary: 'Keep the cancellation, return the payment', recommended: true }],
    });
    assert.strictEqual(renderSurface(dir, 'executor-block-gate', {
      dotpath: 'pay.implementation.checkout', result: 'blocked', file: sides,
    }), [
      "=== MENU: executor block gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which way?`**',
      '',
      '**`1`**       → Keep the cancellation, return the payment (recommended)',
      '**`2`**       → Restore the order as paid, refund behind it',
      "**Comment** → Ask about the options, or tell me what I've missed",
      '',
    ].join('\n'));

    assert.strictEqual(renderSurface(dir, 'executor-block-gate', {
      dotpath: 'pay.implementation.checkout', result: 'failed',
    }), [
      "=== MENU: executor block gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`r/retry`** → Run the executor again with the guidance above and',
      `${NB(10)}anything you add`,
      '**Comment** → Ask about the failure, or steer the next attempt',
      '',
    ].join('\n'));
  });

  it('executor-block-gate: the override line heads a block under auto or bounded, and the payload is validated', () => {
    const sides = writePayload(dir, 'sides.json', { options: ['A side', 'Another side'] });
    for (const mode of ['auto', 'bounded']) {
      writeManifest(dir, 'pay', { phases: { implementation: { items: { checkout: { status: 'in-progress', task_gate_mode: mode } } } } });
      const out = renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: sides });
      assert.ok(out.startsWith([
        "=== MENU: executor block gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
        DOTS,
        '**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.',
        '',
        '**`◆ Which way?`**',
      ].join('\n')), out);
      assert.match(unwrap(out), /\*\*`1`\*\*\s+→ A side\n\*\*`2`\*\*\s+→ Another side/);
    }
    writeManifest(dir, 'pay', { phases: { implementation: { items: { checkout: { status: 'in-progress', task_gate_mode: 'gated' } } } } });
    assert.ok(!renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: sides }).includes('Auto is on'));

    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked' }),
      /--file <sides\.json> is required with --result blocked/);
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'failed', file: sides }),
      /--file belongs to --result blocked/);
    const one = writePayload(dir, 'one.json', { options: ['Only one'] });
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: one }),
      /"options" must be an array of 2–4 sides/);
    const two = writePayload(dir, 'two.json', { options: [{ summary: 'A', recommended: true }, { summary: 'B', recommended: true }] });
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: two }),
      /at most one option may be recommended/);
    const bare = writePayload(dir, 'bare.json', { options: ['A', { recommended: true }] });
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: bare }),
      /options\[1\] must be a non-empty string or an object carrying "summary"/);
  });

  it('executor-block-gate: refuses a missing or unknown result, and a non-implementation address', () => {
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout' }),
      /--result must be one of blocked, failed, got "undefined"/);
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'needs-changes' }),
      /--result must be one of blocked, failed, got "needs-changes"/);
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.planning.checkout', result: 'failed' }),
      /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/);
  });

  // The grapher worked over the plan's authored tasks — three in task_map,
  // beside the phase key, which is no task.
  const graphed = (/** @type {Record<string, any>} */ extra = {}) => writeManifest(dir, 'pay', { phases: { planning: { items: {
    checkout: { status: 'in-progress', task_map: { 'checkout-1': 'p1', 'checkout-1-1': 'a', 'checkout-1-2': 'b', 'checkout-1-3': 'c' }, ...extra },
  } } } });

  it('dependency-approval-gate graph: the grapher\'s notes beneath the natural-order line, byte-stable', () => {
    graphed();
    const file = writePayload(dir, 'tg.json', { notes: 'Every task builds on the one before it.' });
    assert.strictEqual(renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'graph', file }), [
      '=== DISPLAY: task graph (emit verbatim as markdown (not a code block)) ===',
      "I've analyzed all 3 tasks and the natural execution order is already correct — no explicit dependencies or priorities are needed.",
      '',
      'Every task builds on the one before it.',
      '',
      "=== MENU: dependency approval gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Approve the dependency graph?`**',
      '',
      '**`y/yes`**                  → Proceed',
      '**Tell me what to change** → which priorities or dependencies to',
      `${NB(25)}adjust`,
      '',
    ].join('\n'));
    const blank = writePayload(dir, 'blank.json', { notes: ' ' });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'graph', file: blank }),
      /"notes" must be the grapher's notes, a non-empty string/);
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'graph' }),
      /--file <payload\.json> is required — the grapher's report/);
  });

  it('dependency-approval-gate updated-graph: the applied rows, counted, with notes only where given', () => {
    graphed();
    const file = writePayload(dir, 'tg.json', {
      dependencies: ['checkout-1-2 depends on checkout-1-1 — the wrapper exists first', 'checkout-1-3 depends on checkout-1-2 — it drops the wait'],
      priorities: ['checkout-1-1: 1 — everything waits on it'],
      notes: 'No isolated tasks.',
    });
    assert.strictEqual(renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'updated-graph', file }).split('=== MENU')[0], [
      '=== DISPLAY: task graph (emit verbatim as markdown (not a code block)) ===',
      "I've analyzed and applied dependencies and priorities across all 3 tasks:",
      '',
      '**Dependencies** (2 relationships):',
      '- checkout-1-2 depends on checkout-1-1 — the wrapper exists first',
      '- checkout-1-3 depends on checkout-1-2 — it drops the wait',
      '',
      '**Priorities**:',
      '- checkout-1-1: 1 — everything waits on it',
      '',
      'No isolated tasks.',
      '',
      '',
    ].join('\n'));
    const bare = writePayload(dir, 'bare.json', { dependencies: ['checkout-1-2 depends on checkout-1-1 — first'], priorities: [] });
    const out = renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'updated-graph', file: bare });
    assert.ok(out.includes('**Dependencies** (1 relationship):\n- checkout-1-2 depends on checkout-1-1 — first\n\n**Priorities**:\n\n=== MENU'), out);
    assert.match(out, /`◆ Approve the updated graph\?`/);

    const noRows = writePayload(dir, 'norows.json', { priorities: [] });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'updated-graph', file: noRows }),
      /"dependencies" must be an array of the grapher's dependencies rows, each a non-empty string/);
    const blankRow = writePayload(dir, 'blankrow.json', { dependencies: [], priorities: [''] });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'updated-graph', file: blankRow }),
      /"priorities" must be an array/);
    const blankNotes = writePayload(dir, 'blanknotes.json', { dependencies: [], priorities: [], notes: '' });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'updated-graph', file: blankNotes }),
      /"notes" must be a non-empty string when present/);
  });

  it('dependency-approval-gate graph variants refuse a plan with no authored task', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { checkout: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'tg.json', { notes: 'n' });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'graph', file }),
      /"checkout" has no authored tasks in task_map/);
  });

  it('dependency-approval-gate resolution: the plan\'s dependencies and every resolution onto its tasks, read off the planning items', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: {
      checkout: { status: 'in-progress', external_dependencies: {
        'data-model': { description: 'the shared row shape', state: 'unresolved' },
        'auth-flow': { description: 'session tokens', state: 'resolved', internal_id: 'auth-flow-1-2' },
        billing: { description: 'invoices', state: 'satisfied_externally' },
      } },
      'order-history': { status: 'in-progress', external_dependencies: { checkout: { description: 'the paid order', state: 'resolved', internal_id: 'checkout-2-1' } } },
      refunds: { status: 'in-progress', external_dependencies: { checkout: { description: 'the capture', state: 'unresolved' } } },
      'auth-flow': { status: 'completed' },
    } } } });
    assert.strictEqual(renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'resolution' }), [
      '=== DISPLAY: external dependencies (emit verbatim as a text code block (```text fence)) ===',
      'External Dependencies',
      '',
      '  Data Model (unresolved)',
      '',
      '  Auth Flow (resolved)',
      '  └─ auth-flow-1-2',
      '',
      '  Billing (satisfied_externally)',
      '',
      'Reverse resolutions:',
      '  Order History → Checkout:checkout-2-1',
      '',
      "=== MENU: dependency approval gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Approve the dependency resolution?`**',
      '',
      '**`y/yes`**                  → Proceed',
      '**Tell me what to change** → which resolutions to adjust or links to',
      `${NB(25)}add`,
      '',
    ].join('\n'));
  });

  it('dependency-approval-gate resolution: no reverse heading without a reverse resolution; a broken row and --file refuse', () => {
    const out = renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'resolution' });
    assert.ok(out.includes('  Data Model (unresolved)\n\n  Auth Flow (resolved)\n  └─ auth-1-2\n\n=== MENU'), out);
    assert.ok(!out.includes('Reverse resolutions'), out);
    const file = writePayload(dir, 'tg.json', { notes: 'n' });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'resolution', file }),
      /--file belongs to the graph variants/);
    writeManifest(dir, 'pay', { phases: { planning: { items: { checkout: { status: 'in-progress', external_dependencies: { x: { state: 'resolved' } } } } } } });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'resolution' }),
      /external dependency "x" is resolved but names no internal_id/);
    writeManifest(dir, 'pay', { phases: { planning: { items: { checkout: { status: 'in-progress', external_dependencies: { y: { description: 'd' } } } } } } });
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'resolution' }),
      /external dependency "y" carries no state/);
  });

  it('dependency-approval-gate: refuses an unknown variant and a non-planning address', () => {
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout' }),
      /--variant must be one of graph, updated-graph, resolution, got "undefined"/);
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.discussion.checkout', variant: 'graph' }),
      /address must be <work_unit>\.planning\.<topic>/);
  });

  it('task-count-gate: the two id lists aligned in one column above the retry/adjust stop, byte-stable', () => {
    const file = writePayload(dir, 'tc.json', {
      table: ['checkout-1-1', 'checkout-1-2', 'checkout-1-3', 'checkout-1-4', 'checkout-1-5'],
      detail: ['checkout-1-1'],
    });
    assert.strictEqual(renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout', file }), [
      '=== DISPLAY: task count mismatch (emit verbatim as a text code block (```text fence)) ===',
      'Task count mismatch persists after 2 authoring attempts.',
      '',
      'Planning file task table: 5 tasks — checkout-1-1, checkout-1-2,',
      '                          checkout-1-3, checkout-1-4,',
      '                          checkout-1-5',
      'Task detail file:         1 task — checkout-1-1',
      '',
      "=== MENU: task count gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      "**`◆ How would you like to proceed?`**",
      '',
      '**`r/retry`** → Re-invoke the author agent once more',
      '**Adjust**  → Tell me what to correct (the task table or the detail',
      `${NB(10)}file), and I'll apply it and re-validate`,
      '',
    ].join('\n'));
    const empty = writePayload(dir, 'empty.json', { table: ['checkout-1-1'], detail: [] });
    assert.ok(renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout', file: empty }).includes('Task detail file:         0 tasks — none'));
  });

  it('task-count-gate: refuses a missing payload, a malformed list, an empty table, and a non-planning address', () => {
    assert.throws(() => renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout' }), /--file <payload\.json> is required — the two lists of internal ids/);
    const noDetail = writePayload(dir, 'nd.json', { table: ['a'] });
    assert.throws(() => renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout', file: noDetail }), /"detail" must be an array of internal ids, each a non-empty string/);
    const blankId = writePayload(dir, 'bi.json', { table: [' '], detail: [] });
    assert.throws(() => renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout', file: blankId }), /"table" must be an array of internal ids/);
    const noTable = writePayload(dir, 'nt.json', { table: [], detail: ['a'] });
    assert.throws(() => renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout', file: noTable }), /"table" must name the planning file's tasks/);
    const file = writePayload(dir, 'tc.json', { table: ['a'], detail: [] });
    assert.throws(() => renderSurface(dir, 'task-count-gate', { dotpath: 'pay.implementation.checkout', file }),
      /address must be <work_unit>\.planning\.<topic>/);
  });

  it('plan-format-gate: names the project default, and refuses when none is set', () => {
    assert.throws(() => renderSurface(dir, 'plan-format-gate', {}),
      /no project default plan_format — the offer only renders over an existing default/);
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'),
      JSON.stringify({ work_units: { pay: {} }, defaults: { plan_format: 'local-markdown' } }));
    assert.strictEqual(renderSurface(dir, 'plan-format-gate', {}), [
      "=== MENU: plan format gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Project default format is **local-markdown**.',
      '',
      '**`◆ Use the same format?`**',
      '',
      '**`y/yes`** → Use local-markdown',
      '**`n/no`**  → See all available formats',
      '',
    ].join('\n'));
  });

  it('plan-format-gate --variant select: numbers the payload\'s rows, and never names a format itself', () => {
    const file = writePayload(dir, 'formats.json', {
      formats: [
        { name: 'alpha', label: 'Alpha — the first sample format, with a long enough label that the surface has to wrap it under the label column.' },
        { name: 'beta', label: 'Beta — the second.' },
      ],
    });
    assert.strictEqual(renderSurface(dir, 'plan-format-gate', { variant: 'select', file }), [
      "=== MENU: plan format select (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which output format?`**',
      '',
      '**`1`** → Alpha — the first sample format, with a long enough label',
      `${NB(4)}that the surface has to wrap it under the label column.`,
      '**`2`** → Beta — the second.',
      '',
    ].join('\n'));
  });

  it('plan-format-gate: refuses an unknown variant, a missing payload, and a row without a name or label', () => {
    assert.throws(() => renderSurface(dir, 'plan-format-gate', { variant: 'all' }),
      /--variant must be select, got "all"/);
    assert.throws(() => renderSurface(dir, 'plan-format-gate', { variant: 'select' }),
      /--variant select requires --file <payload\.json>/);
    const empty = writePayload(dir, 'empty.json', { formats: [] });
    assert.throws(() => renderSurface(dir, 'plan-format-gate', { variant: 'select', file: empty }),
      /"formats" must be a non-empty array of \{name, label\}/);
    const nameless = writePayload(dir, 'nameless.json', { formats: [{ label: 'Alpha — no name' }] });
    assert.throws(() => renderSurface(dir, 'plan-format-gate', { variant: 'select', file: nameless }),
      /every format needs a non-empty "name" and "label"/);
    const labelless = writePayload(dir, 'labelless.json', { formats: [{ name: 'alpha' }] });
    assert.throws(() => renderSurface(dir, 'plan-format-gate', { variant: 'select', file: labelless }),
      /every format needs a non-empty "name" and "label"/);
  });

  it('plan-review-gate: the loop\'s two gates, spec-review-gate\'s sibling', () => {
    const cont = renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout', variant: 'continue' });
    assert.match(cont, /MENU: plan review continue gate/);
    assert.match(cont, /`◆ Continue with review\?`/);
    assert.match(cont, /\*\*`y\/yes`\*\*\s+→ Continue review/);
    assert.match(cont, /\*\*`s\/skip`\*\*\s+→ Skip review, proceed to completion/);

    const reloop = renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout', variant: 'reloop' });
    assert.match(reloop, /MENU: plan review reloop gate/);
    assert.match(reloop, /`◆ Run another review round\?`/);
    assert.match(unwrap(reloop), /\*\*`y\/yes`\*\*\s+→ Run another round \(traceability \+ integrity\)/);
    assert.match(reloop, /\*\*`p\/proceed`\*\*\s+→ Proceed to conclusion/);

    assert.throws(() => renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout' }),
      /--variant must be "continue" or "reloop"/);
    assert.throws(() => renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.discussion.checkout', variant: 'continue' }),
      /address must be <work_unit>\.planning\.<topic>/);
  });

  it('correction-gate: derives the spec path, and serves completed units only', () => {
    writeManifest(dir, 'done', {
      work_type: 'feature',
      status: 'completed',
      phases: { specification: { items: { done: { status: 'completed' } } } },
    });
    const out = renderSurface(dir, 'correction-gate', { dotpath: 'done.specification.done' });
    assert.strictEqual(out, [
      "=== MENU: correction gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      `Correcting ${dir}/.leeway/done/specification/done/specification.md.`,
      '',
      '**`◆ Apply the correction protocol?`**',
      '',
      '**`y/yes`**  → Edit in place + corrigendum + knowledge re-index',
      '**`v/view`** → Show the full correction list',
      '**`n/no`**   → Leave the specification as-is',
      '',
    ].join('\n'));

    assert.throws(() => renderSurface(dir, 'correction-gate', { dotpath: 'pay.specification.checkout' }),
      /"pay" is "in-progress" — the corrigendum protocol serves completed work units/);
    assert.throws(() => renderSurface(dir, 'correction-gate', { dotpath: 'done.discussion.done' }),
      /address must be <work_unit>\.specification\.<topic>, got phase "discussion"/);
  });

  it('analysis-proceed-gate: the signpost, then the bare y/n consent before the grouping analysis', () => {
    assert.strictEqual(renderSurface(dir, 'analysis-proceed-gate', { dotpath: 'pay' }), [
      '=== DISPLAY: analysis prompt (emit verbatim as markdown (not a code block)) ===',
      '> Your discussions will be analyzed for natural groupings, each one a proposed specification you can start when ready. Results are cached and reused until discussions change.',
      '',
      "=== MENU: analysis proceed gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Proceed with analysis?`**',
      '',
      '**`y/yes`**',
      '**`n/no`**',
      '',
    ].join('\n'));
    assert.throws(() => renderSurface(dir, 'analysis-proceed-gate', { dotpath: 'pay.specification.checkout' }),
      /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'analysis-proceed-gate', { dotpath: 'ghost' }),
      /work unit "ghost" not found/);
  });

  it('analysis-proceed-gate: says first that the analysis is outdated where the discussions moved since it ran, and only then', () => {
    writeManifest(dir, 'moved', { phases: { discussion: { analysis_cache: { checksum: 'from-before', generated: '2026-01-01' }, items: { auth: { status: 'completed' } } } } });
    writePayload(dir, '.leeway/moved/discussion/auth.md', '# Auth\n');
    assert.match(renderSurface(dir, 'analysis-proceed-gate', { dotpath: 'moved' }),
      /\n> Analysis outdated — discussions have changed since the last grouping analysis\. Your discussions will be analyzed for natural groupings/);
    writeManifest(dir, 'never', { phases: { discussion: { items: { auth: { status: 'completed' } } } } });
    writePayload(dir, '.leeway/never/discussion/auth.md', '# Auth\n');
    assert.match(renderSurface(dir, 'analysis-proceed-gate', { dotpath: 'never' }), /\n> Your discussions will be analyzed/,
      'no analysis yet is not an outdated one');
  });
});

describe('render change-set-tree', () => {
  const { git, initRepo, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => cleanupFixture(dir));

  it('is empty while the code tree is clean — the review\'s own artifacts sit uncommitted in the state', () => {
    writePayload(dir, '.leeway/pay/review/checkout/change-set-c1-auth.md', '# Section\n');
    assert.strictEqual(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }), '');
  });

  it('names every modified or untracked path in the code tree in the terminal blocker', () => {
    writePayload(dir, 'src/probe.js', 'x\n');
    writePayload(dir, 'notes.txt', 'y\n');
    assert.strictEqual(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }), [
      '=== DISPLAY: entry blocker (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The change-set verification left the working tree dirty',
      '',
      '=== DISPLAY: blocker guidance (emit verbatim as markdown (not a code block), then STOP — terminal condition) ===',
      '> The pass must leave the tree as it found it — these paths are modified or untracked: `notes.txt`, `src/probe.js`. Once the tree is clean, re-enter the review; it resumes at this step, keeping the section files already written.',
      '',
    ].join('\n'));
  });

  it('refuses an address outside the review', () => {
    assert.throws(() => renderSurface(dir, 'change-set-tree', { dotpath: 'pay.implementation.checkout' }),
      /address must be <work_unit>\.<review>\.<topic>/);
  });

  it('reads every repo in the project — a nested repo\'s change blocks, its folder in the parent never does', () => {
    const web = initRepo(path.join(dir, 'web'));
    writePayload(dir, 'web/index.js', 'x\n');
    git(web, ['add', '-A']);
    git(web, ['commit', '-q', '-m', 'init']);
    assert.strictEqual(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }), '',
      'a clean nested repo is no dirt, though the parent\'s git names its folder');

    writePayload(dir, 'web/index.js', 'y\n');
    assert.match(renderSurface(dir, 'change-set-tree', { dotpath: 'pay.review.checkout' }),
      /these paths are modified or untracked: `web\/index\.js`\. Once the tree is clean/);
  });

  it('in a project nested in a larger repository, reads only the project\'s own folder of it', () => {
    const repo = setupGitFixture('render-nested-');
    try {
      const project = path.join(repo, 'apps/web');
      fs.mkdirSync(project, { recursive: true });
      writeManifest(repo, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
      writePayload(repo, 'other/x.js', 'x\n');
      git(repo, ['add', '-A']);
      git(repo, ['commit', '-q', '-m', 'init']);
      writePayload(repo, 'other/x.js', 'y\n');
      writePayload(repo, '.leeway/pay/review/checkout/change-set-c1-auth.md', '# Section\n');
      assert.strictEqual(renderSurface(project, 'change-set-tree', { dotpath: 'pay.review.checkout' }), '',
        'a sibling folder\'s dirt and the repository\'s state are not the project\'s code');

      writePayload(project, 'src/probe.js', 'x\n');
      assert.match(renderSurface(project, 'change-set-tree', { dotpath: 'pay.review.checkout' }),
        /these paths are modified or untracked: `src\/probe\.js`\. Once the tree is clean/);
    } finally {
      cleanupFixture(repo);
    }
  });
});

describe('render plan-context-gate', () => {
  let dir;
  const dot = 'checkout.planning.checkout';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'checkout', { work_type: 'feature' });
  });
  afterEach(() => teardown(dir));

  it('offers the specification as-is beside the chance to add what changed', () => {
    assert.strictEqual(renderSurface(dir, 'plan-context-gate', { dotpath: dot }), [
      "=== MENU: plan context gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Any new context since the specification was completed?`**',
      '',
      '**`c/continue`**  → Continue with the specification as-is',
      '**Add context** → Tell me the priorities, constraints, or new',
      `${NB(14)}considerations`,
      '',
    ].join('\n'));
  });

  it('refuses another phase, an unknown unit, and a plan already under way', () => {
    assert.throws(() => renderSurface(dir, 'plan-context-gate', { dotpath: 'checkout.specification.checkout' }),
      /address must be <work_unit>\.planning\.<topic>, got phase "specification"/);
    assert.throws(() => renderSurface(dir, 'plan-context-gate', { dotpath: 'ghost.planning.checkout' }),
      /work unit "ghost" not found/);
    writeManifest(dir, 'checkout', {
      work_type: 'feature',
      phases: { planning: { items: { checkout: { status: 'in-progress' } } } },
    });
    assert.throws(() => renderSurface(dir, 'plan-context-gate', { dotpath: dot }),
      /planning item "checkout" is in-progress — the context offer opens a fresh plan/);
  });

  it('a planning item restored to never-attempted still opens the offer', () => {
    writeManifest(dir, 'checkout', {
      work_type: 'feature',
      phases: { planning: { items: { checkout: { status: null } } } },
    });
    assert.match(renderSurface(dir, 'plan-context-gate', { dotpath: dot }),
      /◆ Any new context since the specification was completed\?/);
  });
});

describe('render cross-cutting-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'cache-policy', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'cache-policy': { status: 'in-progress' } } } },
    });
  });
  afterEach(() => teardown(dir));

  it('names the specs the payload judged relevant, above the continue-or-stop ask', () => {
    writeManifest(dir, 'error-shape', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'error-shape': { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'units.json', { units: ['cache-policy', 'error-shape'] });
    assert.strictEqual(renderSurface(dir, 'cross-cutting-gate', { file }), [
      '=== DISPLAY: cross-cutting in progress (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Cross-cutting specifications still in progress:',
      '  These may contain architectural decisions relevant to this',
      '  plan.',
      '',
      '  • cache-policy',
      '  • error-shape',
      '',
      "=== MENU: cross-cutting gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Proceed without these, or complete them first?`**',
      '',
      '**`c/continue`** → Plan without them',
      '**`s/stop`**     → Complete them first',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload, an empty or malformed list, and a name the record does not hold', () => {
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', {}),
      /--file <payload\.json> is required/);
    const empty = writePayload(dir, 'empty.json', { units: [] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file: empty }),
      /"units" is empty — the gate renders over the specs this plan must know about/);
    const wrong = writePayload(dir, 'wrong.json', { units: 'cache-policy' });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file: wrong }),
      /"units" must be an array of strings/);
    const ghost = writePayload(dir, 'ghost.json', { units: ['ghost'] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file: ghost }),
      /"ghost" is not a cross-cutting work unit with a specification in progress/);
  });

  it('refuses a finished cross-cutting spec and a unit of another type', () => {
    const file = writePayload(dir, 'units.json', { units: ['cache-policy'] });
    writeManifest(dir, 'cache-policy', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'cache-policy': { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file }),
      /"cache-policy" is not a cross-cutting work unit with a specification in progress/);
    writeManifest(dir, 'cache-policy', {
      work_type: 'feature',
      phases: { specification: { items: { 'cache-policy': { status: 'in-progress' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-gate', { file }),
      /"cache-policy" is not a cross-cutting work unit with a specification in progress/);
  });
});

describe('render cross-cutting-references', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    for (const name of ['cache-policy', 'error-shape']) {
      writeManifest(dir, name, {
        work_type: 'cross-cutting',
        status: 'completed',
        phases: { specification: { items: { [name]: { status: 'completed' } } } },
      });
    }
  });
  afterEach(() => teardown(dir));

  it('lists each spec the payload judged relevant with its summary, wrapped under the text', () => {
    const file = writePayload(dir, 'refs.json', {
      units: [
        { name: 'cache-policy', summary: 'Reads go through a per-request cache keyed by tenant; writes invalidate the key they touch.' },
        { name: 'error-shape', summary: 'One error envelope.' },
      ],
    });
    assert.strictEqual(renderSurface(dir, 'cross-cutting-references', { file }), [
      '=== DISPLAY: cross-cutting references (emit verbatim as a text code block (```text fence)) ===',
      'Cross-cutting specifications to reference:',
      '  • cache-policy: Reads go through a per-request cache keyed by',
      '    tenant; writes invalidate the key they touch.',
      '  • error-shape: One error envelope.',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload, an empty or malformed list, and a row without a name or summary', () => {
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', {}),
      /--file <payload\.json> is required/);
    const empty = writePayload(dir, 'empty.json', { units: [] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: empty }),
      /"units" must be a non-empty array of \{name, summary\}/);
    const flat = writePayload(dir, 'flat.json', { units: ['cache-policy'] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: flat }),
      /every unit needs a non-empty "name" and "summary"/);
    const summaryless = writePayload(dir, 'summaryless.json', { units: [{ name: 'cache-policy', summary: ' ' }] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: summaryless }),
      /every unit needs a non-empty "name" and "summary"/);
  });

  it('refuses a name the record does not hold, a spec still being written, and a unit of another type', () => {
    const ghost = writePayload(dir, 'ghost.json', { units: [{ name: 'ghost', summary: 'Nothing.' }] });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file: ghost }),
      /"ghost" is not a cross-cutting work unit with a completed specification/);
    const file = writePayload(dir, 'refs.json', { units: [{ name: 'cache-policy', summary: 'Per-request cache.' }] });
    writeManifest(dir, 'cache-policy', {
      work_type: 'cross-cutting',
      phases: { specification: { items: { 'cache-policy': { status: 'in-progress' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file }),
      /"cache-policy" is not a cross-cutting work unit with a completed specification/);
    writeManifest(dir, 'cache-policy', {
      work_type: 'feature',
      phases: { specification: { items: { 'cache-policy': { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'cross-cutting-references', { file }),
      /"cache-policy" is not a cross-cutting work unit with a completed specification/);
  });
});

describe('render scoping-questions', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'support-email', { work_type: 'quick-fix' });
    writeManifest(dir, 'billing', { work_type: 'feature' });
  });
  afterEach(() => teardown(dir));

  it('asks the four scoping questions in their fixed order, an ask that ends the turn', () => {
    assert.strictEqual(renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: 'exclusions,why,where,what' }), [
      "=== DISPLAY: scoping questions (emit verbatim as a text code block (```text fence), then STOP for the user's response) ===",
      'Scoping: Support Email',
      '',
      'A few questions to scope this change:',
      '',
      '- What exactly is being changed? (pattern, syntax, API)',
      '- Where in the codebase? (files, directories, packages)',
      '- Why? (deprecation, consistency, modernisation)',
      '- Any exceptions or areas to exclude?',
      '',
    ].join('\n'));
  });

  it('asks only the questions the carrier leaves open', () => {
    const out = renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: 'where, exclusions' });
    assert.match(out, /A few questions to scope this change:\n\n- Where in the codebase\? \(files, directories, packages\)\n- Any exceptions or areas to exclude\?\n$/);
    assert.doesNotMatch(out, /What exactly|Why\?/);
  });

  it('scoping-questions refuses no open question, an unknown key, and a unit that is not a quick-fix', () => {
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email' }), /--open <what,where,why,exclusions> is required/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: ' , ' }), /--open <what,where,why,exclusions> is required/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email', open: 'what,how' }), /unknown question "how" — one of what, where, why, exclusions/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'billing', open: 'what' }), /"billing" is a feature — scoping is the quick-fix's own/);
    assert.throws(() => renderSurface(dir, 'scoping-questions', { dotpath: 'support-email.scoping.support-email', open: 'what' }), /address must be a bare <work_unit>/);
  });
});

describe('render complexity-gate / first-phase-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'support-email', { work_type: 'quick-fix' });
  });
  afterEach(() => teardown(dir));

  it('names the criteria the payload judged failed, above the continue-or-promote ask', () => {
    const file = writePayload(dir, 'concerns.json', {
      concerns: ['Requires design decisions about the new API surface', 'Three call sites need new behaviour'],
    });
    assert.strictEqual(renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file }), [
      '=== DISPLAY: complexity check (emit verbatim as a text code block (```text fence), directly above the menu) ===',
      'Complexity Check',
      '',
      'This change may be more involved than a quick-fix:',
      '',
      '  • Requires design decisions about the new API surface',
      '  • Three call sites need new behaviour',
      '',
      "=== MENU: complexity gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`c/continue`** → Continue as quick-fix anyway',
      '**`f/feature`**  → Promote to feature (full pipeline)',
      '**`b/bugfix`**   → Promote to bugfix (investigation pipeline)',
      '',
    ].join('\n'));
  });

  it('complexity-gate refuses a missing payload, an empty or malformed list, and a unit already promoted', () => {
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email' }),
      /--file <payload\.json> is required/);
    const empty = writePayload(dir, 'empty.json', { concerns: [] });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file: empty }),
      /"concerns" must be a non-empty array of non-empty strings/);
    const blank = writePayload(dir, 'blank.json', { concerns: ['  '] });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file: blank }),
      /"concerns" must be a non-empty array of non-empty strings/);
    const wrong = writePayload(dir, 'wrong.json', { concerns: 'too big' });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file: wrong }),
      /"concerns" must be an array of strings/);
    writeManifest(dir, 'support-email', { work_type: 'feature' });
    const file = writePayload(dir, 'concerns.json', { concerns: ['Requires design decisions'] });
    assert.throws(() => renderSurface(dir, 'complexity-gate', { dotpath: 'support-email', file }),
      /"support-email" is a feature — the complexity check is the quick-fix's own/);
  });

  it('first-phase-gate carries the read as a statement above its question and the two routes', () => {
    writeManifest(dir, 'support-email', { work_type: 'feature' });
    const file = writePayload(dir, 'read.json', { read: "The concern is an open unknown — I'd start with research." });
    assert.strictEqual(renderSurface(dir, 'first-phase-gate', { dotpath: 'support-email', file }), [
      "=== MENU: first phase gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      "The concern is an open unknown — I'd start with research.",
      '',
      '**`◆ Which phase first?`**',
      '',
      '**`r/research`**   → Explore feasibility and options first, no',
      `${NB(15)}decisions yet`,
      '**`d/discussion`** → Ready to discuss and make decisions',
      '',
    ].join('\n'));
  });

  it('first-phase-gate refuses a fixed-first-phase type, a missing payload, and a read that is not one line', () => {
    const file = writePayload(dir, 'read.json', { read: 'The shape is clear.' });
    assert.throws(() => renderSurface(dir, 'first-phase-gate', { dotpath: 'support-email', file }),
      /a quick-fix has a fixed first phase — the choice belongs to feature and cross-cutting work/);
    writeManifest(dir, 'support-email', { work_type: 'cross-cutting' });
    assert.ok(renderSurface(dir, 'first-phase-gate', { dotpath: 'support-email', file }).includes('The shape is clear.'));
    assert.throws(() => renderSurface(dir, 'first-phase-gate', { dotpath: 'support-email' }),
      /--file <payload\.json> is required/);
    const blank = writePayload(dir, 'blank.json', { read: '' });
    assert.throws(() => renderSurface(dir, 'first-phase-gate', { dotpath: 'support-email', file: blank }),
      /"read" must be a non-empty string/);
    const split = writePayload(dir, 'split.json', { read: 'The shape is clear.\nI would discuss it.' });
    assert.throws(() => renderSurface(dir, 'first-phase-gate', { dotpath: 'support-email', file: split }),
      /"read" must be a single line — it becomes the menu's statement label/);
  });
});

describe('render spec-confirm-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const DISPLAY_HEAD = '=== DISPLAY: spec confirmation (emit verbatim as a text code block (```text fence), directly above the menu) ===';
  const MENU_HEAD = "=== MENU: spec confirm gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===";
  const ASK = [DOTS, '**`◆ Proceed?`**', '', '**`y/yes`**', '**`n/no`**', ''];
  const completed = { status: 'completed' };
  const unit = (specification, discussion = { 'auth-flow': completed, billing: completed, refunds: completed }) =>
    writeManifest(dir, 'pay', { phases: { discussion: { items: discussion }, specification: { items: specification } } });
  const render = (topic) => renderSurface(dir, 'spec-confirm-gate', { dotpath: `pay.specification.${topic}` });
  const single = (topic) => renderSurface(dir, 'spec-confirm-gate', { dotpath: `pay.specification.${topic}`, single: '1' });
  const unify = (topic) => renderSurface(dir, 'spec-confirm-gate', { dotpath: `pay.specification.${topic}`, unify: '1' });

  it('a start that incorporates a started specification: the covered source marked, the supersession', () => {
    unit({
      payments: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } },
      'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } },
    });
    assert.strictEqual(render('payments'), [
      DISPLAY_HEAD,
      'Creating specification: Payments',
      '',
      'Sources:',
      '  • auth-flow (has individual spec — will be incorporated)',
      '  • billing',
      '',
      `Output: ${dir}/.leeway/pay/specification/payments/specification.md`,
      '',
      'After completion:',
      `  ${dir}/.leeway/pay/specification/auth-flow/specification.md → marked as superseded`,
      '',
      MENU_HEAD,
      ...ASK,
    ].join('\n'));
  });

  it('a plain start answers empty — the pick showed everything it does', () => {
    unit({
      payments: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } },
      gone: { status: 'superseded', superseded_by: 'payments', sources: { billing: { status: 'incorporated' } } },
    });
    assert.strictEqual(render('payments'), '');
  });

  it('a continue or a refine answers empty — even one whose start incorporated a specification still live', () => {
    unit({
      core: { status: 'in-progress', incorporates: ['old'], sources: { 'auth-flow': { status: 'incorporated' }, billing: { status: 'pending' } } },
      old: { status: 'completed', sources: { billing: { status: 'incorporated' } } },
      done: { status: 'completed', sources: { refunds: { status: 'incorporated' } } },
      moved: { status: 'completed', sources: { refunds: { status: 'stale' } } },
    });
    for (const topic of ['core', 'old', 'done', 'moved']) assert.strictEqual(render(topic), '', topic);
  });

  it('a proposed grouping keeps every source it names, a gone discussion included', () => {
    unit({
      payments: { status: 'proposed', sources: { phantom: { status: 'pending' }, billing: { status: 'pending' } } },
      billing: { status: 'in-progress', sources: { billing: { status: 'pending' } } },
    });
    assert.match(render('payments'), /Sources:\n {2}• phantom\n {2}• billing \(has individual spec — will be incorporated\)\n/);
  });

  it('--unify: the unify always confirms, listing every started specification it incorporates — or none', () => {
    unit({
      unified: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } },
      'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } },
      billing: { status: 'in-progress', sources: { billing: { status: 'pending' } } },
    });
    assert.strictEqual(unify('unified'), [
      DISPLAY_HEAD,
      'Creating specification: Unified',
      '',
      'Sources:',
      '  • auth-flow',
      '  • billing',
      '',
      'Existing specifications to incorporate:',
      // An absolute path wraps wherever the fixture's temp folder puts the
      // break: the bullet's own wrap lays the rows out.
      ...bulletRow(`${dir}/.leeway/pay/specification/auth-flow/specification.md → will be superseded`),
      ...bulletRow(`${dir}/.leeway/pay/specification/billing/specification.md → will be superseded`),
      '',
      `Output: ${dir}/.leeway/pay/specification/unified/specification.md`,
      '',
      MENU_HEAD,
      ...ASK,
    ].join('\n'));
    unit({ unified: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' } } } });
    const alone = unify('unified');
    assert.match(alone, /Creating specification: Unified\n\nSources:\n {2}• auth-flow\n\nOutput: /);
    assert.doesNotMatch(alone, /Existing specifications to incorporate/);
  });

  it('a grouping named `unified` started plainly is a plain start — empty', () => {
    unit({ unified: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } } });
    assert.strictEqual(render('unified'), '');
  });

  it('a started `unified` is a continue like any other — empty', () => {
    unit({ unified: { status: 'in-progress', sources: { 'auth-flow': { status: 'pending' } } } });
    assert.strictEqual(render('unified'), '');
  });

  describe('--single: the single-discussion path picks nothing, so the confirm is always drawn', () => {
    it('with no item yet, a create of the lone completed discussion', () => {
      unit({}, { 'auth-flow': completed, billing: { status: 'in-progress' }, refunds: { status: 'cancelled' } });
      assert.strictEqual(single('pay'), [
        DISPLAY_HEAD,
        'Creating specification: Pay',
        '',
        'Sources:',
        '  • auth-flow',
        '',
        `Output: ${dir}/.leeway/pay/specification/pay/specification.md`,
        '',
        MENU_HEAD,
        ...ASK,
      ].join('\n'));
      unit({});
      assert.throws(() => single('pay'),
        /no specification "pay" — the single-discussion confirm reads the lone completed discussion, and "pay" has 3/);
    });

    it('a plain start the bare call answers empty for', () => {
      unit({ payments: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' } } } });
      assert.strictEqual(render('payments'), '');
      assert.match(single('payments'), /^=== DISPLAY: spec confirmation .*\nCreating specification: Payments\n\nSources:\n {2}• auth-flow\n\nOutput: /);
    });

    it('a continue: each extraction state its own block', () => {
      unit({
        core: {
          status: 'in-progress',
          sources: { 'auth-flow': { status: 'incorporated' }, billing: { status: 'pending' }, refunds: { status: 'stale' } },
        },
      });
      assert.strictEqual(single('core'), [
        DISPLAY_HEAD,
        'Continuing specification: Core',
        '',
        `Existing: ${dir}/.leeway/pay/specification/core/specification.md [in-progress]`,
        '',
        'Sources to extract:',
        '  • billing [pending]',
        '',
        'Sources re-decided since extraction (reconcile):',
        '  • refunds [stale]',
        '',
        'Previously extracted (for reference):',
        '  • auth-flow',
        '',
        MENU_HEAD,
        ...ASK,
      ].join('\n'));
    });

    it('a continue leaves out a block with nothing in it, and lists every source when all are extracted', () => {
      unit({ core: { status: 'in-progress', sources: { 'auth-flow': { status: 'pending' }, billing: { status: 'pending' } } } });
      const pending = single('core');
      assert.match(pending, /Sources to extract:\n {2}• auth-flow \[pending\]\n {2}• billing \[pending\]\n\n=== MENU/);
      assert.doesNotMatch(pending, /re-decided|Previously extracted/);
      unit({ core: { status: 'in-progress', sources: { 'auth-flow': { status: 'incorporated' }, ghost: { status: 'pending' } } } });
      const extracted = single('core');
      assert.ok(extracted.includes(`Existing: ${dir}/.leeway/pay/specification/core/specification.md [in-progress]\n\nAll sources extracted:\n  • auth-flow\n\n=== MENU`), extracted);
      assert.doesNotMatch(extracted, /ghost/, 'a started specification leaves out a source whose discussion item is gone');
    });

    it('a completed specification with sources left to extract is a continue that names them as new', () => {
      unit({ core: { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' }, refunds: { status: 'pending' } } } });
      const out = single('core');
      assert.ok(out.includes(`Continuing specification: Core\n\nExisting: ${dir}/.leeway/pay/specification/core/specification.md [completed]`), out);
      assert.match(out, /New sources to extract:\n {2}• refunds \[pending\]\n\nPreviously extracted \(for reference\):\n {2}• auth-flow/);
    });

    it('a refine: every source extracted, and the menu opens on where a change of decision belongs', () => {
      unit({ core: { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } } });
      assert.strictEqual(single('core'), [
        DISPLAY_HEAD,
        'Refining specification: Core',
        '',
        `Existing: ${dir}/.leeway/pay/specification/core/specification.md [completed]`,
        '',
        'All sources extracted:',
        '  • auth-flow',
        '',
        MENU_HEAD,
        DOTS,
        'A refinement is for factual corrections and sharpening. A change of decision belongs in the source discussion — reopen that discussion instead; the moment it reopens, this specification is flagged to reconcile against the re-decision.',
        '',
        ...ASK.slice(1),
      ].join('\n'));
    });

    it('refuses a closed specification as the bare call does', () => {
      unit({ old: { status: 'superseded', superseded_by: 'core', sources: { refunds: { status: 'incorporated' } } } });
      assert.throws(() => single('old'), /"old" is superseded — there is nothing to confirm/);
    });
  });

  it('refuses an item it cannot confirm, and an address that is not a specification topic', () => {
    unit({
      old: { status: 'superseded', superseded_by: 'core', sources: { refunds: { status: 'incorporated' } } },
      parked: { status: 'cancelled', sources: { refunds: { status: 'incorporated' } } },
    });
    assert.throws(() => render('old'), /"old" is superseded — there is nothing to confirm/);
    assert.throws(() => render('parked'), /"parked" is cancelled — there is nothing to confirm/);
    assert.throws(() => render('ghost'), /no specification "ghost" — the confirm reads the item the pick names/);
    assert.throws(() => renderSurface(dir, 'spec-confirm-gate', { dotpath: 'pay.planning.core' }),
      /address must be <work_unit>\.specification\.<topic>, got phase "planning"/);
    assert.throws(() => renderSurface(dir, 'spec-confirm-gate', { dotpath: 'pay' }),
      /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'spec-confirm-gate', { dotpath: 'ghost.specification.core' }),
      /work unit "ghost" not found/);
  });
});

describe('render direct-entry-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            alpha: { routing: 'research', source: 'discovery' },
            beta: { routing: 'discussion', source: 'discovery' },
            gamma: { routing: 'discussion', source: 'discovery' },
            delta: { routing: 'research', source: 'discovery' },
            sigma: { routing: 'discussion', source: 'discovery', cancelled: true },
            tau: { routing: 'discussion', source: 'discovery', postponed: true },
          },
        },
        research: { items: { gamma: { status: 'unstarted' }, delta: { status: 'in-progress' } } },
        discussion: { items: { gamma: { status: 'in-progress' } } },
      },
    });
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: { discovery: { items: { feat: { routing: 'research', source: 'discovery' } } } },
    });
  });
  afterEach(() => { teardown(dir); });

  it('a name already on the map answers the red pair naming where the topic stands and its way in — never terminal', () => {
    const out = renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.alpha' });
    assert.strictEqual(out, [
      '=== DISPLAY: direct entry gate (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ "Alpha" is already on the map — it is routed to research and nothing has started',
      '',
      '=== DISPLAY: direct entry guidance (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '> Its row on the menu names the next step.',
      '',
    ].join('\n'));
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.beta' }), /routed to discussion and nothing has started/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.delta' }), /research is in flight on it/);
    // Outstanding research names itself at either door — its row is the topic's own.
    const parked = renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.gamma' });
    assert.match(parked, /⚑ "Gamma" is already on the map — research is parked on it \(mail waiting\)/);
    assert.match(parked, /> Its research row is the way in\./);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.delta' }), /research is in flight on it[\s\S]*Its research row is the way in/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.gamma' }), /research is parked on it \(mail waiting\)[\s\S]*Its research row is the way in/);
  });

  it('a marker-only cancelled row points at the reactivate — it carries no menu row to return to', () => {
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.sigma` });
      assert.match(out, /⚑ "Sigma" is already on the map — it is cancelled and stays on the map as record/, phase);
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Reactivate it from the menu \(`e\/reactivate`\) — a cancelled topic carries no row\./, phase);
      assert.ok(!out.includes('names the next step'), phase);
    }
  });

  /** The project's roadmap, holding tau's item — `pulled_to` another epic when `taken`. */
  function writeRoadmap(taken) {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        tau: {
          horizon: 'next', summary: 's', origin: 'postpone:pay', postponed_from: { work_unit: 'pay', topic: 'tau' },
          ...(taken ? { pulled_to: { work_unit: 'other', topic: 'tau' } } : {}),
        },
      } },
    }, null, 2));
  }

  it('a postponed row points at the pull forward while its roadmap item waits — it carries no menu row either', () => {
    writeRoadmap(false);
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.tau` });
      assert.match(out, /⚑ "Tau" is already on the map — it is postponed and waits on the roadmap/, phase);
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Pull it forward from the menu \(`f\/forward`\) — a postponed topic carries no row\./, phase);
      assert.ok(!out.includes('names the next step'), phase);
    }
  });

  it('a postponed row whose roadmap item another epic took names no way back — the menu has no pull-forward row for it', () => {
    writeRoadmap(true);
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.tau` });
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Its roadmap item has gone to another epic — the topic stays postponed here, with no way back\./, phase);
      assert.ok(!out.includes('f/forward'), phase);
    }
  });

  it('a fresh discussion-routed topic with a parked stub names the research first at either door', () => {
    writeManifest(dir, 'stub', {
      work_type: 'epic',
      phases: {
        discovery: { items: { eta: { routing: 'discussion', source: 'discovery' } } },
        research: { items: { eta: { status: 'unstarted' } } },
      },
    });
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'stub.discussion.eta' }), /research is parked on it \(mail waiting\)[\s\S]*Its research row is the way in/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'stub.research.eta' }), /research is parked on it \(mail waiting\)/);
  });

  it('a closed topic names its closure at either door, research reopened beneath it notwithstanding — a dead end points at discovery\'s reopen', () => {
    writeManifest(dir, 'closed', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          dead: { routing: 'research', source: 'discovery', handled: true },
          gone: { routing: 'research', source: 'discovery' },
        } },
        research: { items: { dead: { status: 'in-progress' }, gone: { status: 'cancelled', previous_status: 'in-progress' } } },
        discussion: { items: { dead: { status: 'completed' }, gone: { status: 'cancelled', previous_status: 'in-progress' } } },
      },
    });
    for (const phase of ['discussion', 'research']) {
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `closed.${phase}.dead` }),
        /⚑ "Dead" is already on the map — it is closed as a dead end and stays on the map as record[\s\S]*> Reopen it in discovery \(`i\/discovery`\) — a dead-ended topic carries no row\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `closed.${phase}.gone` }),
        /it is cancelled and stays on the map as record/);
    }
  });

  it('a decided topic points at the resume — it carries no row of its own; research parked beneath it names its research row instead', () => {
    writeManifest(dir, 'settled', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          done: { routing: 'discussion', source: 'discovery' },
          forwarded: { routing: 'discussion', source: 'discovery' },
        } },
        research: { items: { forwarded: { status: 'unstarted' } } },
        discussion: { items: { done: { status: 'completed' }, forwarded: { status: 'completed' } } },
      },
    });
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `settled.${phase}.done` });
      assert.match(out, /⚑ "Done" is already on the map — discussion has concluded/, phase);
      assert.match(out, /DISPLAY: direct entry guidance[\s\S]*> Resume it from the menu \(`c\/completed`\) — a decided topic carries no row\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `settled.${phase}.forwarded` }),
        /research is parked on it \(mail waiting\)[\s\S]*> Its research row is the way in\./, phase);
    }
  });

  it('a topic whose row is on the menu points at that row — fresh, discussing, and ready for discussion alike', () => {
    writeManifest(dir, 'live', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          talking: { routing: 'discussion', source: 'discovery' },
          researched: { routing: 'research', source: 'discovery' },
        } },
        research: { items: { researched: { status: 'completed' } } },
        discussion: { items: { talking: { status: 'in-progress' } } },
      },
    });
    for (const phase of ['discussion', 'research']) {
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.beta` }),
        /it is routed to discussion and nothing has started[\s\S]*> Its row on the menu names the next step\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `live.${phase}.talking` }),
        /discussion is in flight on it[\s\S]*> Its row on the menu names the next step\./, phase);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `live.${phase}.researched` }),
        /research has completed and discussion is queued[\s\S]*> Its row on the menu names the next step\./, phase);
    }
  });

  it('empty for a new name, for a feature, and refuses a phase outside research|discussion', () => {
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.omega' }), '');
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.omega' }), '');
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'feat.discussion.feat' }), '');
    assert.throws(() => renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.planning.alpha' }), /phase must be research or discussion/);
  });
});
