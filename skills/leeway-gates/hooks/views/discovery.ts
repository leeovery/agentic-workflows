/**
 * An epic's discovery on the board (20.11): This session in discovery, a
 * topic's brief (20.11.2) — on which a topic not started or set aside opens,
 * the messages waiting for it beneath — and a spike's page (20.11.3).
 *
 * Its facts line ends in whether the map waits on the person, and wraps
 * rather than lose those words at the edge. Nothing on a brief is a
 * decision: it says the topic is decided in its discussion.
 */
import { COLOUR, INDENT, MARK, blank, cutTo, dayOf, heading, prose, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import { messageList } from './discussion.ts'
import type { ViewDrawing } from './index.ts'
import { header, pointsSection, section, titled } from './words.ts'

type MapLine = { topic: string; title: string; summary: string }
type Spike = { spike: string; title: string; status: string | null; tool: string | null; showed: string | null }

type Discovery = {
  unit: string
  title: string
  type: string
  session: number | null
  started: string | null
  waits: boolean
  map: MapLine[]
  roadmap: { title: string; horizon: string }[]
  not_taken: { direction: string; why: string }[]
  views: string[]
  spikes: Spike[]
}

const topics = (count: number) => `${count} ${count === 1 ? 'topic' : 'topics'}`

/** What it shapes: the topics on the map, what goes to the roadmap, and whether the map waits on the person or is being shaped. */
function factsLine(view: Discovery, kit: Kit): Line {
  const standing: Part[] = view.waits
    ? [{ text: `${MARK.needs} the map waits on you`, color: COLOUR.needs }]
    : [kit.spinner(), { text: ' shaping', color: COLOUR.running }]

  return {
    key: 'd:facts',
    wraps: true,
    parts: [{ text: `${topics(view.map.length)} on the map · ${view.roadmap.length} to the roadmap · `, color: COLOUR.secondary }, ...standing],
  }
}

const approveLines = (view: Discovery, width: number): Line[] =>
  view.waits
    ? section(heading('d:waiting', { text: 'WAITING ON YOU', bold: true, color: COLOUR.needs }, [{ text: '1 · asked in the conversation', color: COLOUR.secondary }], width), [
        {
          key: 'd:approve',
          mark: { text: `${MARK.needs} `, color: COLOUR.needs },
          wraps: true,
          parts: [{ text: `Approve the map: ${topics(view.map.length)} in this order, and ${view.roadmap.length} to the roadmap`, color: COLOUR.body }],
        },
      ])
    : []

const mapLines = (view: Discovery, width: number): Line[] =>
  section(
    heading('d:map', { text: 'THE MAP', bold: true, color: COLOUR.sky }, [{ text: `${view.map.length} · foundations first`, color: COLOUR.secondary }], width),
    view.map.flatMap((topic, at) => [
      { key: `d:topic:${topic.topic}`, parts: [{ text: `${String(at + 1).padStart(2)} `, color: COLOUR.secondary }, { text: topic.title, color: COLOUR.body }], press: pageKey(`topic:${topic.topic}`) },
      { key: `d:topic:${topic.topic}:summary`, parts: cutTo([{ text: `${INDENT}${topic.summary}`, color: COLOUR.secondary }], width) },
    ]),
  )

/** The horizon the roadmap's items go to, where they all go to one. */
const horizonOf = (roadmap: Discovery['roadmap']) => (new Set(roadmap.map(({ horizon }) => horizon)).size === 1 ? ` · ${roadmap[0]?.horizon}` : '')

const roadmapLines = (view: Discovery, width: number): Line[] =>
  section(
    heading('d:parks', { text: 'TO THE ROADMAP', bold: true, color: COLOUR.violet }, [{ text: `${view.roadmap.length}${horizonOf(view.roadmap)} · with the map`, color: COLOUR.secondary }], width),
    view.roadmap.map((item, at) => ({ key: `d:park:${at}`, parts: cutTo([{ text: `${MARK.call} `, color: COLOUR.violet }, { text: item.title, color: COLOUR.body }], width) })),
  )

const notTakenLines = (view: Discovery, width: number): Line[] =>
  section(
    heading('d:aside', { text: 'NOT TAKEN', bold: true, color: COLOUR.secondary }, [{ text: `${view.not_taken.length} · kept in the log`, color: COLOUR.secondary }], width),
    view.not_taken.map((each, at) => ({
      key: `d:aside:${at}`,
      mark: { text: `${MARK.cancelled} `, color: COLOUR.notStarted },
      wraps: true,
      parts: [{ text: each.direction, color: COLOUR.body }, { text: ` · ${each.why}`, color: COLOUR.secondary }],
    })),
  )

/** The spikes' summary: how many, and reference or canonical, by how many of each where they differ. */
function spikesSummary(spikes: readonly Spike[]): string {
  const statuses = [...new Set(spikes.map(({ status }) => status ?? 'not yet linked'))]

  if (statuses.length === 1) {
    return `${spikes.length} · ${statuses[0]}`
  }

  return [spikes.length, ...statuses.map(status => `${spikes.filter(spike => (spike.status ?? 'not yet linked') === status).length} ${status}`)].join(' · ')
}

const spikeLines = (view: Discovery, width: number): Line[] =>
  section(
    heading('d:spikes', { text: 'SPIKES', bold: true, color: COLOUR.gold }, [{ text: spikesSummary(view.spikes), color: COLOUR.secondary }], width),
    view.spikes.map(spike => ({
      key: `d:spike:${spike.spike}`,
      parts: cutTo(
        [
          { text: `${MARK.call} `, color: COLOUR.gold },
          { text: [spike.title, ...(spike.tool === null ? [] : [spike.tool])].join(' · '), color: COLOUR.body },
          ...(spike.showed === null ? [] : [{ text: ` · ${spike.showed}`, color: COLOUR.secondary }]),
        ],
        width,
      ),
      press: pageKey(`spike:${spike.spike}`),
    })),
  )

const viewsLines = (view: Discovery, width: number): Line[] =>
  section(
    heading('d:views', { text: 'YOUR VIEWS OF THE PRODUCT', bold: true, color: COLOUR.gold }, [{ text: `${view.views.length} · carried into the topics`, color: COLOUR.secondary }], width),
    view.views.map((said, at) => ({ key: `d:view:${at}`, mark: { text: `${MARK.message} `, color: COLOUR.gold }, wraps: true, parts: [{ text: said, color: COLOUR.body }] })),
  )

/** Which session it is and when it started, where its log says. */
const sessionOf = ({ session, started }: Discovery) => [...(session === null ? [] : [`session ${session}`]), ...(started === null ? [] : [`started ${dayOf(started)}`])]

const discoveryLines = (view: Discovery, kit: Kit): Line[] => [
  ...header('d', view.title, [{ text: ' · discovery', color: COLOUR.secondary }], [view.title, view.type, ...sessionOf(view)].join(' · ')),
  factsLine(view, kit),
  blank('d:head'),
  ...approveLines(view, kit.width),
  ...mapLines(view, kit.width),
  ...roadmapLines(view, kit.width),
  ...notTakenLines(view, kit.width),
  ...spikeLines(view, kit.width),
  ...viewsLines(view, kit.width),
]

type Brief = {
  unit: string
  topic: string
  title: string
  order: number | null
  of: number
  summary: string
  sections: { heading: string | null; text: string }[]
  messages: { file: string; title: string; from: string; when: string }[]
}

/** Each of the brief's sections' colour, by its heading: what is still open waits on the discussion, a path not taken is set aside. */
const SECTION_COLOURS: Readonly<Record<string, string>> = { 'paths not taken': COLOUR.secondary, 'open questions': COLOUR.needs }

/**
 * A topic's brief: its place on the map, that it is decided in its
 * discussion, its summary, each section of the brief by its heading, and
 * the messages waiting for it.
 */
function briefLines(brief: Brief, kit: Kit): Line[] {
  const place = brief.order === null ? [] : [{ text: ` · topic ${brief.order} of ${brief.of}`, color: COLOUR.secondary }]
  const headed = brief.sections.filter(({ heading: named }) => named !== null)

  return [
    { key: 'brief:title', parts: [{ text: brief.title, bold: true }, ...place] },
    { key: 'brief:standing', parts: [{ text: 'What discovery heard: decided in its discussion, not here', color: COLOUR.secondary }] },
    blank('brief:title'),
    ...prose('brief:summary', brief.summary),
    ...headed.flatMap(({ heading: named, text }, at) => {
      const lines = pointsSection(`brief:${at}`, named ?? '', text, SECTION_COLOURS[(named ?? '').toLowerCase()] ?? COLOUR.sky, kit.width)

      return lines.length === 0 ? [] : [blank(`brief:${at}`), ...lines.slice(0, -1)]
    }),
    ...(brief.messages.length === 0
      ? []
      : [
          blank('brief:mail'),
          heading('brief:mail', { text: 'MESSAGES WAITING', bold: true, color: COLOUR.needs }, [{ text: `${brief.messages.length}`, color: COLOUR.secondary }], kit.width),
          ...messageList('brief:mail', brief.topic, brief.messages, kit.width),
        ]),
  ]
}

type SpikePage = Spike & { path: string; link: string | null }

/** A spike's page: its tool and standing, where it is kept, what it showed, and its live link. */
const spikePageLines = (spike: SpikePage, kit: Kit): Line[] => [
  ...titled(
    'spike',
    [{ text: `${spike.title} · a spike`, bold: true }],
    [{ text: [...(spike.tool === null ? [] : [spike.tool]), spike.status ?? 'not yet linked', `kept in ${spike.path}${spike.link === null ? '' : ' with its live link'}`].join(' · '), color: COLOUR.secondary }],
    kit.width,
  ).slice(0, -1),
  ...(spike.showed === null
    ? []
    : [blank('spike:showed'), heading('spike:showed', { text: 'WHAT IT SHOWED', bold: true, color: COLOUR.gold }, [], kit.width), ...prose('spike:showed', spike.showed)]),
  ...(spike.link === null ? [] : [blank('spike:link'), { key: 'spike:link', parts: cutTo([{ text: spike.link, color: COLOUR.secondary }], kit.width) }]),
]

export const DISCOVERY: ViewDrawing = {
  lines: (view, kit) => discoveryLines(view as View & Discovery, kit),
  name: () => 'discovery',
}

export const BRIEF: ViewDrawing = {
  lines: (view, kit) => briefLines(view as View & Brief, kit),
  name: view => (view as View & Brief).title,
}

export const SPIKE: ViewDrawing = {
  lines: (view, kit) => spikePageLines(view as View & SpikePage, kit),
  name: view => `the ${(view as View & SpikePage).title} spike`,
}
