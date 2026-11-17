'use strict';

// Layer: verb.

require('./hermetic-env.cjs');

// `engine handoff` — every move into work named by one engine call. The
// table holds each skill a handoff lands on and the arguments it takes; the
// engine composes the continuation and the line naming where the work goes,
// and answers which way the work travels: the gate mod carries it where the
// session announced handoff support, the session invokes it in place where it
// did not. Two forms name no skill: a topic by its unit and name, and a
// unit alone, the start menu's Continue, where it stands.

const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { output, refuses } = require('./engine-harness.cjs');
const { setupFixture, cleanupFixture, createManifest, createFile, readManifest, writeState, layout } = require('./discovery-test-utils.cjs');
const { auditMarkers } = require('./gate-audit.cjs');
const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES } = require('../../skills/ledger-engine/scripts/kernel/manifest-schema.cjs');
const { HANDOFF_TARGETS } = require('../../skills/ledger-engine/scripts/domain/handoff.cjs');

const ANNOUNCED = { LEDGER_HANDOFF: '1' };

const DATA_MARKER = '=== DATA (reason from this — never display or parse the sections below) ===';
const DISPLAY_MARKER = '=== DISPLAY: handoff (emit verbatim as a text code block (```text fence) — do not stop; continue as the skill instructs) ===';
const HANDOFF_MARKER = '=== HANDOFF (json for the gate mod — never display) ===';

// The skill each phase runs in — the one a handoff into the phase lands on —
// but a quick-fix's implementation, which runs in the quick-fix's own skill.
/** @type {Record<string, string>} */
const PHASE_SKILLS = {
  experiment: 'ledger-experiment-process',
  discussion: 'ledger-discussion-process',
  investigation: 'ledger-investigation-process',
  specification: 'ledger-specification-process',
  implementation: 'ledger-implementation-process',
  review: 'ledger-review-process',
};
const QUICK_FIX_SKILL = 'ledger-quick-fix-process';

/** The skill a unit of `type` is handed into `phase` through. @param {string} phase @param {string} type */
const skillOf = (phase, type) => (type === 'quick-fix' && phase === 'implementation' ? QUICK_FIX_SKILL : PHASE_SKILLS[phase]);

// The phases entered at the work unit: the spec, and the build's two places.
const AT_UNIT = ['specification', 'implementation', 'review'];

const IDEA = '.ledger/.inbox/ideas/2026-01-01--dark-mode.md';
const BUG = '.ledger/.inbox/bugs/2026-01-02--flaky-login.md';

/** The answer unannounced, as the session carrying the work itself reads it. @param {string} dir @param {string[]} args */
const inline = (dir, args) => output(dir, ['handoff', ...args]);

/** The answer under the gate mod's announcement. @param {string} dir @param {string[]} args */
const carried = (dir, args) => output(dir, ['handoff', ...args], { env: ANNOUNCED });

/** The refusal's message. @param {string} dir @param {string[]} args @param {RegExp} pattern */
function refused(dir, args, pattern) {
  const { error } = refuses(dir, ['handoff', ...args]);
  assert.match(error, pattern);
}

/** The HANDOFF payload an announced answer carries. @param {string} out */
function payloadOf(out) {
  const lines = out.split('\n');
  const at = lines.indexOf(HANDOFF_MARKER);
  assert.notStrictEqual(at, -1, `no HANDOFF section in:\n${out}`);
  return JSON.parse(lines[at + 1]);
}

/**
 * The answer unannounced, expected whole: the session reads which way the
 * work goes and the skill to invoke, and shows the line.
 * @param {string} skill @param {string} args @param {string} line
 */
function inlineAnswer(skill, args, line) {
  return [
    DATA_MARKER,
    'handoff: inline',
    `skill: ${skill}`,
    `args: ${args}`,
    DISPLAY_MARKER,
    line,
    '',
  ].join('\n');
}

