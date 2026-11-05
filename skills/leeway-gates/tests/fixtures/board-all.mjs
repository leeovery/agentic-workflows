// Mint's All work as engine board answers it, this session in its build and a topic of another unit's on the roadmap, held to its shape by tests/scripts/test-engine-board-views.cjs.
export default {
  kind: 'all',
  project: 'Mint',
  at_start: false,
  waiting: 5,
  units: [
    { unit: 'token-aware-diff-sizing', title: 'Token-aware diff sizing', type: 'feature', phase: 'build', standing: '58 of 68 tasks done', waiting: 3, session: 'this' },
    { unit: 'rate-limit-aware-publish', title: 'Rate-limit-aware publish', type: 'feature', phase: 'specification', standing: 'pass 2 waits on you', waiting: 2, session: 'other' },
    { unit: 'publish-failure', title: 'Publish failure swallows gh stderr', type: 'bugfix', phase: 'investigation', standing: '', waiting: 0, session: null },
  ],
  roadmap: [
    { horizon: 'Next', items: [{ title: 'Headline first release notes', from: null }, { title: 'Changelog site', from: 'Release notes overhaul' }] },
    { horizon: 'Later', items: [{ title: 'Agent guide for running releases', from: null }] },
  ],
  inbox: [
    { kind: 'idea', title: 'Mint CLI UI/UX overhaul' },
    { kind: 'bug', title: 'Single-version regenerate prepends changelog entry at top instead of semver position' },
    { kind: 'bug', title: 'Publish heal hint: wrong diagnosis, wrong command form' },
  ],
  complete: [
    { unit: 'release-notes-overhaul', title: 'Release notes overhaul', type: 'epic' },
    { unit: 'tag-signing', title: 'Tag signing', type: 'feature' },
  ],
}
