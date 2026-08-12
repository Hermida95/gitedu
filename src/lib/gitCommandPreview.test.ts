import { describe, expect, it } from 'vitest'
import { buildCommandPreview, type GitAction } from './gitCommandPreview'

const ALL_ACTIONS: GitAction[] = [
  { type: 'commit', message: 'hola' },
  { type: 'createBranch', name: 'feature' },
  { type: 'checkoutBranch', name: 'feature' },
  { type: 'mergeBranch', branchName: 'feature', currentBranch: 'main' },
  { type: 'rebaseBranch', ontoBranch: 'main', currentBranch: 'feature' },
  { type: 'push' },
  { type: 'fetch' },
  { type: 'pull' },
  { type: 'stashSave', message: 'wip' },
  { type: 'stashPop', index: 0, stashMessage: 'wip' },
  { type: 'stashDrop', index: 0, stashMessage: 'wip' },
  { type: 'initRepo', folderPath: '/tmp/algo' },
]

describe('buildCommandPreview', () => {
  it('returns a non-empty title, command, description and danger flag for every action type', () => {
    for (const action of ALL_ACTIONS) {
      const preview = buildCommandPreview(action)
      expect(preview.title.length, `title for ${action.type}`).toBeGreaterThan(0)
      expect(preview.command.length, `command for ${action.type}`).toBeGreaterThan(0)
      expect(preview.description.length, `description for ${action.type}`).toBeGreaterThan(0)
      expect(typeof preview.danger, `danger for ${action.type}`).toBe('boolean')
    }
  })

  it('the command always starts with "git" (it is always a real git invocation)', () => {
    for (const action of ALL_ACTIONS) {
      expect(buildCommandPreview(action).command.startsWith('git')).toBe(true)
    }
  })

  it('marks rebase and push as dangerous, and read-only/reversible actions as not', () => {
    expect(buildCommandPreview({ type: 'rebaseBranch', ontoBranch: 'main', currentBranch: 'f' }).danger).toBe(true)
    expect(buildCommandPreview({ type: 'push' }).danger).toBe(true)
    expect(buildCommandPreview({ type: 'stashDrop', index: 0, stashMessage: 'x' }).danger).toBe(true)

    expect(buildCommandPreview({ type: 'fetch' }).danger).toBe(false)
    expect(buildCommandPreview({ type: 'pull' }).danger).toBe(false)
    expect(buildCommandPreview({ type: 'commit', message: 'x' }).danger).toBe(false)
    expect(buildCommandPreview({ type: 'mergeBranch', branchName: 'f', currentBranch: 'main' }).danger).toBe(false)
  })

  it('embeds the actual branch name and message into the command text', () => {
    const preview = buildCommandPreview({ type: 'checkoutBranch', name: 'my-feature' })
    expect(preview.command).toBe('git checkout my-feature')

    const commitPreview = buildCommandPreview({ type: 'commit', message: 'fix: algo' })
    expect(commitPreview.command).toContain('fix: algo')
  })
})