/** A project with a feature, an epic, two live inbox items, and roadmap items waiting — an idea and a bug — beside one the epic took. */
function seed() {
  const dir = setupFixture();
  createManifest(dir, 'note-window', { work_type: 'feature' });
  createManifest(dir, 'fumi', { work_type: 'epic' });
  createFile(dir, IDEA, '# Dark mode\n');
  createFile(dir, BUG, '# Flaky login\n');
  const project = readManifest(dir, '.');
  const item = (summary) => ({ horizon: 'next', summary, kind: 'idea', origin: 'harvest' });
  project.roadmap = { horizons: ['next'], items: { loyalty: item('Loyalty points'), 'colour-drift': { ...item('Tag colours drift'), kind: 'bug' }, 'white-label': { ...item('White label'), pulled_to: { work_unit: 'fumi' } } } };
  writeState(dir, layout.manifest('.'), `${JSON.stringify(project, null, 2)}\n`);
  return dir;
}

describe('engine handoff — the composed answer for every target', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  it('discovery for new work names no work unit — the line reads Discovery alone', () => {
    assert.strictEqual(inline(dir, ['ledger-discovery', 'feature', 'none']),
      inlineAnswer('ledger-discovery', 'feature none', '→ Discovery'));
  });

  it('discovery into an existing epic names the epic', () => {
    assert.strictEqual(inline(dir, ['ledger-discovery', 'epic', 'fumi']),
      inlineAnswer('ledger-discovery', 'epic fumi', '→ Discovery · fumi'));
  });

  it('inbox seeds travel quoted, as discovery reads them — one path, several, or none', () => {
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discovery', 'feature', 'none', IDEA])).args,
      `feature none "${IDEA}"`);
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discovery', 'none', 'none', `${IDEA},${BUG}`])).text,
      `Invoke \`/ledger-discovery none none "${IDEA},${BUG}"\`.`);
    assert.strictEqual(inline(dir, ['ledger-discovery', 'none', 'none', 'none']),
      inlineAnswer('ledger-discovery', 'none none "none"', '→ Discovery'));
  });

  it('a start with no kind of work yet is told apart from the product\'s conversation (8.2.9), and a pull\'s waiting roadmap items seed new work beside inbox items (8.1.8)', () => {
    assert.strictEqual(inline(dir, ['ledger-discovery', 'start', 'none', 'none']),
      inlineAnswer('ledger-discovery', 'start none "none"', '→ Discovery'));
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discovery', 'start', 'none', `roadmap:loyalty,${IDEA}`])).text,
      `Invoke \`/ledger-discovery start none "roadmap:loyalty,${IDEA}"\`.`);
  });

  it('a seed path holding a space survives its quotes', () => {
    const spaced = '.ledger/.inbox/ideas/2026-01-03--night mode.md';
    createFile(dir, spaced, '# Night mode\n');
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discovery', 'feature', 'none', spaced])).args,
      `feature none "${spaced}"`);
  });

  it('the start opens on its menu, named bare — where finish hands every unit but an epic once it is done (24.1.2)', () => {
    assert.strictEqual(inline(dir, ['ledger']), inlineAnswer('ledger', '', '→ Start'));
    assert.deepStrictEqual(payloadOf(carried(dir, ['/ledger'])), { skill: 'ledger', args: '', text: 'Invoke `/ledger`.', line: '→ Start' });
  });

  it('the roadmap opens on its home, named bare', () => {
    assert.strictEqual(inline(dir, ['ledger-roadmap']), inlineAnswer('ledger-roadmap', '', '→ Roadmap'));
  });

  it('the epic menu names the epic alone', () => {
    assert.strictEqual(inline(dir, ['ledger-continue-epic', 'fumi']),
      inlineAnswer('ledger-continue-epic', 'fumi', '→ Epic · fumi'));
  });

  it('14.6.2, 18.4.23: the epic menu takes an epic finish completed, by its name alone — its menu the complete variant', () => {
    createManifest(dir, 'done-epic', { work_type: 'epic', status: 'completed' });
    assert.strictEqual(inline(dir, ['ledger-continue-epic', 'done-epic']),
      inlineAnswer('ledger-continue-epic', 'done-epic', '→ Epic · done-epic'));
  });

  it('discovery into an existing epic takes the work type epic or none, and a waiting roadmap idea to join it as a topic (18.8.4)', () => {
    assert.strictEqual(inline(dir, ['ledger-discovery', 'none', 'fumi']),
      inlineAnswer('ledger-discovery', 'none fumi', '→ Discovery · fumi'));
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discovery', 'none', 'fumi', 'none'])).args, 'none fumi "none"');
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discovery', 'none', 'fumi', 'roadmap:loyalty'])).text, 'Invoke `/ledger-discovery none fumi "roadmap:loyalty"`.');
  });

  it('the skill each phase is entered through takes each work type its pipeline holds — the line names the phase and the topic, else the unit; the spec and the build\'s two places, entered at the unit, an epic\'s with no topic, and refusing a topic (4.11.2)', () => {
    for (const type of VALID_WORK_TYPES) {
      const unit = `${type}-unit`;
      createManifest(dir, unit, { work_type: type });
      for (const phase of WORK_TYPE_PIPELINES[type]) {
        const skill = skillOf(phase, type);
        const name = phase.charAt(0).toUpperCase() + phase.slice(1);
        const atUnit = AT_UNIT.includes(phase);
        if (type !== 'epic' || atUnit) {
          assert.strictEqual(inline(dir, [skill, type, unit]),
            inlineAnswer(skill, `${type} ${unit}`, `→ ${name} · ${unit}`), `${skill} ${type}`);
        }
        if (atUnit) {
          refused(dir, [skill, type, unit, 'checkout'], new RegExp(`^Usage: engine handoff ${skill} <[^>]+> <work-unit>$`));
        } else {
          assert.strictEqual(inline(dir, [skill, type, unit, 'checkout']),
            inlineAnswer(skill, `${type} ${unit} checkout`, `→ ${name} · checkout`), `${skill} ${type} with a topic`);
        }
      }
    }
  });

  it('a topic the work unit does not hold yet is named all the same — the phase starts it', () => {
    assert.strictEqual(payloadOf(carried(dir, ['ledger-discussion-process', 'epic', 'fumi', 'payments'])).line,
      '→ Discussion · payments');
  });

  it('the skill named as its slash command — a menu\'s stored route as it stands — answers as the bare name does', () => {
    assert.strictEqual(inline(dir, ['/ledger-roadmap']), inline(dir, ['ledger-roadmap']));
    assert.strictEqual(carried(dir, ['/ledger-continue-epic', 'fumi']), carried(dir, ['ledger-continue-epic', 'fumi']));
  });

  it('the table holds the targets a move into work lands on — and the skill each phase is entered through', () => {
    assert.deepStrictEqual(Object.keys(PHASE_SKILLS).sort(), [...new Set(Object.values(WORK_TYPE_PIPELINES).flat())].sort());
    assert.deepStrictEqual([...HANDOFF_TARGETS].sort(),
      ['ledger', 'ledger-continue-epic', 'ledger-discovery', 'ledger-roadmap', ...Object.values(PHASE_SKILLS), QUICK_FIX_SKILL].sort());
  });

  it('every target is a skill on disk — a handoff never names one that is not there', () => {
    for (const skill of HANDOFF_TARGETS) {
      assert.ok(fs.existsSync(path.join(__dirname, '../../skills', skill, 'SKILL.md')), skill);
    }
  });

  it('the display names its form — the line is shown as the session emits it', () => {
    auditMarkers(inline(dir, ['ledger-discussion-process', 'feature', 'note-window']), 'handoff');
    auditMarkers(carried(dir, ['ledger-discussion-process', 'feature', 'note-window']), 'handoff, announced');
  });
});

