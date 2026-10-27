import type { On } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

tier('user')

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The workflows' system config directory where the process names none. */
const DEFAULT_CONFIG = `${HOME}/.config/workflows`

/** The session's project, the repository's main checkout. */
const ROOT = '/Users/person/app'

/** A linked worktree of the project's repository, and the git directory its `.git` file names. */
const WORKTREE = '/Users/person/app-feature'
const WORKTREE_GIT = `${ROOT}/.git/worktrees/app-feature`

const REFUSAL =
  'Workflow manifests are written through the engine, never edited directly — use `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set|push|pull|delete|apply …` instead.'

/** What a write the mod lets through answers, beneath it. */
const WRITTEN = { result: { type: 'update' as const, filePath: '', content: '', structuredPatch: [], originalFile: null } }

/** The announcement a session the mod applies to carries from its start. */
const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' }

/**
 * The world beneath the mod: the process's environment (announced unless
 * told otherwise), the session's id and project, the folders the engine
 * `marked` under the config directory `markedIn`, and a file system of
 * `paths` with symbolic `links` (each from its
 * own path to where it leads), resolved as `realpath` does, and the
 * `contents` of the files read. The project is the main checkout of a
 * repository with a linked worktree at `WORKTREE`. Every file tool call the
 * mod lets through answers `WRITTEN`.
 */
function world(
  on: On,
  options: {
    env?: Readonly<Record<string, string>>
    marked?: readonly string[]
    markedIn?: string
    root?: string
    cwd?: string
    links?: Readonly<Record<string, string>>
    files?: readonly string[]
    contents?: Readonly<Record<string, string>>
  } = {},
) {
  const { env = ANNOUNCED, marked = ['s0'], markedIn = DEFAULT_CONFIG, root = ROOT, cwd = root, links = {}, files = [] } = options
  const contents: Record<string, string> = {
    [`${WORKTREE}/.git`]: `gitdir: ${WORKTREE_GIT}\n`,
    [`${WORKTREE_GIT}/commondir`]: '../..\n',
    ...options.contents,
  }
  const environment: Record<string, string> = { HOME, ...env }
  const paths = new Set([
    ...files,
    ...Object.keys(contents),
    `${ROOT}/.git/HEAD`,
    `${WORKTREE}/src/app.ts`,
    ...marked.map(id => `${markedIn}/conversations/${id}/workflow`),
    `${ROOT}/.leeway/manifest.json`,
    `${ROOT}/.leeway/pay/manifest.json`,
    `${ROOT}/.leeway/pay/discussion/ledger.md`,
    `${ROOT}/.leeway/pay/imports/manifest.json`,
    `${ROOT}/.leeway/.cache/pay/manifest.json`,
    `${ROOT}/package/manifest.json`,
    '/Users/person/other/.leeway/pay/manifest.json',
  ])
  const isDir = (path: string) => [...paths].some(p => p.startsWith(`${path}/`))
  const exists = (path: string) => path === '/' || paths.has(path) || isDir(path)

  /** Where `path` leads, every link on the way followed. */
  const realpath = (path: string): string => {
    const parts = path.split('/').filter(Boolean)
    let at = ''

    for (const part of parts) {
      at = part === '..' ? at.slice(0, at.lastIndexOf('/')) : `${at}/${part}`
      at = links[at] ?? at
    }

    return at || '/'
  }

  on('env.get', ($, e) => ({ value: environment[e.name] }))
  on('session.id', () => ({ value: 's0' }))
  on('session.root', () => ({ value: root }))
  on('session.cwd', () => ({ value: cwd }))
  on('fs.exists', ($, e) => ({ value: paths.has(e.path) }))
  on('fs.read', ($, e) => {
    const text = contents[realpath(e.path)]

    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: text }
  })

  on('fs.stat', ($, e) => {
    const real = realpath(e.path)

    if (!exists(real)) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return {
      value: {
        kind: paths.has(real) ? ('file' as const) : ('dir' as const),
        size: 0,
        mtimeMs: 0,
        isLink: e.path in links,
        ...(e.resolve ? { realPath: real } : {}),
      },
    }
  })

  on('tool.call', { tool: ['Write', 'Edit', 'NotebookEdit'] }, () => WRITTEN)
}

const write = (file_path: string) => ({ tool: 'Write' as const, file_path, content: '{}' })

const edit = (file_path: string) => ({
  tool: 'Edit' as const,
  file_path,
  old_string: '"status": "in-progress"',
  new_string: '"status": "completed"',
})

const notebook = (notebook_path: string) => ({ tool: 'NotebookEdit' as const, notebook_path, new_source: '' })

