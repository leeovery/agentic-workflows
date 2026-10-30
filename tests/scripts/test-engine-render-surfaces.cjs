'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) that no phase of the
// reshape removes alone: those whose callers span phases or outlive them all.
// The kernel is test-render-surfaces-kernel.cjs; each phase's surfaces are in
// test-engine-render-surfaces-{phase}.cjs.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DOTS } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { titlecase } = require('../../skills/leeway-engine/scripts/domain/conventions.cjs');
const { renderSurface, NB, unwrap, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

/** A string matched literally inside a regular expression. */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    holderWith('discussion', ['E1']);
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.discussion.timing', id: 'E1' });
    assert.match(out, /=== MENU: experiment spawn gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /◆ Work E1 now\?/);
    const n = out.indexOf('**`y/yes`**');
    const l = out.indexOf('**`l/later`**');
    assert.ok(n > -1 && l > n, 'yes leads, later follows');
    assert.match(unwrap(out), /Pause this discussion here and return to the epic menu with E1 queued/);
    assert.ok(!out.includes('the session ends'), 'the pause returns through the bridge — the row never describes a session ending');
    assert.match(unwrap(out), /Keep the conversation going — this discussion cannot conclude until E1's evidence lands/);
  });

  it('refuses a missing id, an unawaited id, and a non-spawn address', () => {
    holderWith('discussion', ['E1']);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.discussion.timing' }),
      /--id is required/);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.discussion.timing', id: 'E9' }),
      /discussion "timing" holds no evidence wait on E9 — the gate follows the recorded spawn/);
    for (const phase of ['research', 'experiment']) {
      assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: `lab.${phase}.timing`, id: 'E1' }),
        /address must be <work_unit>\.<discussion>\.<topic>/);
    }
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
    holderWith('discussion');
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.timing' }), '');
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.experiment.timing' }),
      /address must be <work_unit>\.<discussion\|planning>\.<topic>/);
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
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.invoicing' }),
      /no discussion item "invoicing" — nothing to hold shut/, 'an absent item is a misrouted address, never a clear conclusion');
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
      phases: { discussion: { items: { feat: { status: 'in-progress', awaiting_experiments: ['E1'] } } } },
    });
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'feat.discussion.feat', id: 'E1' });
    assert.match(unwrap(out), /Pause this discussion here and open the laboratory for E1/);
    assert.ok(!out.includes('menu'), 'no menu on a linear unit');
  });

  it('refuses a phase that holds no wait', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress' });
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.experiment.billing' }),
      /address must be <work_unit>\.<discussion\|planning>\.<topic>/);
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
  const { selectionNotFound } = require('../../skills/leeway-engine/scripts/domain/projections/selection.cjs');
  it('renders the terminal byte-exactly, in the noun the menu continues', () => {
    assert.strictEqual(selectionNotFound('work unit', 'ghost'), [
      '=== DISPLAY: not found (emit verbatim as a text code block (```text fence), then STOP — terminal condition) ===',
      'No active work unit named "ghost" found.',
      '',
      'Run /leeway to see available work units or begin a new one.',
      '',
    ].join('\n'));
    assert.ok(selectionNotFound('epic', 'x').includes('No active epic named "x" found.\n\nRun /leeway to see available epics'));
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

describe('the boot and knowledge gate surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

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

  it('the state lost stop and the offers on GitHub are yes/no gates naming the project by its main checkout\'s folder', () => {
    const name = titlecase(path.basename(dir));
    const lost = renderSurface(dir, 'state-lost-gate', {});
    assert.match(lost, /=== DISPLAY: state lost stop[^\n]*\n⚑ Boot stopped: Leeway's state branch is gone\n/);
    assert.ok(lost.includes(`\n> ${name} keeps its Leeway state on a branch of its own, \`leeway-state\`.`), lost);
    assert.match(lost, /=== MENU: state lost gate[^\n]*\n[^\n]*\n\*\*`◆ Start again with a fresh state\?`\*\*\n\n\*\*`y\/yes`\*\* → Start again — /);
    const rule = renderSurface(dir, 'github-rule-gate', {});
    assert.ok(rule.includes(`\n${name}'s remote is on GitHub.`), rule);
    assert.match(rule, /\*\*`◆ Set that rule on GitHub\?`\*\*/);
    assert.match(unwrap(rule), /\*\*`n\/no`\*\*\s+→ Leave it unset — \*setup carries on without it\*/);
    const squash = renderSurface(dir, 'github-squash-gate', {});
    assert.ok(squash.includes(`\n${name} lands each task on GitHub as a pull request squashed into one commit.`), squash);
    assert.match(squash, /\*\*`◆ Squash from the pull request's title and description\?`\*\*/);
    assert.match(unwrap(squash), /\*\*`n\/no`\*\*\s+→ Leave it as it is — \*set it later by hand\*/);
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
      '  node .claude/skills/leeway-engine/scripts/engine.cjs knowledge setup --key-only',
      '      Private prompt, input hidden. Stored at',
      '      ~/.config/leeway/credentials.json (mode 0600).',
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
      '  node .claude/skills/leeway-engine/scripts/engine.cjs knowledge setup --key-only --provider openai-compatible',
      '      Private prompt, input hidden. Stored at',
      '      ~/.config/leeway/credentials.json (mode 0600).',
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
      '  node .claude/skills/leeway-engine/scripts/engine.cjs knowledge setup',
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
      '    node .claude/skills/leeway-engine/scripts/engine.cjs knowledge status',
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
      '> Use /leeway to navigate to the blocking work.',
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
    const { git, initRepo, testIdentity } = require('./engine-harness.cjs');
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
      testIdentity(dir);
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

describe('render first-phase-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'support-email', { work_type: 'quick-fix' });
  });
  afterEach(() => teardown(dir));

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
