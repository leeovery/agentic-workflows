'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DOTS, section, menuFrame, menu, callout, indentedBody, bulletRow, subDetail, treeList } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
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

  it('a never-started topic: only the map row is marked', () => {
    writeManifest(dir, 'pay', {
      phases: { discovery: { items: { 'data-export': { routing: 'discussion', source: 'discovery' } } } },
    });
    const out = renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.data-export' });
    assert.match(out, /MENU: cancel gate/);
    assert.match(unwrap(out), /Cancelling \*\*Data Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    assert.match(out, /◆ Cancel it\?/);
    assert.match(out, /\*\*`y\/yes`\*\* → Confirm cancellation/);
    assert.match(out, /\*\*`n\/no`\*\*  → Keep it/);
  });

  it('a started topic: the items by phase, the open records that end abandoned, the proposed groupings discarded', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'research', source: 'discovery' } } },
        research: { items: { auth: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress', awaiting_experiments: ['E2'] } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: {
          E1: { slug: 'a', status: 'concluded', verdict: 'held' },
          E2: { slug: 'b', status: 'running' },
          'E2.1': { slug: 'c', status: 'conceived' },
        } } } },
        specification: { items: {
          grp: { status: 'proposed', sources: { auth: { status: 'pending' } } },
          other: { status: 'proposed', sources: { auth: { status: 'pending' } } },
          dead: { status: 'cancelled', sources: { auth: { status: 'pending' } } },
        } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }));
    assert.match(out, /Cancelling \*\*Auth\*\* marks its research \[completed\] and discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E2, with E2\.1\) ends abandoned on the register\. The proposed groupings \*\*Grp\*\* and \*\*Other\*\* are discarded — the next grouping analysis rebuilds from the new world\./);
    assert.ok(!out.includes('Dead'), 'a cancelled specification is neither a lock nor a discard');
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

  it('refuses a unit with nothing to cancel — an off-map topic whose only item is superseded, a specification carrying no status', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { legacy: { status: 'superseded', superseded_by: 'other' } } },
        specification: { items: { blank: { sources: {} } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.legacy' }),
      /"legacy" has nothing to cancel — no live item under its name and no map row, so the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.blank' }),
      /"blank" has nothing to cancel — it carries no status, so the menu never offers it/);
  });

  it('a single item, a single open record: singular wording, no discard clause', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { auth: { status: 'triaged' } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: { E1: { slug: 'a', status: 'running' } } } } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }));
    assert.match(out, /Cancelling \*\*Auth\*\* marks its research \[triaged\] cancelled — it can be reactivated later\. 1 open experiment \(E1\) ends abandoned on the register\./);
    assert.ok(!out.includes('discarded'), out);
  });

  it('a specification: the plan and the source discussions it frees', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discussion: { items: { auth: { status: 'completed' }, roles: { status: 'completed' } } },
        specification: { items: { unified: { status: 'in-progress', sources: { auth: { status: 'incorporated' }, roles: { status: 'pending' } } } } },
        planning: { items: { unified: { status: 'in-progress' } } },
      },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.unified' }));
    assert.match(out, /Cancelling \*\*Unified\*\* marks the specification and its plan cancelled and frees its source discussions \(Auth, Roles\) to be regrouped or cancelled; it can be reactivated later\./);
  });

  it('a specification with no plan and no sources names neither', () => {
    writeManifest(dir, 'pay', {
      phases: { specification: { items: { unified: { status: 'completed' } } } },
    });
    const out = unwrap(renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.unified' }));
    assert.match(out, /Cancelling \*\*Unified\*\* marks the specification cancelled; it can be reactivated later\./);
  });

  it('refuses what the menu never offers — locked, cancelled, proposed — and a non-unit address', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { gone: { routing: 'discussion', source: 'discovery', cancelled: true } } },
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: {
          unified: { status: 'in-progress', sources: { auth: { status: 'incorporated' } } },
          grp: { status: 'proposed', sources: {} },
          shipped: { status: 'completed', sources: {} },
          done: { status: 'promoted', sources: {} },
        } },
        implementation: { items: { shipped: { status: 'in-progress' } } },
      },
    });
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.auth' }),
      /"auth" is locked by the specification sourcing its discussion \(unified\) — the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.gone' }),
      /"gone" is already cancelled — the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discovery.ghost' }),
      /no topic "ghost" — nothing on the map and no research or discussion item of that name/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.shipped' }),
      /"shipped" is locked — implementation has started, so the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.grp' }),
      /"grp" is a proposed grouping — not started, so the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.done' }),
      /"done" is promoted — the menu never offers it/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.specification.ghost' }),
      /no specification item "ghost"/);
    assert.throws(() => renderSurface(dir, 'cancel-gate', { dotpath: 'pay.discussion.auth' }),
      /address must be <work_unit>\.discovery\.<topic> or <work_unit>\.specification\.<spec>, got phase "discussion"/);
  });
});

describe('topic-receipt — the unit addresses', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  it('cancel and reactivate read the unit; a never-started topic restores nothing', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { gone: { routing: 'discussion', source: 'discovery', cancelled: true }, back: { routing: 'discussion', source: 'discovery' } } },
        research: { items: { back: { status: 'completed' } } },
        discussion: { items: { back: { status: 'in-progress' } } },
        specification: { items: { spec: { status: 'cancelled', previous_status: 'completed' }, live: { status: 'completed' } } },
        planning: { items: { live: { status: 'in-progress' } } },
      },
    });
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.gone', verb: 'cancel' }), /Cancelled "Gone"\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'reactivate' }),
      /Reactivated "Back"\. Restored research \[completed\] · discussion \[in-progress\]\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.spec', verb: 'cancel', warn: '1' }),
      /⚑ Knowledge removal warning[\s\S]*Cancelled "Spec"\.\n/);
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.live', verb: 'reactivate' }),
      /Reactivated "Live"\. Restored specification \[completed\] · planning \[in-progress\]\.\n/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'cancel' }), /"back" is not cancelled — the cancel has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.spec', verb: 'reactivate' }), /"spec" is still cancelled — the reactivate has not run/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.back', verb: 'reactivate' }),
      /--verb reactivate addresses a unit — <work_unit>\.discovery\.<topic> or <work_unit>\.specification\.<spec>, got phase "research"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.ghost', verb: 'cancel' }), /no topic "ghost"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.specification.ghost', verb: 'cancel' }), /no specification item "ghost"/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.discovery.back', verb: 'bogus' }), /--verb must be complete, cancel, or reactivate/);
  });

  it('complete keeps its phase-item address', () => {
    writeManifest(dir, 'pay', { phases: { research: { items: { back: { status: 'completed' } } } } });
    assert.strictEqual(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.back', verb: 'complete' }), '');
    assert.match(renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.back', verb: 'complete', warn: '1' }), /Knowledge indexing warning/);
    assert.throws(() => renderSurface(dir, 'topic-receipt', { dotpath: 'pay.research.ghost', verb: 'complete' }), /no research item "ghost"/);
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

  /** The design as the briefing tells it — what the approval gate leads with. */
  const design = (body = 'We will count recovering sessions over one week.\n') =>
    writePayload(dir, 'presented-design.md', body);

  it('renders the empty register with the none-yet line — no caller branch needed', () => {
    labWith({});
    const out = renderSurface(dir, 'experiment-register', { dotpath: 'lab.experiment.timing' });
    assert.match(out, /=== DISPLAY: experiment register \(emit verbatim as a code block — do not stop; continue as the workflow instructs\) ===/);
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

  it('the approval gate leads with the design, then the menu — commands first, the prompt last', () => {
    labWith({ E1: { slug: 'window-placement', status: 'designed' } });
    const body = 'We will count recovering sessions over one week.\n\nFifteen percent or better and expansion leads.\n';
    const out = renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1', present: design(body) });
    assert.ok(out.startsWith('=== DISPLAY: experiment design (emit verbatim as markdown) ===\n'
      + '**Design for E1** — what it will do, and what each outcome triggers\n\n'
      + body), out);
    assert.ok(out.indexOf('DISPLAY: experiment design') < out.indexOf('MENU: experiment approval gate'));
    assert.match(out, /=== MENU: experiment approval gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
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
    const out = renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1.1', present: design() });
    assert.match(out, /\*\*Design for E1\.1\*\* — what it will do/);
    assert.match(out, /◆ Approve E1\.1's design\?/);
  });

  it('refuses a missing design, a missing id, an unknown id, and every status but designed', () => {
    labWith({ E1: { slug: 'window-placement', status: 'running' } });
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1' }),
      /render experiment-approval-gate: --present <design\.md> is required/);
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', present: design() }),
      /--id is required/);
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E9', present: design() }),
      /no experiment E9/);
    assert.throws(() => renderSurface(dir, 'experiment-approval-gate', { dotpath: 'lab.experiment.timing', id: 'E1', present: design() }),
      /E1 is "running", not designed — the briefing confirm follows the written design/);
  });

  it('renders the record picker over a populated series', () => {
    labWith({ E1: { slug: 'window-placement', status: 'running' } });
    const out = renderSurface(dir, 'experiment-pick', { dotpath: 'lab.experiment.timing' });
    assert.match(out, /=== MENU: experiment pick \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /Which experiment\? \(enter its id — E1, E2, …, or \*\*`b\/back`\*\*\)/);
  });

  it('the picker keeps only the address guard — a wrong phase refuses', () => {
    labWith({});
    assert.match(renderSurface(dir, 'experiment-pick', { dotpath: 'lab.experiment.timing' }),
      /MENU: experiment pick/);
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
    assert.match(out, /=== MENU: experiment next gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
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

describe('experiment spawn gate + wait gate — the conversation\'s two pauses', () => {
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
    holderWith('research', ['E1']);
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.research.timing', id: 'E1' });
    assert.match(out, /=== MENU: experiment spawn gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /◆ Work E1 now\?/);
    const n = out.indexOf('**`y/yes`**');
    const l = out.indexOf('**`l/later`**');
    assert.ok(n > -1 && l > n, 'yes leads, later follows');
    assert.match(unwrap(out), /Pause this research here and return to the epic menu with E1 queued/);
    assert.ok(!out.includes('the session ends'), 'the pause returns through the bridge — the row never describes a session ending');
    assert.match(unwrap(out), /Keep the conversation going — this research cannot conclude until E1's evidence lands/);
  });

  it('addresses the spawning discussion identically', () => {
    holderWith('discussion', ['E3']);
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.discussion.timing', id: 'E3' });
    assert.match(unwrap(out), /this discussion cannot conclude until E3's evidence lands/);
  });

  it('refuses a missing id, an unawaited id, and a non-spawn address', () => {
    holderWith('research', ['E1']);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.research.timing' }),
      /--id is required/);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.research.timing', id: 'E9' }),
      /research "timing" holds no evidence wait on E9 — the gate follows the recorded spawn/);
    assert.throws(() => renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'lab.experiment.timing', id: 'E1' }),
      /address must be <work_unit>\.<research\|discussion>\.<topic>/);
  });

  it('renders the blocked-conclusion gate — blocker naming the ids, guidance, then the yes/keep menu', () => {
    holderWith('discussion', ['E1', 'E2']);
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.timing' });
    assert.match(out, /=== DISPLAY: wait block \(emit verbatim as a properties code block — ```properties fence\) ===/);
    assert.match(out, /⚑ Conclusion blocked — this discussion awaits experiment evidence \(E1, E2\)/);
    assert.match(out, /=== DISPLAY: wait guidance \(emit verbatim as markdown\) ===/);
    assert.match(out, /> The wait releases when each experiment ends\. The epic menu carries the way in\./);
    assert.match(out, /=== MENU: wait gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /◆ Pause to the menu\?/);
    assert.match(unwrap(out), /Pause this discussion here and return to the epic menu with E1, E2 queued/);
    assert.match(unwrap(out), /Keep the conversation going — conclusion stays blocked until the evidence lands/);
  });

  it('the wait gate is empty over an item with no live wait, and refuses an address outside the waiting phases', () => {
    holderWith('research');
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.research.timing' }), '');
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.experiment.timing' }),
      /address must be <work_unit>\.<research\|discussion\|planning>\.<topic>/);
  });
});

describe('wait-gate — the blocked-conclusion gate over every wait', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  /** @param {object|undefined} research @param {object} discussion */
  function billingWith(research, discussion) {
    writeManifest(dir, 'lab', {
      phases: {
        ...(research ? { research: { items: { billing: research } } } : {}),
        discussion: { items: { billing: discussion } },
      },
    });
  }

  it('a research wait — the blocker names the topic and that the research is in flight, the guidance the ways out', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress' });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' });
    assert.match(out, /=== DISPLAY: wait block \(emit verbatim as a properties code block — ```properties fence\) ===/);
    assert.match(out, /⚑ Conclusion blocked — this discussion awaits research on "Billing" \(in flight\)\n/);
    assert.match(out, /=== DISPLAY: wait guidance \(emit verbatim as markdown\) ===/);
    assert.match(out, /> Work the research first — concluding it releases its wait; this discussion can conclude once the research lands\. The epic menu carries the way in\.\n/);
    assert.match(out, /=== MENU: wait gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /◆ Pause to the menu\?/);
    assert.match(unwrap(out), /\*\*`y\/yes`\*\*\s+→ Pause this discussion here and return to the epic menu with the research queued/);
    assert.match(unwrap(out), /\*\*`k\/keep`\*\* +→ Keep the conversation going — conclusion stays blocked until the research lands/);
    assert.ok(!out.includes('experiment'), 'no experiment clause without an experiment wait');
  });

  it('a parked stub reads parked', () => {
    billingWith({ status: 'triaged' }, { status: 'in-progress' });
    assert.match(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' }),
      /⚑ Conclusion blocked — this discussion awaits research on "Billing" \(parked — not yet started\)\n/);
  });

  it('both kinds — every wait named, research first, and each clause of the guidance and the menu composed', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' });
    assert.match(out, /⚑ Conclusion blocked — this discussion awaits research on "Billing" \(in flight\) and experiment evidence \(E1, E2\)\n/);
    assert.match(out, /> Work the research first — concluding it releases its wait\. The wait releases when each experiment ends\. This discussion can conclude once the research and the evidence have landed\. The epic menu carries the way in\.\n/);
    assert.match(unwrap(out), /return to the epic menu with the research and E1, E2 queued/);
    assert.match(unwrap(out), /conclusion stays blocked until the research and the evidence land/);
  });

  it('an experiment-only wait names the evidence alone — landed research holds nothing', () => {
    billingWith({ status: 'completed' }, { status: 'in-progress', awaiting_experiments: ['E1'] });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' });
    assert.match(out, /awaits experiment evidence \(E1\)\n/);
    assert.ok(!out.includes('research'), 'no research clause once the research has landed');
  });

  it('empty when nothing blocks conclusion', () => {
    billingWith({ status: 'completed' }, { status: 'in-progress' });
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' }), '');
    billingWith(undefined, { status: 'in-progress' });
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.discussion.billing' }), '');
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.research.billing' }),
      /no research item "billing" — nothing to hold shut/, 'an absent item is a misrouted address, never a clear conclusion');
  });

  it('a feature\'s discussion waits on its research the same way — the pause names the work unit\'s next step, never a menu', () => {
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: {
        research: { items: { feat: { status: 'triaged' } } },
        discussion: { items: { feat: { status: 'in-progress' } } },
      },
    });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'feat.discussion.feat' });
    assert.match(out, /awaits research on "Feat" \(parked — not yet started\)/);
    assert.match(out, /Work the research first — concluding it releases its wait; this discussion can conclude once the research lands\. The pause continues the work unit at what it waits on\./);
    assert.match(out, /◆ Pause here\?/);
    assert.match(unwrap(out), /\*\*`y\/yes`\*\*\s+→ Pause this discussion here and continue the work unit at the research/);
    assert.ok(!out.includes('menu') && !out.includes('row'), 'a linear pause lands in plan mode, never on a menu — no epic vocabulary');
  });

  it('a feature\'s spawn gate pauses straight into the laboratory — no menu on a linear unit', () => {
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: { research: { items: { feat: { status: 'in-progress', awaiting_experiments: ['E1'] } } } },
    });
    const out = renderSurface(dir, 'experiment-spawn-gate', { dotpath: 'feat.research.feat', id: 'E1' });
    assert.match(unwrap(out), /Pause this research here and open the laboratory for E1/);
    assert.ok(!out.includes('menu'), 'no menu on a linear unit');
  });

  it('refuses a phase that holds no wait', () => {
    billingWith({ status: 'in-progress' }, { status: 'in-progress' });
    assert.throws(() => renderSurface(dir, 'wait-gate', { dotpath: 'lab.experiment.billing' }),
      /address must be <work_unit>\.<research\|discussion\|planning>\.<topic>/);
  });

  it('a plan waits on its specification — the blocker names why it is unsettled, the guidance the way out', () => {
    writeManifest(dir, 'lab', {
      phases: {
        specification: { items: { billing: { status: 'completed', sources: { talks: { status: 'stale' } } } } },
        planning: { items: { billing: { status: 'in-progress' } } },
      },
    });
    const out = renderSurface(dir, 'wait-gate', { dotpath: 'lab.planning.billing' });
    assert.match(out, /⚑ Conclusion blocked — this plan awaits its specification \(a source has moved beneath the extraction \(talks\)\)\n/);
    assert.match(out, /> Settle the specification first — concluding it releases its wait; this plan can conclude once the specification lands\. The epic menu carries the way in\.\n/);
    assert.match(unwrap(out), /\*\*`y\/yes`\*\*\s+→ Pause this plan here and return to the epic menu with the specification queued/);
    assert.match(unwrap(out), /\*\*`k\/keep`\*\* +→ Keep planning here — conclusion stays blocked until the specification lands/);
  });

  it('a settled specification holds nothing — the plan\'s gate is empty', () => {
    writeManifest(dir, 'lab', {
      phases: {
        specification: { items: { billing: { status: 'completed', sources: { talks: { status: 'incorporated' } } } } },
        planning: { items: { billing: { status: 'in-progress' } } },
      },
    });
    assert.strictEqual(renderSurface(dir, 'wait-gate', { dotpath: 'lab.planning.billing' }), '');
  });
});

