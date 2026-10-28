'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the roadmap and the
// inbox. They go with the tracking layer (29.16), which replaces them.
//
// Layer: unit, the domain's renderSurface called in process, every gate
// payload audited against its menu (gate-audit.cjs). World: the project world
// (setupFixture), its manifests and payloads written per test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DOTS, CONTINUE_CLAUSE } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, unwrap, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

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
