'use strict';

// ---------------------------------------------------------------------------
// The layout on disk (workflow-engine/scripts/domain/layout.cjs, 4.11): the
// table of places and its reader, `layoutPlace`. Unit layer, no world.
// Every place 4.11.17's tree draws holds a sample path, with its kind — the
// logs 4.11's four — and a sample outside each folder is in none; names are
// compared as the fold spells them; the tracker's store is each shipped
// task driver's; each of today's places holds its sample, is no log, and
// names the phase from 29.11 to 29.17 that retires it (E4); and the suites'
// layout helper names only places the table holds.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { LAYOUT, TODAY, IN_LOWER_CASE, layoutPlace } = require('../../skills/workflow-engine/scripts/domain/layout.cjs');
const { listDrivers } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');
const { WRITE_VERBS } = require('../../skills/workflow-engine/scripts/domain/ledger-write.cjs');
const { LEDGER } = require('../../skills/workflow-engine/scripts/domain/ledger-events.cjs');
const { layout } = require('./discovery-test-utils.cjs');

/** A path in each place 4.11.17 draws, and the place's kind and path. */
const DRAWN = Object.freeze({
  '.git': 'file .git',
  '.gitignore': 'file .gitignore',
  '.lock': 'file .lock',
  'manifest.json': 'engine manifest.json',
  '.ledger.jsonl': 'engine .ledger.jsonl',
  '.inbox/ideas/2026-10-30--smart-retry.md': 'file .inbox/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md',
  '.inbox/bugs/2026-10-30--login-timeout.md': 'file .inbox/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md',
  '.inbox/quickfixes/2026-10-30--typo.md': 'file .inbox/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md',
  '.inbox/.archived/bugs/2026-10-30--login-timeout.md': 'file .inbox/.archived/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md',
  '.product/sessions/session-001.md': 'log .product/sessions/session-{NNN}.md',
  '.product/notes/2026-10-30--smart-retry.md': 'file .product/notes/{YYYY-MM-DD}--{slug}.md',
  '.product/spikes/001-pricing-page/round-1/index.html': 'free .product/spikes/{NNN}-{slug}',
  '.product/assets/brand/logo.svg': 'free .product/assets',
  '.state/migrations': 'file .state/migrations',
  '.knowledge/records/pay/auth.md': 'free .knowledge',
  '.knowledge/.copies-live.json': 'free .knowledge',
  '.cache/pay/topics/auth/draft.md': 'free .cache',
  '.cache/.marks/pay.json': 'free .cache',
  'pay/manifest.json': 'engine {unit}/manifest.json',
  'pay/discovery/session-001.md': 'log {unit}/discovery/session-{NNN}.md',
  'pay/seeds/2026-10-30--smart-retry.md': 'free {unit}/seeds',
  'pay/topics/auth/brief.md': 'file {unit}/topics/{topic}/brief.md',
  'pay/topics/auth/log.md': 'log {unit}/topics/{topic}/log.md',
  'pay/topics/auth/mail/001-retry-policy.md': 'file {unit}/topics/{topic}/mail/{NNN}-{slug}.md',
  'pay/topics/auth/experiments/E1-token-cost/problem.md': 'file {unit}/topics/{topic}/experiments/E{n}-{slug}/{problem,design,report}.md',
  'pay/topics/auth/experiments/E1-token-cost/design.md': 'file {unit}/topics/{topic}/experiments/E{n}-{slug}/{problem,design,report}.md',
  'pay/topics/auth/experiments/E1-token-cost/report.md': 'file {unit}/topics/{topic}/experiments/E{n}-{slug}/{problem,design,report}.md',
  'pay/topics/auth/experiments/E1-token-cost/data/runs.csv': 'free {unit}/topics/{topic}/experiments/E{n}-{slug}/data',
  'pay/topics/auth/experiments/E1-token-cost/E1.1-cold-start/report.md': 'file {unit}/topics/{topic}/experiments/E{n}-{slug}/E{n}.{m}-{slug}/{problem,design,report}.md',
  'pay/topics/auth/experiments/E1-token-cost/E1.1-cold-start/data/bench/runs.csv': 'free {unit}/topics/{topic}/experiments/E{n}-{slug}/E{n}.{m}-{slug}/data',
  'pay/assets/mockups/home.png': 'free {unit}/assets',
  'pay/spikes/001-checkout/round-1/index.html': 'free {unit}/spikes/{NNN}-{slug}',
  'pay/spec.md': 'file {unit}/spec.md',
  'pay/spec-review.json': 'engine {unit}/spec-review.json',
  'pay/summary.md': 'file {unit}/summary.md',
  'pay/build/log.md': 'log {unit}/build/log.md',
  'pay/build/notes.md': 'file {unit}/build/notes.md',
  'pay/build/tasks/1.2.md': 'file {unit}/build/tasks/{task}.md',
  'pay/build/tasks/1.2/round-1-a.md': 'file {unit}/build/tasks/{task}/round-{N}-{a,b}.md',
  'pay/build/tasks/1.2/round-1-b.md': 'file {unit}/build/tasks/{task}/round-{N}-{a,b}.md',
  'pay/build/phases/phase-1/review-a.md': 'file {unit}/build/phases/phase-{N}/review-{a,b}.md',
  'pay/build/phases/phase-1/review-b.md': 'file {unit}/build/phases/phase-{N}/review-{a,b}.md',
  'pay/build/phases/phase-1/checkout-a.md': 'file {unit}/build/phases/phase-{N}/{area}-{a,b}.md',
  'pay/build/runs/3.S2/run-001.json': 'file {unit}/build/runs/{n}.S{m}/run-{NNN}.json',
  'pay/review/round-1.md': 'file {unit}/review/round-{N}.md',
  'pay/review/round-1-checks.md': 'file {unit}/review/round-{N}-checks.md',
});