describe('phase-paused — the bridge banner for a conversation leaving on a wait', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  const HEADER = '=== DISPLAY: phase paused (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===';

  it('a linear unit names what its one conversation awaits, the topic name dropped — the unit is the topic', () => {
    writeManifest(dir, 'ledger', {
      work_type: 'feature',
      phases: {
        research: { items: { ledger: { status: 'triaged' } } },
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

  it('nothing left awaited renders the bare line — a peer landed the wait between the gate and the bridge', () => {
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

  it('is loud on a missing phase, a phase that holds no wait, a dotted address, and an unknown unit', () => {
    writeManifest(dir, 'pay', { phases: { discussion: { items: { pay: { status: 'in-progress' } } } } });
    assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'pay' }), /--phase is required/);
    assert.throws(() => renderSurface(dir, 'phase-paused', { dotpath: 'pay', phase: 'specification' }),
      /--phase must be <research\|discussion\|planning> — the phases that pause on a wait; got "specification"/);
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
    for (const action of ['start_discussion', 'start_discussion_after_research', 'continue_discussion', 'new_discussion']) {
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
            parked: { status: 'triaged' },
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

describe('surfaces primitives', () => {
  it('menu opens on the rule, glyphs a short label, and never closes the frame', () => {
    assert.strictEqual(
      menu('Approve?', ['**`y/yes`**', '**`n/no`**']),
      [DOTS, '**`◆ Approve?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('leaves a long or marked-up label as prose — the glyph span cannot nest markup', () => {
    const long = 'Whether the pipeline can expose **click windows** belongs to a different topic entirely';
    const out = menu(long, ['**`y/yes`**'], { question: 'Move it there?' });
    assert.strictEqual(out, [DOTS, long, '', '**`◆ Move it there?`**', '', '**`y/yes`**'].join('\n'));
  });

  it('refuses a y/yes row under a statement — a consent gate asks its question', () => {
    const yes = ['**`y/yes`**', '**`n/no`**'];
    assert.throws(() => menu('Proceed.', yes), /"Proceed\." is not one/);
    assert.throws(() => menu('The tree is dirty.', yes, { question: 'Carry on.' }), /"Carry on\." is not one/);
    assert.throws(() => menu('', ['**`y/yes`** → Apply it']), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses a y/yes row under a question the label cannot glyph — the split is the fix', () => {
    const long = 'Does the pipeline exposing **click windows** belong to a different topic entirely?';
    assert.throws(() => menu(long, ['**`y/yes`**']), /no `◆ …\?` line stands above the rows/);
    assert.throws(() => menu('The tree is dirty.', ['**`y/yes`**'], { question: long }), /"Does the pipeline exposing .*" is not one/);
  });

  it('holds a projection-composed frame to the same rule — the check reads the composed lines', () => {
    const rows = ['**`y/yes`** → Proceed anyway', '**`b/back`** → Return to menu'];
    const lines = menuFrame(['Two topics sit ahead.', '', '**`◆ Proceed anyway?`**', '', ...rows], { glyphLabel: false }).split('\n');
    assert.deepStrictEqual(lines.slice(0, 5), [DOTS, 'Two topics sit ahead.', '', '**`◆ Proceed anyway?`**', '']);
    assert.throws(() => menuFrame(['Two topics sit ahead.', '', '**`◆ Proceed anyway.`**', '', ...rows], { glyphLabel: false }), /"Proceed anyway\." is not one/);
    assert.throws(() => menuFrame(['Two topics sit ahead.', '', ...rows], { glyphLabel: false }), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses an n/no row without a y/yes row — a refusal answers yes, never a verb synonym', () => {
    assert.throws(() => menu('Proceed?', ['**`p/proceed`** → Carry on', '**`n/no`** → Stop here']), /an n\/no row answers a y\/yes row/);
  });

  it('a y/yes row passes under a glyphable question — the label itself, or one split beneath a statement', () => {
    assert.strictEqual(menu('Proceed?', ['**`y/yes`** → Carry on', '**`n/no`** → Stop here']).split('\n')[1], '**`◆ Proceed?`**');
    assert.strictEqual(
      menu('The tree is dirty.', ['**`y/yes`**', '**`n/no`**'], { question: 'Carry on?' }),
      [DOTS, 'The tree is dirty.', '', '**`◆ Carry on?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('a statement label stands over a route menu — no y/yes row, no question owed', () => {
    const out = menu('Where this belongs.', ['**`d/discussion`** → Discuss it', '**`r/research`** → Research it']);
    assert.strictEqual(out.split('\n')[1], '**`◆ Where this belongs.`**');
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

  it('indentedBody wraps each paragraph two columns in; indent moves the column and the budget with it', () => {
    assert.deepStrictEqual(indentedBody(['short', 'lines'], { width: 40 }), ['  short', '  lines']);
    assert.deepStrictEqual(indentedBody(['x'.repeat(50)], { width: 40 }), [`  ${'x'.repeat(38)}`, `  ${'x'.repeat(12)}`], 'the default budget is the width less two columns');
    const deep = indentedBody(['beta '.repeat(20).trim()], { indent: '      ', width: 40 });
    assert.ok(deep.length > 1 && deep.every((l) => l.startsWith('      beta') && [...l].length <= 40));
  });

  it('bulletRow glyphs at the callout indent by default; indent shifts the glyph, continuations stay under the text', () => {
    assert.deepStrictEqual(bulletRow('short row', { width: 40 }), ['  • short row']);
    assert.deepStrictEqual(bulletRow('x'.repeat(50), { width: 40 }), [`  • ${'x'.repeat(36)}`, `    ${'x'.repeat(14)}`], 'the default budget reserves the indent and the glyph');
    const lines = bulletRow('gamma '.repeat(20).trim(), { indent: '    ', width: 40 });
    assert.ok(lines[0].startsWith('    • gamma') && lines[1].startsWith('      gamma'));
    assert.ok(lines.every((l) => [...l].length <= 40));
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

  /** The spec-change read the plan variant leads with. */
  const specChanges = (body = 'Specification unchanged since planning started.\n') =>
    writePayload(dir, 'spec-changes.md', body);

  it('plan leads with the spec-change read, byte-for-byte, then the resume menu', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: 2 } } } } });
    planFiles('pay', 'portal');
    const body = 'The specification changed: **section 4** restructured, one cross-cutting spec is new.\n';
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan', present: specChanges(body) });
    assert.ok(out.startsWith('=== DISPLAY: spec change summary (emit verbatim as markdown) ===\n'
      + '**Specification since planning started** — what the resumed plan would inherit\n\n'
      + body), out);
    assert.ok(out.indexOf('DISPLAY: spec change summary') < out.indexOf('MENU: resume gate'));
  });

  it('plan requires --present, and every other variant refuses it', () => {
    writeManifest(dir, 'pay', { phases: {
      planning: { items: { portal: { status: 'in-progress' } } },
      review: { items: { portal: { status: 'in-progress' } } },
      discussion: { items: { portal: { status: 'in-progress' } } },
    } });
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan' }),
      /render resume-gate: --present <summary\.md> is required on the plan variant/);
    assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan', present: 'gone.md' }),
      /render resume-gate: presented file not found: gone\.md/);
    for (const variant of ['review', 'scoping', 'session', undefined]) {
      assert.throws(() => renderSurface(dir, 'resume-gate', { dotpath: variant === 'session' ? 'pay' : 'pay.review.portal', variant, present: specChanges() }),
        /render resume-gate: --present only applies to the plan variant/);
    }
  });

  it('plan derives the position parenthetical from the planning item', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: 2 } } } } });
    planFiles('pay', 'portal');
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan', present: specChanges() });
    assert.ok(out.includes('Found existing plan for **Portal** (previously reached phase 3, task 2).'));
    assert.ok(/\*\*`c\/continue`\*\* +→ Walk through the plan from the start\. You can review, amend, or navigate at any point — including straight to the leading edge\./.test(unwrap(out)));
    assert.ok(/\*\*`r\/restart`\*\* +→ Erase all planning work for this topic and start fresh\. This deletes the planning file, authored tasks, and clears manifest state\. Other topics are unaffected\./.test(unwrap(out)));
  });

  it('plan omits the parenthetical when the position fields are absent', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    planFiles('pay', 'portal');
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan', present: specChanges() });
    assert.ok(out.includes('Found existing plan for **Portal**.\n'));
    assert.ok(!out.includes('previously reached'));
  });

  it('plan keeps the phase anchor when only the phase is known (post-advance interrupt)', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: null } } } } });
    planFiles('pay', 'portal');
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan', present: specChanges() });
    assert.ok(out.includes('Found existing plan for **Portal** (previously reached phase 3).'));
  });

  it('plan offers the restart alone when the prior run\'s files are already gone', () => {
    // A restart deletes the planning directory, then the manifest entry. A
    // crash between the two commits leaves an entry with nothing to continue,
    // and offering `continue` there sends the session at an empty directory.
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', phase: 3, task: 2 } } } } });
    const out = renderSurface(dir, 'resume-gate', { dotpath: 'pay.planning.portal', variant: 'plan', present: specChanges() });
    assert.ok(out.startsWith('=== DISPLAY: spec change summary'), 'the read leads this branch too');
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

  it('renders yes/keep without the flag — no dead-end row', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.match(out, /=== MENU: research conclude gate/);
    assert.match(out, /This topic looks ready to conclude\.\n\n\*\*`◆ Conclude it\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Mark this topic as complete, ready for discussion/);
    assert.match(out, /\*\*`k\/keep`\*\*\s+→ Keep digging, there's more to understand/);
    assert.ok(!out.includes('dead end'), 'no dead-end row without the flag');
  });

  it('adds the dead-end row under --dead-end, consequences stated', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout', 'dead-end': '1' });
    assert.match(out, /\*\*`d\/dead-end`\*\*\s+→ Close it as a dead end — completed/);
    assert.match(out, /no discussion owed/);
    assert.match(out, /reversible from the map/);
  });

  it('the menu stands alone while the register is empty', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.ok(out.startsWith('=== MENU: research conclude gate'), 'no display precedes the menu');
    assert.ok(!out.includes('DISPLAY: research threads'));
  });

  it('prepends the register above the menu whenever the topic holds a thread — with and without the dead-end row', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress', threads: {
          'cart-persistence': { question: 'Does the cart survive a session?', status: 'learned', origin: 'seed', parent: null },
          'guest-checkout': { question: 'Can a guest check out at all?', status: 'open', origin: 'brief', parent: null },
        } } } },
      },
    });
    for (const args of [{ dotpath: 'pay.research.checkout' }, { dotpath: 'pay.research.checkout', 'dead-end': '1' }]) {
      const out = renderSurface(dir, 'research-conclude-gate', args);
      assert.ok(out.startsWith('=== DISPLAY: research threads (emit verbatim as a code block) ===\n'), 'the display opens the response — a menu follows, so it carries no continue instruction');
      assert.ok(out.indexOf('DISPLAY: research threads') < out.indexOf('=== MENU: research conclude gate'), 'display above the menu');
      assert.match(out, /Research Threads — Checkout \(2 threads — 1 open · 1 learned\)/);
      assert.match(out, /├─ ○ Can a guest check out at all\?\s+\[brief\]\n {2}└─ ● Does the cart survive a session\?\s+\[seed\]/);
      assert.match(out, /\*\*`y\/yes`\*\*\s+→ Mark this topic as complete, ready for discussion/);
      assert.strictEqual(out.includes('dead end'), 'dead-end' in args, 'the dead-end row still follows the flag alone');
    }
  });
});

describe('render research-threads', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: {
          checkout: { status: 'in-progress', threads: {
            'cart-persistence': { question: 'Does the cart survive a session?', status: 'parked', origin: 'seed', parent: null, note: 'needs a device cycle' },
          } },
          shipping: { status: 'in-progress' },
        } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('renders the register as one DISPLAY section — the whole response, so it carries the continue instruction', () => {
    const out = renderSurface(dir, 'research-threads', { dotpath: 'pay.research.checkout' });
    assert.strictEqual(out, [
      '=== DISPLAY: research threads (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
      'Research Threads — Checkout (1 thread)',
      '  └─ ◌ Does the cart survive a session?    [seed]',
      '       ↳ Needs a device cycle',
      '',
    ].join('\n'));
  });

  it('answers empty over an empty register — nothing to emit, no header over nothing', () => {
    assert.strictEqual(renderSurface(dir, 'research-threads', { dotpath: 'pay.research.shipping' }), '');
  });

  it('pins the research address and refuses a topic with no research item', () => {
    assert.throws(() => renderSurface(dir, 'research-threads', { dotpath: 'pay.discussion.checkout' }),
      /render research-threads: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'research-threads', { dotpath: 'pay.research.ghost' }),
      /no research item "ghost" in the manifest/);
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
      '**`◆ Apply them?`**',
      '',
      '**`y/yes`** → Apply all 2, then move on',
      "**Ask**   → Tell me a number to expand, or one you don't think is",
      `${NB(8)}settled`,
      '',
    ].join('\n'));
  });

  it('renders the settled lane — the call intro, the a/auto row above the prompts', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 's.json', {
      lane: 'settled',
      items: [
        { title: 'A repeated field name resolves to its last occurrence', detail: 'The sweep table leans this way; first-wins also fits the record.' },
        { title: 'An empty bare value writes a newline', detail: 'The output contract leans this way; zero bytes also fits the record.' },
      ],
    });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file });
    assert.strictEqual(out, [
      '=== DISPLAY: finding batch (emit verbatim as markdown) ===',
      "Each of these is a call I've made, with what it rests on named beside it.",
      '',
      '1\\. A repeated field name resolves to its last occurrence',
      `${NB(5)}↳ The sweep table leans this way; first-wins also fits the`,
      `${NB(7)}record.`,
      '2\\. An empty bare value writes a newline',
      `${NB(5)}↳ The output contract leans this way; zero bytes also fits`,
      `${NB(7)}the record.`,
      '',
      "=== MENU: finding batch (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Document them?`**',
      '',
      '**`y/yes`**   → Document all 2 and move on',
      '**`a/auto`**  → Document this screen and every remaining settled',
      `${NB(10)}finding automatically`,
      "**Discuss** → Say discuss and a number — I'll raise it after the rest",
      `${NB(10)}land`,
      '**Ask**     → Tell me a number to expand',
      '',
    ].join('\n'));
  });

  it('a settled screen under auto lands as a display — no menu, nothing overridden', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const two = writePayload(dir, 'auto.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }, { title: 'B', detail: 'b.' }] });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: two });
    assert.ok(out.startsWith('=== DISPLAY: finding batch auto-approved (emit verbatim as markdown — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\n'));
    assert.ok(out.includes("Each of these is a call I've made"), 'the screen still shows what landed');
    assert.ok(out.endsWith('\nDocumenting all 2 [auto].\n'), 'the line is true when it is emitted — the landings follow it');
    assert.ok(!out.includes('MENU'), 'the lane that carries the flip never stops once it is set');
    assert.ok(!out.includes('Auto is on'), 'a screen that does not stop overrides nothing');
    const one = writePayload(dir, 'auto1.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }] });
    assert.ok(renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: one })
      .endsWith('\nDocumenting it [auto].\n'), 'the singular reads singular');
  });

  it('the other lanes are scans a user is present for — auto never lands one', () => {
    // The gate mode is the findings walk's, and the planning walk holds one:
    // its call lane is `decide`, which has no flip of its own to answer.
    writeManifest(dir, 'pay', {
      phases: {
        planning: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'auto' } } },
        specification: { items: { checkout: { status: 'in-progress', finding_gate_mode: 'auto' } } },
      },
    });
    for (const [dotpath, lane, items] of [
      ['pay.planning.checkout', 'decide', [{ title: 'A', detail: 'a.' }]],
      ['pay.planning.checkout', 'apply', [{ title: 'A', detail: 'a.' }]],
      ['pay.planning.checkout', 'route', [{ title: 'A', target: 't', detail: 'a.' }]],
      ['pay.specification.checkout', 'apply', [{ title: 'A', detail: 'a.' }]],
      ['pay.specification.checkout', 'route', [{ title: 'A', target: 't', detail: 'a.' }]],
    ]) {
      const file = writePayload(dir, `scan-${dotpath}-${lane}.json`, { lane, items });
      const out = renderSurface(dir, 'finding-batch', { dotpath, file });
      assert.ok(out.includes('=== MENU: finding batch'), `${dotpath} ${lane}: the screen still asks`);
      assert.ok(!out.includes('auto-approved'), `${dotpath} ${lane}: no lane but settled has an auto form`);
      assert.ok(!out.includes('Auto is on'), `${dotpath} ${lane}: a scan overrides nothing`);
    }
  });

  it("the call lane is the address's: settled at the specification, decide everywhere else", () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { checkout: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    const settled = writePayload(dir, 'cl1.json', { lane: 'settled', items: [{ title: 'A', detail: 'a.' }] });
    const decide = writePayload(dir, 'cl2.json', { lane: 'decide', items: [{ title: 'A', detail: 'a.' }] });
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: settled }),
      /lane "settled" is not served at the discussion phase — its call lane is "decide"/,
    );
    assert.throws(
      () => renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: decide }),
      /lane "decide" is not served at the specification phase — its call lane is "settled"/,
    );
    assert.ok(renderSurface(dir, 'finding-batch', { dotpath: 'pay.specification.checkout', file: settled }).includes('`◆ Document it?`'));
    assert.ok(renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: decide }).includes('`◆ Document it?`'));
  });

  it('only the settled lane offers the flip — the other lanes have no gate to set', () => {
    for (const lane of ['apply', 'decide', 'route']) {
      const file = writePayload(dir, `na-${lane}.json`, { lane, items: [{ title: 'A', target: 't', detail: 'a.' }] });
      assert.ok(!renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file }).includes('`a/auto`'), lane);
    }
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
      "Each of these is a call I've made, with what it rests on named beside it.",
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
      '**`◆ Document them?`**',
      '',
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
    const plural = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: two });
    assert.match(plural, /`◆ Document them\?`/);
    assert.match(plural, /→ Document all 2 and move on \(7 more after this\)$/m);
    const one = writePayload(dir, 'one.json', { lane: 'decide', items: [{ title: 'A', detail: 'a.' }] });
    const out = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: one });
    assert.match(out, /`◆ Document it\?`/);
    assert.match(out, /→ Document it and move on$/m);
    assert.match(out, /^This one is a call I've made/m);
    const applyOne = writePayload(dir, 'ap1.json', { lane: 'apply', items: [{ title: 'A', detail: 'a.' }] });
    const applied = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: applyOne });
    assert.match(applied, /`◆ Apply it\?`/);
    assert.match(applied, /→ Apply it, then move on$/m);
    const routeOne = writePayload(dir, 'ro1.json', { lane: 'route', items: [{ title: 'A', target: 't', detail: 'a.' }] });
    const routed = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: routeOne });
    assert.match(routed, /`◆ Send it\?`/);
    assert.match(routed, /→ Send it$/m);
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
    assert.ok(out.includes(`${DOTS}\n**\`◆ Send it?\`**\n\n**\`y/yes\`**`), 'a label-less menu opens on its question');
    const two = writePayload(dir, 'r2.json', {
      lane: 'route',
      items: [
        { title: 'Spec readiness rests on window_state', target: 'storage-and-sync', detail: 'Their subtopic owns the claim.' },
        { title: 'Retry budget belongs to the sync loop', target: 'storage-and-sync', detail: 'Their loop owns the budget.' },
      ],
    });
    const plural = renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: two });
    assert.ok(plural.includes(`${DOTS}\n**\`◆ Send them?\`**\n\n**\`y/yes\`**`), 'the plural asks for the set');
    assert.match(plural, /\*\*`y\/yes`\*\* → Send all 2$/m);
  });

  it('validates loudly — unknown lane, empty items, per-item fields by lane', () => {
    const bad = (name, obj) => renderSurface(dir, 'finding-batch', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    // `ask` is the walked lane's name — the plausible producer mistake is
    // sending it to the batch surface, which has no walked screen.
    assert.throws(() => bad('l.json', { lane: 'ask', items: [{ title: 't', detail: 'd' }] }), /"lane" must be one of apply, settled, decide, route/);
    // An inherited property name is not a lane — the lookup is own-keys only.
    assert.throws(() => bad('proto.json', { lane: 'constructor', items: [{ title: 't', detail: 'd' }] }), /"lane" must be one of apply, settled, decide, route/);
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

  it('triage-offer renders the agenda in queue order and the yes/later menu', () => {
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
    assert.ok(/\*\*`y\/yes`\*\* +→ Surface and discuss them one at a time/.test(out));
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

  it('requeue-offer renders the statement, the diamond question naming the other phase, and the yes/discuss menu', () => {
    writeQueue('measurement', { '001-a-decision-owed.md': 'x' });
    const file = writePayload(dir, 'rq.json', {
      file: '001-a-decision-owed.md', title: 'A decision owed', reason: 'it asks this topic to decide, not to find out.',
    });
    const out = renderSurface(dir, 'requeue-offer', { dotpath: 'wu.discussion.measurement', file });
    assert.ok(out.startsWith("=== MENU: requeue offer (emit verbatim as markdown, then STOP for the user's response) ==="), out);
    assert.ok(out.includes('**A decision owed** — it asks this topic to decide, not to find out.'), out);
    assert.ok(out.includes('**`◆ Move it to research?`**'), out);
    assert.ok(/\*\*`y\/yes`\*\* +→ Move it to this topic's research queue/.test(out), out);
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
    assert.ok(/\*\*`y\/yes`\*\* +→ Continue review/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Skip review, proceed to completion/.test(out));
  });

  it('reloop variant renders the another-cycle menu', () => {
    const out = renderSurface(dir, 'spec-review-gate', { dotpath: 'pay.specification.portal', variant: 'reloop' });
    assert.ok(out.includes('=== MENU: spec review reloop gate'));
    assert.ok(out.includes('**`◆ Run another review cycle?`**'));
    assert.ok(/\*\*`y\/yes`\*\* +→ Run another review cycle \(all three phases\)/.test(out));
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
  const flagText = (s) => s.slice(s.indexOf('⚑')).replace(/\n\s+/g, ' ').trim();
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the head, streams, signed growth, finding sections, and the growth note', () => {
    const file = writePayload(dir, 'c.json', base);
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: convergence diagnostic (emit verbatim as a code block) ==='));
    assert.ok(out.includes('===\n── Spec Review — cycle 5 diagnostic ─'), 'the heading is the drawn in-fence divider');
    assert.strictEqual([...out.split('\n')[1]].length, 65, 'the divider fills the display width');
    assert.ok(out.includes('  Trend: converging'));
    assert.ok(out.includes('  Latest cycle: 2 findings (1 new, 1 recurring)'), 'counts derive from the arrays');
    assert.ok(out.includes('  Per stream: claims 0 · input review 1 · gap analysis 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.ok(out.includes('    • Marker semantics restated twice (fixed in cycle 4)'));
    assert.ok(out.includes('    • Guard scope drifts per section (cycles 3, 4, 5)\n      · Each fix re-words the guard where it lands instead of at\n        its home.'), 'the hypothesis is a sub-detail under the bullet text, wrapped under its own marker');
    assert.ok(out.includes('  ⚑ Resolved findings outnumber new ones — the cycles are closing\n    ground.'));
    assert.ok(out.includes('⚑ Review has added 6802 words to a 6835-word construction.'), 'the >25% growth note fires and names the spec loop\'s document');
    assert.match(flagText(out), /growth from review-authored rules is the review deciding for the user\./, 'the growth note names review-authored growth');
    assert.ok(!flagText(out).includes('writing rules the record never decided'), 'the churn warning stays quiet on a converging trend');
  });

  it('churning with growth fires both spec flags; negative growth renders signed and quiets the note', () => {
    const churn = writePayload(dir, 'c2.json', { ...base, trend: 'churning' });
    let out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: churn });
    assert.match(flagText(out), /the review is writing rules the record never decided/, 'the churn-growth warning fires');
    assert.match(flagText(out), /anything else is a decision nobody made/, 'the warning names the bar a finding clears');
    assert.ok(!flagText(out).includes('before running another cycle'), 'the warning describes the churn, it never orders the next cycle');
    assert.ok(out.includes('⚑ Review has added 6802 words'));
    const shrink = writePayload(dir, 'c3.json', { ...base, live_words: 6500 });
    out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file: shrink });
    assert.ok(out.includes('(-335 net across review)'), 'shrink renders a signed value, never +-');
    assert.ok(!out.includes('Review has added'), 'no growth note on a shrinking document');
  });

  it('the churn trend is loop-neutral — a fix loop carries the same sentence, alone', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'ch.json', { loop_type: 'fix', latest_cycle: 2, trend: 'churning', resolved: [{ title: 'Off-by-one', last_seen_cycle: 1 }], recurring: [], new: [{ title: 'Missing guard' }] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(flagText(out), '⚑ Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.');
  });

  it('planning-review carries growth too — the flags name the plan and the mechanism', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'pr.json', {
      ...base, loop_type: 'planning-review', trend: 'churning',
      stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 1 }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('── Plan Review — cycle 5 diagnostic ─'));
    assert.ok(out.includes('  Per stream: traceability 1 · integrity 1'));
    assert.ok(out.includes('  Document growth: 6835 → 13637 words (+6802 net across review)'));
    assert.match(flagText(out), /the review is writing mechanism the specification never decided/, 'the churn-growth warning reads for the plan');
    assert.match(flagText(out), /a corrected mechanism is the builder's\./, 'the warning leaves mechanism to the builder');
    assert.match(flagText(out), /Review has added 6802 words to a 6835-word plan\./, 'the growth note names the plan, never a construction');
    assert.match(flagText(out), /growth from review-authored mechanism is the review deciding for the builder\./);
    assert.ok(!flagText(out).includes('writing rules the record never decided'), 'the spec loop\'s wording stays with the spec loop');
  });

  it('every trend callout describes what the cycles show — none prescribes a next move', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const lines = {
      churning: '⚑ Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.',
      converging: '⚑ Resolved findings outnumber new ones — the cycles are closing ground.',
      stable: '⚑ Resolved and new findings match cycle for cycle — the loop is holding where it is.',
      diverging: '⚑ New findings outnumber resolved ones — the fixes are introducing new issues.',
    };
    for (const [trend, line] of Object.entries(lines)) {
      const file = writePayload(dir, `t-${trend}.json`, { loop_type: 'fix', latest_cycle: 2, trend, resolved: [], recurring: [], new: [{ title: 'Missing guard' }] });
      const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
      assert.strictEqual(flagText(out), line, `the ${trend} callout states the reading and stops there`);
    }
  });

  it('single-stream loops skip streams and growth; a fix-loop shape renders lean', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'f.json', { loop_type: 'fix', latest_cycle: 3, trend: 'stable', resolved: [], recurring: [{ title: 'Assertion drifts', cycles: '2, 3', hypothesis: 'The fixture regenerates with a shifting seed.' }], new: [] });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.ok(out.includes('── Fix Loop — cycle 3 diagnostic ─'));
    assert.ok(!out.includes('Per stream'));
    assert.ok(!out.includes('Document growth'));
    assert.ok(!out.includes('Resolved:'), 'empty sections are skipped');
    assert.ok(out.includes('  ⚑ Resolved and new findings match cycle for cycle — the loop is\n    holding where it is.'), 'the stable flag wraps via the callout');
  });

  it('a long finding wraps with its continuation under the text, never at column 0', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'w.json', {
      loop_type: 'fix', latest_cycle: 3, trend: 'converging',
      resolved: [{ title: 'Detached-element mute is a no-op — a re-parented <style> goes live in the app document', last_seen_cycle: 1 }],
      recurring: [{ title: 'A hostile document stylesheet still reaches the application chrome (criterion 3)', cycles: '1, 2, 3', hypothesis: 'Containment rests on two mechanisms of unequal strength — the engine\'s own @scope matching, which has held under every probe, and a fallback the tests never reach.' }],
      new: [{ title: 'Nothing verifies the composed stylesheet\'s structure before it is published' }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    const body = out.split('\n').slice(1).filter((l) => l !== '' && !l.startsWith('==='));
    assert.ok(body.every((l) => [...l].length <= 65), 'every line fits the pinned width');
    assert.ok(body.every((l) => l === body[0] || l.startsWith('  ')), 'only the heading sits at column 0');
    assert.ok(out.includes('    • Detached-element mute is a no-op — a re-parented <style>\n      goes live in the app document (fixed in cycle 1)'), 'a resolved row wraps under its text');
    assert.ok(out.includes('    • A hostile document stylesheet still reaches the application\n      chrome (criterion 3) (cycles 1, 2, 3)\n      · Containment rests on two mechanisms of unequal strength —\n        the engine\'s own @scope matching, which has held under\n        every probe, and a fallback the tests never reach.'), 'the hypothesis wraps under its own marker at the bullet-text column');
    assert.ok(out.includes('    • Nothing verifies the composed stylesheet\'s structure before\n      it is published'), 'a new row wraps under its text');
  });

  it('short content renders one line per item, unchanged', () => {
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 's.json', {
      loop_type: 'fix', latest_cycle: 2, trend: 'converging',
      resolved: [{ title: 'Off-by-one', last_seen_cycle: 1 }],
      recurring: [{ title: 'Flaky seed', cycles: '1, 2', hypothesis: 'The fixture reseeds.' }],
      new: [{ title: 'Missing guard' }],
    });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.implementation.portal', file });
    assert.strictEqual(out, [
      '=== DISPLAY: convergence diagnostic (emit verbatim as a code block) ===',
      `── Fix Loop — cycle 2 diagnostic ${'─'.repeat(32)}`,
      '',
      '  Trend: converging',
      '  Latest cycle: 2 findings (1 new, 1 recurring)',
      '',
      '  Resolved:',
      '    • Off-by-one (fixed in cycle 1)',
      '',
      '  Recurring:',
      '    • Flaky seed (cycles 1, 2)',
      '      · The fixture reseeds.',
      '',
      '  New this cycle:',
      '    • Missing guard',
      '',
      '  ⚑ Resolved findings outnumber new ones — the cycles are closing',
      '    ground.',
      '',
    ].join('\n'));
  });

  it('a head line past the budget wraps beneath its indent', () => {
    const file = writePayload(dir, 'g.json', { ...base, review_baseline_words: 123456, live_words: 234567 });
    const out = renderSurface(dir, 'convergence-diagnostic', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('  Document growth: 123456 → 234567 words (+111111 net across\n  review)'), 'the growth line wraps at the head indent');
  });

  it('validates loudly: enums, cycle floor, shapes, stream and growth pairing', () => {
    const cases = [
      [{ ...base, loop_type: 'review' }, /"loop_type" must be one of fix\/analysis\/planning-review\/spec-review/],
      [{ ...base, trend: 'oscillating' }, /"trend" must be one of/],
      [{ ...base, latest_cycle: 1 }, /"latest_cycle" must be an integer ≥ 2/],
      [{ ...base, recurring: [{ title: 'x', cycles: '2, 3' }] }, /recurring\[0\] is missing "hypothesis"/],
      [{ ...base, stream_counts: undefined }, /"spec-review" carries "stream_counts"/],
      [{ ...base, loop_type: 'fix', review_baseline_words: undefined, live_words: undefined, stream_counts: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }] }, /"fix" is single-stream/],
      [{ ...base, loop_type: 'analysis', stream_counts: undefined }, /document growth belongs to spec-review and planning-review/],
      [{ ...base, live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
      [{ ...base, loop_type: 'planning-review', stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 0 }], live_words: undefined }, /"review_baseline_words" and "live_words" travel together/],
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
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'va.json', { ...settled, content: { label: 'L', lines: ['x'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file, view: 'full' });
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
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['New plan section body.'] },
      applied_label: 'approved. Added to the plan.',
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown) ==='), 'auto drops the stop, never the showing');
    assert.ok(out.includes('=== DISPLAY: finding auto-approved (after applying the fix: emit verbatim as a code block — the user set this gate to auto: do not stop; continue as the workflow instructs) ===\nFinding 1 of 2: Missing Outcome field — approved. Added to the plan.'));
    assert.ok(!out.includes('MENU: finding'));
  });

  it('a settled finding at the specification is display-only — its batch screen is the gate', () => {
    for (const mode of ['gated', 'auto']) {
      writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: mode } } } } });
      const file = writePayload(dir, `sb-${mode}.json`, {
        ...settled,
        diff: { current: ['old'], proposed: ['new'] },
      });
      const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
      assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown) ==='), `${mode}: the expansion still shows the report`);
      assert.ok(out.includes('=== DISPLAY: diff ('), `${mode}: the diff rides along — the expansion is problem, call, and change`);
      assert.ok(!out.includes('DISPLAY: finding wording'), `${mode}: a diff finding has no wording to show`);
      assert.ok(!out.includes('MENU: finding'), `${mode}: the batch already asked`);
      assert.ok(!out.includes('finding auto-approved'), `${mode}: the batch already said what landed`);
    }
  });

  it('a settled finding at the specification shows its whole wording — the expansion is the ask', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'sw.json', {
      ...settled,
      content: { label: 'Proposed Addition', lines: ['## Delivery', '', 'Retries are bounded at four attempts.'] },
    });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: finding (emit verbatim as markdown) ==='), 'the report leads');
    assert.ok(out.endsWith('=== DISPLAY: finding wording (emit verbatim as markdown) ===\n**Proposed Addition**\n\n## Delivery\n\nRetries are bounded at four attempts.\n'),
      `the wording closes the expansion: ${out}`);
    assert.ok(!out.includes('MENU: finding'), 'the batch screen is the gate — the expansion asks nothing');
    assert.ok(!/`v\/view`/.test(out), 'there is no row left to ask the wording with');
  });

  it('--view full at the specification returns the wording alone', () => {
    writeManifest(dir, 'pay', { phases: { specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'gated' } } } } });
    const file = writePayload(dir, 'sv.json', { ...settled, content: { label: 'Proposed Addition', lines: ['Retries are bounded at four attempts.'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file, view: 'full' });
    assert.strictEqual(out, '=== DISPLAY: finding wording (emit verbatim as markdown) ===\n**Proposed Addition**\n\nRetries are bounded at four attempts.\n');
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
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'ct.json', { ...settled, category: 'contradiction' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
    assert.ok(out.includes('finding auto-approved'), 'the move rides auto whatever the category reads');
  });

  it('the category no longer picks the shape — a gap rides auto when the record settles it', () => {
    writeManifest(dir, 'pay', { phases: { planning: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } } } });
    const file = writePayload(dir, 'f.json', { ...settled, category: 'gap' });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.portal', file });
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
      [{ ...base, move: 'decide' }, /"move" must be one of settled\/choice/],
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
      [{ ...base, move: 'choice', options: [{ summary: 'a' }, { summary: 'b\nfake row' }] }, /a side is one menu row — sides\[1\]\.summary must be a single line/],
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
      '',
      '**Solution**: Close on detach.',
      '',
      '**Outcome**: No leaked handles.',
      '',
      '**Acceptance Criteria**:',
      '- no leaked handles after detach',
      '',
      '**Do**:',
      '1. Add Close()',
      '2. Call it on detach',
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
    assert.ok(!out.includes('t/technical'), 'the technical arm belongs to the decision menu alone');
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
    const noCriteria = writePayload(dir, 'bad.json', { ...payload, criteria: [] });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noCriteria, gate: 'gated' }), /"criteria" must be non-empty/);
    const noProblem = writePayload(dir, 'bad2.json', { ...payload, problem: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }), /"problem" must be a non-empty string/);
    const emptySeverity = writePayload(dir, 'bad3.json', { ...payload, severity: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptySeverity, gate: 'gated' }), /"severity" must be a non-empty string when present/);
  });

  // Proposal altitude — the judge's output, before any authoring: problem and
  // solution alone, both blocks and outcome absent.
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
      '',
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
      criteria: ['- the suite stays green'],
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.startsWith([
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**`▪ Drop the dead formatter (2 of 4)`** (dead-code)',
      '',
      '**Problem**: Nothing calls it.',
      '',
      '**Solution**: Delete it.',
      '',
      '**Outcome**: One fewer surface to keep true.',
      '',
      '**Acceptance Criteria**:',
      '- the suite stays green',
      '',
      '=== MENU: task approval',
    ].join('\n')), out);
    assert.ok(!out.includes('**Do**:'), 'an absent block leaves no heading behind');
    assert.ok(!/\n\n\n/.test(out), 'an omitted block leaves no doubled blank line');
    const withTests = writePayload(dir, 'mt.json', {
      current: 2, total: 4, title: 'Drop the dead formatter', severity: 'dead-code',
      problem: 'Nothing calls it.', solution: 'Delete it.', criteria: ['- the suite stays green'], tests: ['- it is gone'],
    });
    const rendered = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withTests, gate: 'gated' });
    assert.ok(!rendered.includes('**Tests**') && !rendered.includes('it is gone'), 'a tests key is no block the surface renders');
  });

  it('outcome is optional both ways, and the detail blocks stay non-empty when present', () => {
    const withOutcome = writePayload(dir, 'o1.json', { ...proposal, outcome: 'One helper, one message path.' });
    assert.ok(renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' })
      .includes('**Solution**: Fold them into one and take the caller-supplied message.\n\n**Outcome**: One helper, one message path.\n'));
    const without = writePayload(dir, 'o2.json', proposal);
    assert.ok(!renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: without, gate: 'gated' }).includes('**Outcome**'));
    const emptyOutcome = writePayload(dir, 'o3.json', { ...proposal, outcome: '' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: emptyOutcome, gate: 'gated' }), /"outcome" must be a non-empty string when present/);
    for (const field of ['steps', 'criteria']) {
      const empty = writePayload(dir, `e-${field}.json`, { ...proposal, [field]: [] });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }), new RegExp(`"${field}" must be non-empty`));
      const notLines = writePayload(dir, `n-${field}.json`, { ...proposal, [field]: 'one long string' });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: notLines, gate: 'gated' }), new RegExp(`"${field}" must be an array of strings`));
    }
  });

  it('a decision emits its slim header and the sides as the menu — the record stays staged — byte-exactly', () => {
    const file = writePayload(dir, 'dc.json', {
      current: 3, total: 4, title: 'Settle the page size', severity: 'behaviour',
      sources: 'finder cycle 1', placement: 'phase 1',
      problem: 'Two page sizes are configured at once.', solution: 'Pick one and record it.',
      stakes: 'A4 fixes print output; preferCssPageSize hands it to themes. No measurement picks between them.',
      decision: { question: 'Which page size stands?', options: ['A4 on the PDF renderer', 'preferCssPageSize from the stylesheet'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed task (emit verbatim as markdown) ===',
      '**`▪ Settle the page size (3 of 4)`** (behaviour)',
      'Sources: finder cycle 1',
      'Placement: phase 1',
      '',
      '=== MENU: task decision (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Decision**: Which page size stands?',
      '',
      '**`◆ Which way?`**',
      '',
      '**`1`**           → A4 on the PDF renderer',
      '**`2`**           → preferCssPageSize from the stylesheet',
      "**`t/technical`** → Retell the fork from the code's perspective",
      '**`d/decline`**   → Decline this task — it will not be built',
      '**Comment**     → Tell me what to change',
      '',
    ].join('\n'));
    const display = out.slice(0, out.indexOf('=== MENU'));
    for (const line of ['**Problem**', '**Solution**', '**Stakes**', '**Decision**']) {
      assert.ok(!display.includes(line), `the slim header carries no ${line} line — the record stays in the staging file`);
    }
    assert.ok(out.includes('**Decision**: Which page size stands?'), 'the menu carries the question as its statement label');
    assert.ok(!out.includes('a/auto'), 'an open decision is never one of the calls auto makes');
    assert.ok(!out.includes('Auto is on'), 'a gated decision carries no auto-override line — there is nothing being overridden');
  });

  it('a recommended side orders first with its suffix; plain strings mix in unchanged', () => {
    const file = writePayload(dir, 'dr.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's',
      stakes: 'Each side changes what ships; nothing measurable breaks the tie.',
      decision: { question: 'Which page size stands?', options: [
        'A4 on the PDF renderer',
        { summary: 'preferCssPageSize from the stylesheet', recommended: true },
        { summary: 'Neither — leave it configurable' },
      ] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.includes([
      '**`1`**           → preferCssPageSize from the stylesheet (recommended)',
      '**`2`**           → A4 on the PDF renderer',
      '**`3`**           → Neither — leave it configurable',
      "**`t/technical`** → Retell the fork from the code's perspective",
      '**`d/decline`**   → Decline this task — it will not be built',
    ].join('\n')), out);
  });

  it('a decision requires its stakes — absent, empty, or orphaned stakes refuse by name', () => {
    const decision = { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize'] };
    const missing = writePayload(dir, 'st1.json', { ...proposal, decision });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: missing, gate: 'gated' }),
      /"stakes" must be a non-empty string when "decision" is present/);
    const empty = writePayload(dir, 'st2.json', { ...proposal, decision, stakes: '  ' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: empty, gate: 'gated' }),
      /"stakes" must be a non-empty string when "decision" is present/);
    const orphan = writePayload(dir, 'st3.json', { ...proposal, stakes: 'each side matters' });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: orphan, gate: 'gated' }),
      /"stakes" requires "decision"/);
  });

  it('a decision stops under --gate auto — and takes the comment hint', () => {
    const file = writePayload(dir, 'dc2.json', {
      current: 1, total: 1, title: 'Settle the page size',
      problem: 'p', solution: 's', stakes: 'the fork is product-shaped',
      decision: { question: 'Which page size stands?', options: ['A4', 'preferCssPageSize', 'Neither — leave it configurable'] },
    });
    const auto = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'auto', 'comment-hint': 'Provide feedback to adjust' });
    assert.ok(auto.includes('MENU: task decision'), 'a decision item always stops');
    assert.ok(!auto.includes('DISPLAY: task auto-approved'));
    assert.ok(!auto.includes('MENU: task approval'));
    assert.ok(auto.includes('**Decision**: Which page size stands?\n\n**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.'),
      'the question is the menu\'s statement label, the auto-override line beneath it — never the glyphed chrome');
    assert.ok(/\*\*`3`\*\* +→ Neither — leave it configurable/.test(auto));
    assert.ok(/\*\*`t\/technical`\*\* +→ Retell the fork from the code's perspective/.test(auto), 'the technical arm rides the decision menu');
    assert.ok(/\*\*Comment\*\* +→ Provide feedback to adjust/.test(auto));
  });

  it('a decision excludes authored blocks, and the malformed shapes are refused by name', () => {
    for (const [field, value] of [['steps', ['1. x']], ['criteria', ['- c']]]) {
      const file = writePayload(dir, `dx-${field}.json`, {
        ...proposal, [field]: value, stakes: 'the fork is product-shaped',
        decision: { question: 'Which way?', options: ['a', 'b'] },
      });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" excludes steps\/criteria/);
    }
    for (const [name, decision] of [['null', null], ['a bare string', 'yes']]) {
      const file = writePayload(dir, `dshape-${name.replace(/ /g, '-')}.json`, { ...proposal, decision });
      assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' }),
        /"decision" must be an object carrying "question" and "options"/, `decision as ${name} is refused`);
    }
    const withOutcome = writePayload(dir, 'dx-outcome.json', {
      ...proposal, outcome: 'One page size everywhere.', stakes: 'the fork is product-shaped',
      decision: { question: 'Which way?', options: ['a', 'b'] },
    });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: withOutcome, gate: 'gated' }),
      /"decision" excludes outcome/, 'a decision payload never carries a field the path would silently drop');
    const noProblem = writePayload(dir, 'dx-problem.json', {
      current: 1, total: 1, title: 'T', solution: 's', stakes: 'the fork is product-shaped',
      decision: { question: 'Which way?', options: ['a', 'b'] },
    });
    assert.throws(() => renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file: noProblem, gate: 'gated' }),
      /"problem" must be a non-empty string/, 'the payload mirrors its staging row — a decision with no record behind it is refused');
  });

  it('the question is head chrome — an option-shaped question never captures the arrow column', () => {
    const file = writePayload(dir, 'dq.json', {
      ...proposal, stakes: 'the fork is product-shaped',
      decision: { question: 'Ship **now** → later?', options: ['A4 on the PDF renderer', 'preferCssPageSize'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    assert.ok(out.includes('**Decision**: Ship **now** → later?'), 'the label passes through untouched');
    assert.ok(out.includes('**`1`**           → A4 on the PDF renderer'),
      'the arrow column is measured from the option rows alone — t/technical, at 11, stays the widest key');
  });

  it('a long end-state side wraps under its own row, the recommendation suffix riding the last segment', () => {
    const side = 'Unmatched captures land on an operator-visible record and a person resolves each one — nothing redelivers, nothing vanishes';
    const file = writePayload(dir, 'dw.json', {
      ...proposal, stakes: 'the fork is product-shaped',
      decision: { question: 'Where does an unmatched capture surface?', options: [{ summary: side, recommended: true }, 'Refused — the gateway redelivers'] },
    });
    const out = renderSurface(dir, 'proposed-task', { dotpath: 'pay.implementation.portal', file, gate: 'gated' });
    const lines = out.split('\n');
    const row = lines.findIndex((l) => l.startsWith('**`1`**'));
    assert.ok(row > 0, out);
    // NB(14) = the 11-wide t/technical key column + the three arrow columns.
    assert.ok(lines[row + 1].startsWith(NB(14)), 'continuations align under the label column in non-breaking spaces');
    const last = [lines[row], lines[row + 1], lines[row + 2] ?? ''].filter((l) => l.startsWith('**`1`**') || l.startsWith(NB(14))).pop();
    assert.ok(last && last.endsWith('(recommended)'), 'the suffix rides the wrapped row\'s last segment');
  });

  it('a malformed decision is refused by name', () => {
    const cases = [
      [{ options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: '  ', options: ['a', 'b'] }, /"decision\.question" must be a non-empty string/],
      [{ question: 'Which?\nAnd how?', options: ['a', 'b'] }, /"decision\.question" must be a single line/],
      [{ question: 'Which?', options: ['a', 'b\nfake row'] }, /a side is one menu row — sides\[1\]\.summary must be a single line/],
      [{ question: 'Which?' }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['only one'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', 'b', 'c', 'd', 'e'] }, /"decision\.options" must be an array of 2–4 sides/],
      [{ question: 'Which?', options: ['a', ''] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', { summary: '  ' }] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', { recommended: true }] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: ['a', 7] }, /decision\.options\[1\] must be a non-empty string or an object carrying "summary"/],
      [{ question: 'Which?', options: [{ summary: 'a', recommended: true }, { summary: 'b', recommended: true }] }, /at most one option may be recommended/],
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
      'The gap needs the room. Reopening "synonym-handling" with it pauses this specification until the answer lands; the map offers two other homes.',
      '',
      '**`◆ Reopen it?`**',
      '',
      '**`y/yes`**     → Reopen "synonym-handling" with the gap and pause here',
      '**`t/topic`**   → Open a new topic on the map for it — this',
      `${NB(12)}specification waits for it to conclude`,
      "**`r/roadmap`** → Park it on the roadmap — outside this specification's",
      `${NB(12)}scope`,
      "**Comment**   → Tell me what you're thinking before it moves",
      '',
    ].join('\n'));
    const docOnly = writePayload(dir, 'ig2b.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: docOnly, variant: 'held-doc' });
    assert.ok(held.includes('MENU: incoherence held doc'));
    assert.ok(held.includes('**`◆ How do you want to continue?`**'));
    assert.ok(/\*\*`s\/stop`\*\* +→ Stop here/.test(held));
    assert.ok(unwrap(held).includes('"synonym-handling" is open in another session, so the fix belongs there; this topic waits for it.'),
      `no holder found at render time — the gate names no age: ${held}`);
  });

  it('incoherence-gate gap-route: the map destinations are the epic\'s — a linear work unit keeps the reopen alone', () => {
    writeManifest(dir, 'solo', {
      work_type: 'feature',
      phases: { implementation: { items: { solo: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'ig3.json', { lane: 'review', doc: 'solo', title: 't', context: 'c' });
    const linear = unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'solo.implementation.solo', file, variant: 'gap-route' }));
    assert.ok(linear.includes('Routing this to "solo" — it reopens with the gap, and this specification pauses until the answer lands.'),
      'one home is a statement, not a fork');
    assert.ok(/\*\*`◆ Proceed\?`\*\*/.test(linear));
    assert.ok(/\*\*`y\/yes`\*\* +→ Land the gap and pause here/.test(linear));
    assert.ok(!linear.includes('`t/topic`'), 'a feature has no map to open a topic on');
    assert.ok(!linear.includes('`r/roadmap`'), 'the park is the map\'s neighbour, offered where the map is');
    const epic = unwrap(renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'gap-route' }));
    assert.ok(epic.includes('The gap needs the room. Reopening "solo" with it pauses this specification until the answer lands; the map offers two other homes.'),
      'three homes make it a fork — and the reopen names its cost');
    assert.ok(/\*\*`◆ Reopen it\?`\*\*/.test(epic));
    assert.ok(epic.includes('**`y/yes`**     → Reopen "solo" with the gap and pause here'));
    assert.ok(epic.includes('**`t/topic`**   → Open a new topic on the map for it — this specification waits for it to conclude'));
    assert.ok(epic.includes('**`r/roadmap`** → Park it on the roadmap — outside this specification\'s scope'));
  });

  it('incoherence-gate held-doc names the holder\'s last-active age, however long idle', () => {
    const peer = path.join(dir, '.workflows', '.cache', 'pay', 'discussion', 'synonym-handling', 'presence');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');
    const idle = new Date(Date.now() - 3 * 3600 * 1000);
    fs.utimesSync(peer, idle, idle);
    const file = writePayload(dir, 'ig2c.json', { doc: 'synonym-handling', lane: 'review' });
    const held = renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file, variant: 'held-doc' });
    assert.ok(unwrap(held).includes('"synonym-handling" is open in another session — last active 3h ago — so the fix belongs there; this topic waits for it.'), held);
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
    const nlSide = writePayload(dir, 'ig6b.json', { doc: 'x', lane: 'review', title: 't', context: 'c', quotes: cited, sides: [{ summary: 'a' }, { summary: 'b\nfake row' }] });
    assert.throws(() => renderSurface(dir, 'incoherence-gate', { dotpath: 'pay.implementation.portal', file: nlSide, variant: 'conflict' }), /a side is one menu row — sides\[1\]\.summary must be a single line/);
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

  it('construction-gate: the presented section leads, then the gate mode — menu when gated, announcement when auto', () => {
    const present = writePayload(dir, 'section.md', '## Export Cadence\n\nThe export runs nightly.\n');
    const gated = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal', present });
    assert.ok(gated.startsWith('=== DISPLAY: proposed section (emit verbatim as markdown) ===\n'
      + '**Proposed section** — exactly as it will read in the specification\n\n'
      + '## Export Cadence\n\nThe export runs nightly.\n'), gated);
    assert.ok(gated.indexOf('DISPLAY: proposed section') < gated.indexOf('MENU: construction gate'));
    assert.ok(gated.includes('**`◆ Record this to the specification verbatim?`**'));
    assert.ok(/\*\*`a\/auto`\*\* +→ Approve this and all remaining topics automatically/.test(unwrap(gated)));
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'pay', 'manifest.json'), 'utf8'));
    m.phases.implementation.items.portal.construction_gate_mode = 'auto';
    fs.writeFileSync(path.join(dir, '.workflows', 'pay', 'manifest.json'), JSON.stringify(m, null, 2));
    const auto = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal', present });
    assert.ok(auto.includes('=== DISPLAY: proposed section (emit verbatim as markdown) ===\n'
      + '**Proposed section** — exactly as it will read in the specification\n\n'
      + '## Export Cadence\n\nThe export runs nightly.\n'), auto);
    assert.ok(auto.includes('DISPLAY: construction auto-approved'));
    assert.ok(auto.includes('Portal — auto-approved. Recording to the specification.'));
    assert.ok(!auto.includes('MENU:'), 'auto sees the section and no gate');
  });

  it('construction-gate carries the draft byte-for-byte — markdown syntax is never parsed or reflowed', () => {
    const body = [
      '## Rate Limits',
      '',
      'The limiter reads `X-Rate-Limit` and **rejects** the request past 100/min.',
      '',
      '```json',
      '{ "burst": 10, "window": "1m" }',
      '```',
      '',
      '| Field | Value |',
      '| --- | --- |',
      '| burst | 10 |',
    ].join('\n');
    const present = writePayload(dir, 'syntax.md', `${body}\n`);
    const out = renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal', present });
    assert.ok(out.includes(`\n\n${body}\n`), out);
  });

  it('construction-gate refuses without a section to present, and over a missing or blank file', () => {
    assert.throws(() => renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal' }),
      /render construction-gate: --present <section\.md> is required/);
    assert.throws(() => renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal', present: 'gone.md' }),
      /render construction-gate: presented file not found: gone\.md/);
    const blank = writePayload(dir, 'blank.md', '\n   \n');
    assert.throws(() => renderSurface(dir, 'construction-gate', { dotpath: 'pay.implementation.portal', present: blank }),
      /render construction-gate: presented file is blank: blank\.md/);
  });

  it('renders the ad hoc shape: no severity/sources, placement lines present', () => {
    const adhoc = {
      current: 1, total: 1, title: 'Fix login redirect',
      problem: 'Redirect loops on expired session.', solution: 'Clear the cookie first.', outcome: 'Login lands on the dashboard.',
      placement: 'phase 2', priority: '1', depends_on: 'portal-2-3',
      steps: ['1. Clear cookie', '2. Redirect'],
      criteria: ['- no loop on expired session'],
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

  const task = (body = '### Task pay-1-2: Wrap command\n\n**Do**: route the call sites through the wrapper.\n') =>
    writePayload(dir, 'authored-task.md', body);

  it('leads with the authored task, then renders the menu byte-exactly', () => {
    const body = '### Task pay-1-2: Wrap command\n\n| Field | Value |\n| --- | --- |\n| id | pay-1-2 |\n';
    const out = renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '5', title: 'Wrap command', present: task(body) });
    assert.strictEqual(out, [
      '=== DISPLAY: authored task (emit verbatim as markdown) ===',
      '**Authored task** — exactly as it will be written to the plan',
      '',
      body.trimEnd(),
      '',
      '=== MENU: author task gate (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Task 2 of 5: Wrap command**',
      '',
      '**`◆ Write it to the plan?`**',
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

  it('validates the scalars loudly, and refuses without a task to present', () => {
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '0', total: '5', title: 'X', present: task() }), /--m must be a positive integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '2', total: '1', title: 'X', present: task() }), /--total must be an integer/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', present: task() }), /--title is required/);
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', title: 'X' }),
      /render author-task-gate: --present <task\.md> is required/);
    const blank = writePayload(dir, 'blank-task.md', '\n  \n');
    assert.throws(() => renderSurface(dir, 'author-task-gate', { dotpath: 'pay.planning.portal', m: '1', total: '2', title: 'X', present: blank }),
      /render author-task-gate: presented file is blank: blank-task\.md/);
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

  it('a unit with concerns queued carries the triage waiting cue on its row and its option', () => {
    const out = selectionSections('feature',
      [{ name: 'auth-flow', phase_label: 'discussion (in-progress)', triage_phases: ['discussion'] }, { name: 'dark-mode', phase_label: 'ready for specification' }],
      { completed: 0, cancelled: 0 });
    assert.ok(out.includes('  ├─ 1. Auth Flow\n  │   Discussion (In-Progress) · triage waiting\n'), out);
    assert.ok(out.includes('  └─ 2. Dark Mode\n      Ready For Specification\n'), out);
    assert.ok(unwrap(out).includes('→ Continue "Auth Flow" — *discussion (in-progress)* · triage waiting\n'), out);
    assert.ok(unwrap(out).includes('→ Continue "Dark Mode" — *ready for specification*\n'), out);
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
    // A feature with everything before review completed — the
    // implementation → review hop, every way forward on offer.
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'completed' } } },
        specification: { items: { pay: { status: 'completed' } } },
        planning: { items: { pay: { status: 'completed' } } },
        implementation: { items: { pay: { status: 'completed' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('next-phase-gate: the review hop offers proceed, complete without review, and revisit — byte-stable', () => {
    assert.strictEqual(renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'review' }), [
      "=== MENU: next phase gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Implementation completed for "Pay".',
      '',
      '**`◆ Proceed to review?`**',
      '',
      '**`y/yes`**     → Proceed to review',
      '**`d/done`**    → Complete without review',
      '**`r/revisit`** → Revisit an earlier phase',
      '',
    ].join('\n'));
  });

  it('next-phase-gate: a non-review hop carries no d/done — proceed or revisit', () => {
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'specification', next: 'planning' });
    assert.ok(out.includes('Specification completed for "Pay".'), out);
    assert.match(out, /`◆ Proceed to planning\?`/);
    assert.match(out, /\*\*`y\/yes`\*\* +→ Proceed to planning/);
    assert.match(out, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!out.includes('d/done'), 'skip-review belongs to the review hop alone');
  });

  it('next-phase-gate: no r/revisit while no earlier phase is completed — the review hop still offers d/done', () => {
    writeManifest(dir, 'fresh', {
      work_type: 'feature',
      phases: { implementation: { items: { fresh: { status: 'in-progress' } } } },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'fresh', prev: 'implementation', next: 'review' });
    assert.match(out, /\*\*`y\/yes`\*\*  → Proceed to review/);
    assert.match(out, /\*\*`d\/done`\*\* → Complete without review/);
    assert.ok(!out.includes('r/revisit'), out);
  });

  it('next-phase-gate: empty when continuing is the only way forward — nothing to skip, nothing to revisit', () => {
    writeManifest(dir, 'lab', {
      work_type: 'feature',
      phases: { discussion: { items: { lab: { status: 'in-progress' } } } },
    });
    assert.strictEqual(renderSurface(dir, 'next-phase-gate', { dotpath: 'lab', prev: 'experiment', next: 'discussion' }), '');
  });

  it('next-phase-gate: the review hop names a live reconcile flag — skipping review is an informed choice', () => {
    writeManifest(dir, 'moved', {
      work_type: 'feature',
      phases: {
        specification: { items: { moved: { status: 'completed' } } },
        implementation: { items: { moved: { status: 'completed' } } },
        review: { items: { moved: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved', prev: 'implementation', next: 'review' });
    assert.ok(out.includes('Implementation completed for "Moved". ⚑ Input moved beneath review/moved (implementation) — completing without review carries the pending reconcile unresolved.'), out);
    // The cue informs the skip — a hop with no d/done carries none, flag or not.
    const planning = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved', prev: 'specification', next: 'planning' });
    assert.ok(planning.includes('Specification completed for "Moved".') && !planning.includes('⚑'), planning);
    // No flag, no cue.
    assert.ok(!renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'review' }).includes('⚑'));
  });

  it('a derived phase says the session is complete, never the phase — sibling records may still live', () => {
    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'experiment' });
    assert.ok(note.includes('Experiment session complete for "Pay".'), note);
    assert.ok(!note.includes('Experiment completed'), 'never claims the phase completed');

    writeManifest(dir, 'lab', {
      work_type: 'feature',
      phases: { research: { items: { lab: { status: 'completed' } } } },
    });
    const gate = renderSurface(dir, 'next-phase-gate', { dotpath: 'lab', prev: 'experiment', next: 'discussion' });
    assert.ok(gate.includes('Experiment session complete for "Lab".'), gate);
    assert.match(gate, /\*\*`y\/yes`\*\* +→ Proceed to discussion/);
  });

  it('epic-all-done-gate and phase-completed carry their statements', () => {
    const allDone = renderSurface(dir, 'epic-all-done-gate', { dotpath: 'pay' });
    assert.ok(allDone.includes('All topics have completed review for "Pay".'));

    const note = renderSurface(dir, 'phase-completed', { dotpath: 'pay', phase: 'discussion' });
    assert.ok(note.includes('Discussion completed for "Pay".'));
  });

  it('work-unit addressing is loud on dotted paths, unknown units, missing flags, and an epic', () => {
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay.review.pay', phase: 'review' }), /must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'nope', phase: 'review' }), /work unit "nope" not found/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', next: 'planning' }), /--prev is required/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'specification' }), /--next is required/);
    writeManifest(dir, 'big', { work_type: 'epic' });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'big', prev: 'implementation', next: 'review' }), /"big" is typed "epic" — the gate serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'revisit-phases', { dotpath: 'big' }), /"big" is typed "epic" — the revisit menu serves the linear work types/);
    writeManifest(dir, 'raw', { work_type: undefined });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'raw', prev: 'implementation', next: 'review' }), /"raw" is untyped — the gate serves the linear work types/);
    assert.throws(() => renderSurface(dir, 'phase-completed', { dotpath: 'pay' }), /--phase is required/);
  });

  it('next-phase-gate: refuses a phase outside the type\'s pipeline — a typo, done, or review on a type that has none', () => {
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'implementation', next: 'reveiw' }),
      /unknown --next "reveiw" for a feature \(pipeline: research, experiment, discussion, specification, planning, implementation, review\)/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'review', next: 'done' }), /unknown --next "done" for a feature/);
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'pay', prev: 'banana', next: 'review' }), /unknown --prev "banana" for a feature/);
    // Cross-cutting ends at specification: a review hop is a relay slip, and
    // the skip-review row it would render has no arm in that continuation.
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { discussion: { items: { xc: { status: 'completed' } } } },
    });
    assert.throws(() => renderSurface(dir, 'next-phase-gate', { dotpath: 'xc', prev: 'discussion', next: 'review' }),
      /unknown --next "review" for a cross-cutting \(pipeline: research, experiment, discussion, specification\)/);
    const hop = renderSurface(dir, 'next-phase-gate', { dotpath: 'xc', prev: 'discussion', next: 'specification' });
    assert.match(hop, /\*\*`y\/yes`\*\* +→ Proceed to specification/);
    assert.match(hop, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!hop.includes('d/done'), hop);
  });

  it('next-phase-gate: several live reconcile flags join into one cue', () => {
    writeManifest(dir, 'moved2', {
      work_type: 'feature',
      phases: {
        specification: { items: { moved2: { status: 'completed', reconcile_needed: 'discussion' } } },
        implementation: { items: { moved2: { status: 'completed' } } },
        review: { items: { moved2: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const out = renderSurface(dir, 'next-phase-gate', { dotpath: 'moved2', prev: 'implementation', next: 'review' });
    assert.ok(out.includes('⚑ Input moved beneath specification/moved2 (discussion), review/moved2 (implementation) — completing without review carries the pending reconcile unresolved.'), out);
  });
});

describe('review fixes — gap coverage', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: {
      planning: { items: {
        portal: { status: 'in-progress', finding_gate_mode: 'gated' },
        live: { status: 'in-progress', finding_gate_mode: 'auto' },
      } },
      specification: { items: { portal: { status: 'in-progress', finding_gate_mode: 'auto' } } },
    } });
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
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.planning.live', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!/frame/.test(out), 'no frame sections survive the D8 retirement');
    assert.ok(out.includes('DISPLAY: finding auto-approved'));
    assert.ok(!out.includes('MENU: finding gate'));
  });

  it('finding diff × a batched address renders the fence and stops there', () => {
    const file = writePayload(dir, 'f.json', { ...base, diff: { current: [], proposed: ['new line'] } });
    const out = renderSurface(dir, 'finding', { dotpath: 'pay.specification.portal', file });
    assert.ok(out.includes('=== DISPLAY: diff ('));
    assert.ok(!out.includes('DISPLAY: finding auto-approved'));
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

describe('CLI boundary — engine render through the argv entry', () => {
  const harness = require('./engine-harness.cjs');
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

  const run = (/** @type {string[]} */ args) => harness.output(dir, ['render', ...args]);

  it('flags survive argv: --triage, --variant, --approve, --gate, scalar flags', () => {
    assert.ok(run(['resume-gate', 'pay.discussion.pay', '--triage', '2']).includes('2 rerouted concern(s)'));
    const tl = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 's' }] });
    assert.ok(run(['task-list', 'pay.planning.pay', '--file', tl, '--variant', 'existing']).includes('task list confirmed'));
    const pt = writePayload(dir, 'pt.json', { phases: [{ name: 'P' }] });
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--file', pt, '--approve']).includes('MENU: phase structure gate'));
    const task = writePayload(dir, 'task.json', { current: 1, total: 1, title: 'T', severity: 'Minor', sources: 's', problem: 'p', solution: 's', outcome: 'o', steps: ['1'], criteria: ['c'] });
    assert.ok(run(['proposed-task', 'pay.planning.pay', '--file', task, '--gate', 'auto']).includes('approved [auto]'));
    const authored = writePayload(dir, 'authored-task.md', '### Task pay-1-1: T\n');
    assert.ok(run(['author-task-gate', 'pay.planning.pay', '--m', '1', '--total', '2', '--title', 'T', '--present', authored]).includes('**Task 1 of 2: T**'),
      '--present must survive argv beside the scalars');
    const gate = run(['next-phase-gate', 'pay', '--prev', 'implementation', '--next', 'review']);
    assert.ok(gate.includes('Implementation completed for "Pay".') && gate.includes('Complete without review'), gate);
    assert.ok(run(['phase-completed', 'pay', '--phase', 'discussion']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['phase-paused', 'pay', '--phase', 'discussion']).includes('Discussion paused for "Pay".'));
    assert.ok(run(['epic-all-done-gate', 'pay']).includes('Mark this epic as completed'));
    assert.ok(run(['entry-gate', 'pay.specification.pay', '--own']).includes('was consolidated into'),
      '--own must survive boolean-flag registration through argv');
    assert.ok(run(['phase-completed', 'pay', '--phase', 'scoping', '--paths']).includes('  Spec: .workflows/pay/specification/pay/specification.md'),
      '--paths must survive boolean-flag registration through argv');
  });

  it('surface errors surface as failJson on stderr with exit 1', () => {
    assert.match(harness.refuses(dir, ['render', 'proposed-task', 'pay.planning.pay', '--file', 'missing.json', '--gate', 'nope']).error,
      /--gate must be "gated" or "auto"/);
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

  // Sessions are processes. `mine` runs as this process — alive with a real
  // start time, so its beats are verifiable. `theirs` is only ever the gated
  // entrant, which stamps nothing, so a reaped pid serves: never this
  // process, never the pid-1 holder, so neither owns the other's rows.
  const PID_OF = { mine: process.pid, theirs: require('child_process').spawnSync('node', ['-e', '']).pid };

  /** A held heartbeat owned by another session — pid 1, always alive and never a session here. */
  function holdCode(workUnit, phase, topic, ageSeconds = 0) {
    const file = path.join(dir, '.workflows', '.cache', workUnit, phase, topic, 'presence');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');
    if (ageSeconds) {
      const when = new Date(Date.now() - ageSeconds * 1000);
      fs.utimesSync(file, when, when);
    }
    return file;
  }

  /**
   * Render as a named session. Identity is what presence records and what
   * every consumer compares against, so a test about two sessions is a test
   * about two identities — session id and pid both, from PID_OF.
   * @param {'mine'|'theirs'} sessionId @param {string} dotpath
   */
  function renderAs(sessionId, dotpath) {
    const session = process.env.CLAUDE_CODE_SESSION_ID;
    const pid = process.env.CLAUDE_PID;
    process.env.CLAUDE_CODE_SESSION_ID = sessionId;
    process.env.CLAUDE_PID = String(PID_OF[/** @type {keyof typeof PID_OF} */ (sessionId)]);
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
    // backdated, the re-render brings its last-active age back to now.
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

  it('a holder idle for hours still holds the slot — the gate names its age and nothing else changes', () => {
    holdCode('ship', 'implementation', 'checkout-flow', 3 * 3600);
    const out = renderSurface(dir, 'code-gate', { dotpath: 'pay.implementation.pay' });
    assert.match(out, /⚑ Another session is implementing "Checkout Flow" \(ship\) — last active 3h ago\./, out);
    assert.match(out, /=== MENU: code gate/, out);
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
    assert.ok(menu.indexOf('`b/back`') < menu.indexOf('`y/yes`'), 'back leads');
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

  it('planning: a completed specification still in motion holds the entry — the flag and the open source row alike', () => {
    manifestWith({ specification: { items: { auth: { status: 'completed', reconcile_needed: 'discussion' } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }),
      /⚑ Entry blocked — the specification for "Auth" is unsettled \(its own input moved\)[\s\S]*Continue the work unit — the specification is its next step\./);
    manifestWith({ specification: { items: { auth: { status: 'completed', sources: { talks: { status: 'stale' }, roles: { status: 'pending' } } } } } });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }),
      /unsettled \(a source is not yet extracted \(roles\), a source has moved beneath the extraction \(talks\)\)/);
    // An epic's way back is its menu's specification row, never a next step.
    manifestWith({ specification: { items: { auth: { status: 'completed', sources: { talks: { status: 'stale' } } } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.planning.auth' }),
      /Return to the epic menu — the specification is the way in: its row, or c\/completed while it still reads completed\./);
    // Every row incorporated and no flag: the record has stopped moving.
    manifestWith({ specification: { items: { auth: { status: 'completed', sources: { talks: { status: 'incorporated' } } } } } });
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

  it('epic specification with a topic: a source discussion that has not concluded blocks that spec', () => {
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'stale' }, b: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }),
      /⚑ Sources for "Auth" are not concluded: a[\s\S]*cannot be built from a record still open/);
    // A topic the gap exit opened and parked waits the same way — it has
    // never concluded, and the specification is its reader.
    manifestWith({
      discussion: { items: { a: { status: 'triaged' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'pending' }, b: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }),
      /⚑ Sources for "Auth" are not concluded: a[\s\S]*conclude the discussion\(s\), then re-enter/);
    // The legacy array form decodes the same way.
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: [{ name: 'a', status: 'stale' }] } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ Sources for "Auth" are not concluded: a/);
    // Settled sources are clear; an open discussion outside the spec's sources does not block it.
    manifestWith({
      discussion: { items: { a: { status: 'completed' }, c: { status: 'in-progress' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), '');
    // Plural open sources list every holder, whichever way each is open.
    manifestWith({
      discussion: { items: { a: { status: 'in-progress' }, b: { status: 'triaged' }, c: { status: 'completed' } } },
      specification: { items: { auth: { status: 'in-progress', sources: { a: { status: 'stale' }, b: { status: 'pending' }, c: { status: 'incorporated' } } } } },
    }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.specification.auth' }), /⚑ Sources for "Auth" are not concluded: a, b/);
  });

  it('discussion: outstanding research holds the entry shut, every work type — landed, absent, or closed research clears it', () => {
    const feature = (research) => manifestWith({
      ...(research ? { research: { items: { pay: research } } } : {}),
      discussion: { items: { pay: { status: 'in-progress' } } },
    }, 'feature');
    feature({ status: 'in-progress' });
    const out = renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.pay' });
    assert.match(out, /DISPLAY: entry blocker/);
    assert.match(out, /⚑ Entry blocked — this discussion awaits research on "Pay" \(in flight\)/);
    assert.match(out, /DISPLAY: blocker guidance[\s\S]*> Continue the work unit — the research is its next step\./);
    feature({ status: 'triaged' });
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.pay' }), /awaits research on "Pay" \(parked — not yet started\)/);
    for (const research of [undefined, { status: 'completed' }, { status: 'cancelled', previous_status: 'in-progress' }, { status: 'superseded', superseded_by: 'other' }]) {
      feature(research);
      assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.pay' }), '', JSON.stringify(research));
    }
    // An epic's guidance names its menu; the discussion item need not exist yet, and a concluded one is held the same way.
    manifestWith({ research: { items: { auth: { status: 'triaged' } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }),
      /awaits research on "Auth" \(parked — not yet started\)[\s\S]*> Return to the epic menu — its research row is the way in\./);
    manifestWith({ research: { items: { auth: { status: 'in-progress' } } }, discussion: { items: { auth: { status: 'completed', reconcile_needed: 'research' } } } }, 'epic');
    assert.match(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }), /awaits research on "Auth" \(in flight\)/);
    manifestWith({ research: { items: { other: { status: 'in-progress' } } }, discussion: { items: { auth: { status: 'in-progress' } } } }, 'epic');
    assert.strictEqual(renderSurface(dir, 'entry-gate', { dotpath: 'pay.discussion.auth' }), '', 'another topic\'s research holds nothing');
  });

  it('an unsupported phase is a loud error', () => {
    manifestWith({});
    assert.throws(() => renderSurface(dir, 'entry-gate', { dotpath: 'pay.research.auth' }), /no prerequisite rules for phase "research"/);
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

describe('render review-findings-gate', () => {
  let dir;
  const store = (phase, row) => writePayload(dir, `.workflows/.cache/pay/${phase}/checkout/state.json`, { agents: { 'review-001': {
    id: 'review-001', kind: 'review', phase, topic: 'checkout', set: 1, announced: false, created: '2026-09-11T10:00:00.000Z', ...row,
  } } });
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

  it('counts the acknowledged row\'s unsurfaced findings and names no pass — byte-exact', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1', 'F2', 'F3'], surfaced: ['F2'] });
    const out = renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' });
    assert.strictEqual(out, [
      "=== MENU: review findings gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'The review left 2 findings still to walk.',
      '',
      '**`◆ Walk them now?`**',
      '',
      '**`y/yes`**  → Work through them now',
      '**`s/skip`** → Acknowledge and conclude the topic',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /final review/i);
  });

  it('a lone finding takes the singular', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 1 finding still to walk\.\n\n\*\*`◆ Walk them now\?`\*\*/);
  });

  it('a research address is refused whatever its store holds — the gate is the discussion close\'s', () => {
    store('research', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.research.checkout' }),
      /render review-findings-gate: address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "research"/);
  });

  it('refuses every state the calling prose never renders it from', () => {
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /render review-findings-gate: no review has been dispatched on this topic/);
    store('discussion', { status: 'pending', findings: [], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /the latest review row "review-001" is pending — the gate follows an acknowledged report/);
    store('discussion', { status: 'incorporated', findings: ['F1'], surfaced: ['F1'] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /"review-001" is incorporated/);
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.planning.checkout' }),
      /address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "planning"/);
  });

  it('anchors on the latest review row, not an earlier drained one', () => {
    writePayload(dir, '.workflows/.cache/pay/discussion/checkout/state.json', { agents: {
      'review-001': { id: 'review-001', kind: 'review', phase: 'discussion', topic: 'checkout', set: 1, status: 'incorporated', announced: true, findings: ['F1'], surfaced: ['F1'], created: '2026-09-11T09:00:00.000Z' },
      'review-002': { id: 'review-002', kind: 'review', phase: 'discussion', topic: 'checkout', set: 2, status: 'acknowledged', announced: false, findings: ['F1', 'F2'], surfaced: [], created: '2026-09-11T10:00:00.000Z' },
    } });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 2 findings still to walk\./);
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
    assert.throws(() => renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' }), /unknown surface "nope" \(surfaces: resume-gate, task-list, findings-summary, finding-announce, finding-batch, finding, review-presentation, review-gate, spec-review-gate, spec-completion-gate, convergence-diagnostic, carry-note-gate, hypothesis-board, fix-direction, validation-gate, validation-report, project-skills, linters, triage-announce, triage-offer, triage-block, requeue-offer, reroute-offer, research-threads, research-conclude-gate, deep-dive-offer, perspective-offer, in-flight-agents-gate, review-findings-gate, reroute-candidates, off-topic-offer, backlog-gate, map-op-gate, candidate-gate, triage-closed-target, conclude-gate, closing-gate, experiment-register, experiment-approval-gate, experiment-pick, experiment-next-gate, experiment-spawn-gate, wait-gate, summary-backfill-gate, external-dependency-gate, checkpoint-files-gate, executor-block-gate, dependency-approval-gate, task-count-gate, plan-format-gate, plan-review-gate, correction-gate, analysis-proceed-gate, proposed-task, incoherence-gate, resurface-gate, construction-gate, tasks-overview, author-task-gate, phase-tree, phase-completed, phase-paused, phase-note, entry-gate, direct-entry-gate, code-gate, next-phase-gate, cancel-gate, epic-all-done-gate, epic-soft-gate, task-brief, task-result, task-gate, fix-gate, blocked-tasks, cycle-limit, spec-corrections, cycle-gate, workunit-receipt, topic-receipt, absorb-summary, absorb-receipt, absorb-continuation, promote-receipt, import-reprompt, pivot-continuation, session-receipt, absorb-target, absorb-confirm-gate, plan-topics, archived-actions, archived-delete-gate, revisit-phases, roadmap-view, roadmap-add-gate, horizon-pick, park-gate, roadmap-session-receipt, roadmap-harvest-gate, roadmap-parks-gate, roadmap-shape-gate, shape-gate, synthesis-gate, query-failure-gate, baseline-progress, baseline-area-gate, baseline-paused, baseline-receipt, baseline-scope-gate, baseline-round, baseline-doc-gate, baseline-manage-gate, baseline-doc-pick, baseline-offer-gate, walkthrough-screen, walkthrough-home, walkthrough-topics, walkthrough-topic, migration-gate, label-gate, knowledge-gate, legacy-split-gate, legacy-split-display\)/);
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

  it('every drawn walkthrough diagram fits the pinned width — an untagged fence cannot re-flow (D8)', () => {
    const contentRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        if (!entry.isFile() || !p.endsWith('.md')) continue;
        // A tagged fence is notation, not a drawing: the engine lays it out
        // at the pane's width, and its own suite drives it at the floor and
        // the cap. Only what emits as drawn is measured here.
        let fence = null;
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (line.startsWith('```')) { fence = fence === null ? line.slice(3).trim() : null; return; }
          // Characters, not bytes: the diagrams are drawn with arrows and
          // box-drawing glyphs, each of which is several bytes wide.
          if (fence === '' && [...line].length > 65) offenders.push(`${path.relative(contentRoot, p)}:${i + 1}`);
        });
      }
    })(contentRoot);
    assert.deepStrictEqual(offenders, [],
      'a fenced line renders as drawn — past the narrowest pane it wraps and the diagram breaks');
  });

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
    assert.ok(out.includes(`Into the work underway — a new topic in one of its work\n${NB(6)}units (name which)`), 'the multi-unit label, wrapped');
    assert.match(out, /On the roadmap in "mvp", waiting with its 2 other items/, 'the plural form');
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
    assert.match(out, /"mvp" is being built right now\. Where does this go\?/);
    assert.match(out, /Into the work underway — a new topic in "mvp"/);
    assert.match(out, /`2`.*Another horizon/);
    assert.ok(!out.includes('On the roadmap in'), 'no waiting side-door into a fully-delivered horizon');
  });

  it('roadmap-add-gate: a partly-composed horizon keeps the waiting option', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'roadmap-add-gate', { horizon: 'mvp' });
    assert.match(out, /"mvp" is partly being built\. Where does this go\?/);
    assert.match(out, /On the roadmap in "mvp", waiting with its 1 other item/);
    assert.match(out, /`3`.*Another horizon/);
  });

  it('roadmap-add-gate: refuses an unknown horizon and one with no delivery', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', { horizon: 'ghost' }), /unknown horizon/);
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', { horizon: 'v1' }), /no member of "v1" is in delivery/);
    assert.throws(() => renderSurface(dir, 'roadmap-add-gate', {}), /--horizon is required/);
  });

  it('horizon-pick: the horizons in map order, each with what waits in it, then the new row', () => {
    writeRoadmap(TWO_HORIZONS, { mvp: { work_type: 'epic', status: 'in-progress' } });
    const out = renderSurface(dir, 'horizon-pick', {});
    assert.strictEqual(out, [
      "=== MENU: horizon pick (emit verbatim as markdown, then STOP for the user's response) ===",
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
      /render horizon-pick: no roadmap on the project manifest — the park names its first horizon in prose/);
    writeRoadmap({ horizons: [], items: {} });
    assert.throws(() => renderSurface(dir, 'horizon-pick', {}),
      /render horizon-pick: the roadmap holds no horizons — the park names one in prose/);
  });

  it('park-gate: an existing horizon, no source', () => {
    writeRoadmap(TWO_HORIZONS);
    const out = renderSurface(dir, 'park-gate', {
      name: 'csv-export', horizon: 'v1', summary: "operators export a day's orders as CSV",
    });
    assert.strictEqual(out, [
      "=== MENU: park gate (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Parking **Csv Export** — operators export a day\'s orders as CSV — puts it on the roadmap under "v1", waiting until it is pulled into work.',
      '',
      '**`◆ Park it on the roadmap?`**',
      '',
      '**`y/yes`**   → Park it',
      '**`n/no`**    → Leave it — nothing is recorded',
      '**Comment** → Tell me what to change (name, horizon, or summary)',
      '',
    ].join('\n'));
  });

  it('park-gate: a horizon the map does not hold is flagged new, and the source rides the statement', () => {
    writeRoadmap(TWO_HORIZONS);
    const out = unwrap(renderSurface(dir, 'park-gate', {
      name: 'csv-export', horizon: 'v2', summary: 'operators export orders as CSV',
      source: '.workflows/mvp/specification/orders/specification.md',
    }));
    assert.match(out, /under "v2" \(new\), waiting until it is pulled into work\. Its source is `\.workflows\/mvp\/specification\/orders\/specification\.md`\./);
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
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /the baseline is "none" — no assessment has been started/);
    writeBaseline({ status: 'in-progress', areas: {} });
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /no areas/);
  });

  it('baseline-area-gate: statement, glyphed question, and both options', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    const out = renderSurface(dir, 'baseline-area-gate', { area: 'overview' });
    assert.match(out, /^=== MENU: baseline area gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
    assert.match(out, /\*\*Overview\*\* is documented\. 1 area\(s\) remain\./);
    assert.match(out, /\*\*`◆ Keep going\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Interview the next area/);
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
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Lock the list and start the research/);
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
    // A native verdict is recorded state too — the offer never fires over it,
    // and the mid-flight surfaces read it as never started.
    writeBaseline({ status: 'native' });
    assert.throws(() => renderSurface(dir, 'baseline-offer-gate', {}), /the offer fires once/);
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /the baseline is "native" — no assessment has been started/);
  });

  it('the migration gate leads with the summary and draws the counts line from its flags', () => {
    const summary = writePayload(dir, 'migration-summary.md', 'Restructured workflow directories and created manifest files.\n');
    const counted = renderSurface(dir, 'migration-gate', { present: summary, migrations: '3', files: '12' });
    assert.ok(counted.startsWith([
      '=== DISPLAY: migration summary (emit verbatim as a code block) ===',
      'Migrations Applied',
      '',
      'Restructured workflow directories and created manifest files.',
      '',
      '3 migration(s), 12 file(s) updated.',
      '',
    ].join('\n')), counted);
    assert.ok(counted.indexOf('DISPLAY: migration summary') < counted.indexOf('MENU: migration gate'));
    // Verification fixes only: the run changed no files, so there is no
    // counts line to draw.
    const uncounted = renderSurface(dir, 'migration-gate', { present: summary });
    assert.ok(!uncounted.includes('migration(s)'), uncounted);
    assert.ok(uncounted.includes('Restructured workflow directories and created manifest files.\n\n=== MENU: migration gate'), uncounted);
  });

  it('the migration gate refuses a bare call, a half-given pair, and a non-numeric count', () => {
    const summary = writePayload(dir, 'migration-summary.md', 'Recovered a rerouted concern.\n');
    assert.throws(() => renderSurface(dir, 'migration-gate', {}),
      /render migration-gate: --present <summary\.md> is required/);
    assert.throws(() => renderSurface(dir, 'migration-gate', { present: summary, migrations: '3' }),
      /--migrations and --files are given together or not at all/);
    assert.throws(() => renderSurface(dir, 'migration-gate', { present: summary, files: '12' }),
      /--migrations and --files are given together or not at all/);
    assert.throws(() => renderSurface(dir, 'migration-gate', { present: summary, migrations: 'three', files: '12' }),
      /--migrations must be a non-negative integer, got "three"/);
    assert.throws(() => renderSurface(dir, 'migration-gate', { present: summary, migrations: '3', files: '-1' }),
      /--files must be a non-negative integer, got "-1"/);
  });

  it('the boot gates are static menus: the migration confirm and the tmux label opt-in', () => {
    const migration = renderSurface(dir, 'migration-gate', { present: writePayload(dir, 'migration-summary.md', 'Applied.\n') });
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

  it('the knowledge gate: four menus keyed by what each asks; the reuse row names the configuration it adopts', () => {
    assert.strictEqual(renderSurface(dir, 'knowledge-gate', { variant: 'reuse', provider: 'openai', model: 'text-embedding-3-small' }), [
      "=== MENU: knowledge reuse gate (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== MENU: knowledge reuse gate (emit verbatim as markdown, then STOP for the user's response) ===",
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

    const retry = renderSurface(dir, 'knowledge-gate', { variant: 'retry' });
    assert.match(retry, /=== MENU: knowledge retry gate/);
    assert.match(retry, /\*\*`◆ Ready to retry\?`\*\*/);
    assert.match(unwrap(retry), /\*\*`y\/yes`\*\*\s+→ The key is stored — re-run the setup/);
    assert.match(unwrap(retry), /\*\*`k\/keyword`\*\* → Skip the key for now — use keyword-only search instead/);
    assert.doesNotMatch(retry, /d\/done/);
  });

  it('the knowledge gate refuses a missing or unknown variant, a lone provider or model, and a configuration on any variant but reuse', () => {
    assert.throws(() => renderSurface(dir, 'knowledge-gate', {}), /--variant must be one of reuse, deviate, mode, retry, got ""/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'setup' }), /--variant must be one of reuse, deviate, mode, retry, got "setup"/);
    assert.match(renderSurface(dir, 'knowledge-gate', { variant: 'reuse', provider: 'openai' }), /Use the existing configuration \(openai\)/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'reuse', model: 'text-embedding-3-small' }), /--model names nothing without --provider/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'mode', provider: 'openai', model: 'text-embedding-3-small' }), /--provider\/--model belong to the reuse variant — the mode variant names no configuration/);
    assert.throws(() => renderSurface(dir, 'knowledge-gate', { variant: 'retry', model: 'x' }), /belong to the reuse variant — the retry variant/);
  });

  it('the doc gate leads with the skim, then its menu, and refuses a bare call', () => {
    const body = 'The dispatcher is a polling pump over a flaky downstream. 14 observed claims, 3 decisions, 2 open questions.\n';
    const out = renderSurface(dir, 'baseline-doc-gate', { present: writePayload(dir, 'doc-skim.md', body) });
    assert.ok(out.startsWith('=== DISPLAY: doc skim (emit verbatim as markdown) ===\n'
      + '**The area doc** — what it holds; the full text stays on disk\n\n'
      + body), out);
    assert.ok(out.indexOf('DISPLAY: doc skim') < out.indexOf('MENU: baseline doc gate'));
    assert.throws(() => renderSurface(dir, 'baseline-doc-gate', {}),
      /render baseline-doc-gate: --present <skim\.md> is required/);
  });

  it('the static baseline gates render their menus; the completed-only pair refuse mid-flight', () => {
    assert.match(renderSurface(dir, 'baseline-doc-gate', { present: writePayload(dir, 'doc-skim.md', 'A skim.\n') }), /\*\*`◆ Land it\?`\*\*[\s\S]*\*\*`y\/yes`\*\*\s+→ Index and commit the doc/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-manage-gate', {}), /not completed/);
    assert.throws(() => renderSurface(dir, 'baseline-doc-pick', {}), /not completed/);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`◆ What would you like to do\?`\*\*[\s\S]*\*\*`e\/expand`\*\* → Add a new area, or deepen an existing one/);
    // The way out of the baseline is the surface it was entered from.
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`b\/back`\*\*\s+→ Return to the start menu/);
    assert.match(renderSurface(dir, 'baseline-doc-pick', {}), /Which doc\? \(enter the area name, or \*\*`b\/back`\*\*\)/);
  });
});

describe('walkthrough surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  const SCREENS = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough', 'screens');
  const screenFiles = () => fs.readdirSync(SCREENS).filter((f) => f.endsWith('.md')).sort();
  const screenText = (n) => fs.readFileSync(path.join(SCREENS, screenFiles()[n - 1]), 'utf8');
  const titleOf = (n) => screenText(n).split('\n').find((l) => l.startsWith('# ')).slice(2).trim();

  const TOPICS = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough', 'topics');
  const cardFiles = () => fs.readdirSync(TOPICS).filter((f) => f.endsWith('.md')).sort();
  const cardText = (n) => fs.readFileSync(path.join(TOPICS, cardFiles()[n - 1]), 'utf8');
  const cardTitle = (n) => cardText(n).split('\n').find((l) => l.startsWith('# ')).slice(2).trim();
  // The addresses `walkthrough-topic` takes. Pinned rather than re-derived
  // from the filenames the projection reads: a slug is what a session routes
  // on, and a card renamed out from under one has to fail here.
  const SLUGS = [
    'kinds-of-work', 'the-phases', 'epics-the-map-and-the-dashboard', 'the-roadmap', 'gates-and-auto',
    'the-knowledge-base-and-the-baseline', 'the-inbox', 'reshaping-work', 'working-in-parallel',
  ];
  /** The section markers of a render, in order — the shape the emitting prose walks. */
  const markers = (out) => out.split('\n').filter((l) => l.startsWith('=== ')).map((l) => l.slice(4, l.indexOf(' (')));
  /** A content file's chunks in order, each carrying its fence tag ('' when untagged, null for prose). */
  const fenceChunks = (text) => {
    const chunks = [];
    let tag = null;
    let buffer = [];
    const flush = () => {
      const body = buffer.join('\n').replace(/^\n+|\n+$/g, '');
      if (body !== '' || tag) chunks.push({ tag, text: body });
      buffer = [];
    };
    for (const line of text.split('\n').slice(1)) {
      if (line.startsWith('```')) { const open = line.slice(3).trim(); flush(); tag = tag === null ? open : null; continue; }
      buffer.push(line);
    }
    flush();
    return chunks;
  };
  const menuOf = (out) => out.slice(out.indexOf('=== MENU:'));

  it('a screen is its heading, its content in file order, then its menu', () => {
    const out = renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' });
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'DISPLAY: walkthrough diagram', 'DISPLAY: walkthrough prose', 'MENU: walkthrough screen']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      `# **\`■ How the workflows work · 1 of ${screenFiles().length} · ${titleOf(1)}\`**`,
      '',
      '=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===',
    ].join('\n')), out.slice(0, 400));

    // Every chunk the file marks off reaches the render in file order: the
    // prose as written, an untagged diagram as drawn. A tagged fence is
    // notation the engine lays out, so what reaches the render is the
    // layout's output, not the source — its own suite pins that.
    const chunks = fenceChunks(screenText(1));
    assert.strictEqual(chunks.length, 3, 'screen 1 is prose, diagram, prose');
    let cursor = 0;
    for (const chunk of chunks) {
      if (chunk.tag) continue;
      const at = out.indexOf(chunk.text, cursor);
      assert.ok(at > cursor, `chunk missing or out of order:\n${chunk.text.slice(0, 60)}…`);
      cursor = at;
    }
  });

  it('the first screen: a first run can only go on or skip; from help it goes on or back', () => {
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(2)}`,
      "**`s/skip`** → Skip this for now — it's under h/help whenever you want",
      `${NB(9)}it`,
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));

    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'help' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(2)}`,
      '**`b/back`** → Back to help',
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));
  });

  it('a middle screen: next, back, and a stop that names where stopping lands', () => {
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '2', from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(3)}`,
      '**`b/back`** → Go back a screen',
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));

    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '2', from: 'help' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(3)}`,
      '**`b/back`** → Go back a screen',
      '**`s/stop`** → Stop here and go back to help',
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));
  });

  it('the last screen: one way out, and the closing invitation beside the standing one', () => {
    const last = screenFiles().length;
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: String(last), from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      '**`d/done`**  → Go to the start menu',
      "**Ask**     → Ask anything about what's on this screen",
      "**Tell me** → Tell me what you're likely to start with, and I'll say",
      `${NB(10)}what path it will take`,
      '',
    ].join('\n'));

    assert.match(renderSurface(dir, 'walkthrough-screen', { screen: String(last), from: 'help' }), /\*\*`d\/done`\*\*\s+→ Back to help/);
  });

  it('--menu-only is the menu alone — the return from a question, not the screen again', () => {
    for (const from of ['first-run', 'help']) {
      const full = renderSurface(dir, 'walkthrough-screen', { screen: '2', from });
      const menuOnly = renderSurface(dir, 'walkthrough-screen', { screen: '2', from, 'menu-only': '1' });
      assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough screen']);
      assert.strictEqual(menuOnly, menuOf(full), `${from}: the keys come back exactly as they stood`);
    }
  });

  it('refuses a screen outside the walk, a missing or unknown origin', () => {
    const total = screenFiles().length;
    for (const screen of [undefined, '', '0', String(total + 1), 'two', '1.5']) {
      assert.throws(
        () => renderSurface(dir, 'walkthrough-screen', { screen, from: 'help' }),
        new RegExp(`--screen is 1–${total} — got "${screen ?? ''}"`),
        JSON.stringify(screen),
      );
    }
    assert.throws(() => renderSurface(dir, 'walkthrough-screen', { screen: '1' }), /--from must be one of first-run, help, got ""/);
    assert.throws(() => renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'menu' }), /--from must be one of first-run, help, got "menu"/);
  });

  it('walkthrough-home: the walk, the cards, a question, and the way back', () => {
    assert.strictEqual(renderSurface(dir, 'walkthrough-home', {}), [
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      '# **`■ Help`**',
      '',
      "=== MENU: walkthrough home (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What would you like to do?`**',
      '',
      `**\`w/walk\`**   → Walk through how the workflows work (${screenFiles().length} short screens)`,
      '**`t/topics`** → Read about one area in more depth',
      '**`b/back`**   → Back to the start menu',
      '**Ask**      → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('walkthrough-topics: every card numbered in file order, its slug on the DATA row', () => {
    assert.strictEqual(renderSurface(dir, 'walkthrough-topics', {}), [
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      '# **`■ Help · Topics`**',
      '',
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'CARDS (key  name):',
      ...SLUGS.map((slug, i) => `  ${i + 1}  ${slug}`),
      '',
      "=== MENU: walkthrough topics (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which area?`**',
      '',
      ...SLUGS.map((_slug, i) => `**\`${i + 1}\`**      → ${cardTitle(i + 1)}`),
      '**`b/back`** → Back to help',
      '**Ask**    → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('a card is its heading, its content in file order, then the menu every card wears', () => {
    const out = renderSurface(dir, 'walkthrough-topic', { name: SLUGS[0] });
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'DISPLAY: walkthrough diagram', 'DISPLAY: walkthrough prose', 'MENU: walkthrough card']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      `# **\`■ Help · ${cardTitle(1)}\`**`,
      '',
      '=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===',
    ].join('\n')), out.slice(0, 400));

    const body = cardText(1).split('\n').slice(1).join('\n');
    const chunks = body.split(/^```$/m).map((c) => c.replace(/^\n+|\n+$/g, '')).filter(Boolean);
    assert.strictEqual(chunks.length, 3, 'the first card is prose, diagram, prose');
    let cursor = 0;
    for (const chunk of chunks) {
      const at = out.indexOf(chunk, cursor);
      assert.ok(at > cursor, `chunk missing or out of order:\n${chunk.slice(0, 60)}…`);
      cursor = at;
    }

    assert.strictEqual(menuOf(out), [
      "=== MENU: walkthrough card (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      '**`t/topics`** → Back to the topics',
      '**`b/back`**   → Back to help',
      "**Ask**      → Ask anything about what's on this card",
      '',
    ].join('\n'));
  });

  it('every card renders, and --menu-only is the keys back exactly as they stood', () => {
    for (const slug of SLUGS) {
      const full = renderSurface(dir, 'walkthrough-topic', { name: slug });
      const menuOnly = renderSurface(dir, 'walkthrough-topic', { name: slug, 'menu-only': '1' });
      assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough card']);
      assert.strictEqual(menuOnly, menuOf(full), slug);
    }
  });

  it('refuses a missing or unknown card, naming the ones there are', () => {
    const named = new RegExp(`--name is one of ${SLUGS.join(', ')} — got`);
    for (const name of [undefined, '', 'the-map', '01-kinds-of-work', 'Kinds-Of-Work']) {
      assert.throws(() => renderSurface(dir, 'walkthrough-topic', { name }), named, JSON.stringify(name));
      // The return from a question is addressed the same way: a menu never
      // comes back for a card that does not exist.
      assert.throws(() => renderSurface(dir, 'walkthrough-topic', { name, 'menu-only': '1' }), named, JSON.stringify(name));
    }
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
    assert.match(out, /Outside this spec: 2 findings — held until the review closes\./);
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

  it('names the criteria the review could not measure, singular at one', () => {
    const three = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 3 });
    assert.match(three, /Not measured: 3 criteria — named in the report\./);
    const one = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 1 });
    assert.match(one, /Not measured: 1 criterion — named in the report\./);
  });

  it('says nothing about measurement when every criterion was measured', () => {
    const zero = render({ topic: 'checkout', verdict: 'pass', discarded: 45, not_measured: 0 });
    assert.ok(!zero.includes('Not measured'), 'zero renders nothing');
    const absent = render({ topic: 'checkout', verdict: 'pass', discarded: 45 });
    assert.ok(!absent.includes('Not measured'), 'absent renders nothing');
  });

  it('the out-of-scope line says what happens to the set: decided at a pass, held at a fail', () => {
    const pass = render({ topic: 'checkout', verdict: 'pass', out_of_scope: 1 });
    assert.match(pass, /Outside this spec: 1 finding — each decided below\./);
    const fail = render({
      topic: 'checkout', verdict: 'fail', out_of_scope: 3,
      replan: [{ summary: 'the guard scans comments only', fails: 'ten retired names pass green' }],
    });
    assert.match(fail, /Outside this spec: 3 findings — held until the review closes\./);
  });

  it('the not-measured line closes the tail, after the held and discarded counts', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', corrected: { applied: 4, suite: 'green' }, out_of_scope: 2, discarded: 45, not_measured: 3 });
    const oi = out.indexOf('Outside this spec: 2');
    const di = out.indexOf('Discarded: 45');
    const ni = out.indexOf('Not measured: 3');
    assert.ok(out.indexOf('Corrected in this session') < oi && oi < di && di < ni, 'the tail keeps its order');
  });

  it('a pass with nothing but unmeasured criteria still opens the findings section', () => {
    const out = render({ topic: 'checkout', verdict: 'pass', not_measured: 3 });
    assert.match(out, /DISPLAY: review findings/);
    assert.match(out, /Not measured: 3 criteria — named in the report\./);
    assert.ok(!out.includes('Corrected'));
    assert.ok(!out.includes('Discarded'));
  });

  it('refuses a not-measured count that is not a non-negative integer', () => {
    const message = /render review-presentation: "not_measured" must be a non-negative integer/;
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: -1 }), message);
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: 1.5 }), message);
    assert.throws(() => render({ topic: 'checkout', verdict: 'pass', not_measured: '3' }), message);
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
  });

  it('the completion names where it lands — an epic returns, every other type finishes', () => {
    const landing = (workType) => {
      writeManifest(dir, 'pay', { work_type: workType, phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
      return renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    };
    assert.match(landing('epic'), /\*\*`c\/complete`\*\* → Complete the review and return to the epic/);
    assert.match(landing('feature'), /\*\*`c\/complete`\*\* → Complete the review and finish the feature/);
    assert.match(landing('bugfix'), /\*\*`c\/complete`\*\* → Complete the review and finish the bugfix/);
    assert.match(landing('quick-fix'), /\*\*`c\/complete`\*\* → Complete the review and finish the quick-fix/);
  });

  it('an unknown or absent work type still names a landing', () => {
    writeManifest(dir, 'pay', { work_type: 'rebuild', phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
    assert.match(renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' }),
      /\*\*`c\/complete`\*\* → Complete the review and finish the work/);
    writeManifest(dir, 'pay', { work_type: undefined, phases: { review: { items: { checkout: { status: 'in-progress' } } } } });
    assert.match(renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' }),
      /\*\*`c\/complete`\*\* → Complete the review and finish the work/);
  });

  it('the banked set is decided before the gate, so the gate never offers it', () => {
    const clean = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass' });
    assert.ok(!clean.includes('i/inbox'), 'the out-of-scope decision is not a gate option');
    assert.ok(!clean.includes('p/plan'));
    const flagged = renderSurface(dir, 'review-gate', { dotpath: 'pay.review.checkout', verdict: 'pass', 'out-of-scope': '2' });
    assert.strictEqual(flagged, clean, 'the surface no longer reads --out-of-scope');
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
      '**`r/roadmap`** → Put it on the product roadmap for a later release',
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

describe('render backlog-gate', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const live = () => writeManifest(dir, 'pay', {
    work_type: 'feature',
    phases: { implementation: { items: { pay: { status: 'in-progress' } } } },
  });

  it('names the idea and offers the two backlogs', () => {
    live();
    const file = writePayload(dir, 'b.json', { idea: "a CSV export of the day's orders" });
    const out = renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay', file });
    assert.strictEqual(out, [
      "=== MENU: backlog gate (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "Setting **a CSV export of the day's orders** aside.",
      '',
      '**`◆ Which backlog?`**',
      '',
      '**`r/roadmap`** → The product roadmap — next, or soon after this work',
      '**`i/inbox`**   → The inbox — someday, picked up when it is picked up',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload, a missing idea, and an empty one', () => {
    live();
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay' }),
      /render backlog-gate: --file <payload\.json> is required/);
    const absent = writePayload(dir, 'a.json', { concern: 'wrong key' });
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay', file: absent }),
      /render backlog-gate: "idea" must be a non-empty string/);
    const blank = writePayload(dir, 'e.json', { idea: '   ' });
    assert.throws(() => renderSurface(dir, 'backlog-gate', { dotpath: 'pay.implementation.pay', file: blank }),
      /render backlog-gate: "idea" must be a non-empty string/);
  });

  it('refuses a dead address', () => {
    live();
    const file = writePayload(dir, 'b.json', { idea: 'gift cards' });
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
    assert.match(out, /^=== MENU: roadmap harvest gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
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

  it('roadmap-shape-gate: the session\'s read, then the pull ceremony confirm', () => {
    const body = 'These three become one epic. 3 items stay waiting in mvp.\n';
    const shape = renderSurface(dir, 'roadmap-shape-gate', { present: writePayload(dir, 'unit-shape.md', body) });
    assert.ok(shape.startsWith('=== DISPLAY: unit shape (emit verbatim as markdown) ===\n'
      + '**The shape** — how the pulled items become one unit, and what stays waiting\n\n'
      + body), shape);
    assert.ok(shape.indexOf('DISPLAY: unit shape') < shape.indexOf('MENU: roadmap shape gate'));
    assert.match(shape, /`◆ Shape it this way\?`/);
    assert.match(shape, /`y\/yes`.*Create it and carry on into it/);
    assert.ok(shape.includes(`**Adjust** → Tell me what to change (epic or feature, the\n${NB(9)}description)`), 'the Adjust label, wrapped');
    assert.throws(() => renderSurface(dir, 'roadmap-shape-gate', {}),
      /render roadmap-shape-gate: --present <shape\.md> is required/);
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

  it('query-failure-gate: retry or proceed without context', () => {
    const out = renderSurface(dir, 'query-failure-gate', {});
    assert.match(out, /`◆ How should I proceed\?`/);
    assert.match(out, /`r\/retry`.*I'll fix the issue; retry the query/);
    assert.match(out, /`s\/skip`.*Proceed without knowledge context for this phase/);
  });

  it('legacy-split-gate: three dialog gates keyed by what each asks; the remove confirm asks on its diamond line', () => {
    assert.strictEqual(renderSurface(dir, 'legacy-split-gate', { variant: 'remove' }), [
      "=== MENU: legacy split remove gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Remove the theme?`**',
      '',
      '**`y/yes`** → Remove the theme and drop its content',
      '**`n/no`**  → Back out',
      '',
    ].join('\n'));

    const themes = renderSurface(dir, 'legacy-split-gate', { variant: 'themes' });
    assert.match(themes, /^=== MENU: legacy split themes gate \(emit verbatim as markdown, then STOP for the user's response\) ===/);
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
  });
});

