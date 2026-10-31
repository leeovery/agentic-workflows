'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for discovery. They go
// with the discovery phase (29.12), which removes their callers.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const path = require('path');

const { DOTS } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { appendEntry } = require('../../skills/leeway-engine/scripts/domain/ledger.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');
const { SESSION_ID, MADE } = require('./ledger-world.cjs');

describe('render map-op-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        discovery: {
          items: {
            'auth-flow': { source: 'discovery' },
            'legacy-bits': { source: 'discovery' },
            'in-flight': { source: 'discovery' },
            gone: { source: 'discovery', cancelled: true },
            away: { source: 'discovery', postponed: true },
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

  it('each remaining op carries its own headline and confirm question — a rename at any lifecycle, a started topic taking the name as its title (8.8.17)', () => {
    for (const name of ['auth-flow', 'in-flight']) {
      assert.strictEqual(render('rename', { name, new_name: 'sign-in-flow' }, `rename-${name}.json`), [
        '=== DISPLAY: map operation (emit verbatim as a text code block (```text fence), directly above the menu) ===',
        `Rename "${name}" → "sign-in-flow".`,
        '',
        "=== MENU: map operation gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
        DOTS,
        '**`◆ Confirm rename?`**',
        '',
        '**`y/yes`**',
        '**`n/no`**',
        '',
      ].join('\n'));
    }

    const descriptions = render('edit-description', { items: [{ name: 'auth-flow', description: 'A long one…' }] });
    assert.match(descriptions, /Updating 1 description\(s\):/);
    assert.match(descriptions, /`◆ Apply\?`/);
  });

  it('validates loudly — op vocabulary, payload shape', () => {
    assert.throws(() => render('edit', { name: 'x' }), /--op must be one of edit-summary, edit-description, remove, rename, got "edit"/);
    assert.throws(() => render('close', { name: 'auth-flow' }, 'close.json'), /--op must be one of edit-summary, edit-description, remove, rename, got "close"/);
    assert.throws(() => renderSurface(dir, 'map-op-gate', { dotpath: 'pay', op: 'remove' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'map-op-gate', { dotpath: 'pay.discovery.auth-flow', op: 'remove', file: writePayload(dir, 'a.json', { name: 'x' }) }), /address must be a bare <work_unit>/);
    assert.throws(() => render('remove', {}), /"name" must be a non-empty string/);
    assert.throws(() => render('rename', { name: 'auth-flow' }), /"new_name" must be a non-empty string/);
    assert.throws(() => render('edit-summary', { items: [] }), /"items" must be a non-empty array of \{name, summary\}/);
    assert.throws(() => render('edit-summary', { items: [{ name: 'a' }] }), /item 1 is missing "summary"/);
    assert.throws(() => render('edit-description', { items: [{ description: 'd' }] }), /item 1 is missing "name"/);
    assert.throws(() => render('reroute', { name: 'auth-flow', from: 'research', to: 'discussion' }), /--op must be one of/);
  });

  it('refuses a name the map does not hold — every op, batch rows included', () => {
    assert.throws(() => render('remove', { name: 'ghost' }, 'remove-ghost.json'), /render map-op-gate: no discovery item "ghost" on the map/);
    assert.throws(() => render('rename', { name: 'ghost', new_name: 'spectre' }, 'rn.json'), /no discovery item "ghost" on the map/);
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

  it('a removal its topic\'s standing forbids answers its verb\'s refusal alone, wrapped — no menu, nothing to confirm', () => {
    assert.strictEqual(render('remove', { name: 'in-flight' }, 'r1.json'), [
      REFUSED,
      '"in-flight" can\'t be removed — discussion is in flight on it;',
      'cancel from the epic menu instead.',
      '',
    ].join('\n'));
    assert.strictEqual(refusal(render('remove', { name: 'gone' }, 'r2.json')),
      '"gone" can\'t be removed — it is cancelled and stays on the map as record; reactivate it from the epic menu first.');
    assert.strictEqual(refusal(render('remove', { name: 'away' }, 'r3.json')),
      '"away" can\'t be removed — it is postponed and waits on the roadmap; pull it forward from the roadmap first.');
  });

  it('a removal of an unstarted topic the ledger names is refused, as its verb refuses it — and one over waiting messages is asked, its verb moving them to the inbox (8.8.16)', () => {
    appendEntry(path.join(dir, '.leeway'), { event: 'asked', unit: 'pay', topic: 'legacy-bits', phase: 'discovery', session: SESSION_ID, ...MADE, text: 'Still owned?', part_of: null, relies_on: [], cites: [] }, []);
    assert.strictEqual(refusal(render('remove', { name: 'legacy-bits' }, 'named.json')),
      '"legacy-bits" can\'t be removed — the ledger holds entries on it, which name it for good; cancel from the epic menu instead.');
    writePayload(dir, '.leeway/pay/topics/auth-flow/mail/001-a-point.md', 'A point\n');
    assert.match(render('remove', { name: 'auth-flow' }, 'mailed.json'), /`◆ Confirm removal\?`/);
  });

  it('an edit rides any lifecycle', () => {
    for (const name of ['away', 'gone', 'in-flight']) {
      assert.match(render('edit-summary', { items: [{ name, summary: 'Still editable' }] }, `edit-${name}.json`), /Updating 1 summary\(ies\):/);
    }
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
      '**Name them** → Tell me which to re-add',
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
});