describe('engine handoff — announced and unannounced', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  const ARGS = ['ledger-discussion-process', 'feature', 'note-window'];

  it('announced, the mod carries the work: DATA says so, and the payload holds the skill, its arguments, the continuation and the line', () => {
    const out = carried(dir, ARGS);
    assert.match(out, /^handoff: mod$/m);
    assert.deepStrictEqual(payloadOf(out), {
      skill: 'ledger-discussion-process',
      args: 'feature note-window',
      text: 'Invoke `/ledger-discussion-process feature note-window`.',
      line: '→ Discussion · note-window',
    });
  });

  it('announced, the answer is the unannounced one with the mod named and its payload last', () => {
    const plain = inline(dir, ARGS);
    const out = carried(dir, ARGS);
    const [answer, payload] = out.split(HANDOFF_MARKER + '\n');
    assert.strictEqual(answer, plain.replace('handoff: inline', 'handoff: mod'));
    assert.strictEqual(payload.split('\n').filter(Boolean).length, 1, 'the payload is one line of JSON');
  });

  it('unannounced, nothing is for the mod — the session invokes the skill in place', () => {
    const out = inline(dir, ARGS);
    assert.match(out, /^handoff: inline$/m);
    assert.ok(!out.includes(HANDOFF_MARKER), out);
  });

  it('only the value 1 announces', () => {
    const plain = inline(dir, ARGS);
    for (const value of ['0', 'true', '', 'yes']) {
      assert.strictEqual(output(dir, ['handoff', ...ARGS], { env: { LEDGER_HANDOFF: value } }), plain, `LEDGER_HANDOFF=${value}`);
    }
  });

  it('the gate surface announces gates, never the handoff — the two are independent', () => {
    const plain = inline(dir, ARGS);
    assert.strictEqual(output(dir, ['handoff', ...ARGS], { env: { LEDGER_GATE_SURFACE: '1' } }), plain);
    assert.match(output(dir, ['handoff', ...ARGS], { env: { LEDGER_GATE_SURFACE: '1', ...ANNOUNCED } }), /^handoff: mod$/m);
  });
});

