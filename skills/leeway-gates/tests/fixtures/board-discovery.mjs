// Fumi's first discovery session as engine board answers it, shaping a map of ten, held to its shape by tests/scripts/test-engine-board-discovery.cjs.

/** A topic on the map, its key from its title. */
export const mapTopic = (title, summary) => ({ topic: title.toLowerCase().replaceAll(' ', '-'), title, summary })

export default {
  kind: 'discovery',
  unit: 'fumi',
  title: 'Fumi',
  type: 'epic',
  session: 1,
  started: '2026-07-17',
  waits: false,
  map: [
    mapTopic('Note model', 'What a fumi is: a Markdown body with a stable UID, an optional first-line-derived title'),
    mapTopic('Storage and sync', 'File-based Markdown store in a user-chosen folder (local or iCloud)'),
    mapTopic('Note window', 'The floating fumi as an on-screen object: near-frameless glass'),
    mapTopic('Engine architecture', 'One always-on app over a local socket; note windows, menu bar'),
    mapTopic('Space homing', 'Notes remember their macOS Space and return to it across relaunches'),
    mapTopic('Positioning and audience', 'Positioning as a polished do-one-thing-well tool, user personas'),
    mapTopic('Agent surface', 'The fumi CLI and MCP server over the engine socket: operations'),
    mapTopic('Management window', 'The main app window as an organiser (browse/search/filter)'),
    mapTopic('Onboarding and permissions', 'First-run permission wizard for the Accessibility permission'),
    mapTopic('Commercialization', 'One-time ~$19 plus paid major upgrades, no subscription and no trial'),
  ],
  roadmap: [
    { title: 'Fumi Sync, a hosted sync service', horizon: 'later' },
    { title: 'Storage over a network: SFTP and a hosted API', horizon: 'later' },
    { title: "A fumi's colour drawn from its tags", horizon: 'later' },
    { title: 'A lifetime tier', horizon: 'later' },
  ],
  not_taken: [
    { direction: 'The Mac App Store', why: 'the private Spaces APIs are an automatic rejection' },
    { direction: 'Importing Stickies', why: 'a blank slate, no legacy baggage' },
    { direction: 'A billing backend', why: 'the Merchant of Record covers checkout, tax and licences' },
  ],
  views: ['Clean, well-structured, beautiful, and it just works', 'Modern Swift, correctness over speed, no shortcuts'],
  spikes: [{ spike: '001-note-window', title: 'Note window', status: 'reference', tool: 'Paper', showed: 'Luminous Liquid Glass and stronger type' }],
}
