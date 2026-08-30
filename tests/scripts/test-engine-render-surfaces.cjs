'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DOTS, section, menuFrame, menu, callout, subDetail, treeList } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface } = require('../../skills/workflow-engine/scripts/domain/render.cjs');

// Worklist leading indents are non-breaking spaces (a 4-space lead is a code
// block to a markdown renderer) — goldens spell them explicitly.
const NB = (n) => '\u00a0'.repeat(n);

// Reverse the menu label wrap for wording asserts: a continuation joins its
// previous line with the single space the break replaced. Exact only for
// labels with no markup spanning the break \u2014 layout itself is covered by
// the byte-exact pins.
const unwrap = (s) => s.replace(/\n\u00a0+/g, ' ');
const { selectionSections } = require('../../skills/workflow-engine/scripts/domain/projections/selection.cjs');

function setup() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'render-surfaces-'));
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function writeManifest(dir, name, data) {
  const mdir = path.join(dir, '.workflows', name);
  fs.mkdirSync(mdir, { recursive: true });
  fs.writeFileSync(path.join(mdir, 'manifest.json'), JSON.stringify({
    name, work_type: 'epic', status: 'in-progress', description: 'Test', phases: {}, ...data,
  }, null, 2));
}
function writePayload(dir, rel, obj) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return rel;
}

describe('cancel-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('renders the bare cancel confirm with the statement/question split', () => {
    writeManifest(dir, 'pay', {
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    const out = renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discussion.auth' });
    assert.match(out, /MENU: cancel gate/);
    assert.match(out, /Cancelling \*\*Auth\*\* in discussion will mark it as cancelled — it can be reactivated later\./);
    assert.match(out, /◆ Cancel it\?/);
    assert.match(out, /\*\*`y\/yes`\*\* → Confirm cancellation/);
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

  it('discussion and specification rows keep the counting idiom', () => {
    orderedEpic();
    assert.match(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'new_discussion' }),
      /1 of 2 research topics still in-progress/);
    assert.match(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_specification' }),
      /1 of 2 discussions still in-progress/);
    assert.match(renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'new_discussion' }),
      /re-analyse if you revisit later/);
  });

  it('requires --action always and --topic for the order rows', () => {
    orderedEpic();
    assert.throws(() => renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay' }), /--action is required/);
    assert.throws(() => renderSurface(dir, 'epic-soft-gate', { dotpath: 'pay', action: 'start_planning' }), /--topic is required/);
  });
});

describe('surfaces primitives', () => {
  it('menu opens on the rule, glyphs a short label, and never closes the frame', () => {
    assert.strictEqual(
      menu('Approve?', ['**`y/yes`**', '**`n/no`**']),
      [DOTS, '**`◆ Approve?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('leaves a long or marked-up label as prose — the glyph span cannot nest markup', () => {
    const long = 'Whether the pipeline can expose **click windows** belongs to a different topic entirely';
    const out = menu(long, ['**`y/yes`**']);
    assert.strictEqual(out, [DOTS, long, '', '**`y/yes`**'].join('\n'));
  });

  it('menu appends an optional trailing prompt after a blank line', () => {
    const out = menu('Pick one:', ['**`1`** → A'], { prompt: 'Select an option:' });
    assert.ok(out.endsWith(['**`1`** → A', '', 'Select an option:'].join('\n')));
  });

  it('aligns option arrows into one column, leaving non-option lines alone', () => {
    const out = menu('Pick one:', ['**`c/continue`** → Carry on', '**`q`** → Quit', 'a plain line']);
    const lines = out.split('\n');
    const arrows = lines.filter((l) => l.includes(' → ')).map((l) => l.indexOf(' → '));
    assert.strictEqual(new Set(arrows).size, 1, 'arrows share a column');
    assert.ok(lines.includes('a plain line'), 'non-option lines pass through untouched');
  });

  it('wraps a long option label under the label column with NBSP continuations', () => {
    const out = menuFrame([
      '**`1`** → ' + 'alpha '.repeat(12).trim(),
      '**`i/discovery`** → Continue discovery',
    ], { width: 40 });
    const lines = out.split('\n');
    // column = 11 (i/discovery) → label column 14; every rendered line ≤ 40.
    assert.strictEqual(lines[1], '**`1`**           → alpha alpha alpha alpha');
    assert.strictEqual(lines[2], `${NB(14)}alpha alpha alpha alpha`);
    assert.strictEqual(lines[3], `${NB(14)}alpha alpha alpha alpha`);
    assert.strictEqual(lines[4], '**`i/discovery`** → Continue discovery');
  });

  it('closes and reopens spans at a wrap break — every emitted line is self-contained markdown', () => {
    const out = menuFrame([
      '**`1`** → Continue "Roles" — *implementation (Phase 5, Task roles-5-44)*',
      '**`i/discovery`** → Continue discovery',
    ], { width: 55 });
    const lines = out.split('\n');
    assert.strictEqual(lines[1], '**`1`**           → Continue "Roles" — *implementation (Phase*');
    assert.strictEqual(lines[2], `${NB(14)}*5, Task roles-5-44)*`);
  });

  it('a struck in-session row and a code span both survive the break balanced', () => {
    const struck = menuFrame([
      '**`1`** → ~~Continue "Topic" — *discussion*~~ · in session (last active 2m ago)',
    ], { width: 55 });
    // the ~~…~~ closes before the break here; each line carries balanced markers
    for (const line of struck.split('\n')) {
      assert.strictEqual((line.match(/~~/g) || []).length % 2, 0, line);
    }
    const code = menuFrame([
      '**`1`** → Run `one two three four five six seven` now',
    ], { width: 40 });
    const codeLines = code.split('\n');
    assert.ok(codeLines[1].endsWith('`'), 'code span closes at the break');
    assert.ok(codeLines[2].startsWith(NB(4) + '`'), 'and reopens on the continuation');
  });

  it('keeps the line whole when the label budget falls below the floor', () => {
    const out = menuFrame([
      '**`x/extraordinarily-wide-key-column`** → Continue',
      '**`1`** → A long label that would wrap at any sane width but must stay whole here',
    ], { width: 40 });
    assert.ok(!out.includes(NB(1)), 'no continuation lines at a degenerate budget');
  });

  it('leaves a single oversized token whole rather than splitting markup', () => {
    const out = menuFrame([
      '**`1`** → See supercalifragilistic-hyphenated-identifier-that-cannot-fit for details',
    ], { width: 40 });
    const lines = out.split('\n');
    assert.strictEqual(lines[2], `${NB(4)}supercalifragilistic-hyphenated-identifier-that-cannot-fit`);
    assert.strictEqual(lines[3], `${NB(4)}for details`);
  });

  it('section wraps body in a named, instruction-carrying marker and strips trailing newlines', () => {
    assert.strictEqual(section('MENU: x', 'emit verbatim', 'body\n\n'), '=== MENU: x (emit verbatim) ===\nbody\n');
  });

  it('callout flags the first line and aligns continuations', () => {
    assert.strictEqual(callout(['first line', 'second line']), '  ⚑ first line\n    second line');
  });

  it('menuFrame opens arbitrary lines with the canonical rule and does not close them', () => {
    assert.strictEqual(menuFrame(['a', '', 'b']), [DOTS, '**`◆ a`**', '', 'b'].join('\n'));
  });

  it('menuFrame glyphs only a leading short label — no blank beneath means no glyph', () => {
    assert.strictEqual(menuFrame(['a', 'b']), [DOTS, 'a', 'b'].join('\n'));
  });

  it('callout wraps a string to the width with the flag gutter subtracted', () => {
    const out = callout('word '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('  ⚑ ') && lines[1].startsWith('    '));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('subDetail glyphs the first line and aligns continuations under the text', () => {
    const out = subDetail('alpha '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('   · alpha') && lines[1].startsWith('     alpha'));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('treeList branches each item, gutters continuations, blanks under the last', () => {
    const out = treeList(['one '.repeat(12).trim(), 'two '.repeat(12).trim()], { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('     ├─ one'));
    assert.ok(lines[1].startsWith('     │  one'), 'non-last continuation carries the gutter');
    const lastBranch = lines.findIndex((l) => l.startsWith('     └─ two'));
    assert.ok(lastBranch > 0);
    assert.ok(lines[lastBranch + 1].startsWith('        two'), 'last continuation is blank-guttered');
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
      '=== MENU: resume gate (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      'Found existing discussion for **Auth Flow**.',
      '',
      '**`c/continue`** → Pick up where you left off',
      '**`r/restart`**  → Delete the discussion and start fresh',
      '',
    ].join('\n'));
  });

  it('prepends the triage warning display when --triage is passed', () => {
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', triage: '3' });
    assert.ok(out.startsWith([
      '=== DISPLAY: triage warning (emit verbatim as a code block, directly above the menu) ===',
      "  ⚑ 3 rerouted concern(s) from other topics wait in this topic's",
      '    triage queue. Restart leaves them queued — the restarted',
      '    session raises them.',
      '',
    ].join('\n')));
    assert.ok(out.includes('=== MENU: resume gate'));
  });

  it('rejects a non-positive or non-integer triage count', () => {
    for (const bad of ['0', '-1', 'two', '']) {
      assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', triage: bad }), /--triage must be a positive integer/);
    }
  });

  it('rejects a malformed address and an unknown work unit', () => {
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion' }), /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'nope.discussion.x' }), /work unit "nope" not found/);
  });

  it('rejects an unknown variant and --triage combined with a variant', () => {
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.discussion.auth-flow', variant: 'nope' }), /--variant must be "plan", "review", "scoping", or "session"/);
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.scoping.auth-flow', variant: 'scoping', triage: '2' }), /--triage only applies to the default variant/);
  });
});

describe('render resume-gate variants', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  /** The prior run's planning files — what makes `continue` an option. */
  const planFiles = (workUnit, topic) => {
    fs.mkdirSync(path.join(dir, '.workflows', workUnit, 'planning', topic), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', workUnit, 'planning', topic, 'planning.md'), '# Plan\n');
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

describe('render task-list', () => {
  let dir;
  const payload = {
    phase: 1,
    phase_name: 'Adapter Wrapper',
    tasks: [
      { name: 'Wrap command', summary: 'Wrap the argv in a shell fallback', edge_cases: ['quotes', 'attach passthrough'] },
      { name: 'Drop wait', summary: 'Remove wait-after-command' },
    ],
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the canonical display plus the gate menu when gated', () => {
    const file = writePayload(dir, 'tl.json', payload);
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: task list (emit verbatim as a code block) ===',
      'Phase 1: Adapter Wrapper — 2 tasks.',
      '',
      '1. Wrap command',
      '   · Wrap the argv in a shell fallback',
      '   · Edge cases',
      '     ├─ quotes',
      '     └─ attach passthrough',
      '',
      '2. Drop wait',
      '   · Remove wait-after-command',
      '   · Edge cases: none',
      '',
      '=== MENU: task list gate (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task list?`**',
      '',
      '**`y/yes`**                  → Proceed to authoring',
      '**`a/auto`**                 → Approve this and all remaining task list',
      `${NB(25)}gates automatically`,
      '**Tell me what to change** → which tasks to reorder, split, merge,',
      `${NB(25)}add, edit, or remove`,
      '**Navigate**               → Tell me where to go: a different phase',
      `${NB(25)}or task, or the leading edge`,
      '',
    ].join('\n'));
  });

  it('singular "1 task." and the auto-proceed line when the gate mode is auto', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'tl.json', { ...payload, tasks: [payload.tasks[0]] });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('Phase 1: Adapter Wrapper — 1 task.'));
    assert.ok(out.includes('=== DISPLAY: task list auto-approved (emit verbatim as a code block — the user set this gate to auto: do not stop; continue as the workflow instructs) ==='));
    assert.ok(out.includes('Phase 1: Adapter Wrapper — task list approved. Proceeding to authoring.'));
    assert.ok(!out.includes('MENU: task list gate'));
  });

  it('defaults to gated when the topic carries no gate mode', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: {} } } });
    const file = writePayload(dir, 'tl.json', payload);
    assert.ok(renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file }).includes('MENU: task list gate'));
  });

  it('validates the payload loudly, naming the field', () => {
    const cases = [
      ['missing.json', 'nope', /payload file not found/],
      [writePayload(dir, 'a.json', 'not json'), null, /not valid JSON/],
      [writePayload(dir, 'b.json', []), null, /must be an object/],
      [writePayload(dir, 'c.json', { phase: 0, phase_name: 'x', tasks: [{ name: 'a', summary: 'b' }] }), null, /"phase" must be a positive integer/],
      [writePayload(dir, 'd.json', { phase: 1, phase_name: ' ', tasks: [{ name: 'a', summary: 'b' }] }), null, /"phase_name" must be a non-empty string/],
      [writePayload(dir, 'e.json', { phase: 1, phase_name: 'x', tasks: [] }), null, /"tasks" must be a non-empty array/],
      [writePayload(dir, 'f.json', { phase: 1, phase_name: 'x', tasks: [{ name: 'a' }] }), null, /task 1 is missing "summary"/],
      [writePayload(dir, 'g.json', { phase: 1, phase_name: 'x', tasks: [{ name: 'a', summary: 'b', edge_cases: [''] }] }), null, /"edge_cases" must be an array of non-empty strings/],
    ];
    for (const [file, , re] of cases) {
      assert.throws(() => renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file }), re);
    }
  });

  it('requires --file', () => {
    assert.throws(() => renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal' }), /--file <payload\.json> is required/);
  });

  it('wraps long summaries and edge cases with hanging indents — nothing lands at column zero', () => {
    const file = writePayload(dir, 'tl.json', {
      phase: 1,
      phase_name: 'X',
      tasks: [{
        name: 'Long task',
        summary: 'wrap '.repeat(40).trim(),
        edge_cases: ['edge '.repeat(30).trim()],
      }],
    });
    const out = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file });
    const display = out.split('=== MENU')[0].split('\n').slice(1);
    for (const line of display) {
      if (line === '' || line.startsWith('Phase 1:') || /^\d+\. /.test(line)) continue;
      assert.match(line, /^ {3,}/, `display line must be indented, got: "${line}"`);
      assert.ok([...line].length <= 72, `display line must fit the wrap width, got ${[...line].length}`);
    }
  });
});

describe('render findings-summary', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the worklist overview byte-exactly — glyphs, tags, notes', () => {
    const file = writePayload(dir, 's.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'add-to-task — Task 1-1 lacks the Outcome field.' },
        { title: 'Orphaned dependency', tag: 'Important', summary: 'update-task — Task 2-3 depends on a removed task.' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as markdown — do not stop; continue as the workflow instructs) ===',
      '**Integrity Review** — 2 findings',
      '',
      '○ 1. Missing Outcome field `[Minor]`',
      `${NB(7)}↳ add-to-task — Task 1-1 lacks the Outcome field.`,
      '○ 2. Orphaned dependency `[Important]`',
      `${NB(7)}↳ update-task — Task 2-3 depends on a removed task.`,
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('renders a resumed review — decided rows struck and note-shed, remaining counted', () => {
    const file = writePayload(dir, 'r.json', {
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'Task 1-1 lacks the Outcome field.', status: 'approved' },
        { title: 'Orphaned dependency', tag: 'Important', summary: 'Task 2-3 depends on a removed task.', status: 'skipped' },
        { title: 'Duplicated criteria', tag: 'Minor', summary: 'Two tasks share one criterion.', status: 'pending' },
      ],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: findings summary (emit verbatim as markdown — do not stop; continue as the workflow instructs) ===',
      '**Integrity Review** — 3 findings · 1 remaining',
      '',
      '✓ 1. ~~Missing Outcome field~~ `[Minor]`',
      '⊘ 2. ~~Orphaned dependency~~ `[Important]`',
      '○ 3. Duplicated criteria `[Minor]`',
      `${NB(7)}↳ Two tasks share one criterion.`,
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { review_label: 'X', items: [] }) }), /"items" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { review_label: 'X', items: [{ title: 't', tag: 'g' }] }) }), /item 1 is missing "summary"/);
    assert.throws(() => renderSurface(dir, 'findings-summary', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'c.json', { review_label: 'X', items: [{ title: 't', tag: 'g', summary: 's', status: 'Fixed' }] }) }), /render findings-summary: item 1 carries unknown status "Fixed"/);
  });
});

describe('worklist shape', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  // Rendered width: escapes and code-span backticks are zero-width, `~~` is
  // consumed — byte length over-counts a correct row, so width properties
  // are asserted on the rendered measure, against the resolved width.
  const renderedLen = (line) => line.replace(/\\(.)/g, '$1').replace(/~~/g, '').replace(/`/g, '').length;
  const { displayWidth } = require('../../skills/workflow-engine/scripts/kernel/terminal.cjs');

  it('a tag that cannot fit the last title line drops to its own line at the title column', () => {
    const file = writePayload(dir, 't.json', { label: 'Cycle', tasks: [
      { title: 'The traceability matrix omits three acceptance criteria', severity: 'Important' },
    ] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    const body = out.split('===\n')[1].split('\n');
    assert.ok(body.some((l) => l === `${NB(5)}\`[Important]\``), `tag line missing: ${JSON.stringify(body)}`);
    for (const line of body) assert.ok(renderedLen(line) <= displayWidth(), `overflowing row: ${line}`);
  });

  it('every worklist surface holds the rendered width, tags and escapes included', () => {
    const long = 'Collapse the *duplicated* retry_budget into one constant shared by both callers';
    const width = displayWidth();
    const holdWidth = (out) => {
      // Rows, continuations, and notes hold the width; the header and a
      // batch intro are prose lines left to soft-wrap, so they are exempt.
      for (const line of out.split('===\n')[1].split('\n')) {
        if (!/^[○✓⊘\d ]/.test(line)) continue;
        assert.ok(renderedLen(line) <= width, `overflowing row: ${line}`);
      }
    };
    holdWidth(renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: writePayload(dir, 'w.json', { label: 'Cycle', tasks: [
      { title: long, severity: 'Important' },
      { title: 'Short', severity: 'low' },
    ] }) }));
    writeManifest(dir, 'wu3', { phases: { planning: { items: { portal: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    holdWidth(renderSurface(dir, 'findings-summary', { dotpath: 'wu3.planning.portal', file: writePayload(dir, 'w2.json', { review_label: 'Integrity Review', items: [
      { title: long, tag: 'Important', summary: 'A summary long enough to wrap beneath the arrow and hold its hang.' },
    ] }) }));
    holdWidth(renderSurface(dir, 'finding-batch', { dotpath: 'wu3.discussion.checkout', file: writePayload(dir, 'w3.json', { lane: 'route', items: [
      { title: long, target: 'payments-reconciliation-storage', detail: 'Their subtopic owns the claim.' },
    ] }) }));
  });

  it('the tag-fit boundary is exact — at budget it stays inline, one over it drops', () => {
    // Walked 1-digit head is 5 columns; budget 60 at width 65. Tag
    // `Important` costs 12 rendered (space + brackets + 9 letters). A
    // 48-char title fits inline at exactly the width; 49 forces the drop.
    const at = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: writePayload(dir, 'fit.json', { label: 'C', tasks: [
      { title: 'x'.repeat(48), severity: 'Important' },
    ] }) });
    assert.ok(at.includes('x'.repeat(48) + ' `[Important]`'), `expected inline tag: ${at}`);
    const over = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: writePayload(dir, 'over.json', { label: 'C', tasks: [
      { title: 'x'.repeat(49), severity: 'Important' },
    ] }) });
    assert.ok(over.includes(`${NB(5)}\`[Important]\``), `expected dropped tag: ${over}`);
    assert.ok(!over.includes('x `[Important]`'), 'tag not inline past the boundary');
  });

  it('rows pad 10+ numbering with NBSP, never a leading space', () => {
    writeManifest(dir, 'wu2', { phases: { planning: { items: { portal: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `Item ${i + 1}`, tag: 'low', summary: `Detail ${i + 1}` }));
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'wu2.planning.portal', file: writePayload(dir, 'b.json', { review_label: 'Rev', items }) });
    assert.ok(out.includes(`○ ${NB(1)}1. Item 1`), 'single-digit row pads with NBSP');
    assert.ok(out.includes('○ 11. Item 11'), 'two-digit row unpadded');
    // Batch rows are capped below padding range, but the leading column must
    // still never open on a real space — a markdown renderer would strip it.
    const batch = Array.from({ length: 5 }, (_, i) => ({ title: `Item ${i + 1}`, detail: `Detail ${i + 1}` }));
    const bout = renderSurface(dir, 'finding-batch', { dotpath: 'wu2.discussion.checkout', file: writePayload(dir, 'b2.json', { lane: 'apply', items: batch }) });
    assert.ok(bout.includes('1\\. Item 1'), 'unglyphed row opens on its number');
    for (const line of [...out.split('\n'), ...bout.split('\n')]) {
      assert.ok(!/^ /.test(line), `line leads with a real space: ${JSON.stringify(line)}`);
    }
  });

  it('escapes markdown-active characters in the label, title, and note', () => {
    const file = writePayload(dir, 'e.json', {
      review_label: 'Rev *2* [beta]',
      items: [{ title: 'Escape <script> and ~tilde~', tag: 'low', summary: 'see foo_bar and [link] and \\slash' }],
    });
    writeManifest(dir, 'pay2', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay2.planning.portal', file });
    assert.ok(out.includes('**Rev \\*2\\* \\[beta\\]**'), 'label escaped');
    assert.ok(out.includes('Escape \\<script\\> and \\~tilde\\~'), 'title escaped, angle brackets included');
    assert.ok(out.includes('↳ see foo\\_bar and \\[link\\] and \\\\slash'), 'note escaped');
  });

  it('a wrapped note hangs its continuation two columns past the arrow', () => {
    writeManifest(dir, 'pay3', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', {
      review_label: 'Rev',
      items: [{ title: 'T', tag: 'low', summary: 'This note is deliberately long enough that the wrap point lands inside it and produces a continuation line beneath the arrow.' }],
    });
    const out = renderSurface(dir, 'findings-summary', { dotpath: 'pay3.planning.portal', file });
    const lines = out.split('\n');
    const noteAt = lines.findIndex((l) => l.includes('↳ '));
    assert.ok(noteAt > 0, 'note rendered');
    assert.ok(lines[noteAt].startsWith(`${NB(7)}↳ `), 'note at title column + 2');
    assert.ok(lines[noteAt + 1].startsWith(NB(9)), 'continuation hangs past the arrow');
  });

  it('worklist fails loudly on shape errors its callers cannot reach', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    assert.throws(() => worklist({ items: [{ title: 'x' }] }), /exactly one of "heading"\/"intro"/);
    assert.throws(() => worklist({ heading: { label: 'H', noun: 'x' }, intro: 'I', items: [{ title: 'x' }] }), /exactly one of "heading"\/"intro"/);
    assert.throws(() => worklist({ intro: 'I', items: [] }), /"items" must be a non-empty array/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', state: 'banana' }] }), /unknown state "banana"/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', tag: 'has`tick' }] }), /a tag must not contain backticks/);
    assert.throws(() => worklist({ intro: 'I', items: [{ detail: 'no title' }] }), /item 1 needs a non-empty string "title"/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', tag: 'y'.repeat(70) }] }), /cannot fit the display width/);
  });

  it('walked rows pad 10+ numbering with NBSP too', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `T${i + 1}` }));
    const out = worklist({ heading: { label: 'H', noun: 'item' }, items, walked: true });
    assert.ok(out.includes(`○ ${NB(1)}1. T1`), `walked pad is NBSP: ${out.split('\n')[2]}`);
    assert.ok(out.includes('○ 11. T11'), 'two-digit walked row unpadded');
  });

  it('unglyphed rows pad 10+ numbering with a leading NBSP, never a space', () => {
    // No production surface reaches an unglyphed list past the batch cap;
    // the mechanism is pinned directly so an uncapped future caller
    // inherits it working.
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `T${i + 1}` }));
    const out = worklist({ intro: 'I', items });
    assert.ok(out.includes(`${NB(1)}1\\. T1`), `unglyphed pad is a leading NBSP: ${out.split('\n')[2]}`);
    assert.ok(out.includes('11\\. T11'), 'two-digit unglyphed row unpadded');
    for (const line of out.split('\n')) {
      assert.ok(!/^ /.test(line), `line leads with a real space: ${JSON.stringify(line)}`);
    }
  });

  it('an unwalked heading never counts remaining', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const out = worklist({ heading: { label: 'H', noun: 'item' }, items: [{ title: 'a', state: 'approved' }, { title: 'b' }] });
    assert.ok(out.startsWith('**H** — 2 items\n'), `unexpected header: ${out.split('\n')[0]}`);
  });
});

