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

const { DOTS, CONTINUE_CLAUSE, bulletRow } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, unwrap, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('phase-paused — the epic menu\'s banner for a phase leaving on a pause', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  const HEADER = '=== DISPLAY: phase paused (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';

  it('a linear unit names what its one conversation awaits, the topic name dropped — the unit is the topic', () => {
    writeManifest(dir, 'ledger', {
      work_type: 'feature',
      phases: {
        discussion: { items: { ledger: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'phase-paused', { dotpath: 'ledger', phase: 'discussion' }),
      `${HEADER}\nDiscussion paused for "Ledger" — awaiting experiment evidence (E1).\n`);
  });

  it('an epic names each paused conversation with its waits', () => {
    writeManifest(dir, 'pay', {
      phases: {
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
      `${HEADER}\nDiscussion paused for "Pay" — "Billing" awaits experiment evidence (E1, E2); "Auth" awaits experiment evidence (E1).\n`,
      'only in-progress holders are paused conversations — a completed item\'s stale field is never a wait');
  });

  it('nothing left awaited renders the bare line — a peer landed the wait between the gate and the banner', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
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
    for (const phase of ['research', 'implementation']) {
      assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'pay', phase }),
        new RegExp(`--phase must be <discussion\\|planning\\|specification> — the phases that pause; got "${phase}"`));
    }
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

  it('a discussion entry carries no gate', () => {
    orderedEpic();
    for (const action of ['start_discussion', 'continue_discussion']) {
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