describe('engine handoff topic — a topic opened by its unit and name, as /ledger {unit} {topic} opens it (10.3.1, 10.S2)', () => {
  let dir;
  /** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
  const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...marks });
  beforeEach(() => {
    dir = seed();
    createManifest(dir, 'fumi', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            commercialization: row(1), sync: row(2), export: row(3), removal: row(4, { cancelled: true }),
            widgets: row(5, { postponed: true }),
          },
        },
        discussion: { items: { sync: { status: 'completed' }, removal: { status: 'cancelled' }, widgets: { status: 'postponed' } } },
      },
    });
  });
  afterEach(() => cleanupFixture(dir));

  it('hands off into the conversation the topic is talked through, as the menus\' route does, the work type read from the unit — an epic\'s topic or a feature\'s own in discussion, a bugfix\'s in investigation', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix' });
    assert.strictEqual(carried(dir, ['topic', 'fumi', 'commercialization']), carried(dir, ['/ledger-discussion-process', 'epic', 'fumi', 'commercialization']));
    assert.strictEqual(inline(dir, ['topic', 'note-window', 'note-window']), inlineAnswer('ledger-discussion-process', 'feature note-window note-window', '→ Discussion · note-window'));
    assert.strictEqual(inline(dir, ['topic', 'crash', 'crash']), inlineAnswer('ledger-investigation-process', 'bugfix crash crash', '→ Investigation · crash'));
  });

  it('refuses a call of another shape, and a quick-fix, which has no topics to open, in words a person reads', () => {
    createManifest(dir, 'typo', { work_type: 'quick-fix' });
    refused(dir, ['topic', 'fumi'], /^Usage: engine handoff topic <work-unit> <topic>$/);
    refused(dir, ['topic', 'typo', 'typo'], /^typo is a quick-fix, with no topics to open by name — it carries on from the start menu$/);
  });

  it('refuses, before anything travels, what the topic\'s entry refuses, by its rule: a unit the project lacks, one cancelled or completed, one past its spec, a topic the unit lacks, and one cancelled, postponed or decided', () => {
    createManifest(dir, 'retired', { status: 'cancelled' });
    createManifest(dir, 'shipped', { status: 'completed' });
    createManifest(dir, 'specced');
    createFile(dir, '.ledger/specced/spec.md', '# Spec\n');
    const cases = [
      [['nowhere', 'any'], 'there is no work unit "nowhere" — the start menu lists the work in progress'],
      [['retired', 'retired'], 'retired is cancelled — reactivating it comes first'],
      [['shipped', 'shipped'], 'shipped is completed — new work starts from the start menu'],
      [['specced', 'specced'], 'specced has its spec — a topic exists only before it, and a change is settled in the spec from here'],
      [['fumi', 'comercialization'], 'fumi has no topic "comercialization" — the epic\'s map holds its topics, and a new one comes through its discovery'],
      [['fumi', 'removal'], 'the topic "removal" is cancelled — reactivating it goes through the epic menu\'s discovery row'],
      [['fumi', 'widgets'], 'the topic "widgets" is postponed, and its roadmap item has gone to another epic — it stays postponed here, with no way back'],
      [['fumi', 'sync'], 'the topic "sync" is decided — it reopens through a message sent to it, or through the epic menu\'s discovery row'],
    ];
    assert.deepStrictEqual(cases.map(([args]) => refuses(dir, ['handoff', 'topic', ...args]).error), cases.map(([, error]) => error));
  });

  it('refuses a bugfix\'s topic once its investigation is concluded, the way its menu goes, and hands off into it again once a message reopens it', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'completed' } } } } });
    refused(dir, ['topic', 'crash', 'crash'], /^the topic "crash" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it$/);
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    assert.strictEqual(inline(dir, ['topic', 'crash', 'crash']), inlineAnswer('ledger-investigation-process', 'bugfix crash crash', '→ Investigation · crash'));
  });

  it('refuses a bugfix\'s topic once its spec is written, the investigation behind it', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix' });
    createFile(dir, '.ledger/crash/spec.md', '# Spec\n');
    refused(dir, ['topic', 'crash', 'crash'], /^crash has its spec — a topic exists only before it/);
  });
});

describe('engine handoff unit — Continue, into the unit where it stands (19.1.3, E6)', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  const PHASE = Object.freeze({ name: 'One', sections: [], scenarios: [], relies_on: [] });
  const CLOSED = Object.freeze({ items: {}, closed: '2026-01-01T00:00:00Z' });
  /** A unit's one topic, at a status, in a phase. @param {string} phase @param {string} unit @param {string} status */
  const item = (phase, unit, status) => ({ [phase]: { items: { [unit]: { status } } } });

  it('19.S2, 19.S3: a feature mid-discussion goes straight into its discussion, a bugfix into its investigation, a quick-fix into its own session, and a unit in its spec, its build or its review into that phase — no menu between', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix' });
    createManifest(dir, 'typo', { work_type: 'quick-fix' });
    createManifest(dir, 'specced', { phases: item('discussion', 'specced', 'completed') });
    createFile(dir, '.ledger/specced/spec.md', '# Spec\n');
    createManifest(dir, 'building', { phases: item('discussion', 'building', 'completed'), build: { position: 'auto' }, cut: { phases: [PHASE] } });
    createManifest(dir, 'reviewing', {
      work_type: 'bugfix', phases: item('investigation', 'reviewing', 'completed'), build: { position: 'auto' }, cut: { phases: [PHASE] },
      checklists: { 'phase-1-start': CLOSED, 'phase-1-close': CLOSED },
    });
    const answers = ['note-window', 'crash', 'typo', 'specced', 'building', 'reviewing'].map((unit) => inline(dir, ['unit', unit]));

    assert.deepStrictEqual(answers, [
      inlineAnswer('ledger-discussion-process', 'feature note-window', '→ Discussion · note-window'),
      inlineAnswer('ledger-investigation-process', 'bugfix crash', '→ Investigation · crash'),
      inlineAnswer('ledger-quick-fix-process', 'quick-fix typo', '→ Implementation · typo'),
      inlineAnswer('ledger-specification-process', 'feature specced', '→ Specification · specced'),
      inlineAnswer('ledger-implementation-process', 'feature building', '→ Implementation · building'),
      inlineAnswer('ledger-review-process', 'bugfix reviewing', '→ Review · reviewing'),
    ]);
  });

  it('an epic goes onto its menu, carried as the menu\'s own handoff is', () => {
    assert.strictEqual(carried(dir, ['unit', 'fumi']), carried(dir, ['ledger-continue-epic', 'fumi']));
  });

  it('24.S18, P8: a feature whose discussion put an experiment off for later goes to the laboratory while it waits unrun, and back into its discussion once it is concluded or abandoned', () => {
    const series = (status) => ({ ...item('discussion', 'note-window', 'in-progress'), experiment: { items: { 'note-window': { status: 'in-progress', experiments: { E1: { status, slug: 'speed' } } } } } });
    createManifest(dir, 'note-window', { phases: series('conceived') });
    const waiting = inline(dir, ['unit', 'note-window']);
    createManifest(dir, 'note-window', { phases: series('abandoned') });

    assert.deepStrictEqual([waiting, inline(dir, ['unit', 'note-window'])], [
      inlineAnswer('ledger-experiment-process', 'feature note-window note-window', '→ Experiment · note-window'),
      inlineAnswer('ledger-discussion-process', 'feature note-window', '→ Discussion · note-window'),
    ]);
  });

  it('refuses another shape, a unit the project lacks, and a closed one — seen through the view, brought back through manage', () => {
    createManifest(dir, 'shipped', { status: 'completed' });
    createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
    const cases = [
      [[], 'Usage: engine handoff unit <work-unit>'],
      [['fumi', 'extra'], 'Usage: engine handoff unit <work-unit>'],
      [['nowhere'], 'there is no work unit "nowhere" — the start menu lists the work in progress'],
      [['shipped'], 'shipped is completed — closed work is seen through the start menu\'s view, and brought back through manage'],
      [['dropped'], 'dropped is cancelled — closed work is seen through the start menu\'s view, and brought back through manage'],
    ];
    assert.deepStrictEqual(cases.map(([args]) => refuses(dir, ['handoff', 'unit', ...args]).error), cases.map(([, error]) => error));
  });
});