describe('render research-conclude-gate', () => {
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

  it('pins the research address — the gate concludes research and nothing else', () => {
    assert.throws(() => renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.discussion.checkout' }),
      /render research-conclude-gate: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
  });

  it('renders conclude/keep without the flag — no dead-end row', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.match(out, /=== MENU: research conclude gate/);
    assert.match(out, /\*\*`◆ This topic looks ready to conclude\.`\*\*/);
    assert.match(out, /\*\*`c\/conclude`\*\* → Mark this topic as complete, ready for discussion/);
    assert.match(out, /\*\*`k\/keep`\*\*\s+→ Keep digging, there's more to understand/);
    assert.ok(!out.includes('dead end'), 'no dead-end row without the flag');
  });

  it('adds the dead-end row under --dead-end, consequences stated', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout', 'dead-end': '1' });
    assert.match(out, /\*\*`d\/dead-end`\*\*\s+→ Close it as a dead end — completed/);
    assert.match(out, /no discussion owed/);
    assert.match(out, /reversible from the map/);
  });
});

describe('render reroute-offer', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the clear-home offer byte-exactly — destination named, override in hand', () => {
    const file = writePayload(dir, 'o.json', {
      concern: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
    });
    const out = renderSurface(dir, 'reroute-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      '=== MENU: reroute offer (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Whether the pipeline can expose click windows** belongs to a different topic, not this one.',
      'It reads as **behavioural-ranking**\'s ground, landing research-side — append a phase to override (e.g. `r discussion`).',
      '',
      '**`r/reroute`** → Send it to the topic it belongs to; it picks it up',
      `${NB(12)}later`,
      '**`k/keep`**    → Keep it here as part of this topic',
      '',
    ].join('\n'));
  });

  it('renders the bare offer when no home is resolved', () => {
    const file = writePayload(dir, 'b.json', { concern: 'A stray worry' });
    const out = renderSurface(dir, 'reroute-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /\*\*A stray worry\*\* belongs to a different topic, not this one\.\n\n\*\*/);
    assert.ok(!out.includes('ground, landing'), 'no destination line without a resolved home');
  });

  it('a new target adds the creation line byte-exactly — the two existing lines are untouched', () => {
    const file = writePayload(dir, 'n.json', {
      concern: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
      new_target: true,
    });
    const out = renderSurface(dir, 'reroute-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: reroute offer (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**Whether the pipeline can expose click windows** belongs to a different topic, not this one.',
      "It reads as **behavioural-ranking**'s ground, landing research-side — append a phase to override (e.g. `r discussion`).",
      "**behavioural-ranking** isn't on the map yet — rerouting creates it.",
      '',
      '**`r/reroute`** → Send it to the topic it belongs to; it picks it up',
      `${NB(12)}later`,
      '**`k/keep`**    → Keep it here as part of this topic',
      '',
    ].join('\n'));
  });

  it('a grown thread reframes both lines byte-exactly — creation, not relocation', () => {
    const file = writePayload(dir, 'g.json', {
      concern: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
      grown: true,
    });
    const out = renderSurface(dir, 'reroute-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: reroute offer (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**Whether the pipeline can expose click windows** has grown into its own topic here.',
      'Rerouting creates **behavioural-ranking** on the map, landing research-side — the material stays in this file and feeds the new topic through the queue entry and the provenance read at its discussion. Append a phase to override (e.g. `r discussion`).',
      '',
      '**`r/reroute`** → Send it to the topic it belongs to; it picks it up',
      `${NB(12)}later`,
      '**`k/keep`**    → Keep it here as part of this topic',
      '',
    ].join('\n'));
    assert.ok(!out.includes('belongs to a different topic'), 'a grown thread never reads as relocation');
    assert.ok(!out.includes("isn't on the map yet"), 'the creation line is folded into the grown wording');
  });

  it('validates loudly — concern required, target and phase together, phase constrained, flags need a name', () => {
    const bad = (name, obj) => renderSurface(dir, 'reroute-offer', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    assert.throws(() => bad('c.json', { target: 't', landing_phase: 'research' }), /"concern" must be a non-empty string/);
    assert.throws(() => bad('t.json', { concern: 'x', target: 't' }), /come together/);
    assert.throws(() => bad('p.json', { concern: 'x', landing_phase: 'research' }), /come together/);
    assert.throws(() => bad('l.json', { concern: 'x', target: 't', landing_phase: 'planning' }), /"landing_phase" must be "research" or "discussion"/);
    assert.throws(() => bad('g1.json', { concern: 'x', grown: true }),
      /"grown" needs "target" and "landing_phase" — a thread that grew into its own topic carries the name it grew into/);
    assert.throws(() => bad('n1.json', { concern: 'x', new_target: true }),
      /"new_target" needs "target" — there is no new topic without a name/);
    assert.throws(() => bad('ft.json', { concern: 'x', target: 't', landing_phase: 'research', grown: 'yes' }), /"grown" must be true or false/);
    assert.throws(() => bad('fn.json', { concern: 'x', target: 't', landing_phase: 'research', new_target: 1 }), /"new_target" must be true or false/);
    assert.throws(() => renderSurface(dir, 'reroute-offer', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
  });
});

describe('render reroute-candidates', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders numbered candidates, the new option, and the research recommendation byte-exactly', () => {
    const file = writePayload(dir, 'c.json', {
      concern: 'Click-window feasibility',
      landing_phase: 'research',
      candidates: [
        { name: 'behavioural-ranking', lifecycle: 'decided' },
        { name: 'relevance-measurement', lifecycle: 'fresh' },
      ],
    });
    const out = renderSurface(dir, 'reroute-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: reroute candidates (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Where should "Click-window feasibility" land?`**',
      '',
      '**`1`**     → behavioural-ranking [decided]',
      '**`2`**     → relevance-measurement [fresh]',
      '**`n/new`** → Create a new topic for it',
      '',
      "It reads as an open question — I'd land it research-side. Reply with an option, appending a phase to override (e.g. `1 discussion`).",
      '',
    ].join('\n'));
  });

  it('a candidate wears the map\'s own words, never the raw manifest token', () => {
    const file = writePayload(dir, 'l.json', {
      concern: 'x', landing_phase: 'research',
      candidates: [
        { name: 'behavioural-ranking', lifecycle: 'handled' },
        { name: 'relevance-measurement', lifecycle: 'ready_for_discussion' },
        { name: 'signal-freshness', lifecycle: 'ready_for_discussion', research_state: 'superseded' },
        { name: 'query-parsing', lifecycle: 'fresh', routing: 'discussion' },
      ],
    });
    const out = renderSurface(dir, 'reroute-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /→ behavioural-ranking \[dead end\]/);
    assert.match(out, /→ relevance-measurement \[research complete · ready for/);
    assert.match(out, /→ signal-freshness \[research superseded · ready for/);
    assert.match(out, /→ query-parsing \[fresh · routed to discussion\]/);
    assert.ok(!out.includes('[handled]'), 'the raw token never reaches the reader');
    assert.ok(!out.includes('[ready_for_discussion]'), 'the raw token never reaches the reader');
  });

  it('refuses a lifecycle outside the map vocabulary — a mislabel is worse than an echo', () => {
    const file = writePayload(dir, 'u.json', {
      concern: 'x', landing_phase: 'research',
      candidates: [{ name: 'a', lifecycle: 'in-progress' }],
    });
    assert.throws(() => renderSurface(dir, 'reroute-candidates', { dotpath: 'pay.discussion.checkout', file }),
      /candidate 1 carries unknown lifecycle "in-progress" \(expected ready_for_discussion\/researching\/discussing\/decided\/fresh\/handled\/cancelled\)/);
  });

  it('the discussion recommendation flips the wording and the override example', () => {
    const file = writePayload(dir, 'd.json', {
      concern: 'x', landing_phase: 'discussion',
      candidates: [{ name: 'a', lifecycle: 'fresh' }],
    });
    const out = renderSurface(dir, 'reroute-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /a decision to make — I'd land it discussion-side/);
    assert.match(out, /e\.g\. `1 research`/);
  });

  it('validates loudly — phase constrained, candidates non-empty and complete', () => {
    const bad = (name, obj) => renderSurface(dir, 'reroute-candidates', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    assert.throws(() => bad('p.json', { concern: 'x', landing_phase: 'scoping', candidates: [{ name: 'a', lifecycle: 'f' }] }), /"landing_phase" must be "research" or "discussion"/);
    assert.throws(() => bad('e.json', { concern: 'x', landing_phase: 'research', candidates: [] }), /"candidates" must be a non-empty array/);
    assert.throws(() => bad('m.json', { concern: 'x', landing_phase: 'research', candidates: [{ name: 'a' }] }), /candidate 1 is missing "lifecycle"/);
  });
});

describe('render finding-announce', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the opt-in gate — statement, glyphed question, y/l options', () => {
    const file = writePayload(dir, 'ann.json', {
      agent_type: 'review',
      count: 16,
      shape: '3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere',
    });
    const out = renderSurface(dir, 'finding-announce', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      '=== MENU: finding announce (emit verbatim as markdown) ===',
      DOTS,
      'Background review returned — 16 finding(s): 3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere.',
      '',
      '**`◆ Work through them now?`**',
      '',
      '**`y/yes`**   → Start on them',
      "**`l/later`** → Keep pulling on the current thread, I'll raise them at",
      `${NB(10)}the next pause`,
      '',
    ].join('\n'));
  });

  it('refuses a missing or malformed payload field by name', () => {
    const noShape = writePayload(dir, 'n1.json', { agent_type: 'review', count: 2 });
    assert.throws(() => renderSurface(dir, 'finding-announce', { dotpath: 'pay.discussion.checkout', file: noShape }),
      /"shape" must be a non-empty string/);
    const badCount = writePayload(dir, 'n2.json', { agent_type: 'review', count: 0, shape: '2 need a call' });
    assert.throws(() => renderSurface(dir, 'finding-announce', { dotpath: 'pay.discussion.checkout', file: badCount }),
      /"count" must be a positive integer/);
    const noType = writePayload(dir, 'n3.json', { count: 2, shape: '2 need a call' });
    assert.throws(() => renderSurface(dir, 'finding-announce', { dotpath: 'pay.discussion.checkout', file: noType }),
      /"agent_type" must be a non-empty string/);
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
      '=== DISPLAY: finding batch (emit verbatim as markdown) ===',
      "The fix follows from what's already decided. Nothing here is a choice.",
      '',
      '1\\. Self-containment is holed by \\`excluded\\`',
      `${NB(5)}↳ Restate the invariant as ownership, not transport.`,
      '2\\. A retracted rationale survives unmarked',
      `${NB(5)}↳ Superseded when copy-only won; mark it superseded.`,
      '',
      "=== MENU: finding batch (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`y/yes`** → Apply all 2, then move on',
      "**Ask**   → Tell me a number to expand, or one you don't think is",
      `${NB(8)}settled`,
      '',
    ].join('\n'));
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
      '=== DISPLAY: finding batch (emit verbatim as markdown) ===',
      "Each of these has one defensible answer, settled by what's already decided or by first principles. I've made each call and named what determined it.",
      '',
      '1\\. The drain signal carries intent',
      `${NB(5)}↳ All three exit routes sent one signal; determined by the`,
      `${NB(7)}exit table.`,
      '2\\. Unrecognised socket peer stamps \\`via: cli\\`',
      `${NB(5)}↳ A script you wired up is the same class as the CLI;`,
      `${NB(7)}determined by the enum.`,
      '',
      "=== MENU: finding batch (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
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
    assert.match(
      renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: two }),
      /→ Document all 2 and move on \(7 more after this\)$/m,
    );
    const one = writePayload(dir, 'one.json', { lane: 'decide', items: [{ title: 'A', detail: 'a.' }] });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: one });
    assert.match(out, /→ Document it and move on$/m);
    assert.match(out, /^This one has a single defensible answer/m);
    const applyOne = writePayload(dir, 'ap1.json', { lane: 'apply', items: [{ title: 'A', detail: 'a.' }] });
    assert.match(
      renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: applyOne }),
      /→ Apply it, then move on$/m,
    );
    const routeOne = writePayload(dir, 'ro1.json', { lane: 'route', items: [{ title: 'A', target: 't', detail: 'a.' }] });
    assert.match(
      renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: routeOne }),
      /→ Send it$/m,
    );
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
    assert.ok(!out.includes(`${DOTS}\n\n`), 'a label-less menu opens straight on its options');
  });

  it('validates loudly — unknown lane, empty items, per-item fields by lane', () => {
    const bad = (name, obj) => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    // `ask` is the walked lane's name — the plausible producer mistake is
    // sending it to the batch surface, which has no walked screen.
    assert.throws(() => bad('l.json', { lane: 'ask', items: [{ title: 't', detail: 'd' }] }), /"lane" must be one of apply, decide, route/);
    assert.throws(() => bad('e.json', { lane: 'apply', items: [] }), /"items" must be a non-empty array of \{title, detail\}/);
    assert.throws(() => bad('m.json', { lane: 'apply', items: [{ title: 't' }] }), /item 1 is missing "detail"/);
    assert.throws(() => bad('t.json', { lane: 'route', items: [{ title: 't', detail: 'd' }] }), /item 1 is missing "target"/);
    assert.throws(() => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
  });
});

