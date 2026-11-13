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
const { output } = require('./engine-harness.cjs');
const { fixture } = require('./board-world.cjs');

/** A string matched literally inside a regular expression. */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('cancel-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('a never-started topic: only the map row is marked', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { 'data-export': { source: 'discovery' } } } },
    });
    const out = renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.data-export' });
    assert.match(out, /MENU: cancel gate/);
    assert.match(unwrap(out), /Cancelling \*\*Data Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    assert.match(out, /◆ Cancel it\?/);
    assert.match(out, /\*\*`y\/yes`\*\* → Confirm cancellation/);
    assert.match(out, /\*\*`n\/no`\*\*  → Keep it/);
  });

  it('a started topic: the items by phase, the open records that end abandoned', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { source: 'discovery' } } },
        discussion: { items: { auth: { status: 'in-progress', awaiting_experiments: ['E2'] } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: {
          E1: { slug: 'a', status: 'concluded', verdict: 'held' },
          E2: { slug: 'b', status: 'running' },
          'E2.1': { slug: 'c', status: 'conceived' },
        } } } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }));
    assert.match(out, /Cancelling \*\*Auth\*\* marks its discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E2, with E2\.1\) ends abandoned on the register\.$/m);
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

  it('refuses a unit with nothing to cancel — an off-map topic whose only item carries no status', () => {
    writeManifest(dir, 'pay', { phases: { discussion: { items: { legacy: {} } } } });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.legacy' }),
      /"legacy" has nothing to cancel — no live item under its name and no map row, so the menu never offers it/);
  });

  it('a single item, a single open record: singular wording', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discussion: { items: { auth: { status: 'unstarted' } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: { E1: { slug: 'a', status: 'running' } } } } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }));
    assert.match(out, /Cancelling \*\*Auth\*\* marks its discussion \[unstarted\] cancelled — it can be reactivated later\. 1 open experiment \(E1\) ends abandoned on the register\./);
  });

  it('refuses what the menu never offers — cancelled, postponed, unknown — and a non-unit address', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: {
          gone: { source: 'discovery', cancelled: true },
          away: { source: 'discovery', postponed: true },
        } },
        discussion: { items: { auth: { status: 'completed' } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.gone' }),
      /"gone" is already cancelled — the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.away' }),
      /"away" is postponed — the roadmap owns it; archive its item there to cancel it, or pull it forward first/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.ghost' }),
      /render cancel-gate: no topic "ghost" — the map's topics are auth$/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.auth' }),
      /address must be <work_unit>\.discovery\.<topic>, got phase "specification"/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discussion.auth' }),
      /address must be <work_unit>\.discovery\.<topic>, got phase "discussion"/);
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
      discovery: { items: { auth: { source: 'discovery', summary: 'Auth flow' } } },
      discussion: { items: { auth: { status: 'in-progress' } } },
    },
  };

  it('a never-started topic with no roadmap: the row alone, and the map is created with it', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { 'data-export': { source: 'discovery' } } } },
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

  it('a started topic: the items by phase, the horizon flagged new over an existing map', () => {
    writeProject({ horizons: ['mvp'], items: { other: { horizon: 'mvp', summary: 's', origin: 'harvest' } } });
    writeManifest(dir, 'pay', LIVE);
    const out = unwrap(renderSurface(dir, 'postpone-gate', { dotpath: 'pay.discovery.auth', horizon: 'v2' }));
    assert.match(out, /Postponing \*\*Auth\*\* marks its discussion \[in-progress\] postponed — its record stays on disk and comes back with the pull\. It waits on the roadmap under "v2" \(new\), until it is pulled into work\./);
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
          auth: { source: 'discovery' },
          gone: { source: 'discovery', cancelled: true },
          away: { source: 'discovery', postponed: true },
          busy: { source: 'discovery' },
        } },
        discussion: { items: {
          auth: { status: 'in-progress' },
          busy: { status: 'in-progress' },
        } },
        experiment: { items: { busy: { status: 'in-progress', experiments: {
          E1: { slug: 'a', status: 'concluded', verdict: 'held' },
          E2: { slug: 'b', status: 'running' },
          'E2.1': { slug: 'c', status: 'conceived' },
        } } } },
      },
    });
    writeManifest(dir, 'built', {
      build: { position: 'auto' },
      phases: { discovery: { items: { done: { source: 'discovery' } } }, discussion: { items: { done: { status: 'completed' } } } },
    });
    const gate = (topic, unit = 'pay') => renderSurface(dir, 'postpone-gate', { dotpath: `${unit}.discovery.${topic}`, horizon: 'mvp' });
    assert.throws(() => gate('ghost'), /render postpone-gate: no topic "ghost" — the map's topics are auth, busy$/);
    assert.throws(() => gate('away'), /render postpone-gate: "away" is already postponed — it waits on the roadmap/);
    assert.throws(() => gate('gone'), /render postpone-gate: "gone" is cancelled — reactivate it first: topic reactivate pay discovery gone/);
    assert.throws(() => gate('done', 'built'), /render postpone-gate: postponing "done" is refused — built's build has begun, so its map is closed/);
    assert.throws(() => gate('busy'), /render postpone-gate: postponing "busy" is refused while an experiment is live \(E2, with E2\.1\) — conclude or abandon it first; a laboratory cannot run under a topic that has left the epic/);
    assert.throws(() => gate('auth'), /render postpone-gate: postponing "auth" is refused — a roadmap item named "auth" \(horizon "mvp"\) is not this topic's: rename it on the roadmap, or rename the topic, first/);
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
        discovery: { items: { auth: { source: 'discovery', ...(postponed ? { postponed: true } : {}) } } },
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
      /render topic-receipt: no topic "ghost" — the map's topics are auth$/);
  });
});

