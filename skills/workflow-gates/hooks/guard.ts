/**
 * The workflows' manifests are the engine's to write: in a conversation the
 * engine has marked, a file tool aimed at a work unit's manifest or the
 * project manifest is refused, wherever its path leads from.
 */
import type { EngineInterface, On } from 'claude-code'

import { MARKER, folderOf } from './folder.ts'

const REFUSAL =
  'Workflow manifests are written through the engine, never edited directly — use `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set|push|pull|delete|apply …` instead.'

const MANIFEST = 'manifest.json'

/** Whether the engine has marked the session's conversation as one that runs the workflows. */
async function isWorkflow($: EngineInterface): Promise<boolean> {
  const folder = folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`))
}

/**
 * Where a path lands, every link followed: the nearest part of it that
 * exists resolved, the rest of its spelling after it — a file not there yet
 * lands where writing it would put it. Undefined where nothing resolves.
 */
async function landing(
  $: EngineInterface,
  path: string,
): Promise<string | undefined> {
  const absolute = path.startsWith('/') ? path : `${await $.session.cwd()}/${path}`
  const parts: string[] = []

  for (const part of absolute.split('/')) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '' && part !== '.') {
      parts.push(part)
    }
  }

  for (let n = parts.length; n >= 0; n -= 1) {
    const stat = await $.fs
      .stat(`/${parts.slice(0, n).join('/')}`, { resolve: true })
      .catch(() => undefined)

    if (stat?.realPath !== undefined) {
      return [stat.realPath.replace(/\/$/, ''), ...parts.slice(n)].join('/')
    }
  }

  return undefined
}

/**
 * Whether `path` lands on a manifest the engine keeps under the session's
 * project: `.workflows/manifest.json`, or a work unit's own one level down.
 */
async function isManifest($: EngineInterface, path: string): Promise<boolean> {
  const workflows = await landing($, `${await $.session.root()}/.workflows`)
  const real = await landing($, path)

  if (workflows === undefined || real === undefined || !real.startsWith(`${workflows}/`)) {
    return false
  }

  const [first, second, ...deeper] = real.slice(workflows.length + 1).split('/')

  return second === undefined
    ? first === MANIFEST
    : second === MANIFEST && deeper.length === 0 && first !== undefined && !first.startsWith('.')
}

export function guard(on: On) {
  on('tool.call', { tool: ['Write', 'Edit', 'NotebookEdit'] }, async ($, e, next) => {
    const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path

    if (!(await isWorkflow($)) || !(await isManifest($, path))) {
      return next(e)
    }

    return { deny: REFUSAL }
  }).catch(($, e, next) => next(e))
}