describe('render triage surfaces', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'wu', {});
  });
  afterEach(() => teardown(dir));

  function writeQueue(topic, files) {
    const qdir = path.join(dir, '.workflows', 'wu', 'discussion', '.triage', topic);
    fs.mkdirSync(qdir, { recursive: true });
    for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(qdir, f), body);
  }

  it('triage-announce derives the count with verb agreement, refusing an empty queue', () => {
    assert.throws(() => renderSurface(dir, 'triage-announce', { dotpath: 'wu.discussion.measurement' }), /queue is empty — nothing to announce/);
    writeQueue('measurement', { '001-a.md': 'x' });
    const one = renderSurface(dir, 'triage-announce', { dotpath: 'wu.discussion.measurement' });
    assert.ok(one.startsWith('=== DISPLAY: triage announce (emit verbatim as a code block — do not stop; continue as the workflow instructs) ==='), one);
    assert.ok(one.includes('1 rerouted concern from another topic waits'), one);
    writeQueue('measurement', { '002-b.md': 'y' });
    const two = renderSurface(dir, 'triage-announce', { dotpath: 'wu.discussion.measurement' });
    assert.ok(two.includes('2 rerouted concerns from other topics wait'), two);
  });

  it('triage-offer renders the agenda in queue order and the discuss/later menu', () => {
    writeQueue('measurement', { '001-metrics.md': 'a', '002-tracking.md': 'b' });
    const file = writePayload(dir, 'offer.json', { items: [
      { file: '002-tracking.md', title: 'Expansion tracking', origin: 'synonyms', from_phase: 'discussion', from_date: '2026-08-02' },
      { file: '001-metrics.md', title: 'Offline metrics', origin: 'ranking', from_phase: 'discussion', from_date: '2026-08-01' },
    ] });
    const out = renderSurface(dir, 'triage-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.startsWith([
      '=== DISPLAY: triage agenda (emit verbatim as markdown) ===',
      '**Triage queue** — 2 concerns',
      '',
      '○ 1. Offline metrics',
      `${NB(7)}↳ From ranking · discussion · 2026-08-01`,
      '○ 2. Expansion tracking',
      `${NB(7)}↳ From synonyms · discussion · 2026-08-02`,
    ].join('\n')), out);
    assert.ok(out.includes("=== MENU: triage offer (emit verbatim as markdown, then STOP for the user's response) ==="));
    assert.ok(out.includes('Work through them now?'));
    assert.ok(/\*\*`d\/discuss`\*\* +→ Surface and discuss them one at a time/.test(out));
    assert.ok(/\*\*`l\/later`\*\* +→ Carry on with the session/.test(out));
  });

  it('triage-offer wraps a sentence-length title under itself, with the note beneath', () => {
    writeQueue('measurement', { '001-metrics.md': 'a' });
    const file = writePayload(dir, 'offer.json', { items: [
      { file: '001-metrics.md', title: 'A preset binding persists until broken — three revisions to the positioning model', origin: 'note-model', from_phase: 'discussion', from_date: '2026-07-30' },
    ] });
    const out = renderSurface(dir, 'triage-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.includes([
      '**Triage queue** — 1 concern',
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

  it('triage-offer refuses an empty queue, a short payload, and a payload naming a file the queue lacks', () => {
    const file = writePayload(dir, 'offer.json', { items: [
      { file: '001-metrics.md', title: 'T', origin: 'o', from_phase: 'discussion', from_date: 'd' },
    ] });
    assert.throws(() => renderSurface(dir, 'triage-offer', { dotpath: 'wu.discussion.measurement', file }), /queue is empty — nothing to offer/);
    writeQueue('measurement', { '001-metrics.md': 'a', '002-tracking.md': 'b' });
    assert.throws(() => renderSurface(dir, 'triage-offer', { dotpath: 'wu.discussion.measurement', file }), /payload items must cover the queue exactly/);
    const wrong = writePayload(dir, 'wrong.json', { items: [
      { file: '001-metrics.md', title: 'T', origin: 'o', from_phase: 'discussion', from_date: 'd' },
      { file: '999-ghost.md', title: 'G', origin: 'o', from_phase: 'discussion', from_date: 'd' },
    ] });
    assert.throws(() => renderSurface(dir, 'triage-offer', { dotpath: 'wu.discussion.measurement', file: wrong }), /payload items must cover the queue exactly/);
    const missing = writePayload(dir, 'missing.json', { items: [{ file: '001-metrics.md', title: 'T', origin: 'o', from_date: 'd' }] });
    assert.throws(() => renderSurface(dir, 'triage-offer', { dotpath: 'wu.discussion.measurement', file: missing }), /item 1 is missing "from_phase"/);
  });

  it('requeue-offer renders the statement, the diamond question naming the other phase, and the move/discuss menu', () => {
    writeQueue('measurement', { '001-a-decision-owed.md': 'x' });
    const file = writePayload(dir, 'rq.json', {
      file: '001-a-decision-owed.md', title: 'A decision owed', reason: 'it asks this topic to decide, not to find out.',
    });
    const out = renderSurface(dir, 'requeue-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.startsWith("=== MENU: requeue offer (emit verbatim as markdown, then STOP for the user's response) ==="), out);
    assert.ok(out.includes('**A decision owed** — it asks this topic to decide, not to find out.'), out);
    assert.ok(out.includes('**`◆ Move it to research?`**'), out);
    assert.ok(/\*\*`m\/move`\*\* +→ Move it to this topic's research queue/.test(out), out);
    assert.ok(/\*\*`d\/discuss`\*\* +→ Work it here now/.test(out), out);

    const rdir = path.join(dir, '.workflows', 'wu', 'research', '.triage', 'measurement');
    fs.mkdirSync(rdir, { recursive: true });
    fs.writeFileSync(path.join(rdir, '001-a-decision-owed.md'), 'x');
    const rout = renderSurface(dir, 'requeue-offer', { dotpath: 'wu.research.measurement', file });
    assert.ok(rout.includes('**`◆ Move it to discussion?`**'), rout);
    assert.ok(rout.includes("Move it to this topic's discussion queue"), rout);
  });

  it('requeue-offer refuses a missing payload field, a file the queue lacks, and a phase outside the pair', () => {
    writeQueue('measurement', { '001-a.md': 'x' });
    assert.throws(() => renderSurface(dir, 'requeue-offer', { dotpath: 'wu.discussion.measurement' }), /--file <payload\.json> is required/);
    const missing = writePayload(dir, 'missing.json', { file: '001-a.md', title: 'T' });
    assert.throws(() => renderSurface(dir, 'requeue-offer', { dotpath: 'wu.discussion.measurement', file: missing }), /"reason" must be a non-empty string/);
    const ghost = writePayload(dir, 'ghost.json', { file: '009-ghost.md', title: 'T', reason: 'r' });
    assert.throws(() => renderSurface(dir, 'requeue-offer', { dotpath: 'wu.discussion.measurement', file: ghost }), /is not in the measurement discussion triage queue/);
    const ok = writePayload(dir, 'ok.json', { file: '001-a.md', title: 'T', reason: 'r' });
    assert.throws(() => renderSurface(dir, 'requeue-offer', { dotpath: 'wu.investigation.measurement', file: ok }), /research\/discussion pair only/);
  });

  it('triage-block derives the count and the phase word, refusing an empty queue', () => {
    assert.throws(() => renderSurface(dir, 'triage-block', { dotpath: 'wu.discussion.measurement' }), /queue is empty — nothing blocks conclusion/);
    writeQueue('measurement', { '001-a.md': 'x' });
    const out = renderSurface(dir, 'triage-block', { dotpath: 'wu.discussion.measurement' });
    assert.ok(out.startsWith([
      '=== DISPLAY: triage block (emit verbatim as a properties code block — ```properties fence) ===',
      '⚑ Triage queue not empty — 1 rerouted concern awaiting discussion',
      '',
      '=== DISPLAY: triage block guidance (emit verbatim as markdown) ===',
      '> Returning to the session to surface them before concluding.',
    ].join('\n')), out);
    const rdir = path.join(dir, '.workflows', 'wu', 'research', '.triage', 'measurement');
    fs.mkdirSync(rdir, { recursive: true });
    fs.writeFileSync(path.join(rdir, '001-a.md'), 'x');
    fs.writeFileSync(path.join(rdir, '002-b.md'), 'y');
    const rout = renderSurface(dir, 'triage-block', { dotpath: 'wu.research.measurement' });
    assert.ok(rout.includes('2 rerouted concerns awaiting exploration'), rout);
  });
});

describe('render spec-review-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('continue variant renders the escape-hatch menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'continue' });
    assert.ok(out.includes('=== MENU: spec review continue gate'));
    assert.ok(out.includes('**`◆ Continue with review?`**'));
    assert.ok(/\*\*`p\/proceed`\*\* +→ Continue review/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip review, proceed to completion/.test(out));
  });

  it('reloop variant renders the another-cycle menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'reloop' });
    assert.ok(out.includes('=== MENU: spec review reloop gate'));
    assert.ok(out.includes('**`◆ Run another review cycle?`**'));
    assert.ok(/\*\*`r\/reanalyse`\*\* +→ Run another review cycle \(all three phases\)/.test(out));
    assert.ok(/\*\*`p\/proceed`\*\* +→ Proceed to completion/.test(out));
  });

  it('rejects a missing or unknown variant and a non-specification address', () => {
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal' }), /--variant must be "continue" or "reloop"/);
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'again' }), /--variant must be "continue" or "reloop"/);
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.planning.portal', variant: 'reloop' }), /address must be <work_unit>\.specification\.<topic>/);
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
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the head, streams, signed growth, finding sections, and the growth note', () => {
    const file = writePayload(dir, 'c.json', base);
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: convergence diagnostic (emit verbatim as a code block) ==='));
    assert.ok(out.includes('Spec Review — cycle 5 diagnostic'));
    assert.ok(out.includes('  Trend: converging'));
    assert.ok(out.includes('  Latest cycle: 2 findings (1 new, 1 recurring)'), 'counts derive from the arrays');
    assert.ok(out.includes('  Per stream: claims 0 · input review 1 · gap analysis 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.ok(out.includes('    • Marker semantics restated twice (fixed in cycle 4)'));
    assert.ok(out.includes('    • Guard scope drifts per section (cycles 3, 4, 5)\n      Each fix re-words the guard where it lands instead of at its home.'));
    assert.ok(out.includes('  ⚑ Continuing is likely to resolve remaining items.'));
    assert.ok(out.includes('⚑ Review has added 6802 words'), 'the >25% growth note fires');
    assert.ok(!out.includes('reviewing earlier reviews'), 'the churn warning stays quiet on a converging trend');
  });

  it('churning with growth fires both spec flags; negative growth renders signed and quiets the note', () => {
    const churn = writePayload(dir, 'c2.json', { ...base, trend: 'churning' });
    let out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: churn });
    assert.ok(out.includes('reviewing earlier reviews'), 'the churn-growth warning fires');
    assert.ok(out.includes('⚑ Review has added 6802 words'));
    const shrink = writePayload(dir, 'c3.json', { ...base, live_words: 6500 });
    out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: shrink });
    assert.ok(out.includes('(-335 net across review)'), 'shrink renders a signed value, never +-');
    assert.ok(!out.includes('Review has added'), 'no growth note on a shrinking document');
  });

  it('single-stream loops skip streams and growth; a fix-loop shape renders lean', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'f.json', { loop_type: 'fix', latest_cycle: 3, trend: 'stable', resolved: [], recurring: [{ title: 'Assertion drifts', cycles: '2, 3', hypothesis: 'The fixture regenerates with a shifting seed.' }], new: [] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('Fix Loop — cycle 3 diagnostic'));
    assert.ok(!out.includes('Per stream'));
    assert.ok(!out.includes('Document growth'));
    assert.ok(!out.includes('Resolved:'), 'empty sections are skipped');
    assert.ok(out.includes('  ⚑ Same issues are cycling. Consider manual intervention on the'), 'the stable flag wraps via the callout');
  });

  it('validates loudly: enums, cycle floor, shapes, stream and growth pairing', () => {
    const cases = [
      [{ ...base, loop_type: 'review' }, /"loop_type" must be one of fix\/analysis\/planning-review\/spec-review/],
      [{ ...base, trend: 'oscillating' }, /"trend" must be one of/],
      [{ ...base, latest_cycle: 1 }, /"latest_cycle" must be an integer ≥ 2/],
      [{ ...base, recurring: [{ title: 'x', cycles: '2, 3' }] }, /recurring\[0\] is missing "hypothesis"/],
      [{ ...base, stream_counts: undefined }, /"spec-review" carries "stream_counts"/],
      [{ ...base, loop_type: 'fix', review_baseline_words: undefined, live_words: undefined, stream_counts: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }] }, /"fix" is single-stream/],
      [{ ...base, live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
    ];
    cases.forEach(([payload, re], i) => {
      const file = writePayload(dir, `bad-${i}.json`, payload);
      assert.throws(() => renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file }), re);
    });
  });
});

describe('render spec-completion-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('assessment variant renders the confirm menu', () => {
    const out = renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'assessment' });
    assert.ok(out.includes('=== MENU: spec assessment gate'));
    assert.ok(out.includes('**`◆ Confirm this assessment?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Confirm assessment/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Suggest a different classification/.test(out));
  });

  it('signoff variant renders the conclude consent', () => {
    const out = renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'signoff' });
    assert.ok(out.includes('=== MENU: spec signoff gate'));
    assert.ok(out.includes('**`◆ Ready to conclude?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Conclude specification and mark as completed/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Add context before concluding/.test(out));
  });

  it('rejects a missing or unknown variant and a non-specification address', () => {
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal' }), /--variant must be "assessment" or "signoff"/);
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.specification.portal', variant: 'sign-off' }), /--variant must be "assessment" or "signoff"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'spec-completion-gate', { dotpath: 'pay.discussion.portal', variant: 'signoff' }), /address must be <work_unit>\.specification\.<topic>/);
  });
});

describe('render carry-note-gate', () => {
  let dir;
  const payload = { note: ['→ search-cache: the eviction rule this session settled invalidates its TTL note.'], target: 'search-cache', landing_phase: 'discussion' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { research: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the note, the addressed-to line, and the landing menu', () => {
    const file = writePayload(dir, 'n.json', payload);
    const out = renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file });
    assert.ok(out.includes('=== DISPLAY: carry note'));
    assert.ok(out.includes(payload.note[0]));
    assert.ok(out.includes('*Addressed to: search-cache — lands in its discussion triage queue*'));
    assert.ok(out.includes('=== MENU: carry note gate'));
    assert.ok(out.includes('This note lands in "search-cache"\'s triage queue; if "search-cache" is completed, landing reopens it.'));
    assert.ok(out.includes('**`◆ Land it there?`**'), 'a consent gate carries its glyphed question');
    assert.ok(/\*\*`y\/yes`\*\* +→ Land it there; this document keeps a reroute record/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Leave it as prose in this document/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what to change \(target, phase, or content\)/.test(out));
  });

  it('validates the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal' }), /--file <payload\.json> is required/);
    const bad = writePayload(dir, 'bad.json', { ...payload, note: [] });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: bad }), /"note" must be non-empty/);
    const noTarget = writePayload(dir, 'bad2.json', { ...payload, target: ' ' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: noTarget }), /"target" must be a non-empty string/);
    const badPhase = writePayload(dir, 'bad3.json', { ...payload, landing_phase: 'specification' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: badPhase }), /"landing_phase" must be "research" or "discussion", got "specification"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', payload);
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.discussion.portal', file }), /address must be <work_unit>\.research\.<topic>/);
  });
});

describe('render hypothesis-board', () => {
  let dir;
  const dot = 'hooks.investigation.resume-hooks-silently-lost';
  // One long evidence line — the bug this surface exists to kill was a
  // hand-wrapped board, so the pins below check it survives as one line.
  const EVIDENCE = "The cleanup interval is 10s on the daemon's IDLE branch — exactly when a user is rearranging panes, so a moved pane is reaped within ~10s of the move.";
  const confirmed = {
    id: 'H2', claim: "Coordinate drift orphans a live pane's hook", status: 'confirmed',
    rows: [['Evidence', EVIDENCE], ['Measured', '`grep hookCleanupInterval daemon/reaper.go` → 10s, IDLE branch']],
  };
  const tracing = { id: 'H3', claim: 'Identity design half-finished is the root cause', status: 'tracing', rows: [['Basis', 'Half the key was fixed in July.']] };
  const ruledOut = { id: 'H1', claim: 'Restore races the daemon', status: 'ruled-out', rows: [['Evidence', 'Restore completes before the first prune pass.']] };

  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { 'resume-hooks-silently-lost': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (variant, payload) => renderSurface(dir, 'hypothesis-board', {
    dotpath: dot, variant, file: writePayload(dir, `${variant}.json`, payload),
  });

  it('check-in names what resolved, counts the board, and gates', () => {
    const out = render('check-in', { hypotheses: [ruledOut, confirmed, tracing], resolved_now: ['H1', 'H2'], next: 'Synthesise the root cause' });
    assert.ok(out.includes('=== DISPLAY: hypothesis board (emit verbatim as markdown) ==='));
    assert.ok(out.includes('**Hypothesis board — Resume Hooks Silently Lost** (3 tracked, 1 confirmed, 1 ruled out, 1 open)'));
    assert.ok(out.includes('Resolved this check-in: H1, H2'));
    assert.ok(out.includes("**H2 — Coordinate drift orphans a live pane's hook** — *confirmed*"));
    assert.ok(out.includes('- **Measured**: `grep hookCleanupInterval daemon/reaper.go` → 10s, IDLE branch'));
    assert.ok(out.includes('**Next**: Synthesise the root cause'));
    assert.ok(out.includes('=== MENU: check-in gate'));
    assert.ok(out.includes('**`◆ Continue as planned?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue with the next trace line/.test(out));
    assert.ok(/\*\*Steer\*\* +→ Tell me what to look at instead, or what this changes/.test(out));
  });

  it('never hand-wraps: an evidence row is one authored line whatever its length', () => {
    const out = render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'x' });
    assert.ok(out.includes(`- **Evidence**: ${EVIDENCE}`), 'the evidence survives as a single line for the renderer to reflow');
    const display = out.split('=== MENU')[0];
    assert.ok(!/\n {2,}\S/.test(display), 'no drawn indentation — the display is markdown, not a laid-out block');
  });

  it('plan carries trace lines and the depth, with the plan gate', () => {
    const out = render('plan', {
      hypotheses: [{ ...tracing, status: 'suspected' }],
      trace_lines: ['daemon/reaper.go — the prune pass', 'hooks/key.go — the key-producing sites'],
      depth: 'check-ins', depth_reasoning: 'two systems and an intermittent symptom',
    });
    assert.ok(out.includes('=== DISPLAY: investigation plan (emit verbatim as markdown) ==='));
    assert.ok(out.includes('**Investigation plan — Resume Hooks Silently Lost**'));
    assert.ok(out.includes('**Trace lines**\n- daemon/reaper.go — the prune pass\n- hooks/key.go — the key-producing sites'));
    assert.ok(out.includes('**Depth**: check-ins — two systems and an intermittent symptom'));
    assert.ok(out.includes('**`◆ Does this plan look right?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed with the analysis as planned/.test(out));
    assert.ok(unwrap(out).includes('**Adjust** → Tell me what to change: hypotheses, trace lines, or depth'));
    assert.ok(!out.includes('Resolved this check-in'), 'a plan resolves nothing');
  });

  it('resume re-renders the ledger with what is left', () => {
    const out = render('resume', { hypotheses: [ruledOut, tracing], depth: 'check-ins', remaining: 'H3 is mid-trace' });
    assert.ok(out.includes('=== DISPLAY: resumed plan (emit verbatim as markdown) ==='));
    assert.ok(out.includes('**Investigation plan — Resume Hooks Silently Lost · resumed** (2 tracked, 1 ruled out, 1 open)'));
    assert.ok(out.includes('**Depth**: check-ins\n**Remaining**: H3 is mid-trace'));
    assert.ok(out.includes('**`◆ Picking up where we left off — still good?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue as agreed/.test(out));
  });

  it('pivot leads with what changed, then the replacement direction', () => {
    const out = render('pivot', {
      changed: 'The key format itself is malformed.',
      hypotheses: [{ ...tracing, status: 'suspected' }],
      trace_lines: ['hooks/key.go — the four key-producing sites'],
    });
    assert.ok(out.includes('=== DISPLAY: plan pivot (emit verbatim as markdown) ==='));
    assert.ok(out.includes('**Plan pivot — Resume Hooks Silently Lost**'));
    assert.ok(out.includes('**What changed**: The key format itself is malformed.'));
    assert.ok(out.includes('**Proposed direction**'));
    assert.ok(out.includes('**`◆ Proceed on the new direction?`**'));
    assert.ok(!out.includes('**Depth**'), 'a pivot proposes a direction, never a new checkpoint depth');
  });

  it('validates the variant, the address, and the ledger', () => {
    const file = writePayload(dir, 'v.json', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'x' });
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, file }), /--variant must be one of plan\/resume\/check-in\/pivot/);
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, variant: 'board' }), /--variant must be one of/);
    assert.throws(() => renderSurface(dir, 'hypothesis-board', { dotpath: dot, variant: 'check-in' }), /--file <payload\.json> is required/);
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { discussion: { items: { hooks: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'hypothesis-board', { dotpath: 'hooks.discussion.hooks', variant: 'check-in', file }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/,
    );
  });

  it('validates the ledger entries', () => {
    const bad = (h) => () => render('check-in', { hypotheses: h, resolved_now: ['H2'], next: 'x' });
    assert.throws(bad([]), /"hypotheses" must be a non-empty array/);
    assert.throws(bad([{ ...confirmed, id: ' ' }]), /hypotheses\[0\] is missing "id"/);
    assert.throws(bad([confirmed, confirmed]), /duplicate hypothesis id "H2"/);
    assert.throws(bad([{ ...confirmed, claim: '' }]), /hypotheses\[0\] is missing "claim"/);
    assert.throws(bad([{ ...confirmed, status: 'proven' }]), /unknown status "proven" \(expected suspected\/tracing\/confirmed\/ruled-out\)/);
    assert.throws(bad([{ ...confirmed, rows: [] }]), /needs "rows"/);
    assert.throws(bad([{ ...confirmed, rows: [['Evidence']] }]), /row 1 must be a \[label, value\] pair/);
  });

  it('refuses a field that runs to more than one line — it would break the markdown around it', () => {
    const bad = (h) => () => render('check-in', { hypotheses: [h], resolved_now: ['H2'], next: 'x' });
    assert.throws(bad({ ...confirmed, claim: 'Coordinate drift\norphans a hook' }), /hypotheses\[0\] claim runs to more than one line — split it across rows, or leave the detail in the investigation file/);
    assert.throws(bad({ ...confirmed, rows: [['Evidence', 'line one\nline two']] }), /hypotheses\[0\] row 1 value runs to more than one line/);
    assert.throws(bad({ ...confirmed, rows: [['Ev\nidence', 'x']] }), /hypotheses\[0\] row 1 label runs to more than one line/);
    assert.throws(
      () => render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'], next: 'Trace the reaper\nthen the doctor' }),
      /"next" runs to more than one line/,
    );
    assert.throws(
      () => render('plan', { hypotheses: [confirmed], trace_lines: ['daemon/reaper.go\nhooks/key.go'], depth: 'check-ins', depth_reasoning: 'x' }),
      /trace_lines\[0\] runs to more than one line/,
    );
  });

  it('carries any ledger shape — free row labels, however many a hypothesis needs', () => {
    const out = render('check-in', {
      hypotheses: [
        { id: 'A', claim: 'One line of basis is enough', status: 'ruled-out', rows: [['Ruled out by', 'The sampled runs disagree with it.']] },
        {
          id: 'B',
          claim: 'This one earned six rows',
          status: 'confirmed',
          rows: [['Evidence', 'a'], ['Measured', 'b'], ['Reproduced', 'c'], ['Blast radius', 'd'], ['Why it hid', 'e'], ['Owner', 'f']],
        },
      ],
      resolved_now: ['A', 'B'],
      next: 'x',
    });
    assert.ok(out.includes('**A — One line of basis is enough** — *ruled-out*'));
    assert.ok(out.includes('- **Ruled out by**: The sampled runs disagree with it.'));
    assert.ok(out.includes('- **Why it hid**: e'), 'a label the surface has never seen renders like any other');
    assert.ok(out.includes('(2 tracked, 1 confirmed, 1 ruled out, 0 open)'));
  });

  it('validates each variant against what it must carry', () => {
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: [], next: 'x' }), /"resolved_now" must be a non-empty array/);
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: ['H9'], next: 'x' }), /"resolved_now" names "H9", which is not on the board/);
    assert.throws(
      () => render('check-in', { hypotheses: [tracing], resolved_now: ['H3'], next: 'x' }),
      /"H3" is named in "resolved_now" but its status is "tracing" — a resolved hypothesis is confirmed or ruled-out/,
    );
    assert.throws(() => render('check-in', { hypotheses: [confirmed], resolved_now: ['H2'] }), /"next" must be a non-empty string/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: [], depth: 'check-ins', depth_reasoning: 'x' }), /"trace_lines" must be a non-empty array/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: ['t'] }), /"depth_reasoning" must be a non-empty string/);
    assert.throws(() => render('plan', { hypotheses: [confirmed], trace_lines: ['t'], depth: 'deep', depth_reasoning: 'x' }), /"depth" must be one of straight-through\/check-ins/);
    assert.throws(() => render('resume', { hypotheses: [confirmed], depth: 'check-ins' }), /"remaining" must be a non-empty string/);
    assert.throws(() => render('pivot', { hypotheses: [confirmed], trace_lines: ['t'] }), /"changed" must be a non-empty string/);
  });
});