describe('topic-receipt — the restore verb', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('names the statuses the pull forward returned the unit to, the indexing advisory riding --warn', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { source: 'discovery' }, fresh: { source: 'discovery' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'restore' }),
      /Pulled "Auth" forward\. Restored discussion \[in-progress\]\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'restore', warn: '1' }),
      /⚑ Knowledge indexing warning[\s\S]*Pulled "Auth" forward\./);
    // A topic that never started comes back with nothing to name.
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.fresh', verb: 'restore' }),
      /Pulled "Fresh" forward\.\n/);
  });

  it('refuses a topic still postponed, a non-Discovery address, and a dead name', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { source: 'discovery', postponed: true } } },
        discussion: { items: { auth: { status: 'postponed', previous_status: 'in-progress' } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.auth', verb: 'restore' }),
      /"auth" is still postponed — the pull forward has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discussion.auth', verb: 'restore' }),
      /--verb restore addresses the Discovery unit — <work_unit>\.discovery\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.ghost', verb: 'restore' }),
      /render topic-receipt: no topic "ghost" — the map has no live topics$/);
  });
});

describe('topic-receipt — the unit addresses', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('cancel and reactivate read the unit; a never-started topic restores nothing', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { gone: { source: 'discovery', cancelled: true }, back: { source: 'discovery' } } },
        discussion: { items: { back: { status: 'in-progress' } } },
      },
    });
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.gone', verb: 'cancel' }), /Cancelled "Gone"\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'reactivate' }),
      /Reactivated "Back"\. Restored discussion \[in-progress\]\.\n/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'cancel' }), /"back" is not cancelled — the cancel has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discussion.back', verb: 'reactivate' }),
      /--verb reactivate addresses the Discovery unit — <work_unit>\.discovery\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.ghost', verb: 'cancel' }), /no topic "ghost"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'bogus' }), /--verb must be cancel, reactivate, postpone, or restore/);
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
      /"timing"'s series holds no live experiments — the laboratory's leave follows a finished series/);
    assert.throws(() => renderSurface(dir, 'experiment-next-gate', { dotpath: 'lab.discussion.timing' }),
      /address must be <work_unit>\.experiment\.<topic>/);
  });
});

describe('experiment spawn gate — the conversation\'s pause for its laboratory', () => {
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
    assert.match(unwrap(out), /Pause this discussion here and open the laboratory for E1/);
    assert.match(unwrap(out), /Keep the conversation going — the question E1 measures waits for its result, unless you answer it first/);
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

});

