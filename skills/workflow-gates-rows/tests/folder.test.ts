import { describe, expect, test, tier } from 'claude-code/testing'

import { folderOf } from '../hooks/folder.ts'

tier('user')

describe('folderOf', () => {
  test('the folder the engine names: the system config directory, by the session id', () => {
    expect(folderOf(undefined, '/Users/person', 's0')).toBe('/Users/person/.config/workflows/conversations/s0')
  })

  test('the directory WORKFLOWS_CONFIG_DIR names, over the home', () => {
    expect(folderOf('/Users/person/elsewhere', '/Users/person', 's0')).toBe('/Users/person/elsewhere/conversations/s0')
  })

  test('the home\'s .config/workflows while WORKFLOWS_CONFIG_DIR is empty', () => {
    expect(folderOf('', '/Users/person', 's0')).toBe('/Users/person/.config/workflows/conversations/s0')
  })

  test('the session id\'s safe characters alone, so no id escapes the store', () => {
    expect(folderOf('/cfg', undefined, 'a/../../evil')).toBe('/cfg/conversations/aevil')
    expect(folderOf('/cfg', undefined, 'sess_1-A.b c')).toBe('/cfg/conversations/sess_1-Abc')
  })

  test('none where the process names neither directory', () => {
    expect(folderOf(undefined, undefined, 's0')).toBe(null)
    expect(folderOf('', '', 's0')).toBe(null)
  })
})
