import { describe, expect, it } from 'vitest'
import { extractGitErrorMessage, parsePorcelainV2 } from './gitService'

describe('parsePorcelainV2', () => {
  it('parses branch name, upstream and ahead/behind counts', () => {
    const output = [
      '# branch.oid abc123',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
    ].join('\n')

    const result = parsePorcelainV2(output)
    expect(result.branch).toBe('main')
    expect(result.upstream).toBe('origin/main')
    expect(result.ahead).toBe(2)
    expect(result.behind).toBe(1)
    expect(result.files).toEqual([])
  })

  it('treats a detached HEAD as branch: null', () => {
    const result = parsePorcelainV2('# branch.head (detached)')
    expect(result.branch).toBeNull()
  })

  it('classifies a staged file (index differs from HEAD, worktree clean)', () => {
    const line = '1 M. N... 100644 100644 100644 aaaa bbbb src/App.tsx'
    const result = parsePorcelainV2(line)
    expect(result.files).toEqual([{ path: 'src/App.tsx', status: 'staged', raw: 'M.' }])
  })

  it('classifies an unstaged file (worktree differs from index)', () => {
    const line = '1 .M N... 100644 100644 100644 aaaa bbbb src/App.tsx'
    const result = parsePorcelainV2(line)
    expect(result.files).toEqual([{ path: 'src/App.tsx', status: 'unstaged', raw: '.M' }])
  })

  it('classifies an untracked file', () => {
    const result = parsePorcelainV2('? new-file.txt')
    expect(result.files).toEqual([{ path: 'new-file.txt', status: 'untracked', raw: '??' }])
  })

  it('classifies a conflicted (unmerged) file', () => {
    const line = 'u UU N... 100644 100644 100644 100644 aaaa bbbb cccc conflict.txt'
    const result = parsePorcelainV2(line)
    expect(result.files).toEqual([{ path: 'conflict.txt', status: 'conflicted', raw: 'UU' }])
  })

  it('parses a realistic multi-file status block end to end', () => {
    const output = [
      '# branch.oid abc123',
      '# branch.head feature',
      '1 M. N... 100644 100644 100644 aaaa bbbb staged.txt',
      '1 .M N... 100644 100644 100644 aaaa bbbb unstaged.txt',
      '? untracked.txt',
    ].join('\n')

    const result = parsePorcelainV2(output)
    expect(result.branch).toBe('feature')
    expect(result.files.map((f) => f.path)).toEqual(['staged.txt', 'unstaged.txt', 'untracked.txt'])
    expect(result.files.map((f) => f.status)).toEqual(['staged', 'unstaged', 'untracked'])
  })

  it('returns sensible defaults for an empty (clean, no-branch-line) status', () => {
    const result = parsePorcelainV2('')
    expect(result.branch).toBeNull()
    expect(result.upstream).toBeNull()
    expect(result.ahead).toBe(0)
    expect(result.behind).toBe(0)
    expect(result.files).toEqual([])
  })

  it('parses real `git status --porcelain=v2 --branch` output captured from an actual repo', () => {
    // Capturado literalmente de un repo real con un fichero staged (con cambios
    // extra sin stagear encima), uno solo unstaged, y uno sin rastrear — no es
    // una cadena inventada a mano para que encaje con el parser.
    const real = [
      '# branch.oid 2a5f4e6fa7c2cac30c87242eb8fa62cfc7ad0c83',
      '# branch.head main',
      '1 M. N... 100644 100644 100644 78981922613b2afb6025042ff6bd878ac1994e85 422c2b7ab3b3c668038da977e4e93a5fc623169c staged.txt',
      '1 .M N... 100644 100644 100644 f2ad6c76f0115a6ba5b00456a849810e7ec0af20 f2ad6c76f0115a6ba5b00456a849810e7ec0af20 unstaged.txt',
      '? untracked.txt',
    ].join('\n')

    const result = parsePorcelainV2(real)
    expect(result.branch).toBe('main')
    expect(result.files).toEqual([
      { path: 'staged.txt', status: 'staged', raw: 'M.' },
      { path: 'unstaged.txt', status: 'unstaged', raw: '.M' },
      { path: 'untracked.txt', status: 'untracked', raw: '??' },
    ])
  })
})

describe('extractGitErrorMessage', () => {
  it('prefers stderr when present (this is the actual bug this function fixes)', () => {
    const err = { message: 'Command failed: git merge foo', stderr: 'CONFLICT (content): Merge conflict in a.txt' }
    expect(extractGitErrorMessage(err)).toBe('CONFLICT (content): Merge conflict in a.txt')
  })

  it('falls back to stdout when stderr is empty (git diff --no-index puts its output there)', () => {
    const err = { message: 'Command failed', stderr: '', stdout: 'diff --git a/x b/x\n+hello\n' }
    expect(extractGitErrorMessage(err)).toBe('diff --git a/x b/x\n+hello')
  })

  it('falls back to .message when neither stdout nor stderr has content', () => {
    const err = { message: 'Command failed: git status', stderr: '', stdout: '' }
    expect(extractGitErrorMessage(err)).toBe('Command failed: git status')
  })

  it('handles a plain Error with no stdout/stderr fields', () => {
    expect(extractGitErrorMessage(new Error('algo raro'))).toBe('algo raro')
  })

  it('handles a non-object thrown value without crashing', () => {
    expect(extractGitErrorMessage('just a string')).toBe('just a string')
  })
})
