'use strict';

// ---------------------------------------------------------------------------
// The question on the map an experiment measures (9.1.11,
// leeway-engine/scripts/domain/experiment-question.cjs): the spawn recording
// it and the map showing it waiting, the questions a spawn refuses, and the
// report that reaches as a message the topic that question stands on once it
// has left the spawning topic's open questions, its relative links rebased;
// the topic's decided close held while one of its experiments is out, and
// the spec closing the series to new spawns and owed reports (4.11.2).
//
// Layer: verb. World: experiment-world.cjs's lab with nothing asked, built
// once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { cleanupFixture, commitAll, ok: engine, refusedPristine, lastMessage, statePath, layout, withFrozenClock, fixtureFrom } = require('./engine-harness.cjs');
const { writeManifest, readManifest, setup, problemScratch, SESSION, MADE, walkTo } = require('./experiment-world.cjs');
const { DECIDED_ITEMS } = require('./pipeline-world.cjs');

/** The lab with nothing asked, built once. */
const plainWorld = fixtureFrom('engine-exp-plain-', setup);

describe('the question on the map an experiment measures (9.1.11)', () => {
  let dir;
  beforeEach(() => { dir = plainWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  /** A ledger write at timing's discussion: its short id. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
  function write(verb, flags, content) {
    return engine(dir, ['ledger', verb, 'lab.discussion.timing', ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
  }
  const ask = (/** @type {string} */ text) => write('ask', [], { ...MADE, text });
  /** The person's own answer to `question`. @param {string} question */
  const personDecides = (question) => write('decide', ['--answers', question], { by: 'person', who_moved_whom: 'none', text: 'Top left.', why: 'Where the eye lands.' });
  const map = () => engine(dir, ['ledger', 'map', 'lab', 'timing']).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.waiting_on]);
  /** Spawn E{next} measuring `question`. @param {string} question */
  const measure = (question) => engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement', '--from', 'discussion',
    '--problem', problemScratch(dir, 'window-placement'), '--question', question]);
  const ledgerIds = () => fs.readFileSync(statePath(dir, layout.ledger), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id);

  it('the spawn records the question by its full id, and the map shows it waiting on the experiment', () => {
    const placement = ask('Where does a new window open?');
    const sizing = ask('How big is a new window?');
    const res = measure(placement.slice(0, 4));
    assert.strictEqual(res.question, placement, 'the response names the question by its short id');
    const full = ledgerIds().find((id) => id.startsWith(placement));
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1,
      { slug: 'window-placement', status: 'conceived', question: full });
    assert.deepStrictEqual(map(), [[placement, 'open', { experiment: 'E1', running: true }], [sizing, 'open', null]]);
  });

  it('refuses a question that is no open question of the topic, writing nothing', () => {
    const placement = ask('Where does a new window open?');
    const finding = write('find', [], { ...MADE, text: 'Windows open centred today.', how: 'read the code', known: 'read' });
    const answered = ask('Does a window remember its place?');
    personDecides(answered);
    const cases = [
      ['zzzz', /--question: /],
      [finding, new RegExp(`--question names ${finding}, which is no question`)],
      [answered, new RegExp(`--question names ${answered}, which stands open on no row of "timing"'s map`)],
    ];
    for (const [prefix, refusal] of cases) {
      const args = ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', problemScratch(dir, 'x'), '--question', /** @type {string} */ (prefix)];
      assert.match(refusedPristine(dir, args).error, /** @type {RegExp} */ (refusal));
    }
    assert.deepStrictEqual(map().map(([id, , waiting]) => [id, waiting]), [[placement, null], [answered, null]]);
  });

  it('a concluded experiment keeps its question waiting until the discussion writes the result', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.strictEqual(res.report_sent, undefined, 'an open question takes the report in the discussion, never as a message');
    assert.deepStrictEqual(map(), [[placement, 'open', { experiment: 'E1', running: false }]]);
    write('decide', ['--answers', placement], { ...MADE, text: 'Top left.', why: 'E1 measured it.' });
    assert.deepStrictEqual(map().map(([id, stands, waiting]) => [id, stands, waiting]), [[placement, 'answered', null]]);
  });

  it('a report concluding after the person closed its question reaches the topic as a message, the topic held in progress while it ran', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    const report = '# Report — E1\n\nTop left is found fastest.\n';
    fs.writeFileSync(statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement', 'report.md')), report);
    const res = withFrozenClock(() => engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']));
    const message = statePath(dir, layout.mailbox('lab', 'timing', '001-e1-report.md'));
    assert.deepStrictEqual(res.report_sent, { topic: 'timing', message_path: message, reopened: false, committed: res.report_sent.committed });
    assert.strictEqual(fs.readFileSync(message, 'utf8'), '# Report — E1\nFrom Experiment E1 · 1 Jan\n\nTop left is found fastest.\n', 'the report reaches its own topic as written, from the experiment by its id');
    assert.strictEqual(lastMessage(dir), 'mail(lab): send 001-e1-report.md to timing');
  });

  it('a report whose question the person moved to another topic, and decided there while it ran, reaches that topic as a message, reopening it once decided', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discovery.items.sizing = { summary: 'Window sizing', order: 2 };
    m.phases.discussion.items.sizing = { status: 'in-progress' };
    writeManifest(dir, 'lab', m);
    commitAll(dir, 'sizing');
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    engine(dir, ['ledger', 'move', 'lab.discussion.timing', '--question', placement, '--to', 'sizing'], { env: SESSION, stdin: JSON.stringify({ by: 'person', who_moved_whom: 'none' }) });
    const sizingMap = () => engine(dir, ['ledger', 'map', 'lab', 'sizing']).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.waiting_on]);
    assert.deepStrictEqual(sizingMap(), [[placement, 'open', { experiment: 'E1', running: true }]]);
    engine(dir, ['ledger', 'decide', 'lab.discussion.sizing', '--answers', placement], { env: SESSION, stdin: JSON.stringify({ by: 'person', who_moved_whom: 'none', text: 'Top left.', why: 'Where the eye lands.' }) });
    const decided = readManifest(dir, 'lab');
    decided.phases.discussion.items.sizing.status = 'completed';
    writeManifest(dir, 'lab', decided);
    const record = layout.experiment('lab', 'timing', 'E1-window-placement');
    fs.writeFileSync(statePath(dir, `${record}/report.md`), '# Report — E1\n\nRuns in [the data](data/run.csv).\n');
    const res = withFrozenClock(() => engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']));
    assert.deepStrictEqual(res.report_sent, {
      topic: 'sizing', message_path: statePath(dir, layout.mailbox('lab', 'sizing', '001-e1-report.md')), reopened: true, committed: res.report_sent.committed,
    });
    const back = path.posix.relative(layout.mailbox('lab', 'sizing'), record);
    assert.strictEqual(
      fs.readFileSync(res.report_sent.message_path, 'utf8'), `# Report — E1\nFrom Experiment E1, on Timing · 1 Jan\n\nRuns in [the data](${back}/data/run.csv).\n`,
      'the moved question\'s topic hears from the experiment by the topic whose series holds it, each link rebased from its own mailbox',
    );
    assert.strictEqual(lastMessage(dir), 'mail(lab): send 001-e1-report.md to sizing');
    assert.ok(!fs.existsSync(statePath(dir, layout.mailbox('lab', 'timing'))), 'the topic the question left gets nothing');
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.sizing.status, 'in-progress', 'the decided destination reopens');
    assert.deepStrictEqual(sizingMap(), [[placement, 'answered', null]]);
  });

  it('a report whose question the person moved to the roadmap as later reaches the spawning topic', () => {
    engine(dir, ['roadmap', 'add', 'placement', '--horizon', 'v2', '--summary', 'Window placement']);
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    write('move', ['--question', placement, '--to', 'roadmap:placement'], { by: 'person', who_moved_whom: 'none' });
    fs.writeFileSync(statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement', 'report.md')), '# Report — E1\n');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.deepStrictEqual([res.report_sent.topic, res.report_sent.message_path], ['timing', statePath(dir, layout.mailbox('lab', 'timing', '001-e1-report.md'))]);
  });

  it('the report sent as a message has each relative link rebased to resolve from the mailbox, every other link and fenced code as written', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    const record = layout.experiment('lab', 'timing', 'E1-window-placement');
    fs.mkdirSync(statePath(dir, `${record}/data`), { recursive: true });
    fs.writeFileSync(statePath(dir, `${record}/data/run.csv`), 'ms\n4\n');
    fs.writeFileSync(statePath(dir, `${record}/report.md`), [
      '# Report — E1', '',
      'Runs in [the data](data/run.csv#L2) and ![the chart](./data/run.csv "timings"), as [the problem](<problem.md>) set.',
      'See [the docs](https://example.com/a.md), [above](#method) and [the root](/abs/path.md).',
      '[raw]: data/run.csv',
      '```', '[kept](data/run.csv)', '```', '',
    ].join('\n'));
    const res = withFrozenClock(() => engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']));
    const back = path.posix.relative(layout.mailbox('lab', 'timing'), record);
    assert.strictEqual(fs.readFileSync(res.report_sent.message_path, 'utf8'), [
      '# Report — E1', 'From Experiment E1 · 1 Jan', '',
      `Runs in [the data](${back}/data/run.csv#L2) and ![the chart](${back}/data/run.csv "timings"), as [the problem](<${back}/problem.md>) set.`,
      'See [the docs](https://example.com/a.md), [above](#method) and [the root](/abs/path.md).',
      `[raw]: ${back}/data/run.csv`,
      '```', '[kept](data/run.csv)', '```', '',
    ].join('\n'));
    assert.ok(fs.existsSync(path.resolve(path.dirname(res.report_sent.message_path), `${back}/data/run.csv`)), 'a rebased link resolves to the file it named');
  });

  it('a report owed as a message and not written refuses the conclusion, writing nothing', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    const res = refusedPristine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.match(res.error, /experiment E1 \("timing"\) has no report\.md — its question left the topic's open questions while it ran, so the report reaches "timing" as a message/);
  });

  it('a report owed as a message past the unit\'s spec refuses the conclusion before it writes anything, so no report is lost (4.11.2)', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    fs.writeFileSync(statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement', 'report.md')), '# Report — E1\n\nTop left.\n');
    fs.writeFileSync(statePath(dir, layout.unit('lab', 'spec.md')), '# Lab\n');
    const res = refusedPristine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.strictEqual(res.error, 'experiment E1 ("timing") owes its report to "timing" as a message, and lab has its spec — a topic exists only before it: abandon the experiment, and settle what it found in the spec');
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1.status, 'running');
  });

  it('an epic topic\'s decided close is refused while an experiment of its own is out, conceived or further, naming the abandon that frees one no one will run, and taken once each has ended (11.2.1)', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    personDecides(placement);
    for (const item of DECIDED_ITEMS) engine(dir, ['checklist', 'done', 'decided', 'lab', 'timing', item], { env: SESSION });
    const close = ['checklist', 'close', 'decided', 'lab', 'timing'];
    assert.strictEqual(refusedPristine(dir, close, { env: SESSION }).error,
      'checklist close: timing\'s experiment E1 is still out — the topic closes once each has concluded or been abandoned, and its report is read; one no one will run is abandoned: engine experiment abandon lab timing E1 --reason "<one line>"');
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'the person decided it']);
    engine(dir, close, { env: SESSION });
    assert.strictEqual(typeof readManifest(dir, 'lab').checklists.decided.timing.closed, 'string');
  });

  it('refuses a spawn from a discussion past its unit\'s spec, writing nothing: a topic exists only before it (4.11.2)', () => {
    const placement = ask('Where does a new window open?');
    fs.writeFileSync(statePath(dir, layout.unit('lab', 'spec.md')), '# Lab\n');
    const args = ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement', '--from', 'discussion', '--problem', problemScratch(dir, 'window-placement'), '--question', placement];
    assert.match(refusedPristine(dir, args).error, /^lab has its spec — a topic exists only before it, and a change is settled in the spec from here$/);
  });
});
