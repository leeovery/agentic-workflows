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

const { DOTS, CONTINUE_CLAUSE, bulletRow } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, unwrap, setup, teardown, writeManifest } = require('./render-surfaces-world.cjs');

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
