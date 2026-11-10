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
    assert.throws(() => gate('gone'), /render postpone-gate: "gone" is cancelled — reactivate it from the epic menu first/);
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
      /"timing"'s series holds no live experiments — the bridge exit follows a finished series/);
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

describe('render phase-completed', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: { discussion: { items: { pay: { status: 'completed' } } } },
    });
  });
  afterEach(() => teardown(dir));

  it('a derived phase says the session is complete, never the phase — sibling records may still live', () => {
    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'experiment' });
    assert.ok(note.includes('Experiment session complete for "Pay".'), note);
    assert.ok(!note.includes('Experiment completed'), 'never claims the phase completed');
  });

  it('phase-completed carries its statement', () => {
    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'discussion' });
    assert.ok(note.includes('Discussion completed for "Pay".'));
  });

  it('work-unit addressing is loud on dotted paths, unknown units, a missing phase, and an epic', () => {
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay.review.pay', phase: 'review' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'nope', phase: 'review' }), /work unit "nope" not found/);
    writeManifest(dir, 'big', { work_type: 'epic' });
    assert.throws(() => renderSurface(dir, 'revisit-phases', { dotpath: 'big' }), /"big" is typed "epic" — the revisit menu serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay' }), /--phase is required/);
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

  it('horizon-pick --park: says what is going on the roadmap above the same rows, naming no horizon as its own (18.8.2, 18.8.11); refuses an address beside it', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    assert.deepStrictEqual(renderSurface(dir, 'horizon-pick', { park: 'streak-freeze' }).split('\n').slice(1, 6), [
      '· · · · · · · · · · · ·',
      'Putting "Streak Freeze" on the roadmap.',
      '',
      '**`◆ Which horizon?`**',
      '',
    ]);
    assert.throws(() => renderSurface(dir, 'horizon-pick', { park: 'streak-freeze', dotpath: 'mvp.discovery.auth' }),
      /render horizon-pick: --park names the item being put on the roadmap, and takes no address$/);
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

  it('park-gate: an archived item\'s name refuses too, naming it and the way on (18.8.21)', () => {
    const archived = { summary: 's', kind: 'idea', origin: 'harvest', archived: { at: '2026-01-01T00:00:00Z', horizon: 'v1' } };
    writeRoadmap({ ...TWO_HORIZONS, items: { ...TWO_HORIZONS.items, legacy: archived } });
    assert.throws(() => renderSurface(dir, 'park-gate', { name: 'legacy', horizon: 'v1', summary: 's' }),
      { message: 'render park-gate: "legacy" is archived on the roadmap, and its name stays taken — bring it back onto a horizon (engine roadmap move legacy --horizon <h>), or name the new one apart' });
  });

  it('roadmap-view: an archived item is left out, of its horizon and of the count (18.8.13)', () => {
    const archived = { summary: 'an old idea', kind: 'idea', origin: 'harvest', archived: { at: '2026-01-01T00:00:00Z', horizon: 'v1' } };
    writeRoadmap({ ...TWO_HORIZONS, items: { ...TWO_HORIZONS.items, legacy: archived } }, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-view', {});
    assert.match(out, /Roadmap \(3 items — 1 in flight · 2 waiting\)/);
    assert.ok(!out.includes('Legacy') && !out.includes('an old idea'), out);
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
    fs.mkdirSync(path.join(dir, '.leeway/.product/notes'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/.product/notes/2026-03-01--dark-mode.md'), 'taken\n');
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

describe('render send-closed-target', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        discovery: {
          items: {
            'legacy-bits': { source: 'discovery' },
            live: { source: 'discovery' },
          },
        },
        discussion: { items: { 'legacy-bits': { status: 'cancelled' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('renders the cancelled target byte-exactly — the statement, then the ask over three destinations', () => {
    assert.strictEqual(renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.legacy-bits' }), [
      "=== MENU: closed target gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '"legacy-bits" is cancelled, so it won\'t pick up messages.',
      '',
      '**`◆ Where should the message go?`**',
      '',
      '**`o/open`**      → Reactivate it and send the message there — the',
      `${NB(14)}topic returns to its previous state and counts as`,
      `${NB(14)}open again`,
      '**`e/elsewhere`** → Pick a different target',
      "**`d/drop`**      → Don't send it; it stays with the current topic",
      '',
    ].join('\n'));
  });

  it('refuses a live target, an unknown name, and a non-discovery address', () => {
    assert.throws(() => renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.live' }),
      /"live" is "fresh", not cancelled — the gate serves cancelled targets/);
    assert.throws(() => renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discovery.ghost' }),
      /render send-closed-target: no topic "ghost" — the map's topics are live$/);
    assert.throws(() => renderSurface(dir, 'send-closed-target', { dotpath: 'pay.discussion.legacy-bits' }),
      /address must be <work_unit>\.discovery\.<target>, got phase "discussion"/);
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
      },
    });
  });
  afterEach(() => teardown(dir));

  // A map whose rows are missing a summary (one drafted, one with no source
  // to draft from), a description alone, or nothing at all — the last never
  // part of the batch.
  const backfillMap = () => writeManifest(dir, 'pay', {
    phases: { discovery: { items: {
      'auth-flow': { source: 'discovery', order: 1 },
      billing: { source: 'discovery', order: 2, summary: 'How invoices are raised and settled' },
      'legacy-bits': { source: 'discovery', order: 3 },
      settled: { source: 'discovery', order: 4, summary: 'Whole', description: 'Whole' },
    } } },
  });
  const drafted = (summaries, name = 'summaries.json') => writePayload(dir, `.leeway/.cache/pay/discovery/${name}`, { summaries });
  const backfill = (variant, extra = {}) => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay', variant, ...extra });
  const PROPOSED_ROWS = [
    'Proposed summaries for 3 topic(s):',
    '',
    '  1. Auth Flow',
    '       How sign-in survives a dropped session and a token refresh',
    '       mid-request',
    '  2. Billing',
    '       How invoices are raised and settled  (already populated)',
    '  3. Legacy Bits',
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
      phases: { discovery: { items: { billing: { source: 'discovery', summary: 'How invoices are raised, reconciled, and settled each month end' } } } },
    });
    assert.ok(backfill('proposed', { file: drafted({}) }).includes([
      '  1. Billing',
      '       How invoices are raised, reconciled, and settled each',
      '       month end  (already populated)',
    ].join('\n')));
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { billing: { source: 'discovery', summary: 'How invoices are raised, reconciled, and settled monthly' } } } },
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
    writeManifest(dir, 'pay', { phases: { discovery: { items: { settled: { summary: 'Whole', description: 'Whole' } } } } });
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
});