describe('render validation-gate / validation-report', () => {
  let dir;
  const inv = 'hooks.investigation.crash';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const report = (variant, payload) => renderSurface(dir, 'validation-report', {
    dotpath: inv, variant, file: writePayload(dir, `v-${variant}.json`, payload),
  });

  const RC_CHECKS = [['Symptom coverage', 'all three trace to the same call'], ['Blast radius', 'two further callers share the path']];
  const FX_CHECKS = [['Root cause coverage', 'every symptom resolved'], ['Side effects', 'none identified']];
  const rcClean = {
    status: 'validated', confidence: 'high', checks: RC_CHECKS,
    summary: 'The diagnosis holds against a fresh trace.',
    analysis_path: '.workflows/.cache/hooks/investigation/crash/agents/002.md',
  };
  const fxClean = {
    status: 'validated', confidence: 'medium', direction: 'Make the address optional', checks: FX_CHECKS,
    summary: 'The direction breaks the causal chain and no caller depends on the throw.',
    analysis_path: 'p.md',
  };

  it('offers the root cause validation in its own words, payload-less', () => {
    const rc = renderSurface(dir, 'validation-gate', { dotpath: inv, variant: 'root-cause' });
    assert.ok(rc.includes('=== MENU: root-cause validation offer'));
    assert.ok(rc.includes('**`◆ Root cause documented. Run validation?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Run root cause validation/.test(rc));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip straight to findings sign-off/.test(rc));
  });

  it('never offers the fix validation — an agreed direction is always pressure-tested', () => {
    assert.throws(
      () => renderSurface(dir, 'validation-gate', { dotpath: inv, variant: 'fix' }),
      /--variant must be root-cause — the fix direction is always pressure-tested/,
    );
    assert.throws(() => renderSurface(dir, 'validation-gate', { dotpath: inv }), /--variant must be root-cause/);
  });

  it('a clean pass carries the same readout as a failing one, and no menu', () => {
    const out = report('root-cause', rcClean);
    assert.ok(out.includes('**Root cause validation · high confidence** — validated, no gaps found'));
    assert.ok(out.includes('- **Symptom coverage**: all three trace to the same call'));
    assert.ok(out.includes('The diagnosis holds against a fresh trace.'));
    assert.ok(out.includes('*Full analysis: `.workflows/.cache/hooks/investigation/crash/agents/002.md`*'));
    assert.ok(!out.includes('=== MENU'), 'a validated verdict asks nothing');
    const fx = report('fix', fxClean);
    assert.ok(fx.includes('**Fix validation · "Make the address optional" · medium confidence** — confirmed, no unaddressed risks'));
    assert.ok(fx.includes('- **Root cause coverage**: every symptom resolved'));
  });

  it('findings list under the confidence, with the checks, the analysis path and the handling gate', () => {
    const long = 'The trace stops at the tax context, but nothing checks whether the billing address is reliably present on a digital-only order.';
    const out = report('root-cause', {
      ...rcClean, status: 'gaps_found', confidence: 'medium',
      items: [long, 'Empty-string addresses were never exercised.'],
      analysis_path: '.workflows/.cache/hooks/investigation/crash/agents/003.md',
    });
    assert.ok(out.includes('**Root cause validation · medium confidence** — 2 gaps'));
    assert.ok(out.includes('1\\. The trace stops at the tax context'), 'a batch list numbers its rows and never walks them');
    assert.ok(!out.includes('○ 1.'), 'nothing here is walked, so no state glyph');
    assert.ok(out.includes('- **Blast radius**: two further callers share the path'), 'the findings say what was examined too');
    assert.ok(out.includes('*Full analysis: `.workflows/.cache/hooks/investigation/crash/agents/003.md`*'));
    assert.ok(out.includes('**`◆ How should these gaps be handled?`**'));
    assert.ok(unwrap(out).includes('**`a/address`** → Work through them and fold the answers into the investigation'));
    const fx = report('fix', { ...fxClean, status: 'risks_found', confidence: 'low', items: ['x'] });
    assert.ok(fx.includes('**Fix validation · "Make the address optional" · low confidence** — 1 risk'));
    assert.ok(unwrap(fx).includes('**`a/address`** → Work through them and fold the outcome into the fix direction'));
  });

  it('refuses a verdict that disagrees with its own findings', () => {
    assert.throws(
      () => report('root-cause', { ...rcClean, items: ['a gap'] }),
      /"status" is "validated" but 1 gap\(s\) are listed — the verdict and the findings must agree/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, status: 'gaps_found', items: [] }),
      /"status" is "gaps_found" but no gaps are listed/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, status: 'risks_found', items: ['x'] }),
      /"status" must be "validated" or "gaps_found" for the root-cause variant/,
    );
    assert.throws(
      () => report('fix', { ...fxClean, confidence: 'certain' }),
      /"confidence" must be one of high\/medium\/low/,
    );
  });

  it('holds every verdict to naming what it checked, concluded and confirmed', () => {
    assert.throws(
      () => report('fix', { ...fxClean, direction: undefined }),
      /"direction" must name the agreed approach/,
    );
    assert.throws(
      () => report('root-cause', { ...rcClean, direction: 'Make the address optional' }),
      /"direction" belongs to the fix variant — root-cause validation has no chosen approach to name/,
    );
    assert.throws(() => report('fix', { ...fxClean, checks: [] }), /"checks" must be a non-empty array/);
    assert.throws(() => report('fix', { ...fxClean, checks: [['Testing']] }), /checks\[0\] must be a \[label, outcome\] pair/);
    assert.throws(() => report('fix', { ...fxClean, summary: undefined }), /"summary" must be a non-empty string/);
    assert.throws(() => report('fix', { ...fxClean, analysis_path: undefined }), /"analysis_path" must be a non-empty string/);
  });

  it('holds the address to the investigation phase', () => {
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { discussion: { items: { crash: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'validation-gate', { dotpath: 'hooks.discussion.crash', variant: 'root-cause' }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "discussion"/,
    );
  });
});