describe('engine handoff — refusals', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  it('a call naming no skill refuses with the usage', () => {
    refused(dir, [], /^Usage: engine handoff <skill\|\/skill> \[args …\], engine handoff topic <work-unit> <topic>, or engine handoff unit <work-unit>$/);
  });

  it('a skill no move into work lands on refuses, naming the targets — scoping among them, no pipeline holding it (19.5.5)', () => {
    for (const skill of ['ledger-help', 'ledger-bridge', 'ledger-research-process', 'ledger-scoping-process', 'ledger-log-idea', 'ledger-nonsense']) {
      refused(dir, [skill], new RegExp(`^"${skill}" is not a handoff target — a handoff moves into work: ledger-discovery, `));
    }
  });

  it('the wrong number of arguments refuses with that target\'s usage', () => {
    const cases = [
      [['ledger-discovery', 'feature'], /^Usage: engine handoff ledger-discovery <work-type\|start\|none> <none\|epic> \[<seeds\|none>\]$/],
      [['ledger-discovery', 'feature', 'none', 'none', 'extra'], /^Usage: engine handoff ledger-discovery /],
      [['ledger', 'fumi'], /^Usage: engine handoff ledger$/],
      [['ledger-roadmap', 'open'], /^Usage: engine handoff ledger-roadmap$/],
      [['ledger-continue-epic'], /^Usage: engine handoff ledger-continue-epic <epic>$/],
      [['ledger-continue-epic', 'fumi', 'discussion', 'completed'], /^Usage: engine handoff ledger-continue-epic <epic>$/],
      [['ledger-discussion-process', 'feature'], /^Usage: engine handoff ledger-discussion-process <epic\|feature> <work-unit> \[<topic>\]$/],
      [['ledger-quick-fix-process', 'quick-fix', 'a', 'b'], /^Usage: engine handoff ledger-quick-fix-process <quick-fix> <work-unit>$/],
      [['ledger-implementation-process', 'epic'], /^Usage: engine handoff ledger-implementation-process <epic\|feature\|bugfix> <work-unit>$/],
    ];
    for (const [args, pattern] of cases) refused(dir, args, pattern);
  });

  it('discovery refuses a pre-seed outside the work types, cross-cutting among them (19.S1), and a work unit that is no epic the project holds', () => {
    refused(dir, ['ledger-discovery', 'cross-cutting', 'none'], /^the work type must be one of epic\|feature\|bugfix\|quick-fix\|start\|none — got "cross-cutting"$/);
    refused(dir, ['ledger-discovery', 'epic', 'note-window'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['ledger-discovery', 'epic', 'ghost'], /^work unit "ghost" not found$/);
  });

  it('discovery into an existing epic refuses, before anything travels, a work type that would start new work, an inbox item, a bug or a quick-fix item, and an epic past its spec, in the pull\'s words', () => {
    for (const type of [...VALID_WORK_TYPES.filter((t) => t !== 'epic'), 'start']) {
      refused(dir, ['ledger-discovery', type, 'fumi'], new RegExp(`^the work type into an existing epic must be one of epic\\|none — got "${type}"$`));
    }
    refused(dir, ['ledger-discovery', 'none', 'fumi', IDEA], /^an inbox item starts new work, never joins an existing epic — only a waiting roadmap idea joins "fumi": got "\.ledger\/\.inbox\/ideas\/2026-01-01--dark-mode\.md"$/);
    refused(dir, ['ledger-discovery', 'none', 'fumi', 'roadmap:white-label'], /^roadmap item "white-label" is joined to work unit "fumi" already/);
    refused(dir, ['ledger-discovery', 'none', 'fumi', 'roadmap:colour-drift'], /^roadmap item "colour-drift" is a bug — only an idea joins an epic; a bug or a quick-fix starts work of its own, through w on the roadmap$/);
    createFile(dir, '.ledger/fumi/spec.md', '# Fumi\n');
    refused(dir, ['ledger-discovery', 'none', 'fumi', 'roadmap:loyalty'], /^fumi has its spec, so its map is closed — the item stays on the roadmap: pull it into an epic still before its spec, or start it as work of its own$/);
  });

  it('discovery refuses seeds that are not live inbox items on disk, named once each', () => {
    refused(dir, ['ledger-discovery', 'feature', 'none', '.ledger/.inbox/ideas/2026-01-09--ghost.md'], /inbox file not found/);
    refused(dir, ['ledger-discovery', 'feature', 'none', '.ledger/.inbox/.archived/ideas/x.md'], /not a live inbox path/);
    refused(dir, ['ledger-discovery', 'feature', 'none', 'README.md'], /not a live inbox path/);
    refused(dir, ['ledger-discovery', 'feature', 'none', `${IDEA},${IDEA}`], /duplicate inbox path/);
    refused(dir, ['ledger-discovery', 'feature', 'none', `${IDEA},`], /not a live inbox path/);
  });

  it('discovery refuses a roadmap seed that is no waiting item on the roadmap, or is named twice', () => {
    refused(dir, ['ledger-discovery', 'start', 'none', 'roadmap:ghost'], /^the roadmap has no item "ghost" to seed the work$/);
    refused(dir, ['ledger-discovery', 'start', 'none', 'roadmap:white-label'], /^roadmap item "white-label" is joined to work unit "fumi" already — only a waiting item seeds new work$/);
    refused(dir, ['ledger-discovery', 'start', 'none', 'roadmap:loyalty,roadmap:loyalty'], /^roadmap item "loyalty" is named twice$/);
    refused(dir, ['ledger-discovery', 'start', 'none', 'roadmap:'], /^the roadmap has no item "" to seed the work$/);
  });

  it('a seed path holding a double quote refuses — it would end the quotes discovery reads it inside', () => {
    const quoted = '.ledger/.inbox/ideas/2026-01-04--a "b".md';
    createFile(dir, quoted, '# Quoted\n');
    refused(dir, ['ledger-discovery', 'feature', 'none', quoted], /^seeds travel quoted — a seed cannot hold a double quote/);
  });

  it('the epic menu refuses a unit that is no epic, a completed feature among them, and one the project lacks', () => {
    createManifest(dir, 'done-feature', { work_type: 'feature', status: 'completed' });
    refused(dir, ['ledger-continue-epic', 'note-window'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['ledger-continue-epic', 'done-feature'], /^work unit "done-feature" is of type feature, not epic$/);
    refused(dir, ['ledger-continue-epic', 'none'], /^work unit "none" not found$/);
  });

  it('every epic phase entered at a topic refuses the epic alone — the epic menu names the topic before it hands off', () => {
    for (const phase of WORK_TYPE_PIPELINES.epic.filter((each) => !AT_UNIT.includes(each))) {
      refused(dir, [PHASE_SKILLS[phase], 'epic', 'fumi'], new RegExp(`^an epic enters ${phase} at a topic$`));
    }
  });

  it('a phase\'s skill refuses a work type its pipeline does not hold — the build\'s a quick-fix, whose implementation runs in its own skill', () => {
    for (const type of VALID_WORK_TYPES) {
      createManifest(dir, `${type}-unit`, { work_type: type });
      const served = new Set(WORK_TYPE_PIPELINES[type].map((phase) => skillOf(phase, type)));
      for (const skill of [...Object.values(PHASE_SKILLS), QUICK_FIX_SKILL]) {
        if (served.has(skill)) continue;
        refused(dir, [skill, type, `${type}-unit`], new RegExp(`^the work type must be .* — got "${type}"$`));
      }
    }
    refused(dir, ['ledger-discussion-process', 'saga', 'note-window'], /^the work type must be one of epic\|feature — got "saga"$/);
  });

  it('a phase\'s skill refuses a work unit the project does not hold, or holds as another type', () => {
    refused(dir, ['ledger-discussion-process', 'feature', 'ghost'], /^work unit "ghost" not found$/);
    refused(dir, ['ledger-discussion-process', 'epic', 'note-window', 'auth'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['ledger-discussion-process', 'feature', 'none'], /^work unit "none" not found$/);
  });

  it('a work unit whose manifest does not parse refuses as corrupt, never as a unit not found', () => {
    createFile(dir, '.ledger/broken/manifest.json', '{not json');
    refused(dir, ['ledger-discussion-process', 'feature', 'broken'], /^invalid JSON in .*\/\.ledger\/broken\/manifest\.json: /);
    refused(dir, ['ledger-continue-epic', 'broken'], /^invalid JSON in /);
  });

  it('a work unit no longer in progress refuses — a handoff moves into work in progress', () => {
    createManifest(dir, 'shipped', { work_type: 'feature', status: 'completed' });
    createManifest(dir, 'dropped', { work_type: 'epic', status: 'cancelled' });
    refused(dir, ['ledger-review-process', 'feature', 'shipped'], /^work unit "shipped" is completed — a handoff moves into work in progress$/);
    refused(dir, ['ledger-continue-epic', 'dropped'], /^work unit "dropped" is cancelled — a handoff moves into work in progress$/);
  });

  it('a name that would break addressing refuses before anything is read', () => {
    refused(dir, ['ledger-discussion-process', 'feature', '../note-window'], /^"\.\.\/note-window" is not a legal work unit name/);
    refused(dir, ['ledger-discussion-process', 'epic', 'fumi', 'pay.ments'], /^"pay\.ments" is not a legal topic name/);
    refused(dir, ['ledger-discussion-process', 'epic', 'fumi', 'pay/ments'], /^"pay\/ments" is not a legal topic name/);
    refused(dir, ['ledger-discussion-process', 'epic', 'fumi', ''], /^"" is not a legal topic name/);
  });

  it('an argument that whitespace or a quote would split refuses — the invocation could not carry it', () => {
    for (const arg of ['note window', 'note\twindow', 'it\'s', 'say"so']) {
      refused(dir, ['ledger-discussion-process', 'epic', 'fumi', arg], /cannot travel as one argument — whitespace and quotes split it$/);
    }
  });

  it('an argument holding a backtick refuses, the quoted seeds included — it would end the continuation\'s code span', () => {
    refused(dir, ['ledger-discussion-process', 'epic', 'fumi', '`x`'], /^"`x`" cannot travel in the continuation — a backtick ends its code span$/);
    const ticked = '.ledger/.inbox/ideas/2026-01-05--a`b.md';
    createFile(dir, ticked, '# Ticked\n');
    refused(dir, ['ledger-discovery', 'feature', 'none', ticked], /cannot travel in the continuation — a backtick ends its code span$/);
  });
});