describe('render phase-note', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { investigation: { items: { 'auth-flow': { status: 'completed' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the one-liner with the phase noun by default and an override when given', () => {
    assert.strictEqual(renderSurface(dir, 'phase-note', { dotpath: 'pay.investigation.auth-flow', verb: 'Resuming' }),
      '=== DISPLAY: phase note (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===\nResuming investigation: Auth Flow\n');
    assert.ok(renderSurface(dir, 'phase-note', { dotpath: 'pay.investigation.auth-flow', verb: 'Reopening', noun: 'hunt' })
      .includes('Reopening hunt: Auth Flow'));
    assert.throws(() => renderSurface(dir, 'phase-note', { dotpath: 'pay.investigation.auth-flow' }), /--verb is required/);
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

  it('horizon-pick --park: the item going on the roadmap named above the horizons in map order, each with what waits in it, then the new row, none named as its own (18.8.2, 18.8.11)', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'horizon-pick', { park: 'streak-freeze' });
    assert.strictEqual(out, [
      "=== MENU: horizon pick (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Putting "Streak Freeze" on the roadmap.',
      '',
      '**`◆ Which horizon?`**',
      '',
      '**`1`**     → mvp — *1 waiting*',
      '**`2`**     → v1 — *1 waiting*',
      '**`n/new`** → A new horizon — name it',
      '',
    ].join('\n'), 'the pulled item counts against no horizon — only what waits is offered');
  });

  it('horizon-pick --park over several items, comma-joined, says how many are going on the roadmap', () => {
    writeRoadmap(TWO_HORIZONS);
    assert.strictEqual(renderSurface(dir, 'horizon-pick', { park: 'streak-freeze,dark-mode,export-csv' }).split('\n')[2], 'Putting 3 items on the roadmap.');
  });

  it('horizon-pick: refuses a pick naming nothing going on the roadmap, --park beside an address, a --park name that is no item name or comes twice, a never-born roadmap and one with no horizons', () => {
    assert.throws(() => renderSurface(dir, 'horizon-pick', {}),
      /^Error: render horizon-pick: name what is going on the roadmap — --park <name>\[,<name>…\], a topic leaving for it as <work_unit>\.discovery\.<topic>, or --back <name> --from <what put it back>$/);
    assert.throws(() => renderSurface(dir, 'horizon-pick', { park: 'streak-freeze', dotpath: 'mvp.discovery.auth' }),
      /render horizon-pick: --park names the items being put on the roadmap, and takes no address$/);
    assert.throws(() => renderSurface(dir, 'horizon-pick', { park: 'streak-freeze,' }),
      /render horizon-pick: --park takes the items' names, comma-joined — "" is not a legal item name/);
    assert.throws(() => renderSurface(dir, 'horizon-pick', { park: 'a,b,a' }), /render horizon-pick: --park names "a" twice$/);
    assert.throws(() => renderSurface(dir, 'horizon-pick', { park: 'streak-freeze' }),
      /render horizon-pick: no roadmap on the project manifest — the caller names its first horizon in prose/);
    writeRoadmap({ horizons: [], items: {} });
    assert.throws(() => renderSurface(dir, 'horizon-pick', { park: 'streak-freeze' }),
      /render horizon-pick: the roadmap holds no horizons — the caller names one in prose/);
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

  it('the brownfield offer: a yes/no gate drawn only while nothing is recorded — any answer refuses it (8.12.11)', () => {
    const offer = renderSurface(dir, 'brownfield-offer-gate', {});
    assert.match(offer, /=== MENU: brownfield offer/);
    assert.match(offer, /\*\*`◆ Run a baseline assessment\?`\*\*/);
    assert.match(offer, /\*\*`y\/yes`\*\* → Start the assessment now/);
    assert.match(unwrap(offer), /\*\*`n\/no`\*\*\s+→ Skip — it is not offered again/);
    for (const answer of ['native', 'skipped', 'accepted', 'completed']) {
      fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({ work_units: {}, brownfield_offer: answer }));
      assert.throws(() => renderSurface(dir, 'brownfield-offer-gate', {}), new RegExp(`the offer's answer is "${answer}" — the offer is made once, while nothing is recorded`));
    }
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

  it('the stop the gate mod\'s band tests draw carrying ⚑ (18.S43) is the engine\'s answer under the gate surface, its project named Fumi', async () => {
    const out = output(dir, ['render', 'state-lost-gate'], { env: { LEEWAY_GATE_SURFACE: '1' } }).replaceAll(titlecase(path.basename(dir)), 'Fumi');

    assert.strictEqual(out, await fixture('menu-state-lost.mjs'));
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
    assert.ok(renderSurface(dir, 'import-reprompt', { file, dotpath: 'no-such-unit.discussion.nope' })
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