describe('render project-skills / linters', () => {
  let dir;
  const imp = 'hooks.implementation.crash';
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { implementation: { items: { crash: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (surface, variant, payload) => renderSurface(dir, surface, {
    dotpath: imp, variant, file: payload && writePayload(dir, `${surface}-${variant}.json`, payload),
  });

  it('project skills: a stored set confirms compact, a fresh scan is chosen from the full list', () => {
    const c = render('project-skills', 'confirm', { skills: ['laravel-conventions', 'laravel-testing'] });
    assert.ok(c.includes('**Project skills** — 2 from the project default'));
    assert.ok(c.includes('laravel-conventions, laravel-testing'));
    assert.ok(!c.includes('1\\.'), 'a confirm is a comma run, not a numbered worklist');
    assert.ok(c.includes('**`◆ Use these project skills?`**'));
    const d = render('project-skills', 'discovery', { skills: [{ name: 'a', detail: 'x' }, { name: 'b', detail: 'y' }] });
    assert.ok(d.includes('**Project skills** — 2 skills'));
    assert.ok(d.includes('1\\. a — x'));
    assert.ok(d.includes('**`◆ Which project skills should be used?`**'));
    assert.ok(unwrap(d).includes('**List the ones you want** → Name them — e.g. "golang-pro, react-patterns"'));
  });

  it('linters: a discovery carries installed state as the row tag and its recommendations beneath', () => {
    const out = render('linters', 'discovery', {
      linters: [{ name: 'pint', detail: 'vendor/bin/pint', installed: true }, { name: 'phpstan', detail: 'vendor/bin/phpstan', installed: false }],
      recommendations: 'phpstan is not installed — `composer require --dev phpstan/phpstan`.',
    });
    assert.ok(out.includes('**Linter discovery** — 2 linters'));
    assert.ok(out.includes('1\\. pint — vendor/bin/pint `[installed]`'));
    assert.ok(out.includes('2\\. phpstan — vendor/bin/phpstan `[missing]`'));
    assert.ok(out.includes('**Recommended**: phpstan is not installed'));
    assert.ok(out.includes('**`◆ Approve these linters?`**'));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip linter setup \(no linting during TDD\)/.test(out));
  });

  it('linters: a stored set confirms compact with no installed state and no recommendations', () => {
    const out = render('linters', 'confirm', { linters: ['pint', 'phpstan'] });
    assert.ok(out.includes('**Linters** — 2 from the project default'));
    assert.ok(out.includes('pint, phpstan'));
    assert.ok(!out.includes('`[installed]`'), 'an approved set was already checked');
    assert.ok(out.includes('**`◆ Use these linters?`**'));
    assert.throws(
      () => render('linters', 'discovery', { linters: [{ name: 'pint', detail: 'vendor/bin/pint' }] }),
      /every row of a discovery needs "installed"/,
    );
  });

  it('the skipped variants ask again without a payload', () => {
    const s = render('project-skills', 'skipped');
    assert.ok(s.includes('Previous implementations used no project skills.'));
    assert.ok(s.includes('**`◆ Skip project skills again?`**'));
    assert.ok(/\*\*`n\/no`\*\* +→ Analyse for project skills/.test(s));
    const l = render('linters', 'skipped');
    assert.ok(l.includes('Previous implementations skipped linters.'));
    assert.ok(l.includes('**`◆ Skip linters again?`**'));
    assert.ok(/\*\*`n\/no`\*\* +→ Run full linter discovery/.test(l));
  });

  it('validates the variant, the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'linters', { dotpath: imp }), /--variant must be one of confirm\/discovery\/skipped/);
    assert.throws(() => renderSurface(dir, 'linters', { dotpath: imp, variant: 'confirm' }), /--file <payload\.json> is required/);
    assert.throws(() => render('linters', 'confirm', { linters: [] }), /"linters" must be a non-empty array/);
    assert.throws(() => render('project-skills', 'confirm', { skills: [{ name: 'a', detail: 'b' }] }), /skills\[0\] must be a non-empty string/);
    assert.throws(() => render('project-skills', 'discovery', { skills: [{ name: 'a' }] }), /skills\[0\] is missing "detail"/);
    assert.throws(() => render('project-skills', 'discovery', { skills: [{ detail: 'a' }] }), /skills\[0\] is missing "name"/);
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { planning: { items: { crash: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'project-skills', { dotpath: 'hooks.planning.crash', variant: 'skipped' }),
      /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/,
    );
  });
});

describe('render fix-direction', () => {
  let dir;
  const dot = 'hooks.investigation.checkout-crash';
  const rows = [['Changes', 'The constructor takes an optional address.'], ['Risk', 'A caller relying on the throw would start succeeding.']];
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { investigation: { items: { 'checkout-crash': { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (payload) => renderSurface(dir, 'fix-direction', { dotpath: dot, file: writePayload(dir, 'fd.json', payload) });

  it('a lone option is unlettered and uncounted', () => {
    const out = render({ options: [{ name: 'Make the address optional', rows }] });
    assert.ok(out.includes('=== DISPLAY: fix direction (emit verbatim as markdown) ==='));
    assert.ok(out.includes('**Fix direction — Checkout Crash**\n'));
    assert.ok(!out.includes('approaches)'), 'one approach is not a comparison');
    assert.ok(out.includes('**Make the address optional**\n'), 'no letter where there is nothing to compare against');
    assert.ok(out.includes('- **Changes**: The constructor takes an optional address.'));
    assert.ok(out.includes('=== MENU: fix direction gate'));
    assert.ok(out.includes('**`◆ What are your thoughts?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Agree with this direction and pressure-test it/.test(out), 'agreement commissions the validation');
    assert.ok(unwrap(out).includes('**Provide feedback** → Tell me your thoughts: discuss, challenge, or suggest alternatives'));
  });

  it('several options letter themselves, count themselves, and carry the mark', () => {
    const out = render({
      options: [
        { name: 'Make the address optional', recommended: true, rows },
        { name: 'Guard at the call site', rows },
        { name: 'Backfill the address', rows },
      ],
      recommendation: 'A — it fixes the assumption rather than working around it.',
      open_question: 'Whether the empty-string case is the same bug.',
    });
    assert.ok(out.includes('**Fix direction — Checkout Crash** (3 approaches)'));
    assert.ok(out.includes('**A — Make the address optional** — *recommended*'));
    assert.ok(out.includes('**B — Guard at the call site**\n'));
    assert.ok(out.includes('**C — Backfill the address**\n'));
    assert.ok(out.includes('**Recommendation**: A — it fixes the assumption rather than working around it.'));
    assert.ok(out.includes('**Open question**: Whether the empty-string case is the same bug.'));
  });

  it('a recommendation must say which and why, and only where there is a comparison', () => {
    assert.throws(
      () => render({ options: [{ name: 'a', rows }, { name: 'b', recommended: true, rows }] }),
      /a recommended option needs "recommendation" — the deciding factor, not just the mark/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', rows }, { name: 'b', rows }], recommendation: 'b is better' }),
      /"recommendation" was given but no option is marked "recommended"/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', recommended: true, rows }], recommendation: 'x' }),
      /a lone option cannot be "recommended" — there is nothing to recommend it over/,
    );
    assert.throws(
      () => render({ options: [{ name: 'a', recommended: true, rows }, { name: 'b', recommended: true, rows }], recommendation: 'x' }),
      /only one option can be "recommended"/,
    );
  });

  it('validates the options, their rows, and the address', () => {
    assert.throws(() => renderSurface(dir, 'fix-direction', { dotpath: dot }), /--file <payload\.json> is required/);
    assert.throws(() => render({ options: [] }), /"options" must be a non-empty array .* one obvious fix is a valid outcome, none is not/);
    assert.throws(() => render({ options: [{ rows }] }), /options\[0\] is missing "name"/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [] }] }), /options\[0\] needs "rows"/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [['Changes']] }] }), /options\[0\] row 1 must be a \[label, value\] pair/);
    assert.throws(() => render({ options: [{ name: 'a\nb', rows }] }), /options\[0\] name runs to more than one line/);
    assert.throws(() => render({ options: [{ name: 'a', rows: [['Changes', 'one\ntwo']] }] }), /options\[0\] row 1 value runs to more than one line/);
    assert.throws(
      () => render({ options: Array.from({ length: 9 }, (_, i) => ({ name: `o${i}`, rows })) }),
      /9 options is past comparing — this surface letters at most 8/,
    );
    writeManifest(dir, 'hooks', { work_type: 'bugfix', phases: { specification: { items: { 'checkout-crash': { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'fix-direction', { dotpath: 'hooks.specification.checkout-crash', file: writePayload(dir, 'fd2.json', { options: [{ name: 'a', rows }] }) }),
      /address must be <work_unit>\.investigation\.<topic>, got phase "specification"/,
    );
  });
});

describe('render finding', () => {
  let dir;
  const base = {
    n: 1, total: 2, title: 'Missing Outcome field',
    meta: [['Severity', 'Minor'], ['Change Type', 'add-to-task']],
    problem: 'A task with no Outcome leaves the builder guessing what done looks like.',
  };
  const settled = { ...base, move: 'settled', proposal: 'The template fixes this — I would add the Outcome line the other tasks carry.' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
  });
  afterEach(() => teardown(dir));

  it('leads with the problem and the call, renders the diff in place, and gates on a question', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      diff: { context_above: ['**Solution**: shared adapter.'], current: [], proposed: ['**Outcome**: lands at a live shell.'], context_below: ['**Do**:'] },
      apply_label: 'Apply to the plan verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.startsWith([
      '=== DISPLAY: finding (emit verbatim as markdown) ===',
      '**Finding 1 of 2: Missing Outcome field**',
      '',
      '- **Severity**: Minor',
      '- **Change Type**: add-to-task',
      '',
      'A task with no Outcome leaves the builder guessing what done looks like.',
      '',
      'The template fixes this — I would add the Outcome line the other tasks carry.',
      '',
    ].join('\n')));
    assert.ok(out.includes('=== DISPLAY: diff (emit verbatim as a diff code block (```diff fence)) ===\n **Solution**: shared adapter.\n+**Outcome**: lands at a live shell.\n **Do**:'));
    assert.ok(!/frame|╭|╰/.test(out), 'the fence is the frame — no drawn borders, no frame sections');
    assert.ok(out.includes('=== MENU: finding gate'));
    assert.ok(/\*\*`◆ Apply this\?`\*\*/.test(out), 'the menu opens with a question, never a second copy of the heading');
    assert.strictEqual(out.match(/\*\*Finding 1 of 2: Missing Outcome field\*\*/g).length, 1, 'the heading renders exactly once');
    assert.ok(/\*\*`y\/yes`\*\* +→ Apply to the plan verbatim/.test(out));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining settled findings automatically/.test(unwrap(out)));
    assert.ok(/\*\*Discuss\*\* +→ Challenge it, adjust it, or decline it/.test(unwrap(out)));
  });

  it('never offers skip — a found problem is settled, chosen, or routed, never waved past', () => {
    const file = writePayload(dir, 'f.json', { ...settled, content: { label: 'Proposed Addition', lines: ['New spec section body.'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!/skip/i.test(out), 'no skip option at any gate');
  });

  it('holds whole proposed content behind v/view instead of dumping it as source', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', '> Retries are bounded at four attempts.'] },
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!out.includes('DISPLAY: finding content'), 'the proposed section is not rendered at the gate');
    assert.ok(!out.includes('## Delivery'), 'artifact source never reaches the presentation');
    assert.ok(/\*\*`v\/view`\*\* +→ Show the exact wording/.test(out), 'the wording is reachable, not imposed');
    assert.ok(!out.includes('view full'), 'view full is gone — there is no full copy to re-show');
  });

  it('--view full answers the v/view row: the wording and the gate again, the report not repeated', () => {
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', 'Retries are bounded at four attempts.'] },
      apply_label: 'Apply to the specification verbatim',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file, view: 'full' });
    assert.ok(out.startsWith('=== DISPLAY: finding wording (emit verbatim as markdown) ===\n**Proposed Addition**\n\n## Delivery'));
    assert.ok(!out.includes('DISPLAY: finding ('), 'the report is not re-rendered — one finding never fills a screen twice');
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!/`v\/view`/.test(out), 'the view row is spent');
    assert.ok(/\*\*`y\/yes`\*\* +→ Apply to the specification verbatim/.test(out));
    assert.ok(/\*\*Discuss\*\*/.test(out), 'the view menu is the gate menu minus the view row');
  });

  it('--view full validates the wording it shows — malformed content refuses in the surface vocabulary', () => {
    const noLabel = writePayload(dir, 'v1.json', { ...settled, content: { lines: ['x'] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: noLabel, view: 'full' }),
      /"content.label" must be a non-empty string/);
    const noLines = writePayload(dir, 'v2.json', { ...settled, content: { label: 'L' } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: noLines, view: 'full' }),
      /"content.lines" must be an array of strings/);
    const emptyLines = writePayload(dir, 'v3.json', { ...settled, content: { label: 'L', lines: [] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: emptyLines, view: 'full' }),
      /"content.lines" must be non-empty/);
  });

  it('--view full over an auto address offers no a/auto row — the mode is already set', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'va.json', { ...settled, content: { label: 'L', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file, view: 'full' });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!/`a\/auto`/.test(out));
  });

  it('--view full is refused where there is no wording to show, and on a choice', () => {
    const diffFile = writePayload(dir, 'd.json', { ...settled, diff: { current: [], proposed: ['x'] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: diffFile, view: 'full' }),
      /--view needs "content" — a diff finding shows its change in place/);
    const choiceFile = writePayload(dir, 'c.json', { ...base, move: 'choice', options: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: choiceFile, view: 'full' }),
      /--view serves a settled finding's wording; a choice proposes none/);
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: diffFile, view: 'part' }),
      /--view only accepts "full"/);
  });

  it('a diff finding offers no view — the change is already visible in place', () => {
    const file = writePayload(dir, 'f.json', { ...settled, diff: { current: ['old'], proposed: ['new'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(!/`v\/view`/.test(out));
  });

  it('wide diff lines pass through untouched — no border, no wrap', () => {
    const long = 'x'.repeat(150);
    const file = writePayload(dir, 'f.json', { ...settled, diff: { current: [], proposed: [long] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes(`\n+${long}\n`), 'the fence re-flows in the host; the engine never wraps diff lines');
  });

  it('a settled finding rides auto: the report renders, the gate does not', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['New spec section body.'] },
      applied_label: 'approved. Added to specification.',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown) ==='), 'auto drops the stop, never the showing');
    assert.ok(out.includes('=== DISPLAY: finding auto-approved (after applying the fix: emit verbatim as a code block — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nFinding 1 of 2: Missing Outcome field — approved. Added to specification.'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('a choice stops over auto, numbers its options recommended-first, and offers no a/auto row', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...base,
      move: 'choice',
      options: [{ summary: 'Hold the queue slot and keep retrying' }, { summary: 'Bound retries at four, then dead-letter', recommended: true }],
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== MENU: finding choice'), 'auto never decides what only the user can');
    assert.ok(!out.includes('finding auto-approved'));
    assert.ok(unwrap(out).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'a stop over auto announces itself in the engine\'s one voice');
    assert.ok(/\*\*`◆ Which way\?`\*\*/.test(out));
    assert.ok(/\*\*`1`\*\* +→ Bound retries at four, then dead-letter \(recommended\)/.test(out), 'the recommendation sorts first');
    assert.ok(/\*\*`2`\*\* +→ Hold the queue slot and keep retrying/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what you're thinking/.test(out));
    assert.ok(!/`a\/auto`/.test(out), 'a choice never offers the auto opt-in');
    assert.ok(!/skip/i.test(out));
  });

  it('a gated choice carries no auto-override line — there is nothing being overridden', () => {
    const file = writePayload(dir, 'cg.json', {
      ...base,
      move: 'choice',
      options: [{ summary: 'a' }, { summary: 'b', recommended: true }],
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding choice'));
    assert.ok(!out.includes('Auto is on'));
  });

  it('contradiction is a legal category token — cosmetic, deciding nothing', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'ct.json', { ...settled, category: 'contradiction' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('finding auto-approved'), 'the move rides auto whatever the category reads');
  });

  it('the category no longer picks the shape — a gap rides auto when the record settles it', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', { ...settled, category: 'gap' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('finding auto-approved'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('validates loudly: move, shape, exclusivity, and empty diff', () => {
    const cases = [
      [{ ...settled, n: 0 }, /"n" must be a positive integer/],
      [{ ...settled, total: 0 }, /"total" must be an integer/],
      [{ ...settled, meta: [['x']] }, /"meta" must be an array of \[label, value\] pairs/],
      [{ ...settled, problem: ' ' }, /"problem" must be a non-empty string/],
      [{ ...base, move: 'route' }, /a "route" finding goes to resolve-source-incoherence and never renders at the gate/],
      [{ ...base }, /"move" must be one of settled\/choice/],
      [{ ...base, move: 'apply' }, /"move" must be one of settled\/choice/],
      [{ ...settled, category: 'source-defect' }, /"source-defect" findings route via resolve-source-incoherence and never render at the gate/],
      [{ ...settled, category: 'unsourced-decision' }, /"unsourced-decision" findings route via resolve-source-incoherence/],
      [{ ...settled, category: 'severity' }, /unknown category "severity"/],
      [{ ...base, move: 'settled' }, /a "settled" finding must carry a "proposal"/],
      [{ ...settled, options: [{ summary: 'a' }, { summary: 'b' }] }, /a "settled" finding carries no "options"/],
      [{ ...settled, diff: { current: [], proposed: ['x'] }, content: { label: 'X', lines: ['y'] } }, /pass "diff" or "content", not both/],
      [{ ...settled, diff: { current: [], proposed: [] } }, /"diff" must carry at least one/],
      [{ ...settled, content: { label: 'X', lines: [] } }, /"content.lines" must be non-empty/],
      [{ ...settled, content: { lines: ['x'] } }, /"content.label" must be a non-empty string/],
      [{ ...settled, content: { label: 'X', lines: 'not an array' } }, /"content.lines" must be an array of strings/],
      [{ ...base, move: 'choice', options: [{ summary: 'only one' }] }, /a "choice" finding must carry at least 2 "options"/],
      [{ ...base, move: 'choice', options: [{ summary: 'a' }, { notASummary: true }] }, /options\[1\]\.summary must be a non-empty string/],
      [{ ...base, move: 'choice', options: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] }, /at most one option may be recommended/],
      [{ ...base, move: 'choice', proposal: 'already decided', options: [{ summary: 'a' }, { summary: 'b' }] }, /a "choice" finding carries no "proposal"/],
      [{ ...base, move: 'choice', content: { label: 'X', lines: ['y'] }, options: [{ summary: 'a' }, { summary: 'b' }] }, /a "choice" finding carries no "content"/],
    ];
    cases.forEach(([payload, re], i) => {
      const file = writePayload(dir, `bad-${i}.json`, payload);
      assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file }), re);
    });
  });
});

describe('render proposed-task', () => {
  let dir;
  const payload = {
    current: 2, total: 3, title: 'Fix adapter leak', severity: 'Important',
    sources: 'reviewer cycle 1',
    problem: 'The adapter never closes.', solution: 'Close on detach.', outcome: 'No leaked handles.',
    steps: ['1. Add Close()', '2. Call it on detach'],
    criteria: ['- no leaked handles after detach'],
    tests: ['- detach closes the adapter'],
  };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the task detail plus the approval menu when gated, byte-exactly', () => {
    const file = writePayload(dir, 'p.json', payload);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**`▪ Fix adapter leak (2 of 3)`** (Important)',
      'Sources: reviewer cycle 1',
      '',
      '**Problem**: The adapter never closes.',
      '**Solution**: Close on detach.',
      '**Outcome**: No leaked handles.',
      '',
      '**Do**:',
      '1. Add Close()',
      '2. Call it on detach',
      '',
      '**Acceptance Criteria**:',
      '- no leaked handles after detach',
      '',
      '**Tests**:',
      '- detach closes the adapter',
      '',
      '=== MENU: task approval (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**     → Approve this task',
      '**`a/auto`**    → Approve this and all remaining tasks automatically',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
  });

  it('honours a custom comment hint and the auto gate', () => {
    const file = writePayload(dir, 'p.json', payload);
    const gated = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(gated));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('=== DISPLAY: task auto-approved (after recording the approval: emit verbatim as a code block — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nTask 2 of 3: Fix adapter leak — approved [auto].'));
    assert.ok(!auto.includes('MENU: task approval'));
  });

  it('requires --gate and validates the payload loudly', () => {
    const file = writePayload(dir, 'p.json', payload);
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file }), /--gate must be "gated" or "auto"/);
    const noTests = writePayload(dir, 'bad.json', { ...payload, tests: [] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noTests, gate: 'gated' }), /"tests" must be non-empty/);
    const noProblem = writePayload(dir, 'bad2.json', { ...payload, problem: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }), /"problem" must be a non-empty string/);
    const emptySeverity = writePayload(dir, 'bad3.json', { ...payload, severity: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptySeverity, gate: 'gated' }), /"severity" must be a non-empty string when present/);
  });

  // Proposal altitude — the judge's output, before any authoring: problem and
  // solution alone, the three blocks and outcome absent.
  const proposal = {
    current: 1, total: 4, title: 'Merge the near-miss helpers', severity: 'near-miss',
    placement: 'phase 3',
    problem: 'Two helpers differ only in their error text.',
    solution: 'Fold them into one and take the caller-supplied message.',
  };

  it('renders a proposal — no blocks, no outcome, the approval menu unchanged, byte-exactly', () => {
    const file = writePayload(dir, 'pr.json', proposal);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**`▪ Merge the near-miss helpers (1 of 4)`** (near-miss)',
      'Placement: phase 3',
      '',
      '**Problem**: Two helpers differ only in their error text.',
      '**Solution**: Fold them into one and take the caller-supplied message.',
      '',
      '=== MENU: task approval (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**     → Approve this task',
      '**`a/auto`**    → Approve this and all remaining tasks automatically',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
  });

  it('mixes present and absent blocks — each renders under its own heading, none leaves a hole', () => {
    const file = writePayload(dir, 'mx.json', {
      current: 2, total: 4, title: 'Drop the dead formatter', severity: 'dead-code',
      problem: 'Nothing calls it.', solution: 'Delete it.', outcome: 'One fewer surface to keep true.',
      tests: ['- the suite stays green'],
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.startsWith([
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**`▪ Drop the dead formatter (2 of 4)`** (dead-code)',
      '',
      '**Problem**: Nothing calls it.',
      '**Solution**: Delete it.',
      '**Outcome**: One fewer surface to keep true.',
      '',
      '**Tests**:',
      '- the suite stays green',
      '',
      '=== MENU: task approval',
    ].join('\n')), out);
    assert.ok(!out.includes('**Do**:'), 'an absent block leaves no heading behind');
    assert.ok(!out.includes('**Acceptance Criteria**:'));
    assert.ok(!/\n\n\n/.test(out), 'an omitted block leaves no doubled blank line');
  });

  it('outcome is optional both ways, and the detail blocks stay non-empty when present', () => {
    const withOutcome = writePayload(dir, 'o1.json', { ...proposal, outcome: 'One helper, one message path.' });
    assert.ok(renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' })
      .includes('**Solution**: Fold them into one and take the caller-supplied message.\n**Outcome**: One helper, one message path.\n'));
    const without = writePayload(dir, 'o2.json', proposal);
    assert.ok(!renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: without, gate: 'gated' }).includes('**Outcome**'));
    const emptyOutcome = writePayload(dir, 'o3.json', { ...proposal, outcome: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptyOutcome, gate: 'gated' }), /"outcome" must be a non-empty string when present/);
    for (const field of ['steps', 'criteria', 'tests']) {
      const empty = writePayload(dir, `e-${field}.json`, { ...proposal, [field]: [] });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }), new RegExp(`"${field}" must be non-empty`));
      const notLines = writePayload(dir, `n-${field}.json`, { ...proposal, [field]: 'one long string' });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notLines, gate: 'gated' }), new RegExp(`"${field}" must be an array of strings`));
    }
  });

  it('a decision item presents the sides as the menu — numbered, decline, comment, no auto — byte-exactly', () => {
    const file = writePayload(dir, 'dc.json', {
      current: 3, total: 4, title: 'Settle the page size', severity: 'behaviour',
      problem: 'Two page sizes are configured at once.', solution: 'Pick one and record it.',
      decision: { question: 'Which page size stands?', options: ['A4 on the PDF renderer', 'preferCssPageSize from the stylesheet'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**`▪ Settle the page size (3 of 4)`** (behaviour)',
      '',
      '**Problem**: Two page sizes are configured at once.',
      '**Solution**: Pick one and record it.',
      '**Decision**: Which page size stands?',
      '',
      '=== MENU: task decision (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Which way?`**',
      '',
      '**`1`**         → A4 on the PDF renderer',
      '**`2`**         → preferCssPageSize from the stylesheet',
      '**`d/decline`** → Decline this task — it will not be built',
      '**Comment**   → Tell me what to change',
      '',
    ].join('\n'));
    assert.ok(!out.includes('a/auto'), 'an open decision is never one of the calls auto makes');
    assert.ok(!out.includes('Auto is on'), 'a gated decision carries no auto-override line — there is nothing being overridden');
  });

  it('a decision stops under --gate auto — and takes the comment hint', () => {
    const file = writePayload(dir, 'dc2.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's',
      decision: { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize', 'Neither — leave it configurable'] },
    });
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(auto.includes('MENU: task decision'), 'a decision item always stops');
    assert.ok(!auto.includes('DISPLAY: task auto-approved'));
    assert.ok(!auto.includes('MENU: task approval'));
    assert.ok(auto.includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'a stop that fires over the auto opt-in says so, in the engine\'s one voice');
    assert.ok(auto.includes('**Decision**: Which page size stands?'), 'the question renders in the body, never the glyphed chrome');
    assert.ok(/\*\*`3`\*\* +→ Neither — leave it configurable/.test(auto));
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(auto));
  });

  it('a decision excludes authored blocks, and the malformed shapes are refused by name', () => {
    for (const [field, value] of [['steps', ['1. x']], ['criteria', ['- c']], ['tests', ['- t']]]) {
      const file = writePayload(dir, `dx-${field}.json`, {
        ...proposal, [field]: value,
        decision: { question: 'Which way?', options: ['a', 'b'] },
      });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" excludes steps\/criteria\/tests/);
    }
    for (const [name, decision] of [['null', null], ['a bare string', 'yes']]) {
      const file = writePayload(dir, `dshape-${name.replace(/ /g, '-')}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" must be an object carrying "question" and "options"/, `decision as ${name} is refused`);
    }
  });

  it('a malformed decision is refused by name', () => {
    const cases = [
      [{ options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: '  ', options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: 'Which?' }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['only one'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', 'b', 'c', 'd', 'e'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', ''] }, /decision\.options\[1\] must be a non-empty string/],
      [{ question: 'Which?', options: ['a', { summary: 'b' }] }, /decision\.options\[1\] must be a non-empty string/],
    ];
    cases.forEach(([decision, re], i) => {
      const file = writePayload(dir, `dbad-${i}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }), re);
    });
    const notObject = writePayload(dir, 'dbad-shape.json', { ...proposal, decision: ['a', 'b'] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notObject, gate: 'gated' }),
      /"decision" must be an object carrying "question" and "options"/);
  });

  it('incoherence-gate conflict: payload-driven display then the menu, recommended side first, byte-exact', () => {
    const file = writePayload(dir, 'ig.json', {
      doc: 'synonym-handling',
      lane: 'review',
      title: 'Expansion freshness rests on a stream that will not be built',
      context: 'The two decisions cannot both be implemented.',
      quotes: [
        { doc: 'behavioural-ranking', section: 'Signal Ingestion · Decision', quote: 'No live signal stream will be built.' },
        { doc: 'synonym-handling', section: 'Expansion Source · Decision', quote: 'Reading the live click-signal stream at query time.' },
      ],
      stakes: 'A spec extracting both sides describes a panel the record cannot produce.',
      sides: [
        { summary: 'Live click-signal stream at query time' },
        { summary: 'Batch-derived expansion, daily refresh', recommended: true },
      ],
    });
    const out = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'conflict' });
    assert.strictEqual(out, [
      '=== DISPLAY: incoherence conflict (emit verbatim as markdown) ===',
      '**Conflict — Expansion freshness rests on a stream that will not be built**',
      '',
      '- **behavioural-ranking · Signal Ingestion · Decision**: "No live signal stream will be built."',
      '- **synonym-handling · Expansion Source · Decision**: "Reading the live click-signal stream at query time."',
      '',
      '**Details**: The two decisions cannot both be implemented.',
      '',
      'A spec extracting both sides describes a panel the record cannot produce.',
      '',
      "=== MENU: incoherence conflict (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which decision stands?`**',
      '',
      '**`1`**       → Batch-derived expansion, daily refresh (recommended)',
      '**`2`**       → Live click-signal stream at query time',
      "**Comment** → Tell me what you're thinking; we'll work it through",
      '',
    ].join('\n'));
  });

  it('incoherence-gate gap-route: the raise plus its acknowledgement gate, byte-exact; held-doc keeps its menu', () => {
    const file = writePayload(dir, 'ig2.json', {
      lane: 'review',
      doc: 'synonym-handling',
      title: 'Ranking interaction is undecided',
      context: 'Neither source decides how expanded matches rank.',
      quotes: [{ doc: 'behavioural-ranking', section: 'Scoring · Decision', quote: 'Score blending is out of scope.' }],
      stakes: 'The ranking chapter cannot be written until this is decided.',
    });
    const gap = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'gap-route' });
    assert.strictEqual(gap, [
      '=== DISPLAY: incoherence gap (emit verbatim as markdown) ===',
      '**Gap — Ranking interaction is undecided**',
      '',
      '- **behavioural-ranking · Scoring · Decision**: "Score blending is out of scope."',
      '',
      '**Details**: Neither source decides how expanded matches rank.',
      '',
      'The ranking chapter cannot be written until this is decided.',
      '',
      "=== MENU: incoherence gap (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Routing this to "synonym-handling" — it reopens with the gap, and this specification pauses until the answer lands.',
      '',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**   → Land the gap and pause here',
      "**Comment** → Tell me what you're thinking before it moves",
      '',
    ].join('\n'));
    const docOnly = writePayload(dir, 'ig2b.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: docOnly, variant: 'held-doc' });
    assert.ok(held.includes('MENU: incoherence held doc'));
    assert.ok(held.includes('**`◆ How do you want to continue?`**'));
    assert.ok(/\*\*`s\/stop`\*\* +→ Stop here/.test(held));
  });

  it('cancel-cascade-gate derives the collapse set — started cancelled, proposed discarded; refuses when nothing sources the topic', () => {
    writeManifest(dir, 'pay', { work_type: 'epic', phases: {
      discussion: { items: { beta: { status: 'completed' } } },
      specification: { items: {
        unified: { status: 'in-progress', sources: { beta: { status: 'incorporated' } } },
        grp: { status: 'proposed', sources: { beta: { status: 'pending' } } },
        dead: { status: 'cancelled', sources: { beta: { status: 'pending' } } },
      } },
    } });
    const out = renderSurface(dir, 'cancel-cascade-gate', { dotpath: 'pay.discussion.beta' });
    assert.ok(out.includes('MENU: cancel cascade'), out);
    assert.ok(out.includes('**Unified** is cancelled with it (reactivatable)'), out);
    assert.ok(out.includes('the proposed grouping **Grp** is discarded'), out);
    assert.ok(!out.includes('Dead'), 'terminal specs never enter the collapse set');
    assert.ok(out.includes('**`◆ Cancel them together?`**'), out);
    writeManifest(dir, 'pay', { work_type: 'epic', phases: { discussion: { items: { beta: { status: 'completed' } } } } });
    assert.throws(() => renderSurface(dir, 'cancel-cascade-gate', { dotpath: 'pay.discussion.beta' }), /no live specification sources "beta"/);
  });

  it('the incoherence stops announce over their own lane\'s auto — and stay silent over the other lane\'s', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'auto', construction_gate_mode: 'gated',
    } } } } });
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const conflict = writePayload(dir, 'al1.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    const out = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: conflict, variant: 'conflict' });
    assert.ok(unwrap(out).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'));
    // The same stop called from the construction lane is not overriding anything.
    const conflictC = writePayload(dir, 'al2.json', { doc: 'x', lane: 'construction', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    const outC = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: conflictC, variant: 'conflict' });
    assert.ok(!outC.includes('Auto is on'), 'a construction-lane stop does not announce the findings walk\'s auto');
    const gap = writePayload(dir, 'al3.json', { doc: 'x', lane: 'review', title: 't', context: 'c' });
    assert.ok(unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: gap, variant: 'gap-route' })).includes('Auto is on — stopping anyway'));
    const held = writePayload(dir, 'al4.json', { doc: 'x', lane: 'review' });
    assert.ok(unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.specification.portal', file: held, variant: 'held-doc' })).includes('Auto is on — stopping anyway'));
  });

  it('resurface-gate announces over construction auto only — it is construction-lane machinery', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'auto', construction_gate_mode: 'gated',
    } } } } });
    const payload = { section: 'S', diff: { current: ['old'], proposed: ['new'] } };
    const quiet = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.specification.portal', file: writePayload(dir, 'rs1.json', payload) });
    assert.ok(!quiet.includes('Auto is on'), 'findings auto is not resurface-gate\'s lane');
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: {
      status: 'in-progress', finding_gate_mode: 'gated', construction_gate_mode: 'auto',
    } } } } });
    const loud = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.specification.portal', file: writePayload(dir, 'rs2.json', payload) });
    assert.ok(unwrap(loud).includes('**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'));
  });

  it('a payload without a legal lane is refused by name', () => {
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const badLane = writePayload(dir, 'al5.json', { doc: 'x', lane: 'planning', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: badLane, variant: 'conflict' }),
      /"lane" must be "construction" or "review"/);
    const noLane = writePayload(dir, 'al6.json', { doc: 'x', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noLane, variant: 'conflict' }),
      /"lane" must be "construction" or "review"/);
  });

  it('a conflict must quote the documents it collides — composed sides are refused', () => {
    const noQuotes = writePayload(dir, 'igq.json', { doc: 'x', lane: 'review', title: 't', context: 'c', sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(
      () => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noQuotes, variant: 'conflict' }),
      /a conflict must quote the sides it collides — sides you would compose yourself are not documented, and belong in a conversation, not this gate/,
    );
    const empty = writePayload(dir, 'igq2.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: [], sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: empty, variant: 'conflict' }), /"quotes" must be a non-empty array when present/);
    // gap-route keeps quotes optional: a gap has no collision to cite.
    const gap = writePayload(dir, 'igq3.json', { doc: 'x', lane: 'review', title: 't', context: 'c' });
    assert.ok(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: gap, variant: 'gap-route' }).includes('MENU: incoherence gap'));
  });

  it('incoherence-gate validates loudly: variant, doc, sides floor, single recommended', () => {
    const cited = [{ doc: 'd', section: 's', quote: 'q' }];
    const file = writePayload(dir, 'ig3.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file }), /--variant must be/);
    const noDoc = writePayload(dir, 'ig4.json', { lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noDoc, variant: 'conflict' }), /"doc" must be a non-empty string/);
    const oneSide = writePayload(dir, 'ig5.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: oneSide, variant: 'conflict' }), /at least 2 entries/);
    const twoRec = writePayload(dir, 'ig6.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: twoRec, variant: 'conflict' }), /at most one side/);
    const noTitle = writePayload(dir, 'ig7.json', { doc: 'x', lane: 'review', context: 'c', sides: [{ summary: 'a' }, { summary: 'b' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: noTitle, variant: 'gap-route' }), /"title" must be a non-empty string/);
    const badQuote = writePayload(dir, 'ig8.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: [{ doc: 'a', section: 's' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: badQuote, variant: 'gap-route' }), /quotes\[0\] must carry doc, section, and quote/);
  });

  it('resurface-gate: header, diff fence, and the always-gated menu; --view full swaps the body and drops the view option', () => {
    const file = writePayload(dir, 'rs.json', {
      section: 'Expansion Source',
      diff: { context_above: ['ctx above'], current: ['old line'], proposed: ['new line'], context_below: ['ctx below'] },
      full: ['Full updated section body'],
    });
    const out = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('=== DISPLAY: resurfacing (emit verbatim as markdown) ===\n**Resurfacing: Expansion Source**'));
    assert.ok(out.includes('=== DISPLAY: resurfacing diff (emit verbatim as a diff code block (```diff fence)) ===\n ctx above\n-old line\n+new line\n ctx below'));
    assert.ok(out.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`v\/view full`\*\* +→ Show the full updated section/.test(out));
    const full = renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file, view: 'full' });
    assert.ok(full.includes('**Resurfacing: Expansion Source** — full updated section\n\nFull updated section body'));
    assert.ok(!full.includes('view full'), 'the full view drops the view option');
    const noDiff = writePayload(dir, 'rs2.json', { section: 'X' });
    assert.throws(() => renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file: noDiff }), /"diff" is required/);
    const emptyDiff = writePayload(dir, 'rs3.json', { section: 'X', diff: { current: [], proposed: [] } });
    assert.throws(() => renderSurface(dir, 'resurface-gate', { dotpath: 'pay.implementation.portal', file: emptyDiff }), /at least one current\/proposed line/);
  });

  it('construction-gate: reads the manifest gate mode — menu when gated, announcement when auto', () => {
    const gated = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' });
    assert.ok(gated.includes('MENU: construction gate'));
    assert.ok(gated.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining topics automatically/.test(unwrap(gated)));
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'pay', 'manifest.json'), 'utf8'));
    m.phases.implementation.items.portal.construction_gate_mode = 'auto';
    fs.writeFileSync(path.join(dir, '.workflows', 'pay', 'manifest.json'), JSON.stringify(m, null, 2));
    const auto = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' });
    assert.ok(auto.includes('DISPLAY: construction auto-approved'));
    assert.ok(auto.includes('Portal — auto-approved. Recording to the specification.'));
    assert.ok(!auto.includes('MENU:'));
  });

  it('renders the ad hoc shape: no severity/sources, placement lines present', () => {
    const adhoc = {
      current: 1, total: 1, title: 'Fix login redirect',
      problem: 'Redirect loops on expired session.', solution: 'Clear the cookie first.', outcome: 'Login lands on the dashboard.',
      placement: 'phase 2', priority: '1', depends_on: 'portal-2-3',
      steps: ['1. Clear cookie', '2. Redirect'],
      criteria: ['- no loop on expired session'],
      tests: ['- expired session logs in cleanly'],
    };
    const file = writePayload(dir, 'a.json', adhoc);
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    const lines = out.split('\n');
    assert.strictEqual(lines[1], '**`▪ Fix login redirect`**');
    assert.strictEqual(lines[2], 'Placement: phase 2');
    assert.strictEqual(lines[3], 'Priority: 1');
    assert.strictEqual(lines[4], 'Depends on: portal-2-3');
    assert.strictEqual(lines[5], '');
    assert.ok(!out.includes('Sources:'));
    assert.ok(out.includes('MENU: task approval'));
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto' });
    assert.ok(auto.includes('Fix login redirect — approved [auto].'));
    assert.ok(!auto.includes('Task 1 of 1'));
  });
});

