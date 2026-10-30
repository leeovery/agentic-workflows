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

const { DOTS } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

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

  it('a close over messages waiting in the topic\'s mailbox is refused', () => {
    writePayload(dir, '.leeway/pay/topics/auth-flow/mail/001-a-point.md', 'A point\n');
    assert.strictEqual(refusal(render('close', { name: 'auth-flow' }, 'w.json')),
      '"auth-flow" can\'t be closed as a dead end — messages wait in its mailbox; open the topic to answer them, or cancel the topic from the epic menu instead.');
  });

  it('a destructive op over messages waiting in a fresh topic\'s mailbox is refused, as its transaction refuses it', () => {
    writePayload(dir, '.leeway/pay/topics/auth-flow/mail/001-a-point.md', 'A point\n');
    for (const [op, extra, verb] of [['remove', {}, 'removed'], ['rename', { new_name: 'x' }, 'renamed'], ['reroute', { from: 'discussion', to: 'research' }, 're-routed']]) {
      assert.strictEqual(refusal(render(op, { name: 'auth-flow', ...extra }, `${op}-w.json`)),
        `"auth-flow" can't be ${verb} from the map — messages wait in its mailbox; open the topic to answer them, or cancel the topic from the epic menu instead.`);
    }
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