/** A path in each of today's places, and the place's path. */
const TODAYS = Object.freeze({
  'pay/research/auth.md': '{unit}/research/{topic}.md',
  'pay/discussion/auth.md': '{unit}/discussion/{topic}.md',
  'pay/discussion/.mailbox/auth/001-retry-policy.md': '{unit}/{research,discussion,investigation}/.mailbox/{topic}/{NNN}-{slug}.md',
  'pay/experiment/auth/E1-token-cost/E1.1-cold-start/report.md': '{unit}/experiment/{topic}',
  'pay/discovery/sessions/session-001.md': '{unit}/discovery/sessions/session-{NNN}.md',
  'pay/discovery/briefs/auth.md': '{unit}/discovery/briefs/{topic}.md',
  '.roadmap/sessions/session-001.md': '.roadmap/sessions/session-{NNN}.md',
  '.roadmap/imports/deck.pdf': '.roadmap/imports',
  '.baseline/.state/agenda-api.md': '.baseline',
  'pay/.state/discovery-gap-analysis.md': '{unit}/.state',
  'pay/implementation/auth/review-tasks-c1.md': '{unit}/implementation/{topic}',
  'pay/review/auth/report.md': '{unit}/review/{topic}',
  '.state/environment-setup.md': '.state/environment-setup.md',
  'pay/investigation/crash.md': '{unit}/investigation/{topic}.md',
  'pay/specification/auth/specification.md': '{unit}/specification/{topic}',
  'pay/planning/auth/tasks/pay-1-2.md': '{unit}/planning/{topic}',
  'pay/imports/deck.pdf': '{unit}/imports',
  '.roadmap/notes/ideas/2026-10-30--smart-retry.md': '.roadmap/notes/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md',
});

