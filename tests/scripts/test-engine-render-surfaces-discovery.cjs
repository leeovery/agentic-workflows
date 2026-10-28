'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for discovery. They go
// with the discovery phase (29.12), which replaces them.
//
// Layer: unit, the domain's renderSurface called in process, every gate
// payload audited against its menu (gate-audit.cjs). World: the project world
// (setupFixture), its manifests and payloads written per test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

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

describe('render complexity-gate / first-phase-gate', () => {
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