describe('render tasks-overview', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders a fresh cycle byte-exactly — all rows pending, no remaining count', () => {
    const file = writePayload(dir, 'o.json', { label: 'Analysis cycle 2', tasks: [{ title: 'Fix leak', severity: 'Important' }, { title: 'Add test', severity: 'Minor' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as markdown — do not stop; continue as the workflow instructs) ===',
      '**Analysis cycle 2** — 2 proposed tasks',
      '',
      '○ 1. Fix leak `[Important]`',
      '○ 2. Add test `[Minor]`',
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('renders a mid-walk resume — decided rows struck, remaining counted', () => {
    const file = writePayload(dir, 'r.json', { label: 'Analysis cycle 1', tasks: [
      { title: 'Fix leak', severity: 'Important', status: 'approved' },
      { title: 'Add test', severity: 'Minor', status: 'skipped' },
      { title: 'Type the selector', severity: 'Minor', status: 'pending' },
    ] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: tasks overview (emit verbatim as markdown — do not stop; continue as the workflow instructs) ===',
      '**Analysis cycle 1** — 3 proposed tasks · 1 remaining',
      '',
      '✓ 1. ~~Fix leak~~ `[Important]`',
      '⊘ 2. ~~Add test~~ `[Minor]`',
      '○ 3. Type the selector `[Minor]`',
      '',
      "Let's work through these one at a time.",
      '',
    ].join('\n'));
  });

  it('escapes markdown-active title text', () => {
    const file = writePayload(dir, 'e.json', { label: 'Cycle', tasks: [{ title: 'Collapse *both* fakes', severity: 'low' }] });
    const out = renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file });
    assert.match(out, /○ 1\. Collapse \\\*both\\\* fakes `\[low\]`/);
  });

  it('validates loudly', () => {
    const file = writePayload(dir, 'o.json', { label: 'X', tasks: [{ title: 't' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file }), /task 1 needs "title" and "severity"/);
    const bad = writePayload(dir, 'b.json', { label: 'X', tasks: [{ title: 't', severity: 's', status: 'done' }] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: bad }), /render tasks-overview: task 1 carries unknown status "done" \(expected pending\/approved\/skipped\)/);
    const empty = writePayload(dir, 'empty.json', { label: 'X', tasks: [] });
    assert.throws(() => renderSurface(dir, 'tasks-overview', { dotpath: 'pay.implementation.portal', file: empty }), /"tasks" must be a non-empty array/, 'an empty overview refuses — the zero-proposal branches route around this surface');
  });
});

describe('render author-task-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the authoring menu byte-exactly', () => {
    const out = renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '5', title: 'Wrap command' });
    assert.strictEqual(out, [
      '=== MENU: author task gate (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Task 2 of 5: Wrap command**',
      '',
      '**`y/yes`**                  → Write it to the plan',
      '**`a/auto`**                 → Approve this and all remaining tasks',
      `${NB(25)}automatically`,
      '**Tell me what to change** → what to revise in this task',
      '**Navigate**               → Tell me where to go: a different phase',
      `${NB(25)}or task, or the leading edge`,
      '',
    ].join('\n'));
  });

  it('validates the scalars loudly', () => {
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '0', total: '5', title: 'X' }), /--m must be a positive integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '1', title: 'X' }), /--total must be an integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2' }), /--title is required/);
  });
});

describe('render phase-tree', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders numbered phase nodes with wrapped tree detail, byte-exactly', () => {
    const file = writePayload(dir, 'ph.json', {
      phases: [
        { name: 'Adapter Wrapper', detail: [['Goal', 'burst windows land at a live shell'], ['Criteria', 'no dead-end prompt']] },
        { name: 'Regression Net', detail: [['Goal', 'attach flows pinned by tests']] },
      ],
    });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: phase tree (emit verbatim as a code block) ===',
      'Phase structure — 2 phases.',
      '',
      '1. Adapter Wrapper',
      '   ├─ Goal: burst windows land at a live shell',
      '   └─ Criteria: no dead-end prompt',
      '',
      '2. Regression Net',
      '   └─ Goal: attach flows pinned by tests',
      '',
    ].join('\n'));
  });

  it('appends the structure gate with --approve; long detail wraps with the gutter', () => {
    const file = writePayload(dir, 'ph.json', {
      phases: [{ name: 'X', detail: [['Goal', 'goal '.repeat(30).trim()], ['Criteria', 'done']] }],
    });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    assert.ok(out.includes('MENU: phase structure gate'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed to task breakdown/.test(out));
    const lines = out.split('\n');
    const goalIdx = lines.findIndex((l) => l.startsWith('   ├─ Goal:'));
    assert.ok(lines[goalIdx + 1].startsWith('   │  goal'), 'wrapped detail carries the gutter');
  });

  it('validates loudly', () => {
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'a.json', { phases: [] }) }), /"phases" must be a non-empty array/);
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: writePayload(dir, 'b.json', { phases: [{ name: 'X', detail: [] }] }) }), /"detail" must be a non-empty array/);
  });
});

describe('render task-list --variant existing', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('gated menu drops the auto option; auto mode says confirmed', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 'b' }] });
    const gated = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(/\*\*Tell me what to change\*\* +→ which tasks to revise in this phase/.test(gated));
    assert.ok(!gated.includes('`a/auto`'), 'existing variant offers no auto opt-in');

    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', task_list_gate_mode: 'auto' } } } } });
    const auto = renderSurface(dir, 'task-list', { dotpath: 'pay.planning.portal', file, variant: 'existing' });
    assert.ok(auto.includes('Phase 1: X — task list confirmed. Proceeding to authoring.'));
  });
});

describe('selection projection', () => {
  it('renders the bugfix pick list byte-exactly', () => {
    const out = selectionSections('bugfix',
      [{ name: 'crash', phase_label: 'specification (in-progress)' }, { name: 'leak', phase_label: 'investigation (in-progress)' }],
      { completed: 1, cancelled: 1 });
    assert.strictEqual(out, [
      '=== DISPLAY: selection (emit verbatim as a code block only at the select step) ===',
      '2 bugfix(es) in progress',
      '  ├─ 1. Crash',
      '  │   Specification (In-Progress)',
      '  └─ 2. Leak',
      '      Investigation (In-Progress)',
      '',
      '1 completed, 1 cancelled.',
      '',
      '=== MENU: selection (emit verbatim as markdown only at the select step, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Which bugfix would you like to continue?`**',
      '',
      '**`1`**        → Continue "Crash" — *specification (in-progress)*',
      '**`2`**        → Continue "Leak" — *investigation (in-progress)*',
      '**`3`**        → View completed & cancelled bugfixes',
      '**`m/manage`** → Manage a bugfix\'s lifecycle',
      '',
    ].join('\n'));
  });

  it('epic variant bodies the active phases and drops the phase label from options', () => {
    const out = selectionSections('epic', [{ name: 'payments', active_phases: ['discussion', 'specification'] }], { completed: 0, cancelled: 0 });
    assert.ok(out.includes('  └─ 1. Payments\n      Discussion, Specification'));
    assert.ok(/\*\*`1`\*\* +→ Continue "Payments"/.test(out));
    assert.ok(!out.includes('Continue "Payments" —'));
    assert.ok(!out.includes('View completed'), 'no closed units, no view option');
  });

  it('empty units render nothing; unknown type throws', () => {
    assert.strictEqual(selectionSections('feature', [], { completed: 3, cancelled: 0 }), '');
    assert.throws(() => selectionSections('nope', [{ name: 'x' }], { completed: 0, cancelled: 0 }), /unknown type "nope"/);
  });
});

describe('bridge continuation surfaces', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { work_type: 'feature' });
  });
  afterEach(() => teardown(dir));

  it('gates render byte-stable menus', () => {
    const early = renderSurface(dir, 'early-completion-gate', { dotpath: 'pay' });
    assert.ok(early.includes('Implementation completed for "Pay".'));
    assert.ok(/\*\*`d\/done`\*\* +→ Complete without review/.test(early));

    const revisit = renderSurface(dir, 'revisit-gate', { dotpath: 'pay', prev: 'specification', next: 'planning' });
    assert.ok(revisit.includes('Specification completed for "Pay".'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Proceed to planning/.test(revisit));

    const allDone = renderSurface(dir, 'epic-all-done-gate', { dotpath: 'pay' });
    assert.ok(allDone.includes('All topics have completed review for "Pay".'));

    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'discussion' });
    assert.ok(note.includes('Discussion completed for "Pay".'));
  });

  it('early-completion gate names a live reconcile flag — skipping review is an informed choice', () => {
    writeManifest(dir, 'moved', {
      work_type: 'feature',
      phases: {
        implementation: { items: { moved: { status: 'completed' } } },
        review: { items: { moved: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'early-completion-gate', { dotpath: 'moved' });
    assert.ok(out.includes('⚑ Input moved beneath review/moved (implementation)'), out);
    assert.ok(out.includes('carries the pending reconcile unresolved'), out);
    // No flag, no cue.
    const clean = renderSurface(dir, 'early-completion-gate', { dotpath: 'pay' });
    assert.ok(!clean.includes('⚑'), clean);
  });

  it('work-unit addressing is loud on dotted paths, unknown units, and missing flags', () => {
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay.review.pay', phase: 'review' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'nope', phase: 'review' }), /work unit "nope" not found/);
    assert.throws(() => renderSurface(dir, 'revisit-gate', { dotpath: 'pay', next: 'planning' }), /--prev is required/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay' }), /--phase is required/);
  });
});

describe('review fixes — gap coverage', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } }, specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
  });
  afterEach(() => teardown(dir));

  const base = {
    n: 1, total: 1, title: 'T', meta: [['Severity', 'Minor']],
    move: 'settled', problem: 'P', proposal: 'Q',
  };

  it('finding content × gated offers v/view, never view full', () => {
    const file = writePayload(dir, 'f.json', { ...base, content: { label: 'Proposed Addition', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('MENU: finding gate'));
    assert.ok(!out.includes('view full'), 'there is no full copy to re-show');
    assert.ok(/`v\/view`/.test(out), 'the wording stays reachable');
  });

  it('finding diff × auto renders the diff fence plus the applied line, no menu', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!/frame/.test(out), 'no frame sections survive the D8 retirement');
    assert.ok(out.includes('DISPLAY: finding auto-approved'));
    assert.ok(!out.includes('MENU: finding gate'));
  });

  it('null payload is a loud named error, not a TypeError', () => {
    const file = writePayload(dir, 'n.json', 'null');
    for (const surface of ['finding', 'findings-summary', 'proposed-task', 'tasks-overview', 'phase-tree']) {
      assert.throws(
        () => renderSurface(dir, surface, { dotpath: 'pay.planning.portal', file, gate: 'gated' }),
        /payload must be a JSON object or array/,
        surface,
      );
    }
  });

  it('a context-only diff is refused loudly', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { context_above: ['ctx'], current: [], proposed: [] } });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file }), /"diff" must carry at least one current\/proposed line/);
  });

  it('null meta values and null phase-tree detail values are refused', () => {
    const bad = writePayload(dir, 'm.json', { ...base, meta: [['Severity', null]] });
    assert.throws(() => renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file: bad }), /"meta" must be an array of \[label, value\] pairs/);
    const badTree = writePayload(dir, 'pt.json', { phases: [{ name: 'X', detail: [['Goal', null]] }] });
    assert.throws(() => renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file: badTree }), /"detail" must be a non-empty array of \[label, value\] pairs/);
  });

  it('phase-tree --approve menu offers view full', () => {
    const file = writePayload(dir, 'pt.json', { phases: [{ name: 'X' }] });
    const out = renderSurface(dir, 'phase-tree', { dotpath: 'pay.planning.portal', file, approve: '1' });
    assert.ok(/\*\*`v\/view full`\*\* +→ Show the full phase structure — goals, ordering rationale, acceptance criteria/.test(unwrap(out)));
  });
});

describe('titlecaseLabel', () => {
  const { titlecaseLabel } = require('../../skills/workflow-engine/scripts/domain/conventions.cjs');
  it('capitalises runs in place, preserving punctuation', () => {
    assert.strictEqual(titlecaseLabel('discussion (in-progress)'), 'Discussion (In-Progress)');
    assert.strictEqual(titlecaseLabel('finalising — quick-fix'), 'Finalising — Quick-Fix');
    assert.strictEqual(titlecaseLabel('phase 2 (done)'), 'Phase 2 (Done)');
  });
});

describe('CLI boundary — engine render via subprocess', () => {
  const { execFileSync, spawnSync } = require('child_process');
  const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'in-progress' } } },
        planning: { items: { pay: { status: 'in-progress', task_list_gate_mode: 'auto' } } },
        specification: { items: { pay: { status: 'superseded', superseded_by: 'core' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  function run(args) {
    return execFileSync('node', [ENGINE, 'render', ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('flags survive argv: --triage, --variant, --approve, --gate, scalar flags', () => {
    assert.ok(run(['resume-gate', 'pay.discussion.pay', '--triage', '2']).includes('2 rerouted concern(s)'));
    const tl = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 's' }] });
    assert.ok(run(['task-list', 'pay.planning.pay', '--file', tl, '--variant', 'existing']).includes('task list confirmed'));
    const pt = writePayload(dir, 'pt.json', { phases: [{ name: 'P' }] });
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--file', pt, '--approve']).includes('MENU: phase structure gate'));
    const task = writePayload(dir, 'task.json', { current: 1, total: 1, title: 'T', severity: 'Minor', sources: 's', problem: 'p', solution: 's', outcome: 'o', steps: ['1'], criteria: ['c'], tests: ['t'] });
    assert.ok(run(['proposed-task', 'pay.planning.pay', '--file', task, '--gate', 'auto']).includes('approved [auto]'));
    assert.ok(run(['author-task-gate', 'pay.planning.pay', '--m', '1', '--total', '2', '--title', 'T']).includes('**Task 1 of 2: T**'));
    assert.ok(run(['revisit-gate', 'pay', '--prev', 'discussion', '--next', 'specification']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['phase-completed', 'pay', '--phase', 'discussion']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['early-completion-gate', 'pay']).includes('Complete without review'));
    assert.ok(run(['epic-all-done-gate', 'pay']).includes('Mark this epic as completed'));
    assert.ok(run(['entry-gate', 'pay.specification.pay', '--own']).includes('was consolidated into'),
      '--own must survive boolean-flag registration through argv');
    assert.ok(run(['phase-completed', 'pay', '--phase', 'scoping', '--paths']).includes('  Spec: .workflows/pay/specification/pay/specification.md'),
      '--paths must survive boolean-flag registration through argv');
  });

  it('surface errors surface as failJson on stderr with exit 1', () => {
    const res = spawnSync('node', [ENGINE, 'render', 'proposed-task', 'pay.planning.pay', '--file', 'missing.json', '--gate', 'nope'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.match(JSON.parse(res.stderr.trim()).error, /--gate must be "gated" or "auto"/);
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
      '=== DISPLAY: phase note (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===\nResuming research: Auth Flow\n');
    assert.ok(renderSurface(dir, 'phase-note', { dotpath: 'pay.planning.auth-flow', verb: 'Reopening', noun: 'plan' })
      .includes('Reopening plan: Auth Flow'));
    assert.throws(() => renderSurface(dir, 'phase-note', { dotpath: 'pay.research.auth-flow' }), /--verb is required/);
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

  /** A held heartbeat owned by another session. */
  function holdCode(workUnit, phase, topic, ageSeconds = 0) {
    const file = path.join(dir, '.workflows', '.cache', workUnit, phase, topic, 'presence');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pid: null, pid_start: null, session_id: 'peer' }) + '\n');
    if (ageSeconds) {
      const when = new Date(Date.now() - ageSeconds * 1000);
      fs.utimesSync(file, when, when);
    }
    return file;
  }

  /**
   * Render as a named session. Identity is what presence records and what
   * every consumer compares against, so a test about two sessions is a test
   * about two identities — and the pid is stripped so ownership rests on the
   * session id alone (both "sessions" are this one process).
   */
  function renderAs(sessionId, dotpath) {
    const session = process.env.CLAUDE_CODE_SESSION_ID;
    const pid = process.env.CLAUDE_PID;
    process.env.CLAUDE_CODE_SESSION_ID = sessionId;
    delete process.env.CLAUDE_PID;
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
    path.join(dir, '.workflows', '.cache', workUnit, phase, topic, 'presence');

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
    // backdated past the staleness window, the re-render brings it back.
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

  it('states the holder in the red register and offers back first, proceed second', () => {
    holdCode('ship', 'implementation', 'checkout-flow', 120);
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' });

    assert.match(out, /=== DISPLAY: code gate \(emit verbatim as a properties code block/, out);
    assert.match(out, /⚑ Another session is implementing "Checkout Flow" \(ship\) — last active 2m ago\./, out);
    assert.match(out, /=== MENU: code gate \(emit verbatim as markdown, then STOP/, out);
    const menu = unwrap(out);
    assert.match(menu, /Code phases run one at a time — concurrent sessions write the same files/, menu);
    assert.match(menu, /Only proceed if you know that session is no longer working/, menu);
    assert.match(menu, /presence clear ship implementation checkout-flow/, menu);
    assert.match(menu, /\*\*`◆ Proceed anyway\?`\*\*/, menu);
    assert.ok(menu.indexOf('`b/back`') < menu.indexOf('`p/proceed`'), 'back leads');
    assert.match(menu, /`b\/back`\*\* +→ Leave that session to it \(recommended\)/, menu);
  });

  it('a review holder reads as reviewing, and any work unit takes the one slot', () => {
    holdCode('ship', 'review', 'checkout-flow');
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.review.pay' });
    assert.match(out, /Another session is reviewing "Checkout Flow" \(ship\)/, out);
    assert.match(unwrap(out), /presence clear ship review checkout-flow/, out);
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
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows/.cache/pay/implementation')), false,
      'a refusal claims nothing');
  });

  it('gates before the item exists — a fresh entry has initialised nothing', () => {
    assert.strictEqual(renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.never-inited' }), '');
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.cache/pay/implementation/never-inited/presence')),
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
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ The discussion for "Pay" is not yet completed/);
    manifestWith({ discussion: { items: { auth: { status: 'completed' } } } }, 'feature');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');

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

  it('epic specification with a topic: a source discussion back in-progress blocks that spec', () => {
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'stale' }, b: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }),
      /⚑ Sources for "Auth" are back in-progress: a[\s\S]*cannot be built from an in-flight record/);
    // The legacy array form decodes the same way.
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: [{ name: 'a', status: 'stale' }] } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ Sources for "Auth" are back in-progress: a/);
    // Settled sources are clear; an open discussion outside the spec's sources does not block it.
    manifestWith({
      discussion: { items: { a: { status: 'completed' }, c: { status: 'in-progress' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');
    // Plural open sources list every holder.
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'in-progress' }, c: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'stale' }, b: { status: 'stale' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ Sources for "Auth" are back in-progress: a, b/);
  });

  it('an unsupported phase is a loud error', () => {
    manifestWith({});
    assert.throws(() => renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }), /no prerequisite rules for phase "discussion"/);
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
      '=== DISPLAY: entry blocker (emit verbatim as a properties code block — ```properties fence) ===',
      '⚑ The specification for "Auth" was consolidated into "Core Auth"',
      '',
      '=== DISPLAY: blocker guidance (emit verbatim as markdown, then STOP — terminal condition) ===',
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

  it('is loud outside specification', () => {
    writeManifest(dir, 'pay', { work_type: 'feature', phases: {} });
    assert.throws(() => renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth', own: '1' }), /--own is only supported for specification/);
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
      '=== DISPLAY: phase completed (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
      'Scoping completed for "Hotfix".',
      '',
      '  Spec: .workflows/hotfix/specification/hotfix/specification.md',
      '  Plan: .workflows/hotfix/planning/hotfix/',
      '',
    ].join('\n'));
  });
});

