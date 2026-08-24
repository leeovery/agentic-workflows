'use strict';

// Both specifications concluded and ordered, both plans completed, and
// the synonym-handling plan blocked on a behavioural-ranking task that
// has not been implemented. The epic menu should carry no
// implementation row for it — u/unblock is the escape hatch.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

function spec(h, topic, body) {
  h.engine('topic', 'start', WU, 'specification', topic);
  h.engine('manifest', 'set', `${WU}.specification.${topic}`,
    `sources.${topic}.status`, 'incorporated');
  h.write(`.workflows/${WU}/specification/${topic}/specification.md`, body);
  h.engine('commit', WU, '-m', `spec(${WU}): ${topic} specification`);
  h.engine('topic', 'complete', WU, 'specification', topic);
  h.engine('commit', WU, '-m', `spec(${WU}): complete ${topic} specification`);
}

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    spec(h, 'behavioural-ranking', [
      '# Specification: Behavioural Ranking',
      '',
      '## Overview',
      '',
      'Feed behavioural signals into ranking via the batch nightly',
      'aggregation the discussion settled on.',
      '',
      '## Dependencies',
      '',
      '(none)',
      '',
    ].join('\n'));
    spec(h, 'synonym-handling', [
      '# Specification: Synonym Handling',
      '',
      '## Overview',
      '',
      'Behaviour-driven synonym expansion reading the live click-signal',
      'stream at query time.',
      '',
      '## Dependencies',
      '',
      '| Dependency | Why Blocked |',
      '|------------|-------------|',
      '| Behavioural Ranking | Needs the click-signal stream shipping |',
      '',
    ].join('\n'));

    // The sequence runs last: it clears the stale flags the two
    // completions set, leaving the entry's refresh step silent.
    h.engine('build-order', 'sequence', WU,
      'behavioural-ranking=1', 'synonym-handling=2');

    for (const topic of ['behavioural-ranking', 'synonym-handling']) {
      h.engine('topic', 'start', WU, 'planning', topic);
      h.write(`.workflows/${WU}/planning/${topic}/planning.md`, [
        `# Plan: ${topic}`,
        '',
        'One phase, minimal — enough for the menu to read a completed',
        'plan.',
        '',
      ].join('\n'));
      h.engine('commit', WU, '-m', `plan(${WU}): ${topic} plan`);
      h.engine('topic', 'complete', WU, 'planning', topic);
      h.engine('commit', WU, '-m', `plan(${WU}): complete ${topic} plan`);
    }

    // The resolve-dependencies pass as a prior planning session left it:
    // the declared dependency wired to the specific upstream task.
    h.engine('manifest', 'set', `${WU}.planning.synonym-handling`,
      'external_dependencies.behavioural-ranking.description=Needs the click-signal stream shipping',
      'external_dependencies.behavioural-ranking.state=resolved',
      'external_dependencies.behavioural-ranking.internal_id=behavioural-ranking-1-2');
    h.engine('commit', WU, '-m', `plan(${WU}): resolve synonym-handling dependencies`);
  },
};