describe('the manifest guard', () => {
  test('refuses a file tool aimed at the project manifest or a work unit\'s', async ($, on) => {
    world(on)

    for (const call of [
      write(`${ROOT}/.leeway/manifest.json`),
      write(`${ROOT}/.leeway/pay/manifest.json`),
      edit(`${ROOT}/.leeway/pay/manifest.json`),
      notebook(`${ROOT}/.leeway/pay/manifest.json`),
    ]) {
      expect(await $.tool.call(call), JSON.stringify(call)).toEqual({ deny: REFUSAL })
    }
  })

  test('refuses a manifest the call names by another spelling — relative, through `..`, or through a link', async ($, on) => {
    world(on, { links: { '/Users/person/shortcut': `${ROOT}/.leeway/pay` } })

    for (const call of [
      write('.leeway/pay/manifest.json'),
      edit(`${ROOT}/.leeway/pay/discussion/../manifest.json`),
      edit('/Users/person/shortcut/manifest.json'),
    ]) {
      expect(await $.tool.call(call), JSON.stringify(call)).toEqual({ deny: REFUSAL })
    }
  })

  test('refuses a manifest named from the home directory', async ($, on) => {
    world(on)

    expect(await $.tool.call(edit('~/app/.leeway/pay/manifest.json'))).toEqual({ deny: REFUSAL })
    expect(await $.tool.call(edit('~/app/.leeway/pay/discussion/ledger.md'))).toEqual(WRITTEN)
  })

  test('refuses a manifest named relative to a working directory beneath the project root', async ($, on) => {
    world(on, { cwd: `${ROOT}/.leeway/pay/discussion` })

    expect(await $.tool.call(write('../manifest.json'))).toEqual({ deny: REFUSAL })
    expect(await $.tool.call(write('../../manifest.json'))).toEqual({ deny: REFUSAL })
    expect(await $.tool.call(edit('ledger.md'))).toEqual(WRITTEN)
  })

  test('refuses a manifest through a project whose .leeway/ is itself a link, by either spelling', async ($, on) => {
    const STORE = '/Users/person/store/workflows'

    world(on, {
      links: { [`${ROOT}/.leeway`]: STORE },
      files: [`${STORE}/manifest.json`, `${STORE}/pay/manifest.json`, `${STORE}/pay/discussion/ledger.md`],
    })

    for (const call of [
      write(`${ROOT}/.leeway/pay/manifest.json`),
      edit(`${STORE}/pay/manifest.json`),
      edit(`${STORE}/manifest.json`),
    ]) {
      expect(await $.tool.call(call), JSON.stringify(call)).toEqual({ deny: REFUSAL })
    }

    expect(await $.tool.call(edit(`${ROOT}/.leeway/pay/discussion/ledger.md`))).toEqual(WRITTEN)
  })

  test('refuses a file elsewhere that is a link to a manifest', async ($, on) => {
    world(on, { links: { '/Users/person/notes/state.json': `${ROOT}/.leeway/pay/manifest.json` } })

    expect(await $.tool.call(write('/Users/person/notes/state.json'))).toEqual({ deny: REFUSAL })
  })

  test('refuses a work unit\'s manifest not written yet, where its folder is not there either', async ($, on) => {
    world(on)

    expect(await $.tool.call(write(`${ROOT}/.leeway/fresh/manifest.json`))).toEqual({ deny: REFUSAL })
  })

  test('lets through any other file under .leeway/, and a manifest outside the project\'s .leeway/', async ($, on) => {
    world(on)

    for (const call of [
      edit(`${ROOT}/.leeway/pay/discussion/ledger.md`),
      write(`${ROOT}/.leeway/pay/imports/manifest.json`),
      write(`${ROOT}/.leeway/.cache/pay/manifest.json`),
      write(`${ROOT}/package/manifest.json`),
      edit('/Users/person/other/.leeway/pay/manifest.json'),
      write(`${ROOT}/.leeway/manifest.json.bak`),
    ]) {
      expect(await $.tool.call(call), JSON.stringify(call)).toEqual(WRITTEN)
    }
  })

  test('refuses the state\'s manifests from a session in a linked worktree of the repository', async ($, on) => {
    world(on, { root: WORKTREE })

    for (const call of [
      write(`${ROOT}/.leeway/manifest.json`),
      edit(`${ROOT}/.leeway/pay/manifest.json`),
      edit('../app/.leeway/pay/manifest.json'),
    ]) {
      expect(await $.tool.call(call), JSON.stringify(call)).toEqual({ deny: REFUSAL })
    }

    expect(await $.tool.call(write(`${WORKTREE}/.leeway/pay/manifest.json`))).toEqual(WRITTEN)
    expect(await $.tool.call(edit(`${ROOT}/.leeway/pay/discussion/ledger.md`))).toEqual(WRITTEN)
  })

  test('finds the main checkout from a session rooted below a worktree\'s top, and from one whose `.git` names its git directory relatively', async ($, on) => {
    world(on, { root: `${WORKTREE}/src`, contents: { [`${WORKTREE}/.git`]: 'gitdir: ../app/.git/worktrees/app-feature\n' } })

    expect(await $.tool.call(edit(`${ROOT}/.leeway/pay/manifest.json`))).toEqual({ deny: REFUSAL })
  })

  test('lets every write through where the session\'s folder is in no repository, or in one with no main checkout', async ($, on) => {
    world(on, { root: '/Users/person/loose', files: ['/Users/person/loose/notes.md'] })

    expect(await $.tool.call(write(`${ROOT}/.leeway/pay/manifest.json`))).toEqual(WRITTEN)
  })

  test('finds the conversation in the config directory the process names, never under the home directory', async ($, on) => {
    const config = '/Users/person/state/workflows'

    world(on, { env: { ...ANNOUNCED, WORKFLOWS_CONFIG_DIR: config }, markedIn: config })

    expect(await $.tool.call(write(`${ROOT}/.leeway/pay/manifest.json`))).toEqual({ deny: REFUSAL })
  })

  test('lets every write through in a conversation the engine has not marked', async ($, on) => {
    world(on, { marked: [] })

    expect(await $.tool.call(write(`${ROOT}/.leeway/pay/manifest.json`))).toEqual(WRITTEN)
    expect(await $.tool.call(edit(`${ROOT}/.leeway/manifest.json`))).toEqual(WRITTEN)
  })

  for (const env of [{}, { WORKFLOWS_GATE_SURFACE: '0' }] as Readonly<Record<string, string>>[]) {
    test(`lets every write through in a session that did not announce — ${JSON.stringify(env)}`, async ($, on) => {
      world(on, { env })

      expect(await $.tool.call(write(`${ROOT}/.leeway/pay/manifest.json`))).toEqual(WRITTEN)
      expect(await $.tool.call(edit(`${ROOT}/.leeway/manifest.json`))).toEqual(WRITTEN)
    })
  }
})
