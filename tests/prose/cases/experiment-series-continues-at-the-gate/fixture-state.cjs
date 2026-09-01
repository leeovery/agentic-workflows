'use strict';

// The harvested epic with synonym-handling's research paused on two
// experiments at once: E1 (the recovery share) and E2 (how quickly the
// recoveries land), both conceived with their problem statements on disk,
// the research item awaiting both. The world the series loop needs — the
// picker is the first ask, the gate offers the next, and the second
// record auto-resolves once the first ends.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'synonym-handling';
const SLUG1 = 'reformulation-recovery';
const SLUG2 = 'recovery-latency';

// 40 zero-result searches across sessions s-1..s-40; sessions s-1..s-12
// recover — a reformulated query in the same session returns results and
// is clicked, 30 seconds after the failed query. 30% recovery, 100%
// within a minute; deterministic, countable with grep.
function sessionLog() {
  const lines = [];
  for (let i = 1; i <= 40; i++) {
    const mm = String(i).padStart(2, '0');
    lines.push(`2026-01-01T09:${mm}:10Z s-${i} query="worn brake shoes" results=0 clicked=no`);
    if (i <= 12) {
      lines.push(`2026-01-01T09:${mm}:40Z s-${i} query="brake pads" results=14 clicked=yes`);
    }
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    h.write('logs/search-sessions.log', sessionLog());

    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
      '# Research: Synonym Handling',
      '',
      'What replaces the hand-maintained synonym and misspelling list —',
      'a curated managed list versus behaviour-driven expansion. The',
      'choice turns on two numbers handed to the laboratory 2026-01-01:',
      '',
      '- The in-session recovery share of zero-result searches —',
      '  awaiting E1. Behaviour-driven expansion feeds on those',
      '  recoveries; a negligible share sends the choice to a curated',
      '  source.',
      '- How quickly the recoveries land — awaiting E2. Recoveries that',
      '  arrive within the same minute can be mined from in-session',
      '  signals alone; slower ones need cross-session stitching the',
      '  team would have to build first.',
      '',
      'A day of sandbox search-session activity is exported at',
      'logs/search-sessions.log. The source choice waits on both.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): the two open numbers`);

    h.write(`.workflows/.cache/${WU}/research/${TOPIC}/problem.md`, [
      '# E1: Reformulation Recovery',
      '',
      'We need to learn what share of zero-result searches recover',
      'because the searcher reformulates within the same session — the',
      'replacement-source choice turns on it. We hope the share is',
      'meaningful. A day of sandbox activity is exported at',
      'logs/search-sessions.log.',
      '',
      'Spawned from the "synonym-handling" research, at the replacement-',
      'source choice, on 2026-01-01.',
      '',
    ].join('\n'));
    JSON.parse(h.engine('experiment', 'create', WU, TOPIC, '--slug', SLUG1, '--from', 'research',
      '--problem', `.workflows/.cache/${WU}/research/${TOPIC}/problem.md`));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): spawn E1 ${SLUG1}`);
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '--sweep', '-m',
      `experiment(${WU}/${TOPIC}): E1 problem statement`);

    h.write(`.workflows/.cache/${WU}/research/${TOPIC}/problem.md`, [
      '# E2: Recovery Latency',
      '',
      'We need to learn how quickly in-session recoveries land: the',
      'share of recovering sessions whose reformulation returns results',
      'within a minute of the failed query. Whether in-session signals',
      'suffice for behaviour-driven expansion turns on it — slower',
      'recoveries need cross-session stitching the team would have to',
      'build first. Same sample: logs/search-sessions.log.',
      '',
      'Spawned from the "synonym-handling" research, at the same',
      'replacement-source choice, on 2026-01-01.',
      '',
    ].join('\n'));
    JSON.parse(h.engine('experiment', 'create', WU, TOPIC, '--slug', SLUG2, '--from', 'research',
      '--problem', `.workflows/.cache/${WU}/research/${TOPIC}/problem.md`));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): spawn E2 ${SLUG2}`);
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '--sweep', '-m',
      `experiment(${WU}/${TOPIC}): E2 problem statement`);
  },
};