describe('render import-reprompt', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('names the refused paths in the fence, and offers the correction or the skip', () => {
    const file = writePayload(dir, 'reprompt.json', { missing: ['shots/dockset 05.JPEG', 'notes/ghost.md'] });
    assert.strictEqual(renderSurface(dir, 'import-reprompt', { file }), [
      '=== DISPLAY: missing imports (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
      'One or more paths could not be landed — nothing at the path, a',
      'folder rather than a file, or unreadable:',
      '',
      '  • shots/dockset 05.JPEG',
      '  • notes/ghost.md',
      '',
      "=== MENU: import reprompt (emit verbatim as markdown, then STOP for the user's response) ===",
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

describe('render legacy-split-display', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const themes = [
    { kebab_name: 'auth', summary: 'Login, sessions, and token refresh' },
    { kebab_name: 'caching', summary: 'Response caching and invalidation' },
  ];

  it('candidates: the theme list as a batch worklist — the name per row, its summary beneath', () => {
    const file = writePayload(dir, 'candidates.json', { source: 'auth', themes });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'candidates', file }), [
      '=== DISPLAY: legacy split candidates (emit verbatim as markdown — do not stop; continue as the workflow instructs) ===',
      'Candidate themes for auth.md:',
      '',
      '1\\. auth',
      `${NB(5)}↳ Login, sessions, and token refresh`,
      '2\\. caching',
      `${NB(5)}↳ Response caching and invalidation`,
      '',
    ].join('\n'));
  });

  it('plan: each theme as a numbered summary/content/cache tree, then the rename footer naming the stamp apply mints', () => {
    const file = writePayload(dir, 'plan-display.json', { source: 'auth', work_unit: 'pay', themes: [
      { ...themes[0], paragraph_count: 4, content_preview: 'The auth flow begins at login' },
      { ...themes[1], paragraph_count: 2, content_preview: 'Responses are cached per route' },
    ] });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'plan', file }), [
      '=== DISPLAY: legacy split plan (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
      'Plan for auth.md:',
      '',
      '1. auth',
      '   ├─ Summary: Login, sessions, and token refresh',
      '   ├─ Content: 4 para(s) — "The auth flow begins at login..."',
      '   └─ Cache: .workflows/.cache/pay/legacy-split/auth/auth.md',
      '',
      '2. caching',
      '   ├─ Summary: Response caching and invalidation',
      '   ├─ Content: 2 para(s) — "Responses are cached per route..."',
      '   └─ Cache: .workflows/.cache/pay/legacy-split/auth/caching.md',
      '',
      'Source file will be renamed to auth-superseded-<datetime>.md.',
      '',
    ].join('\n'));
  });

  it('plan: a long preview wraps under its text column with the rail intact, and no row overflows the width', () => {
    const file = writePayload(dir, 'plan-display.json', { source: 'auth', work_unit: 'pay', themes: [
      { ...themes[0], paragraph_count: 4, content_preview: 'The auth flow begins at the login form and hands a session to' },
    ] });
    const out = renderSurface(dir, 'legacy-split-display', { variant: 'plan', file });
    assert.ok(out.includes([
      '   ├─ Content: 4 para(s) — "The auth flow begins at the login',
      '   │  form and hands a session to..."',
      '   └─ Cache: .workflows/.cache/pay/legacy-split/auth/auth.md',
    ].join('\n')), out);
    for (const line of out.split('\n').slice(1)) assert.ok(line.length <= 65, `overflowing row: ${line}`);
  });

  it('errors: the validator\'s lines as bullets under the source', () => {
    const file = writePayload(dir, 'errors.json', { source: 'auth', errors: [
      "theme 'auth' has empty summary",
      "theme 'caching' has no cache file at caching.md",
    ] });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'errors', file }), [
      '=== DISPLAY: legacy split errors (emit verbatim as a code block — do not stop; continue as the workflow instructs) ===',
      'Validation failed for auth:',
      '',
      "  • theme 'auth' has empty summary",
      "  • theme 'caching' has no cache file at caching.md",
      '',
    ].join('\n'));
  });

  it('refuses a missing or unknown variant, a missing or absent file, and a payload short of its variant\'s fields', () => {
    const bad = (name, variant, obj) => () => renderSurface(dir, 'legacy-split-display', { variant, file: writePayload(dir, name, obj) });
    assert.throws(() => renderSurface(dir, 'legacy-split-display', {}), /--variant must be one of candidates, plan, errors, got ""/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'themes' }), /--variant must be one of candidates, plan, errors, got "themes"/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'candidates' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'candidates', file: 'nope.json' }), /payload file not found: nope\.json/);
    assert.throws(bad('s.json', 'candidates', { themes }), /"source" must be a non-empty string/);
    assert.throws(bad('e.json', 'candidates', { source: 'auth', themes: [] }), /"themes" must be a non-empty array of \{kebab_name, summary\}/);
    assert.throws(bad('m.json', 'candidates', { source: 'auth', themes: [themes[0], { kebab_name: 'caching' }] }), /theme 2 is missing "summary"/);
    assert.throws(bad('w.json', 'plan', { source: 'auth', themes }), /"work_unit" must be a non-empty string/);
    assert.throws(bad('pe.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [] }), /"themes" must be a non-empty array of \{kebab_name, summary, content_preview, paragraph_count\}/);
    assert.throws(bad('pp.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: 1 }] }), /theme 1 is missing "content_preview"/);
    assert.throws(bad('pc.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: '3', content_preview: 'x' }] }), /theme 1 "paragraph_count" must be a non-negative integer/);
    assert.throws(bad('pn.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: -1, content_preview: 'x' }] }), /theme 1 "paragraph_count" must be a non-negative integer/);
    assert.throws(bad('ee.json', 'errors', { source: 'auth', errors: [] }), /"errors" must be a non-empty array of strings/);
    assert.throws(bad('eb.json', 'errors', { source: 'auth', errors: ['ok', ''] }), /errors\[1\] must be a non-empty string/);
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

  it('a cancelled row names its way back — the reactivate — on every op it refuses', () => {
    assert.throws(() => render('remove', { name: 'gone' }, 'c1.json'),
      /"gone" can't be removed — it's "cancelled", not fresh — reactivate it from the epic menu first/);
    assert.throws(() => render('rename', { name: 'gone', new_name: 'x' }, 'c2.json'),
      /"gone" can't be renamed — it's "cancelled", not fresh — reactivate it from the epic menu first/);
    assert.throws(() => render('reroute', { name: 'gone', from: 'discussion', to: 'research' }, 'c3.json'),
      /"gone" can't be re-routed — it's "cancelled", not fresh — reactivate it from the epic menu first/);
    assert.throws(() => render('close', { name: 'gone' }, 'c4.json'),
      /"gone" can't be closed as a dead end — it's cancelled; reactivate it from the epic menu first/);
    assert.throws(() => render('remove', { name: 'in-flight' }, 'c5.json'), /not fresh$/, 'a live row carries no reactivate clause');
  });

  it('a cancelled topic refuses the close, and an edit rides any lifecycle', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { 'auth-flow': { routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'auth-flow': { status: 'cancelled' } } },
      },
    });
    assert.throws(() => render('close', { name: 'auth-flow' }, 'c1.json'),
      /"auth-flow" can't be closed as a dead end — it's cancelled; reactivate it from the epic menu first/);
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
    assert.match(out, /\*\*`o\/open`\*\*\s+→ Reactivate it and land the concern there — the/);
    assert.match(out, /topic returns to its previous state and counts as\n/);
    assert.match(out, /open again/);
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
    const file = writePayload(dir, 'd.json', { thread: 'How does the competitor rank a query it has never seen?' });
    assert.strictEqual(renderSurface(dir, 'deep-dive-offer', { dotpath: 'pay.research.checkout', file }), [
      "=== MENU: deep dive offer (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'A thread worth digging: How does the competitor rank a query it has never seen?',
      '',
      '**`◆ Send a deep dive after it while we keep going?`**',
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

  it('perspective-offer renders the tension statement then the ask byte-exactly — discussion only', () => {
    const file = writePayload(dir, 'p.json', { tension: 'Ship Now ↔ Strategic Timing' });
    assert.strictEqual(renderSurface(dir, 'perspective-offer', { dotpath: 'pay.discussion.checkout', file }), [
      "=== MENU: perspective offer (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'This decision sits on a Ship Now ↔ Strategic Timing tension.',
      '',
      '**`◆ Want to explore both lenses?`**',
      '',
      '**`y/yes`** → Spin up perspective agents arguing each lens',
      '**`n/no`**  → Continue without perspectives',
      '',
    ].join('\n'));
    assert.throws(() => renderSurface(dir, 'perspective-offer', { dotpath: 'pay.research.checkout', file }),
      /render perspective-offer: address must be <work_unit>\.discussion\.<topic>, got phase "research"/);
    assert.throws(() => renderSurface(dir, 'perspective-offer', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'perspective-offer', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, 'q.json', {}) }),
      /"tension" must be a non-empty string/);
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

    // Implementation and planning have hit their end — the arm beside yes is
    // an ask, never a way back.
    const implementation = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.implementation.checkout' });
    assert.strictEqual(implementation, [
      "=== MENU: conclude gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Ready to mark implementation as completed?`**',
      '',
      '**`y/yes`** → Mark as completed',
      "**Ask**   → Ask questions about the implementation (doesn't mark it",
      `${NB(8)}complete)`,
      '',
    ].join('\n'));
    assert.doesNotMatch(implementation, /`n\/no`/);

    const planning = renderSurface(dir, 'conclude-gate', { dotpath: 'pay.planning.checkout' });
    assert.strictEqual(planning, [
      "=== MENU: conclude gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Ready to conclude?`**',
      '',
      '**`y/yes`** → Conclude plan and mark as completed',
      "**Ask**   → Ask questions about the plan (doesn't mark it complete)",
      '',
    ].join('\n'));
    assert.doesNotMatch(planning, /`n\/no`/);
  });

  it('conclude-gate: refuses a phase that concludes some other way', () => {
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.research.checkout' }),
      /phase must be one of discussion, investigation, implementation, planning, got "research"/);
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.planning' }),
      /address must be <work_unit>\.<phase>\.<topic>/);
    assert.throws(() => renderSurface(dir, 'conclude-gate', { dotpath: 'pay.implementation.ghost' }),
      /no implementation item "ghost" — nothing to conclude/);
  });

  it('closing-gate: the discussion close\'s five consents, variant-keyed', () => {
    const reReview = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 're-review' });
    assert.match(reReview, /MENU: re-review gate/);
    assert.match(unwrap(reReview), /The discussion has moved since the last review read it\. One more pass can catch what that movement opened — or conclude without one\./);
    assert.match(reReview, /`◆ Run one more review\?`/);
    assert.match(unwrap(reReview), /\*\*`y\/yes`\*\*\s+→ Run one more review before concluding/);
    assert.match(unwrap(reReview), /\*\*`n\/no`\*\*\s+→ Conclude without it — the movement stays unreviewed/);
    assert.doesNotMatch(unwrap(reReview), /final review/);
    assert.match(unwrap(reReview), /\*\*Keep going\*\* → Tell me what else to explore/);

    const owed = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'findings-owed' });
    assert.match(owed, /MENU: findings-owed gate/);
    assert.match(unwrap(owed), /Background findings have come back and are still to be walked — they must be heard before concluding\./);
    assert.match(owed, /`◆ Walk them now\?`/);
    assert.match(unwrap(owed), /\*\*`y\/yes`\*\*\s+→ Walk what came back/);

    // A review still in flight at the close: yes is the wait, never a
    // fresh dispatch — the surface must not read as "run another".
    const running = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'review-running' });
    assert.match(running, /MENU: review-running gate/);
    assert.match(unwrap(running), /A review is still running over this discussion — what it finds must be heard before concluding\. Nothing new is dispatched\./);
    assert.match(running, /`◆ Wait for it\?`/);
    assert.match(unwrap(running), /\*\*`y\/yes`\*\*\s+→ Wait for it and walk what it finds/);
    assert.doesNotMatch(unwrap(running), /[Rr]un the final review|final review/);
    assert.doesNotMatch(unwrap(running), /`n\/no`|`p\/proceed`/);
    assert.match(unwrap(running), /\*\*Keep going\*\* → Tell me what else to explore/);

    const finalReview = renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'final-review' });
    assert.match(finalReview, /MENU: final-review gate/);
    assert.match(unwrap(finalReview), /Next: a final gap review before concluding — no review has run yet\./);
    assert.match(finalReview, /`◆ Proceed\?`/);
    assert.match(unwrap(finalReview), /\*\*`y\/yes`\*\*\s+→ Run the final review/);

    assert.strictEqual(renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'wrap-up' }), [
      "=== MENU: wrap-up gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      "I'll reconcile the document against our conversation, then confirm before marking complete.",
      '',
      '**`◆ Do you wish to conclude?`**',
      '',
      '**`y/yes`** → Conclude — begin wrap-up',
      '**`n/no`**  → Continue the conversation',
      '',
    ].join('\n'));
  });

  it('closing-gate: refuses out of place — wrong phase, unknown variant, a reason on any variant', () => {
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.research.checkout', variant: 'wrap-up' }),
      /address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs these gates; got phase "research"/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout' }),
      /--variant must be one of re-review, findings-owed, review-running, final-review, wrap-up, got ""/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'conclude' }),
      /--variant must be one of/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'final-review', reason: 'no review has run yet' }),
      /takes no --reason — every variant carries its own wording/);
    assert.throws(() => renderSurface(dir, 'closing-gate', { dotpath: 'pay.discussion.checkout', variant: 'review-running', reason: 'x' }),
      /takes no --reason/);
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

  it('checkpoint-files-gate: the analysis loop\'s static stop', () => {
    const checkpoint = renderSurface(dir, 'checkpoint-files-gate', { dotpath: 'pay.implementation.checkout' });
    assert.match(checkpoint, /MENU: checkpoint files gate/);
    assert.match(checkpoint, /`◆ Include unexpected files in the checkpoint commit\?`/);
    assert.match(unwrap(checkpoint), /\*\*`y\/yes`\*\*\s+→ Include all/);
    assert.match(unwrap(checkpoint), /\*\*`s\/skip`\*\*\s+→ Exclude unexpected files, commit only implementation files/);
    assert.match(unwrap(checkpoint), /\*\*Comment\*\* → Specify which to include/);

    assert.throws(() => renderSurface(dir, 'checkpoint-files-gate', { dotpath: 'pay.planning.checkout' }),
      /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/);
  });

  it('executor-block-gate: a block renders the fork\'s sides recommended-first, a failure offers the retry', () => {
    const sides = writePayload(dir, 'sides.json', {
      options: ['Restore the order as paid, refund behind it', { summary: 'Keep the cancellation, return the payment', recommended: true }],
    });
    assert.strictEqual(renderSurface(dir, 'executor-block-gate', {
      dotpath: 'pay.implementation.checkout', result: 'blocked', file: sides,
    }), [
      "=== MENU: executor block gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which way?`**',
      '',
      '**`1`**       → Keep the cancellation, return the payment (recommended)',
      '**`2`**       → Restore the order as paid, refund behind it',
      "**Comment** → Ask about the options, or tell me what I've missed",
      '',
    ].join('\n'));

    assert.strictEqual(renderSurface(dir, 'executor-block-gate', {
      dotpath: 'pay.implementation.checkout', result: 'failed',
    }), [
      "=== MENU: executor block gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      '**`◆ How would you like to proceed?`**',
      '',
      '**`r/retry`** → Run the executor again with the guidance above and',
      `${NB(10)}anything you add`,
      '**Comment** → Ask about the failure, or steer the next attempt',
      '',
    ].join('\n'));
  });

  it('executor-block-gate: the override line heads a block under auto or bounded, and the payload is validated', () => {
    const sides = writePayload(dir, 'sides.json', { options: ['A side', 'Another side'] });
    for (const mode of ['auto', 'bounded']) {
      writeManifest(dir, 'pay', { phases: { implementation: { items: { checkout: { status: 'in-progress', task_gate_mode: mode } } } } });
      const out = renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: sides });
      assert.ok(out.startsWith([
        "=== MENU: executor block gate (emit verbatim as markdown, then STOP for the user's response) ===",
        DOTS,
        '**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.',
        '',
        '**`◆ Which way?`**',
      ].join('\n')), out);
      assert.match(unwrap(out), /\*\*`1`\*\*\s+→ A side\n\*\*`2`\*\*\s+→ Another side/);
    }
    writeManifest(dir, 'pay', { phases: { implementation: { items: { checkout: { status: 'in-progress', task_gate_mode: 'gated' } } } } });
    assert.ok(!renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: sides }).includes('Auto is on'));

    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked' }),
      /--file <sides\.json> is required with --result blocked/);
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'failed', file: sides }),
      /--file belongs to --result blocked/);
    const one = writePayload(dir, 'one.json', { options: ['Only one'] });
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: one }),
      /"options" must be an array of 2–4 sides/);
    const two = writePayload(dir, 'two.json', { options: [{ summary: 'A', recommended: true }, { summary: 'B', recommended: true }] });
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: two }),
      /at most one option may be recommended/);
    const bare = writePayload(dir, 'bare.json', { options: ['A', { recommended: true }] });
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'blocked', file: bare }),
      /options\[1\] must be a non-empty string or an object carrying "summary"/);
  });

  it('executor-block-gate: refuses a missing or unknown result, and a non-implementation address', () => {
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout' }),
      /--result must be one of blocked, failed, got "undefined"/);
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.implementation.checkout', result: 'needs-changes' }),
      /--result must be one of blocked, failed, got "needs-changes"/);
    assert.throws(() => renderSurface(dir, 'executor-block-gate', { dotpath: 'pay.planning.checkout', result: 'failed' }),
      /address must be <work_unit>\.implementation\.<topic>, got phase "planning"/);
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
      'Project default format is **local-markdown**.',
      '',
      '**`◆ Use the same format?`**',
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
    assert.match(cont, /\*\*`y\/yes`\*\*\s+→ Continue review/);
    assert.match(cont, /\*\*`s\/skip`\*\*\s+→ Skip review, proceed to completion/);

    const reloop = renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout', variant: 'reloop' });
    assert.match(reloop, /MENU: plan review reloop gate/);
    assert.match(reloop, /`◆ Run another review round\?`/);
    assert.match(unwrap(reloop), /\*\*`y\/yes`\*\*\s+→ Run another round \(traceability \+ integrity\)/);
    assert.match(reloop, /\*\*`p\/proceed`\*\*\s+→ Proceed to conclusion/);

    assert.throws(() => renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.planning.checkout' }),
      /--variant must be "continue" or "reloop"/);
    assert.throws(() => renderSurface(dir, 'plan-review-gate', { dotpath: 'pay.discussion.checkout', variant: 'continue' }),
      /address must be <work_unit>\.planning\.<topic>/);
  });

  it('correction-gate: leads with the correction, derives the spec path, and serves completed units only', () => {
    writeManifest(dir, 'done', {
      work_type: 'feature',
      status: 'completed',
      phases: { specification: { items: { done: { status: 'completed' } } } },
    });
    const body = 'The spec says the export runs hourly; `grep -n cron src/export.js` shows nightly. Correct it to nightly.\n';
    const present = writePayload(dir, 'proposed-correction.md', body);
    const out = renderSurface(dir, 'correction-gate', { dotpath: 'done.specification.done', present });
    assert.strictEqual(out, [
      '=== DISPLAY: proposed correction (emit verbatim as markdown) ===',
      '**The correction** — what is wrong, the evidence, and what replaces it',
      '',
      body.trimEnd(),
      '',
      "=== MENU: correction gate (emit verbatim as markdown, then STOP for the user's response) ===",
      DOTS,
      'Correcting .workflows/done/specification/done/specification.md.',
      '',
      '**`◆ Apply the correction protocol?`**',
      '',
      '**`y/yes`**  → Edit in place + corrigendum + knowledge re-index',
      '**`v/view`** → Show the full correction list',
      '**`n/no`**   → Leave the specification as-is',
      '',
    ].join('\n'));

    assert.throws(() => renderSurface(dir, 'correction-gate', { dotpath: 'done.specification.done' }),
      /render correction-gate: --present <correction\.md> is required/);
    assert.throws(() => renderSurface(dir, 'correction-gate', { dotpath: 'pay.specification.checkout', present }),
      /"pay" is "in-progress" — the corrigendum protocol serves completed work units/);
    assert.throws(() => renderSurface(dir, 'correction-gate', { dotpath: 'done.discussion.done', present }),
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
          },
        },
        research: { items: { gamma: { status: 'triaged' }, delta: { status: 'in-progress' } } },
        discussion: { items: { gamma: { status: 'in-progress' } } },
      },
    });
    writeManifest(dir, 'feat', {
      work_type: 'feature',
      phases: { discovery: { items: { feat: { routing: 'research', source: 'discovery' } } } },
    });
  });
  afterEach(() => { teardown(dir); });

  it('a name already on the map answers the blocker pair naming where the topic stands', () => {
    const out = renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.alpha' });
    assert.match(out, /DISPLAY: entry blocker/);
    assert.match(out, /⚑ "Alpha" is already on the map — it is routed to research and nothing has started/);
    assert.match(out, /DISPLAY: blocker guidance[\s\S]*Return to the epic menu — its row for the topic names the next step\./);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.beta' }), /routed to discussion and nothing has started/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.delta' }), /research is in flight on it/);
    // Outstanding research names itself at either door — its row is the topic's own.
    const parked = renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.gamma' });
    assert.match(parked, /⚑ "Gamma" is already on the map — research is parked on it \(triage waiting\)/);
    assert.match(parked, /Return to the epic menu — its research row is the way in\./);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.delta' }), /research is in flight on it[\s\S]*its research row is the way in/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.gamma' }), /research is parked on it \(triage waiting\)[\s\S]*its research row is the way in/);
  });

  it('a marker-only cancelled row points at the reactivate — it carries no menu row to return to', () => {
    for (const phase of ['discussion', 'research']) {
      const out = renderSurface(dir, 'direct-entry-gate', { dotpath: `pay.${phase}.sigma` });
      assert.match(out, /⚑ "Sigma" is already on the map — it is cancelled and stays on the map as record/, phase);
      assert.match(out, /DISPLAY: blocker guidance[\s\S]*Reactivate it from the epic menu \(e\/reactivate\) — a cancelled topic carries no menu row\./, phase);
      assert.ok(!out.includes('Return to the epic menu'), phase);
    }
  });

  it('a fresh discussion-routed topic with a parked stub names the research first at either door', () => {
    writeManifest(dir, 'stub', {
      work_type: 'epic',
      phases: {
        discovery: { items: { eta: { routing: 'discussion', source: 'discovery' } } },
        research: { items: { eta: { status: 'triaged' } } },
      },
    });
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'stub.discussion.eta' }), /research is parked on it \(triage waiting\)[\s\S]*its research row is the way in/);
    assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: 'stub.research.eta' }), /research is parked on it \(triage waiting\)/);
  });

  it('a closed topic names its closure at either door, research reopened beneath it notwithstanding — its empty menu is the closure\'s', () => {
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
        /⚑ "Dead" is already on the map — it is closed as a dead end and stays on the map as record[\s\S]*its row for the topic names the next step\./);
      assert.match(renderSurface(dir, 'direct-entry-gate', { dotpath: `closed.${phase}.gone` }),
        /it is cancelled and stays on the map as record/);
    }
  });

  it('empty for a new name, for a feature, and refuses a phase outside research|discussion', () => {
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.discussion.omega' }), '');
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.research.omega' }), '');
    assert.strictEqual(renderSurface(dir, 'direct-entry-gate', { dotpath: 'feat.discussion.feat' }), '');
    assert.throws(() => renderSurface(dir, 'direct-entry-gate', { dotpath: 'pay.planning.alpha' }), /phase must be research or discussion/);
  });
});