describe('selection not-found display', () => {
  const { selectionNotFound } = require('../../skills/workflow-engine/scripts/domain/projections/selection.cjs');
  it('renders the per-type terminal byte-exactly', () => {
    assert.strictEqual(selectionNotFound('cross-cutting', 'ghost'), [
      '=== DISPLAY: not found (emit verbatim as a code block, then STOP — terminal condition) ===',
      'No active cross-cutting concern named "ghost" found.',
      '',
      'Run /workflow-start to see available concerns or begin a new one.',
      '',
    ].join('\n'));
    assert.ok(selectionNotFound('quick-fix', 'x').includes('available quick-fixes'));
  });
});

describe('catalogue dispatch', () => {
  it('the CLI usage banner lists every registered surface', () => {
    // A surface reachable from the catalogue but absent from the banner is
    // invisible to anyone who mistypes a command — the way finding-batch was.
    let catalogue;
    try {
      renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' });
    } catch (err) {
      catalogue = String(err.message).match(/surfaces: ([^)]+)\)/)[1].split(', ');
    }
    const engineSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts', 'engine.cjs'), 'utf8');
    const banner = [...engineSrc.matchAll(/^ {2}render (\S+)/gm)].map((m) => m[1]);
    const missing = catalogue.filter((n) => !banner.includes(n));
    assert.deepStrictEqual(missing, [], `surfaces missing from the usage banner: ${missing.join(', ')}`);
  });

  it('unknown surface errors with the catalogue listing', () => {
    assert.throws(() => renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' }), /unknown surface "nope" \(surfaces: resume-gate, task-list, findings-summary, finding-announce, finding-batch, finding, review-presentation, review-gate, spec-review-gate, spec-completion-gate, convergence-diagnostic, carry-note-gate, hypothesis-board, fix-direction, validation-gate, validation-report, project-skills, linters, triage-announce, triage-offer, triage-block, requeue-offer, reroute-offer, research-conclude-gate, deep-dive-offer, in-flight-agents-gate, reroute-candidates, off-topic-offer, map-op-gate, candidate-gate, topic-collision-gate, triage-closed-target, conclude-gate, summary-backfill-gate, external-dependency-gate, checkpoint-files-gate, executor-block-gate, dependency-approval-gate, task-count-gate, plan-format-gate, plan-review-gate, correction-gate, analysis-proceed-gate, proposed-task, incoherence-gate, cancel-cascade-gate, resurface-gate, construction-gate, tasks-overview, author-task-gate, phase-tree, phase-completed, phase-note, entry-gate, code-gate, early-completion-gate, revisit-gate, cancel-gate, epic-all-done-gate, epic-soft-gate, task-brief, task-result, task-gate, fix-gate, blocked-tasks, cycle-limit, cycle-gate, workunit-receipt, topic-receipt, absorb-receipt, promote-receipt, pivot-continuation, session-receipt, absorb-target, plan-topics, revisit-phases, roadmap-view, roadmap-add-gate, roadmap-session-receipt, roadmap-harvest-gate, roadmap-parks-gate, roadmap-shape-gate, roadmap-conclude-gate, name-gate, shape-gate, synthesis-gate, query-failure-gate, baseline-progress, baseline-area-gate, baseline-paused, baseline-receipt, baseline-scope-gate, baseline-round, baseline-doc-gate, baseline-manage-gate, baseline-doc-pick, baseline-offer-gate\)/);
  });
});

describe('single-source invariants', () => {
  it('the menu dot rule literal exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && fs.readFileSync(p, 'utf8').includes('· · · · · · · · · · · ·')) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'menus must frame through surfaces.menuFrame — inline dot rules reintroduce the pre-consolidation drift class');
  });

  it('the option-line grammar exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && /\*\*\\?`[^`]+\\?`\*\* →/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'option lines must build through cmdOption/rangeOption — hand-formatted options reintroduce the drift class');
  });

  it('the continuation instruction exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && fs.readFileSync(p, 'utf8').includes('do not stop; continue as the workflow instructs')) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'continuation phrasing must ride CONTINUE_INSTRUCTION — a second literal drifts on the next reword');
  });

  // No equivalent invariant for the ⚑ callout: the glyph legitimately appears
  // in inline one-line display headers (arrivals lines, not-ready blocks), so
  // a content grep cannot isolate the wrapped-callout idiom without false
  // positives. Single-sourcing there is enforced structurally — flaggedCallout
  // delegates to surfaces.callout — and guarded by review.

  it('box-glyph frames are retired everywhere — the fence is the frame (D8)', () => {
    const skillsRoot = path.join(__dirname, '..', '..', 'skills');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && (p.endsWith('.cjs') || p.endsWith('.md')) && /[╭╰]/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(skillsRoot, p));
        }
      }
    })(skillsRoot);
    assert.deepStrictEqual(offenders, [],
      'artefact content is framed by its emission fence, never drawn borders — a box glyph reintroduces a fixed-width commitment the terminal cannot honour');
  });
});

describe('roadmap surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {object} roadmap @param {Record<string, object>} [workUnits] */
  function writeRoadmap(roadmap, workUnits = {}) {
    const wf = path.join(dir, '.workflows');
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
      ordering: { horizon: 'mvp', summary: 'customers order from a menu', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
      menus: { horizon: 'mvp', summary: 'operators maintain the menu', origin: 'harvest' },
      loyalty: { horizon: 'v1', summary: 'repeat-customer rewards', origin: 'park:mvp' },
    },
  };

  it('roadmap-view: horizon groups, join notes, the breakdown header', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-view', {});
    assert.match(out, /^=== DISPLAY: roadmap \(emit verbatim as a code block\) ===/);
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

  it('roadmap-add-gate: two delivering units render the name-which label', () => {
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
    assert.match(out, /Into the delivery — a fresh topic in one of its units/);
    assert.match(out, /Waiting in "mvp" beside its 2 uncommitted items/, 'the plural form');
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
    assert.match(out, /^=== MENU: roadmap add gate/);
    assert.match(out, /"mvp" is being built right now\. Where does this land\?/);
    assert.match(out, /Into the delivery — a fresh topic in "mvp"/);
    assert.match(out, /`2`.*Another horizon/);
    assert.ok(!out.includes('Waiting in'), 'no waiting side-door into a fully-delivered horizon');
  });

  it('roadmap-add-gate: a partly-composed horizon keeps the waiting option', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' });
    assert.match(out, /"mvp" is partly in delivery\. Where does this land\?/);
    assert.match(out, /Waiting in "mvp" beside its 1 uncommitted item/);
    assert.match(out, /`3`.*Another horizon/);
  });

  it('roadmap-add-gate: refuses an unknown horizon and one with no delivery', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', { horizon: 'ghost' }), /unknown horizon/);
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', { horizon: 'v1' }), /no member of "v1" is in delivery/);
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', {}), /--horizon is required/);
  });

  it('roadmap-session-receipt: empty without --warn, the advisory with it', () => {
    assert.strictEqual(renderSurface(dir, 'roadmap-session-receipt', {}), '');
    const out = renderSurface(dir, 'roadmap-session-receipt', { warn: '1' });
    assert.match(out, /Knowledge indexing warning/);
  });
});

describe('baseline surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  function writeBaseline(baseline) {
    const wf = path.join(dir, '.workflows');
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, 'manifest.json'), JSON.stringify({ work_units: {}, baseline }, null, 2));
  }

  it('baseline-progress: in-progress shows statuses and the remaining count', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'pending' } });
    const out = renderSurface(dir, 'baseline-progress', {});
    assert.strictEqual(out, [
      '=== DISPLAY: baseline progress (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
      'Baseline in progress:',
      '',
      '  overview    [completed]',
      '  glossary    [researched]',
      '  dispatcher  [pending]',
      '',
      '2 area(s) remain.',
      '',
    ].join('\n'));
  });

  it('baseline-progress: completed lists the landed docs', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', glossary: 'completed' } });
    const out = renderSurface(dir, 'baseline-progress', {});
    assert.match(out, /Baseline — 2 area\(s\) documented:/);
    assert.match(out, /  • overview\.md\n  • glossary\.md/);
  });

  it('baseline-progress: refuses a missing baseline and an empty area map', () => {
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /no baseline on the project manifest/);
    writeBaseline({ status: 'in-progress', areas: {} });
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /no areas/);
  });

  it('baseline-area-gate: statement, glyphed question, and both options', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    const out = renderSurface(dir, 'baseline-area-gate', { area: 'overview' });
    assert.match(out, /^=== MENU: baseline area gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /\*\*Overview\*\* is documented\. 1 area\(s\) remain\./);
    assert.match(out, /\*\*`◆ Keep going\?`\*\*/);
    assert.match(out, /\*\*`c\/continue`\*\* → Interview the next area/);
    assert.match(out, /\*\*`p\/pause`\*\*\s+→ Stop here — resume any time from workflow-start/);
  });

  it('baseline-area-gate: refuses a missing --area, an unknown area, an unlanded area, and a drained map', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', {}), /--area is required/);
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'ghost' }), /unknown area/);
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'glossary' }), /not completed/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'overview' }), /no areas remain/);
  });

  it('baseline-paused: counts the documented areas and points back at workflow-start', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'researched' } });
    const out = renderSurface(dir, 'baseline-paused', {});
    assert.match(out, /Paused — 1 of 3 area\(s\) documented\./);
    assert.match(out, /Resume from the workflow-start menu\./);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-paused', {}), /not in-progress/);
  });

  it('baseline-receipt: lists the docs and requires the completion write first', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', glossary: 'completed' } });
    const out = renderSurface(dir, 'baseline-receipt', {});
    assert.match(out, /Baseline complete — 2 area\(s\) documented and indexed\./);
    assert.match(out, /  • overview\.md\n  • glossary\.md/);
    assert.match(out, /\[baseline \| …\] context/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-receipt', {}), /not completed/);
  });

  it('baseline-receipt: refuses to name a doc that was never landed', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', dispatcher: 'pending' } });
    assert.throws(() => renderSurface(dir, 'baseline-receipt', {}), /"dispatcher" is "pending", not completed/);
  });

  it('baseline-scope-gate: renders the proposed list as markdown above the gate, stateless', () => {
    const file = writePayload(dir, 'payload.json', {
      mode: 'fresh',
      areas: [{ name: 'overview', detail: 'What the product is' }, { name: 'dispatcher', detail: 'The downstream push pipeline' }],
    });
    const out = renderSurface(dir, 'baseline-scope-gate', { file });
    assert.match(out, /=== DISPLAY: baseline scope \(emit verbatim as markdown \(not a code block\)\) ===/);
    assert.match(out, /\*\*overview\*\* — What the product is\n\*\*dispatcher\*\* — The downstream push pipeline/);
    assert.match(out, /\*\*`◆ Assess these areas\?`\*\*/);
    assert.match(out, /\*\*`a\/approve`\*\* → Lock the list and start the research/);
    assert.match(out, /\*\*`b\/back`\*\*\s+→ Leave without changing anything/);
    assert.match(out, /\*\*Adjust\*\*\s+→ Tell me what to add, drop, rename, or merge/);
  });

  it('baseline-scope-gate: refuses illegal names, bad modes, and empty payloads', () => {
    const bad = (payload) => writePayload(dir, 'payload.json', payload);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', {}), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'weird', areas: [{ name: 'a', detail: 'x' }] }) }), /"mode" must be/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [] }) }), /non-empty array/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [{ name: 'api.v2', detail: 'x' }] }) }), /kebab-case/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [{ name: 'ok-area', detail: ' ' }] }) }), /missing "detail"/);
  });

  it('baseline-round: numbers questions, letters candidates, closes on the any-mix line', () => {
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'researched' } });
    const file = writePayload(dir, 'payload.json', {
      area: 'dispatcher',
      questions: [
        { text: 'The dispatcher polls behind four guards — what is the story?', candidates: ['Incident accretion', 'Partner rate agreement'] },
        { text: 'Why does Closed exist as a state?' },
      ],
    });
    const out = renderSurface(dir, 'baseline-round', { file });
    assert.match(out, /=== DISPLAY: baseline round \(emit verbatim as a code block, then STOP for the user's response\) ===/);
    assert.match(out, /1\. The dispatcher polls behind four guards/);
    assert.match(out, /   a\. Incident accretion\n   b\. Partner rate agreement/);
    assert.match(out, /2\. Why does Closed exist as a state\?/);
    assert.match(out, /Answer in your own words, pick letters, or say "don't know" —/);
  });

  it('baseline-round: refuses an unresearched area and malformed questions', () => {
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'completed' } });
    const file = writePayload(dir, 'payload.json', { area: 'dispatcher', questions: [{ text: 'x' }] });
    assert.throws(() => renderSurface(dir, 'baseline-round', { file }), /not researched/);
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'researched' } });
    const many = writePayload(dir, 'payload.json', { area: 'dispatcher', questions: [1, 2, 3, 4, 5].map((n) => ({ text: `q${n}` })) });
    assert.throws(() => renderSurface(dir, 'baseline-round', { file: many }), /1-4/);
  });

  it('baseline-offer-gate: renders only while nothing is recorded', () => {
    const out = renderSurface(dir, 'baseline-offer-gate', {});
    assert.match(out, /\*\*`◆ Run a baseline assessment\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\* → Start the assessment now/);
    assert.match(unwrap(out), /\*\*`n\/no`\*\*\s+→ Skip — you can start it later from the workflow-start menus/);
    writeBaseline({ status: 'skipped' });
    assert.throws(() => renderSurface(dir, 'baseline-offer-gate', {}), /the offer fires once/);
  });

  it('the static baseline gates render their menus; the completed-only pair refuse mid-flight', () => {
    assert.match(renderSurface(dir, 'baseline-doc-gate', {}), /\*\*`◆ Land it\?`\*\*[\s\S]*\*\*`a\/approve`\*\* → Index and commit the doc/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-manage-gate', {}), /not completed/);
    assert.throws(() => renderSurface(dir, 'baseline-doc-pick', {}), /not completed/);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`◆ What would you like to do\?`\*\*[\s\S]*\*\*`e\/expand`\*\* → Add a new area, or deepen an existing one/);
    assert.match(renderSurface(dir, 'baseline-doc-pick', {}), /Which doc\? \(enter the area name, or \*\*`b\/back`\*\*\)/);
  });
});

describe('render review-presentation', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const render = (payload) => {
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(payload));
    return renderSurface(dir, 'review-presentation', { dotpath: 'pay.review.checkout', file: 'p.json' });
  };

  it('a fail carries full chrome: title anchor, red verdict tier, then the list', () => {
    const out = render({
      topic: 'checkout', verdict: 'fail',
      corrected: { applied: 180, reverted: 2, suite: 'green' }, discarded: 45, out_of_scope: 2,
      replan: [
        { summary: 'the badge key collides for two row shapes', ref: 'union.go:190', fails: 'both rows render the badge' },
        { summary: 'the guard scans comments only', fails: 'ten retired names pass green' },
      ],
    });
    assert.match(out, /=== TITLE \(emit verbatim as markdown — the view's chrome heading\) ===\n# \*\*`■ Review — Checkout`\*\*/);
    assert.match(out, /DISPLAY: review verdict \(emit verbatim as a properties code block/);
    assert.match(out, /⚑ Failed — 2 findings must be planned and built before this work is delivered/);
    assert.match(out, /\*\*Needs planning\*\* — 2 findings/);
    assert.match(out, /1\\\. the badge key collides/);
    assert.match(out, /↳ union\.go:190 — both rows render the badge/);
    assert.match(out, /↳ ten retired names pass green/);
    assert.match(out, /Corrected in this session: 180 applied · suite green · 2 reverted, still owed\./);
    assert.match(out, /Outside this spec: 2 findings held for your call\./);
    assert.match(out, /Discarded: 45 — reasons in the report\./);
    const vi = out.indexOf('⚑ Failed');
    assert.ok(out.indexOf('■ Review') < vi && vi < out.indexOf('Needs planning'), 'verdict sits between the title and the list');
  });

  it('a pass keeps the chrome and stays calm — no red, nothing listed', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', corrected: { applied: 180, suite: 'green' }, discarded: 45 });
    assert.match(out, /# \*\*`■ Review — Checkout`\*\*/);
    assert.match(out, /\*\*Passed\*\* — nothing needs planning\./);
    assert.ok(!out.includes('⚑'), 'red is the fail register only');
    assert.match(out, /180 applied · suite green\./);
    assert.ok(!out.includes('Needs planning'));
    assert.ok(!/^\d+\\\. /m.test(out), 'nothing is listed on a pass');
  });

  it('a clean pass is the title and the verdict alone', () => {
    const out = render({ topic: 'checkout', verdict: 'pass' });
    assert.match(out, /\*\*Passed\*\*/);
    assert.ok(!out.includes('DISPLAY: review findings'), 'no findings section when there is nothing to say');
    assert.ok(!out.includes('Corrected'));
    assert.ok(!out.includes('Discarded'));
  });

  it('refuses a verdict that disagrees with the list', () => {
    assert.throws(() => render({ topic: 'checkout', verdict: 'fail' }), /a fail must carry at least one "replan" finding/);
    assert.throws(
      () => render({ topic: 'checkout', verdict: 'pass', replan: [{ summary: 'x', fails: 'y' }] }),
      /a pass cannot carry "replan" findings/,
    );
  });

  it('refuses a bad payload and a bad address', () => {
    assert.throws(() => render({ topic: 'checkout', verdict: 'ship-it' }), /"verdict" must be "pass" or "fail"/);
    assert.throws(() => render({ verdict: 'pass' }), /"topic" must be a non-empty string/);
    writeManifest(dir, 'pay2', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify({ topic: 'x', verdict: 'pass' }));
    assert.throws(
      () => renderSurface(dir, 'review-presentation', { dotpath: 'pay2.discussion.checkout', file: 'p.json' }),
      /address must be <work_unit>\.review\.<topic>/,
    );
  });
});

describe('render review-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('a fail routes to planning and offers nothing else', () => {
    const out = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'fail', replan: '9' });
    assert.match(out, /\*\*`◆ What next\?`\*\*/);
    assert.match(out, /\*\*`p\/plan`\*\* → Plan the 9 failures and reopen implementation/);
    assert.match(out, /\*\*Ask\*\*/);
    assert.ok(!out.includes('c/complete'), 'a failing review cannot be completed');
    assert.ok(!out.includes('i/inbox'), 'future work is not offered while the review is failing');
  });

  it('a pass completes, offering the out-of-scope decision only when findings exist', () => {
    const withOos = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass', 'out-of-scope': '2' });
    assert.match(withOos, /\*\*`c\/complete`\*\* → Complete the review phase and continue/);
    assert.match(withOos, /\*\*`i\/inbox`\*\*\s+→ Decide the 2 findings outside this spec/);
    const clean = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    assert.ok(!clean.includes('i/inbox'), 'no offer when nothing is out of scope');
    assert.ok(!clean.includes('p/plan'));
  });

  it('refuses a fail with no replan count, a bad verdict, and a bad address', () => {
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'fail' }),
      /a fail needs --replan <count>/,
    );
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'maybe' }),
      /--verdict must be "pass" or "fail"/,
    );
    writeManifest(dir, 'pay2', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
    assert.throws(
      () => renderSurface(dir, 'review-gate', { dotpath: 'pay2.discussion.checkout', verdict: 'pass' }),
      /address must be <work_unit>\.review\.<topic>/,
    );
  });
});

describe('render off-topic-offer', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const feature = () => writeManifest(dir, 'pay', {
    work_type: 'feature',
    phases: { research: { items: { pay: { status: 'in-progress' } } } },
  });

  it('offers the pivot for a feature, aligned across three rows', () => {
    feature();
    const file = writePayload(dir, 'o.json', { concern: 'Rate limiting on the public API' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Rate limiting on the public API** is beyond this topic's scope.",
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`p/pivot`**  → Convert this work to an epic so it can hold the',
      `${NB(11)}concern as its own topic`,
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('drops the pivot for a non-feature and re-aligns the pair', () => {
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { research: { items: { xc: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { concern: 'Audit logging' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'xc.research.xc', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Audit logging** is beyond this topic's scope.",
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload and an empty concern', () => {
    feature();
    assert.throws(() => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay' }), /--file <payload\.json> is required/);
    const blank = writePayload(dir, 'b.json', { concern: '  ' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file: blank }),
      /"concern" must be a non-empty string/,
    );
  });

  it('the discussion variant adds the roadmap park and speaks the Summary register', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: { discussion: { items: { pay: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { concern: 'Gift cards' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.discussion.pay', file, variant: 'discussion' });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Gift cards** is beyond this topic's scope.",
      '',
      '**`l/log`**     → Capture it as an idea in the inbox for later',
      '**`r/roadmap`** → Park it on the product roadmap with a horizon',
      '**`p/pivot`**   → Convert this work to an epic so it can hold the',
      `${NB(12)}concern as its own topic`,
      '**`i/ignore`**  → Note it in the Summary and move on',
      '',
    ].join('\n'));
  });

  it('refuses an unknown variant', () => {
    feature();
    const file = writePayload(dir, 'o.json', { concern: 'X' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file, variant: 'nope' }),
      /--variant takes "discussion"/,
    );
  });
});

describe('render roadmap gate menus — static sets, engine-rendered like every menu', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('roadmap-harvest-gate: the sort confirm', () => {
    const out = renderSurface(dir, 'roadmap-harvest-gate', {});
    assert.match(out, /^=== MENU: roadmap harvest gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /`◆ Confirm the sort, or tell me what to adjust\.`/);
    assert.match(out, /`y\/yes`.*Commit these items to the roadmap/);
    assert.match(out, /`e\/explore`.*Go back to the conversation; not ready yet/);
    assert.match(out, /\*\*Adjust\*\*.*Tell me what to change \(move, split, merge, rename,/);
  });

  it('roadmap-parks-gate: the parks-only confirm in the park register', () => {
    const out = renderSurface(dir, 'roadmap-parks-gate', {});
    assert.match(out, /`◆ Park these on the roadmap, or tell me what to adjust\.`/);
    assert.match(out, /`y\/yes`.*Commit these items to the roadmap and conclude/);
    assert.match(out, /\*\*Adjust\*\*.*move between horizons/);
  });

  it('roadmap-shape-gate and roadmap-conclude-gate: the pull ceremony pair', () => {
    const shape = renderSurface(dir, 'roadmap-shape-gate', {});
    assert.match(shape, /`◆ Shape it this way\?`/);
    assert.match(shape, /`y\/yes`.*Create it and continue into delivery/);
    assert.match(shape, /\*\*Adjust\*\*.*epic vs feature, the framing/);
    const conclude = renderSurface(dir, 'roadmap-conclude-gate', {});
    assert.match(conclude, /`◆ Pull a slice into delivery now\?`/);
    assert.match(conclude, /`p\/pull`.*Pick the item\(s\) going into delivery/);
    assert.match(conclude, /`s\/stop`.*Stop here — the roadmap keeps everything warm/);
  });
});

describe('render — the adopted cross-flow static gates', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('name-gate: the confirm shape, and the collision re-ask variant', () => {
    const confirm = renderSurface(dir, 'name-gate', {});
    assert.match(confirm, /^=== MENU: name gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(confirm, /`◆ Is this name okay\?`/);
    assert.match(confirm, /`y\/yes`.*Use this name/);
    assert.match(confirm, /\*\*A different name\*\*.*Tell me what to call it instead/);

    const collision = renderSurface(dir, 'name-gate', { variant: 'collision' });
    assert.match(collision, /`◆ Choose a different name, or resume via \/workflow-start\.`/);
    assert.match(collision, /\*\*A different name\*\*.*Tell me what to call it instead/);
    assert.ok(!/y\/yes/.test(collision), 'the collided suggestion is not re-offerable');

    assert.throws(() => renderSurface(dir, 'name-gate', { variant: 'nope' }), /--variant takes "collision"/);
  });

  it('shape-gate: the work-type commit confirm', () => {
    const out = renderSurface(dir, 'shape-gate', {});
    assert.match(out, /`◆ Have I read this right\?`/);
    assert.match(out, /`y\/yes`.*That's the right shape, set it up/);
    assert.match(out, /`o\/other`.*It's something else \(tell me what\)/);
    assert.match(out, /\*\*Keep shaping\*\*.*Tell me what I'm missing/);
  });

  it('synthesis-gate: the epic topic sort confirm', () => {
    const out = renderSurface(dir, 'synthesis-gate', {});
    assert.match(out, /`◆ Confirm to commit, or tell me what to adjust\.`/);
    assert.match(out, /`y\/yes`.*Commit these topics and conclude/);
    assert.match(out, /`e\/explore`.*Go back to exploration; not ready to commit yet/);
    assert.match(out, /\*\*Adjust\*\*.*split, merge, rename,/);
  });

  it('query-failure-gate: retry or proceed without context', () => {
    const out = renderSurface(dir, 'query-failure-gate', {});
    assert.match(out, /`◆ How should I proceed\?`/);
    assert.match(out, /`r\/retry`.*I'll fix the issue; retry the query/);
    assert.match(out, /`s\/skip`.*Proceed without knowledge context for this phase/);
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
      '=== DISPLAY: map operation (emit verbatim as a code block, directly above the menu) ===',
      'Updating 2 summary(ies):',
      '',
      '  • auth-flow: "How sign-in survives a session drop"',
      '  • legacy-bits: "What the old importer still owns"',
      '',
      "=== MENU: map operation gate (emit verbatim as markdown, then STOP for the user's response) ===",
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
      '=== DISPLAY: map operation (emit verbatim as a code block, directly above the menu) ===',
      'Remove "auth-flow" from the map.',
      '',
      '  Lifecycle: fresh — no work has started on this topic.',
      '  The name will be added to the dismissed list so the analysis',
      "  won't auto-re-propose it.",
      '',
      "=== MENU: map operation gate (emit verbatim as markdown, then STOP for the user's response) ===",
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

  it('refuses an op its lifecycle forbids — the same table the write path enforces', () => {
    assert.throws(() => render('remove', { name: 'in-flight' }, 'r1.json'),
      /render map-op-gate: "in-flight" can't be removed — it's "discussing", not fresh/);
    assert.throws(() => render('rename', { name: 'in-flight', new_name: 'x' }, 'r2.json'),
      /"in-flight" can't be renamed — it's "discussing", not fresh/);
    assert.throws(() => render('reroute', { name: 'in-flight', from: 'research', to: 'discussion' }, 'r3.json'),
      /"in-flight" can't be re-routed — it's "discussing", not fresh/);
    assert.throws(() => render('close', { name: 'dead-end' }, 'r4.json'),
      /"dead-end" can't be closed as a dead end — it's already closed/);
    assert.throws(() => render('reopen', { name: 'auth-flow' }, 'r5.json'),
      /"auth-flow" can't be reopened — it's "fresh", not closed as a dead end/);
  });

  it('a cancelled topic refuses the close, and an edit rides any lifecycle', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { 'auth-flow': { routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'auth-flow': { status: 'cancelled' } } },
      },
    });
    assert.throws(() => render('close', { name: 'auth-flow' }, 'c1.json'),
      /"auth-flow" can't be closed as a dead end — it's cancelled; reactivate the phase work from the epic menu first/);
    assert.match(render('edit-summary', { items: [{ name: 'auth-flow', summary: 'Still editable' }] }, 'c2.json'),
      /Updating 1 summary\(ies\):/);
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

  it('renders the gated candidate byte-exactly — display then the four-way gate', () => {
    staged('gated');
    assert.strictEqual(render(), [
      '=== DISPLAY: candidate (emit verbatim as a code block) ===',
      'Signal Freshness Contract [discussion]',
      '  What freshness the ranking signals must guarantee downstream',
      '  surfaced by gap analysis',
      '',
      "=== MENU: candidate gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Add this topic to the map?`**',
      '',
      '**`y/yes`**   → Approve — the topic joins the map and its phase can',
      `${NB(10)}start from the epic menu`,
      '**`a/auto`**  → Approve this and all remaining candidates automatically',
      '**`s/skip`**  → Skip and dismiss — the analysis never re-proposes this',
      `${NB(10)}name`,
      '**Comment** → Tell me what to change (routing, summary, or',
      `${NB(10)}description)`,
      '',
    ].join('\n'));
  });

  it('an auto gate mode renders the approval line and no menu — the branch is the surface\'s', () => {
    staged('auto');
    const out = render();
    assert.match(out, /=== DISPLAY: candidate \(/);
    assert.match(out, /=== DISPLAY: candidate approved \(after recording the approval: /);
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
});

describe('render topic-collision-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('renders the cancel / pick-another pair byte-exactly', () => {
    assert.strictEqual(renderSurface(dir, 'topic-collision-gate', {}), [
      "=== MENU: topic collision gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`c/cancel`**     → Abandon creating this topic',
      '**Pick another** → Tell me a different name',
      '',
    ].join('\n'));
  });
});