/** Paths outside every place: beside each folder's places, a free folder named as a file, and a name a placeholder refuses. */
const OUTSIDE = Object.freeze([
  'notes.md', '.ledger.jsonl.bak', 'manifest.json.bak', '.tmp/notes.md',
  '.inbox/2026-10-30--smart-retry.md', '.inbox/ideas/smart-retry.md', '.inbox/notes/2026-10-30--smart-retry.md', '.inbox/.archived/2026-10-30--smart-retry.md',
  '.product/notes.md', '.product/sessions/notes.md', '.product/notes/smart-retry.md', '.product/spikes/pricing-page/index.html',
  '.state/notes.md',
  'pay/notes.md', 'pay/scratch/notes.md', 'pay/discovery/notes.md', 'pay/topics/auth.md', 'pay/topics/auth/notes.md', 'pay/topics/auth/mail/retry-policy.md',
  'pay/topics/auth/experiments/notes.md', 'pay/topics/auth/experiments/E1-token-cost/notes.md', 'pay/topics/auth/experiments/E1-token-cost/E1.1-cold-start/notes.md',
  'pay/spikes/checkout/index.html', 'pay/build/notes/today.md', 'pay/build/tasks/notes.md', 'pay/build/tasks/1.2/notes.md', 'pay/build/phases/phase-1/notes.md',
  'pay/build/runs/3.S2/notes.json', 'pay/review/notes.md',
  '.cache', '.knowledge', 'pay/assets', 'pay/seeds', 'pay/spikes/001-checkout', 'pay/topics/auth/experiments/E1-token-cost/data', '.baseline', 'pay/imports',
  'Pay/spec.md', 'pay/topics/a.b/log.md', 'pay/discovery/session-1.md', 'pay/build/tasks/1.md', 'pay/build/tasks/0.2.md', 'pay/build/runs/3.s2/run-001.json', 'pay/review/round-0.md',
  '.inbox/ideas/30-10-2026--smart-retry.md', '.inbox/ideas/today--smart-retry.md', '.inbox/ideas/2026-10-30--smart_retry.md', 'pay/build/phases/phase-1/check_out-a.md',
  'pay/topics/auth/experiments/E0-token-cost/problem.md', 'pay/topics/auth/experiments/E1-token-cost/E1.0-cold-start/report.md', 'pay/build/runs/0.S2/run-001.json', 'pay/build/runs/3.S0/run-001.json',
  'pay/research/auth/notes.md', 'pay/discussion/.mailbox/auth/retry-policy.md', 'pay/discovery/sessions/notes.md', 'pay/discovery/briefs/auth/notes.md',
  '.roadmap/notes.md', '.roadmap/sessions/notes.md', '.state/environment.md',
]);

/** @param {import('../../skills/workflow-engine/scripts/domain/layout.cjs').Place|null} at */
const named = (at) => (at === null ? null : `${at.kind} ${at.path}`);

