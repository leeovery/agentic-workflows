'use strict';

// The conclude world with one more session behind it: both of the plan's
// phase-1 tasks are implemented and recorded, phase 1 has closed through
// its consolidation boundary, and an analysis cycle has already run and
// come back clean. `analysis_cycle_total` reads 1 — recorded through the
// engine verb the loop's cycle gate runs, never a hand-written field —
// and the three cycle-1 findings files sit in the implementation
// directory holding exactly what the clean analysis stubs write, each
// recording no findings.
//
// Nothing else of the cycle exists: no synthesis ever ran, so there is
// no report, no staging file on disk and no `staging` subtree on the
// manifest. The session that ran the cycle died between the findings
// commit and the conclude gate, so the next session opens at Step 0 and
// meets the converged cycle at the cycle gate.
//
// The findings commit is landed twice over: through the engine commit
// the analysis loop's section C prescribes (the scoped `--topic` commit
// covering the findings files and the manifest's cycle counter), and as
// a declared history layer, because a recipe's own git dies at the
// world's fresh init and the walk reads the message out of the log.
//
// No perturbation: the specification is the mainline's own, and the two
// modules sit where it expects them. The bank is absent — nothing was
// ever deposited.

const m = require('../../mainlines/feature.cjs');

const IMPL = `.workflows/${m.WU}/implementation/${m.WU}`;

// The clean findings files, byte for byte as tests/prose/stubs/
// analysis-{duplication,standards,architecture}-clean.md write them.
const FINDINGS = [
  ['duplication', 'No significant duplication detected across implementation files.'],
  ['standards', "Both modules sit where the specification expects them and follow the project's conventions; no comment claims more than the code carries."],
  ['architecture', "Nothing architectural inside this cycle's remit."],
];

function findingsFile(agent, summary) {
  return [
    `AGENT: ${agent}`,
    'FINDINGS: none',
    `SUMMARY: ${summary}`,
    '',
  ].join('\n');
}

// The completed tasks' files — the shape the mainline's implement()
// writes (local-markdown authoring contract).
function taskFile(task, status) {
  return [
    '---',
    `id: ${task.id}`,
    'phase: 1',
    `status: ${status}`,
    'created: 2026-01-01',
    '---',
    '',
    `# ${task.title}`,
    '',
    task.description,
    '',
    `**Acceptance Criteria**: ${task.criteria}`,
    '',
    `**Tests**: ${task.tests}`,
    '',
  ].join('\n');
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');

    // The previous session: task init, both tasks executed and recorded,
    // and the phase closed through its consolidation boundary — the
    // deferred completion, the pass landing, the re-record that closes it
    // (consolidation-pass.md F).
    h.engine('task', 'init', m.WU, m.WU);
    h.engine('task', 'start', m.WU, m.WU, `${m.WU}-1-1`);
    h.write('src/checkout/payment-intent.js', [
      '// Create a gateway payment intent when checkout begins. Card-only',
      '// is enforced at creation.',
      'export function createPaymentIntent(order) {',
      "  return gateway.intents.create({ order: order.id, methods: ['card'] });",
      '}',
      '',
    ].join('\n'));
    h.write('tests/checkout/payment-intent.test.js', [
      '// Intent created on checkout start; card-only enforced; rejection',
      '// surfaces; duplicate start does not mint a second intent.',
      "test('creates a card-only intent on checkout start', () => {});",
      '',
    ].join('\n'));
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${m.WU}-1-1.md`, taskFile(m.TASKS[0], 'completed'));
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-1`, '--phase', '1', '--next-task', `${m.WU}-1-2`);

    h.engine('task', 'start', m.WU, m.WU, `${m.WU}-1-2`);
    h.write('src/webhooks/capture.js', [
      '// Consume gateway capture webhooks and mark the order paid.',
      'export function handleCaptureWebhook(event) {',
      '  return orders.markPaid(event.intentId);',
      '}',
      '',
    ].join('\n'));
    h.write('tests/webhooks/capture.test.js', [
      '// Webhook marks the order paid; duplicates are idempotent; an',
      '// unknown intent is logged and ignored.',
      "test('marks the order paid on capture webhook', () => {});",
      '',
    ].join('\n'));
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${m.WU}-1-2.md`, taskFile(m.TASKS[1], 'completed'));
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-2`, '--phase', '1', '--next-task', '~');
    h.engine('manifest', 'push', `${m.WU}.implementation.${m.WU}`, 'consolidated_phases', '1');
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-2`, '--phase', '1', '--phase-complete');

    // The analysis cycle that came back clean: the cycle gate's record,
    // the three agents' findings files, and the loop's findings commit.
    h.engine('task', 'analysis-cycle', m.WU, m.WU);
    for (const [agent, summary] of FINDINGS) {
      h.write(`${IMPL}/analysis-${agent}-c1.md`, findingsFile(agent, summary));
    }
    h.engine('commit', m.WU, '-m', `impl(${m.WU}): analysis cycle 1 — findings`,
      '--topic', `implementation/${m.WU}`);

    h.write('.world-history.json', JSON.stringify([
      { message: `impl(${m.WU}): T${m.WU}-1-1 — create payment intent on checkout start`,
        files: ['src/checkout/payment-intent.js', 'tests/checkout/payment-intent.test.js'] },
      { message: `impl(${m.WU}): T${m.WU}-1-2 — handle capture webhooks`,
        files: ['src/webhooks/capture.js', 'tests/webhooks/capture.test.js'] },
      { message: `impl(${m.WU}): analysis cycle 1 — findings`,
        files: [
          ...FINDINGS.map(([agent]) => `${IMPL}/analysis-${agent}-c1.md`),
          `.workflows/${m.WU}/manifest.json`,
        ] },
    ], null, 2));
  },
};
