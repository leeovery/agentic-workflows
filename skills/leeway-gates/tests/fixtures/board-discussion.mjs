// Fumi's Onboarding and permissions in its discussion as engine board answers it, its third review round running for 4:12, held to its shape by tests/scripts/test-engine-board-views.cjs.

/** Decisions whose they are, each with its words. */
export const decision = (who, ...texts) => texts.map((text, at) => ({ id: `${who}${at}${text.length}`, text, who }))

export default {
  kind: 'discussion',
  unit: 'fumi',
  title: 'Fumi',
  type: 'epic',
  topic: 'onboarding-and-permissions',
  topic_title: 'Onboarding and permissions',
  summary: 'First-run permission wizard for the Accessibility permission.',
  live: true,
  progress: { decided: 11, yours: 12, calls: 6 },
  closing: false,
  open: [{ id: 'q1', text: 'An unlicensed Fumi opens on a licence window, and setup runs once a licence is in', from: 'Commercialization', experiment: null }],
  messages: [{ file: '001-lost-key.md', title: 'The licence window carries a "Lost your key?" link', from: 'Commercialization', when: '16 Oct' }],
  since: [{ id: 'c1', text: 'No price line in the walkthrough or anywhere else in first run.', question: 'Pricing mention' }],
  reviews: [
    { id: 'r3', round: 3, state: 'running', since: '2026-10-21T13:25:48', findings: 0, taken: 0, waiting: 0 },
    { id: 'r2', round: 2, state: 'read', since: '2026-10-21T10:00:00', findings: 9, taken: 9, waiting: 0 },
    { id: 'r1', round: 1, state: 'read', since: '2026-10-20T10:00:00', findings: 7, taken: 7, waiting: 0 },
  ],
  decided: [
    ...decision('yours', 'Enabling sync later', 'First run shape', 'Launch at login offer', 'No iCloud account state', 'First run landing'),
    ...decision('claude', 'First launch definition'),
    ...decision('yours', 'Sample notes and sync'),
    ...decision('claude', 'Login item banner'),
    ...decision('yours', 'Sync toggle default'),
    ...decision('claude', 'Who performs the restart after the Accessibility grant', 'The engine needs Files-and-Folders access — and asks for it'),
    ...decision('yours', 'Sync offer copy', 'Notification permission ask'),
    ...decision('claude', 'Screen title', 'Pricing mention'),
    ...decision('yours', 'Wizard step content', 'Personalisation step'),
  ],
  sent: [
    { title: 'Fumi is also in ⌘Tab and the Dock while the first-run wizard or the licence window is open', to: 'Management window', file: '002.md', at: '2026-10-21T12:10:00', stands: 'waiting' },
    { title: 'First run shows the product before the licence: the licence is a wizard step after the tour', to: 'Commercialization', file: '001.md', at: '2026-10-20T21:18:00', stands: 'taken' },
  ],
}
