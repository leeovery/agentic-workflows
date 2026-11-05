// Fumi's page at its menu as engine board answers it, LATELY as the spike has it, held to its shape by tests/scripts/test-engine-board-views.cjs, with the map staged again (8.8.21) waiting on the person.

/** A topic on the epic's page, by its title and state, the rest as given. */
export const epicTopic = (title, state, more = {}) => ({
  topic: title.toLowerCase().replaceAll(' ', '-'),
  title,
  state,
  decided: 0,
  total: 0,
  session: null,
  messages: 0,
  experiment: null,
  ...more,
})

/** Fumi's map staged again, waiting on the person (8.8.21). */
export const restaged = { kind: 'map', id: 'approve-the-map', text: 'Approve the map: 16 topics in this order', page: null }

/** Topics decided, by their titles. */
export const decidedTopics = (...titles) => titles.map(title => epicTopic(title, 'decided'))

export default {
  kind: 'epic',
  unit: 'fumi',
  title: 'Fumi',
  about: 'Fumi — a smarter macOS Stickies alternative: notes assigned to specific macOS Spaces',
  started: '2026-07-17',
  now: { phase: 'discussion', since: '2026-07-17T15:00:00' },
  at_menu: true,
  here: true,
  progress: { decided: 9, total: 15, discussing: 5 },
  waiting: [],
  topics: [
    ...decidedTopics('Note model', 'Storage and sync', 'Note window', 'Engine architecture', 'Space homing', 'Platform support', 'Search and retrieval', 'Status and alerts', 'Agent surface'),
    epicTopic('Management window', 'discussing', { decided: 36, total: 36, messages: 1 }),
    epicTopic('Onboarding and permissions', 'discussing', { decided: 11, total: 12, session: 'this', messages: 1 }),
    epicTopic('Commercialization', 'discussing', { decided: 25, total: 25, messages: 1 }),
    epicTopic('Licensing and trial integrity', 'discussing', { decided: 10, total: 15, session: 'other', messages: 2 }),
    epicTopic('Support and diagnostics', 'discussing', { decided: 0, total: 6, session: 'other' }),
    epicTopic('Build and release', 'not-started', { messages: 17 }),
  ],
  spec: { state: 'waits', session: null },
  build: { state: 'waits', session: null },
  set_aside: [
    { topic: 'positioning-and-audience', title: 'Positioning and audience', state: 'cancelled', horizon: null },
    { topic: 'website', title: 'Website', state: 'postponed', horizon: 'next' },
  ],
  lately: [
    { kind: 'answered', at: '2026-10-21T13:10:00', topic: 'Licensing and trial integrity', detail: null, count: 8 },
    { kind: 'answered', at: '2026-10-21T12:10:00', topic: 'Onboarding and permissions', detail: 'Management window', count: 1 },
    { kind: 'sent', at: '2026-10-21T12:10:00', topic: 'Management window', detail: 'Onboarding and permissions' },
    { kind: 'started', at: '2026-10-20T20:40:00', topic: 'Support and diagnostics', detail: 'discussion' },
    { kind: 'postponed', at: '2026-10-20T20:28:00', topic: 'Website', detail: 'next' },
    { kind: 'created', at: '2026-07-17T09:00:00', topic: null, detail: 'epic' },
  ],
}