describe('render triage-closed-target', () => {
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

  it('renders the dead-end target byte-exactly — statement context, three destinations', () => {
    assert.strictEqual(renderSurface(dir, 'triage-closed-target', { dotpath: 'pay.discovery.auth-flow' }), [
      "=== MENU: closed target gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '"auth-flow" is closed as a dead end, so it won\'t pick up rerouted concerns.',
      '',
      '**`o/open`**      → Reopen it and land the concern there — it returns',
      `${NB(14)}to its name-matched lifecycle and counts as open`,
      `${NB(14)}again`,
      '**`e/elsewhere`** → Pick a different target',
      '**`d/drop`**      → Drop the reroute; the concern stays with the',
      `${NB(14)}current topic`,
      '',
    ].join('\n'));
  });

  it('a cancelled target flips both words the lifecycle owns', () => {
    const out = renderSurface(dir, 'triage-closed-target', { dotpath: 'pay.discovery.legacy-bits' });
    assert.match(out, /"legacy-bits" is cancelled, so it won't pick up rerouted concerns\./);
    assert.match(out, /\*\*`o\/open`\*\*\s+→ Reactivate it and land the concern there — its/);
    assert.match(out, /phase work returns to its previous status and\n/);
    assert.match(out, /counts as open again/);
  });

  it('refuses a live target, an unknown name, and a non-discovery address', () => {
    assert.throws(() => renderSurface(dir, 'triage-closed-target', { dotpath: 'pay.discovery.live' }),
      /"live" is "fresh", not closed — the gate serves handled and cancelled targets/);
    assert.throws(() => renderSurface(dir, 'triage-closed-target', { dotpath: 'pay.discovery.ghost' }),
      /no discovery item "ghost" on the map/);
    assert.throws(() => renderSurface(dir, 'triage-closed-target', { dotpath: 'pay.discussion.legacy-bits' }),
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
    const file = writePayload(dir, 'd.json', { thread: "The competitor's ranking pipeline" });
    assert.strictEqual(renderSurface(dir, 'deep-dive-offer', { dotpath: 'pay.research.checkout', file }), [
      "=== MENU: deep dive offer (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      "The competitor's ranking pipeline looks like it could use a deep dive.",
      '',
      '**`◆ Want me to spin up a background investigation while we keep going?`**',
      '',
      '**`y/yes`** → Dispatch a deep-dive agent',
      "**`n/no`**  → Skip, we'll cover it in conversation",
      '',
    ].join('\n'));
  });

  it('in-flight-agents-gate renders the wait/proceed pair byte-exactly — statement context, no glyph', () => {
    assert.strictEqual(renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout', count: '2' }), [
      "=== MENU: in-flight agents gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'There are still 2 background agents working.',
      '',
      '**`w/wait`**    → Wait for results before concluding',
      '**`p/proceed`** → Conclude now (results will persist in cache for',
      `${NB(12)}reference)`,
      '',
    ].join('\n'));
  });

  it('a lone agent takes the singular — the count never reads "1 agents"', () => {
    assert.strictEqual(renderSurface(dir, 'in-flight-agents-gate', { dotpath: 'pay.research.checkout', count: '1' }), [
      "=== MENU: in-flight agents gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'There is still 1 background agent working.',
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
      "=== MENU: conclude gate (emit verbatim as markdown, then STOP for the user's response) ===",
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

    const implementation = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.implementation.checkout' });
    assert.match(implementation, /`◆ Ready to mark implementation as completed\?`/);
    assert.match(implementation, /\*\*`y\/yes`\*\* → Mark as completed/);
    assert.match(implementation, /\*\*`n\/no`\*\*\s+→ Go back and make changes/);

    const planning = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.planning.checkout' });
    assert.match(planning, /`◆ Ready to conclude\?`/);
    assert.match(planning, /\*\*`y\/yes`\*\* → Conclude plan and mark as completed/);
  });

  it('conclude-gate: refuses a phase that concludes some other way', () => {
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.research.checkout' }),
      /phase must be one of discussion, investigation, implementation, planning, got "research"/);
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.planning' }),
      /address must be <work_unit>\.<phase>\.<topic>/);
  });

  it('summary-backfill-gate: the static batch gate and the payload-named unsourced set', () => {
    const batch = renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay', variant: 'batch' });
    assert.match(batch, /MENU: summary batch gate/);
    assert.match(batch, /`◆ Accept these summaries\?`/);
    assert.match(unwrap(batch), /\*\*`y\/yes`\*\*\s+→ Accept all summaries as drafted \(description is auto-drafted silently\)/);
    assert.match(unwrap(batch), /\*\*`e\/edit`\*\* → Edit one or more summary lines before accepting/);
    assert.match(unwrap(batch), /\*\*`s\/skip`\*\* → Skip the whole batch \(leave fields blank\)/);

    const unsourced = renderSurface(dir, 'summary-backfill-gate', {
      dotpath: 'pay', variant: 'unsourced', file: writePayload(dir, 'u.json', { names: ['auth-flow', 'legacy-bits'] }),
    });
    assert.match(unsourced, /`◆ 2 topic\(s\) have no source file to draft from:`/);
    assert.match(unsourced, /\n- Auth Flow\n- Legacy Bits\n\n/);
    assert.match(unwrap(unsourced), /\*\*`p\/provide`\*\* → Tell me the summary for each and I'll write it/);
    assert.match(unwrap(unsourced), /\*\*`l\/leave`\*\*\s+→ Leave them unset; this flow re-offers next time/);
  });

  it('summary-backfill-gate: validates the variant, the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay' }),
      /--variant must be "batch" or "unsourced", got "undefined"/);
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay.discovery.x', variant: 'batch' }),
      /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', { dotpath: 'pay', variant: 'unsourced' }),
      /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'summary-backfill-gate', {
      dotpath: 'pay', variant: 'unsourced', file: writePayload(dir, 'u.json', { names: [] }),
    }), /"names" must be a non-empty array of topic names/);
  });

  it('external-dependency-gate: the blocking gate is static, the pick reads its descriptions from the plan', () => {
    const blocking = renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.planning.checkout', variant: 'blocking' });
    assert.match(blocking, /MENU: blocking dependencies gate/);
    assert.match(blocking, /`◆ How would you like to proceed\?`/);
    assert.match(blocking, /\*\*`s\/satisfied`\*\* → Mark a dependency as satisfied externally/);
    assert.match(blocking, /\*\*`i\/implement`\*\* → Exit to implement blocking dependencies first/);

    const pick = renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'pick', blocking: 'data-model,auth-flow',
    });
    assert.strictEqual(pick, [
      "=== MENU: dependency pick (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which dependency has been satisfied?`**',
      '',
      '**`1`** → Data Model — the shared row shape',
      '**`2`** → Auth Flow — session tokens',
      '',
    ].join('\n'));
  });

  it('external-dependency-gate: refuses a foreign name, an empty set and a non-planning address', () => {
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.planning.checkout', variant: 'pick' }),
      /--blocking <topic,topic,…> is required/);
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', {
      dotpath: 'pay.planning.checkout', variant: 'pick', blocking: 'ghost',
    }), /"ghost" is not an external dependency of "checkout"/);
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.implementation.checkout', variant: 'blocking' }),
      /address must be <work_unit>\.planning\.<topic>, got phase "implementation"/);
    assert.throws(() => renderSurface(dir, 'external-dependency-gate', { dotpath: 'pay.planning.checkout', variant: 'nope' }),
      /--variant must be "blocking" or "pick"/);
  });

  it('checkpoint-files-gate and executor-block-gate: the implementation loop\'s two static stops', () => {
    const checkpoint = renderSurface(dir, 'checkpoint-files-gate', { dotpath: 'pay.implementation.checkout' });
    assert.match(checkpoint, /MENU: checkpoint files gate/);
    assert.match(checkpoint, /`◆ Include unexpected files in the checkpoint commit\?`/);
    assert.match(unwrap(checkpoint), /\*\*`y\/yes`\*\*\s+→ Include all/);
    assert.match(unwrap(checkpoint), /\*\*`s\/skip`\*\*\s+→ Exclude unexpected files, commit only implementation files/);
    assert.match(unwrap(checkpoint), /\*\*Comment\*\* → Specify which to include/);

    const block = renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout' });
    assert.match(block, /MENU: executor block gate/);
    assert.match(block, /`◆ How would you like to proceed\?`/);
    assert.match(unwrap(block), /\*\*`r\/retry`\*\* → Re-invoke the executor with your comments \(provide below\)/);
    assert.match(unwrap(block), /\*\*`t\/stop`\*\*\s+→ Stop implementation entirely/);

    for (const surface of ['checkpoint-files-gate', 'executor-block-gate']) {
      assert.throws(() => renderSurface(dir, surface, { dotpath: 'pay.planning.checkout' }),
        /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/);
    }
  });

  it('dependency-approval-gate: three variants, one approve-or-change shape', () => {
    const graph = renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'graph' });
    assert.match(graph, /MENU: dependency approval gate/);
    assert.match(graph, /`◆ Approve the dependency graph\?`/);
    assert.match(unwrap(graph), /\*\*`y\/yes`\*\*\s+→ Proceed/);
    assert.match(unwrap(graph), /\*\*Tell me what to change\*\* → which priorities or dependencies to adjust/);

    assert.match(renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'updated-graph' }),
      /`◆ Approve the updated graph\?`/);
    const resolution = renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout', variant: 'resolution' });
    assert.match(resolution, /`◆ Approve the dependency resolution\?`/);
    assert.match(unwrap(resolution), /\*\*Tell me what to change\*\* → which resolutions to adjust or links to add/);

    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.planning.checkout' }),
      /--variant must be one of graph, updated-graph, resolution, got "undefined"/);
    assert.throws(() => renderSurface(dir, 'dependency-approval-gate', { dotpath: 'pay.discussion.checkout', variant: 'graph' }),
      /address must be <work_unit>\.planning\.<topic>/);
  });

  it('task-count-gate: the authoring mismatch stop', () => {
    const out = renderSurface(dir, 'task-count-gate', { dotpath: 'pay.planning.checkout' });
    assert.match(out, /MENU: task count gate/);
    assert.match(out, /`◆ How would you like to proceed\?`/);
    assert.match(unwrap(out), /\*\*`r\/retry`\*\* → Re-invoke the author agent once more/);
    assert.match(unwrap(out), /\*\*Adjust\*\*\s+→ Tell me what to correct \(the task table or the detail file\), and I'll apply it and re-validate/);
    assert.throws(() => renderSurface(dir, 'task-count-gate', { dotpath: 'pay.implementation.checkout' }),
      /address must be <work_unit>\.planning\.<topic>/);
  });

  it('plan-format-gate: names the project default, and refuses when none is set', () => {
    assert.throws(() => renderSurface(dir, 'plan-format-gate', {}),
      /no project default plan_format — the offer only renders over an existing default/);
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'),
      JSON.stringify({ work_units: { pay: {} }, defaults: { plan_format: 'local-markdown' } }));
    assert.strictEqual(renderSurface(dir, 'plan-format-gate', {}), [
      "=== MENU: plan format gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Project default format is **local-markdown**. Use the same format?',
      '',
      '**`y/yes`** → Use local-markdown',
      '**`n/no`**  → See all available formats',
      '',
    ].join('\n'));
  });

  it('plan-review-gate: the loop\'s two gates, spec-review-gate\'s sibling', () => {
    const cont = renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout', variant: 'continue' });
    assert.match(cont, /MENU: plan review continue gate/);
    assert.match(cont, /`◆ Continue with review\?`/);
    assert.match(cont, /\*\*`p\/proceed`\*\* → Continue review/);
    assert.match(cont, /\*\*`s\/skip`\*\*\s+→ Skip review, proceed to completion/);

    const reloop = renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout', variant: 'reloop' });
    assert.match(reloop, /MENU: plan review reloop gate/);
    assert.match(reloop, /`◆ Run another review round\?`/);
    assert.match(unwrap(reloop), /\*\*`r\/reanalyse`\*\* → Run another round \(traceability \+ integrity\)/);
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
      "=== MENU: correction gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Apply the correction protocol to .workflows/done/specification/done/specification.md?',
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

  it('analysis-proceed-gate: the bare y/n consent before the grouping analysis', () => {
    assert.strictEqual(renderSurface(dir, 'analysis-proceed-gate', { dotpath: 'pay' }), [
      "=== MENU: analysis proceed gate (emit verbatim as markdown, then STOP for the user's response) ===",
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
});
