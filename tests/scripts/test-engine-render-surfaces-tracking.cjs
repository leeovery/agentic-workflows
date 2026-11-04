'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the epic menu and
// the inbox. They go with the tracking layer (29.16), which removes their
// callers.
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

const { DOTS, CONTINUE_CLAUSE } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

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
    summary: 'What freshness the ranking signals must guarantee downstream',
  };
  const render = (obj = payload, name = 'c.json') => renderSurface(dir, 'candidate-gate', {
    dotpath: 'pay', file: writePayload(dir, name, obj),
  });

  it('renders the gated candidate byte-exactly — display then the five-way gate', () => {
    staged('gated');
    assert.strictEqual(render(), [
      '=== DISPLAY: candidate (emit verbatim as a text code block (```text fence)) ===',
      'Signal Freshness Contract',
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
      '**Comment**    → Tell me what to change (summary or description)',
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
    assert.throws(() => render({ name: 'signal-freshness-contract' }, 's.json'), /"summary" must be a non-empty string/);

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