describe('4.11\'s places (4.11.17)', () => {
  it('every place the tree draws holds its sample, of its kind — the engine\'s alone the manifests, the ledger and spec-review.json (6.2.3) — and every place has one', () => {
    assert.deepStrictEqual(Object.fromEntries(Object.keys(DRAWN).map((rel) => [rel, named(layoutPlace(rel))])), DRAWN);
    assert.deepStrictEqual(new Set(Object.values(DRAWN)), new Set(LAYOUT.map(named)));
  });

  it('a path beside each folder\'s places, a free folder named as a file, and a name a placeholder refuses are in no place', () => {
    assert.deepStrictEqual(OUTSIDE.filter((rel) => layoutPlace(rel) !== null), []);
  });

  it('names are compared as the fold spells them: in another case, under a fold to lower case, a path is the place it names, and as written it is none', () => {
    for (const [rel, place] of [
      ['PAY/Topics/Auth/LOG.md', '{unit}/topics/{topic}/log.md'],
      ['pay/topics/auth/experiments/e1-token-cost/PROBLEM.md', '{unit}/topics/{topic}/experiments/E{n}-{slug}/{problem,design,report}.md'],
      ['.INBOX/Ideas/2026-10-30--Smart-Retry.md', '.inbox/{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md'],
      ['pay/build/runs/3.s2/run-001.json', '{unit}/build/runs/{n}.S{m}/run-{NNN}.json'],
      ['.LEDGER.jsonl', '.ledger.jsonl'],
    ]) {
      assert.strictEqual(layoutPlace(rel, IN_LOWER_CASE)?.path, place, `${rel} folded`);
      assert.strictEqual(layoutPlace(rel), null, `${rel} as written`);
    }
  });

  it('the ledger\'s refusal names every verb that writes it', () => {
    assert.strictEqual(layoutPlace(LEDGER)?.verb, `ledger ${WRITE_VERBS.join('|')}`);
  });

  it('the tracker\'s store is each shipped task driver\'s: every file it keeps on the state branch is a file in the layout, and nothing beside it is (7.1.10)', () => {
    const files = listDrivers('task').flatMap((/** @type {{storeFiles: () => string[]}} */ driver) => driver.storeFiles());
    assert.notDeepStrictEqual(files, []);
    for (const file of files) {
      assert.strictEqual(named(layoutPlace(file)), `file ${file}`, file);
      assert.strictEqual(layoutPlace(path.posix.join(path.posix.dirname(file), 'notes.md')), null, `beside ${file}`);
    }
  });
});

describe('today\'s places (E4)', () => {
  it('every one names the phase from 29.11 to 29.17 that retires it', () => {
    assert.deepStrictEqual(TODAY.filter((at) => !/^29\.1[1-7]$/.test(at.retires ?? '')).map((at) => at.path), []);
  });

  it('every one holds its sample, and none is a log or the engine\'s alone', () => {
    assert.deepStrictEqual(Object.fromEntries(Object.keys(TODAYS).map((rel) => [rel, layoutPlace(rel)?.path ?? null])), TODAYS);
    assert.deepStrictEqual(new Set(Object.values(TODAYS)), new Set(TODAY.map((at) => at.path)));
    assert.deepStrictEqual(TODAY.filter((at) => at.kind === 'log' || at.kind === 'engine').map((at) => at.path), []);
  });

  it('the suites\' layout helper names only places the table holds (discovery-test-utils.cjs)', () => {
    const samples = {
      projectManifest: layout.projectManifest,
      ledger: layout.ledger,
      lock: layout.lock,
      gitignore: layout.gitignore,
      migrations: layout.migrations,
      projectState: layout.projectState('environment-setup.md'),
      inbox: layout.inbox('ideas', '2026-10-30--smart-retry.md'),
      archived: layout.archived('ideas', '2026-10-30--smart-retry.md'),
      knowledge: layout.knowledge('config.json'),
      cache: layout.cache('pay', 'draft.md'),
      unit: layout.unit('pay', 'spec.md'),
      manifest: layout.manifest('pay'),
      topic: layout.topic('pay', 'auth', 'log.md'),
      assets: layout.assets('pay', 'deck', 'cover.png'),
      doc: layout.doc('pay', 'investigation', 'crash'),
      mailbox: layout.mailbox('pay', 'research', 'auth', '001-retry-policy.md'),
      experiment: layout.experiment('pay', 'auth', 'E1-token-cost', 'problem.md'),
      spec: layout.spec('pay', 'auth'),
      plan: layout.plan('pay', 'auth'),
      session: layout.session('pay', '001'),
      brief: layout.brief('pay', 'auth'),
      imports: layout.imports('pay', 'deck.pdf'),
      unitState: layout.unitState('pay', 'discussion-consolidation-analysis.md'),
    };
    assert.deepStrictEqual(Object.keys(samples).sort(), Object.keys(layout).sort(), 'a sample of every place the helper names');
    assert.deepStrictEqual(Object.entries(samples).filter(([, rel]) => layoutPlace(rel) === null), []);
  });
});
