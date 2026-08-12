import { describe, expect, it } from 'vitest'
import {
  checkout,
  commitChange,
  createBranch,
  createInitialState,
  editFile,
  fetch,
  merge,
  pull,
  push,
  rebase,
  simStateToCommits,
  simulateTeammateCommit,
  stageChange,
  unstageChange,
  type SimState,
} from './gitSimulator'

function commitOnCurrentBranch(state: SimState, message: string): SimState {
  return commitChange(stageChange(editFile(state)), message)
}

describe('createInitialState', () => {
  it('starts with an unborn main branch and no commits, like a fresh git init', () => {
    const state = createInitialState()
    expect(state.commits).toHaveLength(0)
    expect(state.branches.main).toBeNull()
    expect(state.currentBranch).toBe('main')
  })
})

describe('the first commit', () => {
  it('has no parents and becomes the tip of the current branch', () => {
    const state = commitOnCurrentBranch(createInitialState(), 'primer commit')
    expect(state.commits).toHaveLength(1)
    expect(state.commits[0].parents).toEqual([])
    expect(state.branches.main).toBe(state.commits[0].id)
  })
})

describe('stage/unstage', () => {
  it('commitChange is a no-op until the change is staged', () => {
    const edited = editFile(createInitialState())
    const notStaged = commitChange(edited, 'no debería contar')
    expect(notStaged.commits).toHaveLength(0)
  })

  it('unstageChange clears staged without discarding the pending change', () => {
    const staged = stageChange(editFile(createInitialState()))
    expect(staged.staged).toBe(true)
    const unstaged = unstageChange(staged)
    expect(unstaged.staged).toBe(false)
    expect(unstaged.hasPendingChange).toBe(true)
  })
})

describe('branching and divergence', () => {
  it('createBranch points the new branch at the current tip without switching to it', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = createBranch(state, 'feature')
    expect(state.branches.feature).toBe(state.branches.main)
    expect(state.currentBranch).toBe('main')
  })

  it('commits on separate branches make them diverge', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = createBranch(state, 'feature')
    state = commitOnCurrentBranch(state, 'commit en main')
    state = checkout(state, 'feature')
    state = commitOnCurrentBranch(state, 'commit en feature')
    expect(state.branches.main).not.toBe(state.branches.feature)
    expect(state.commits).toHaveLength(3)
  })
})

describe('merge', () => {
  it('fast-forwards (no merge commit) when the current branch is a straight ancestor', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = createBranch(state, 'feature')
    state = checkout(state, 'feature')
    state = commitOnCurrentBranch(state, 'feature avanza')
    const countBeforeMerge = state.commits.length

    state = checkout(state, 'main')
    state = merge(state, 'feature')

    expect(state.commits).toHaveLength(countBeforeMerge)
    expect(state.branches.main).toBe(state.branches.feature)
  })

  it('creates a two-parent merge commit when the branches genuinely diverged', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = createBranch(state, 'feature')
    const mainTipBeforeDiverge = state.branches.main

    state = commitOnCurrentBranch(state, 'commit en main')
    const mainTip = state.branches.main

    state = checkout(state, 'feature')
    state = commitOnCurrentBranch(state, 'commit en feature')
    const featureTip = state.branches.feature

    state = checkout(state, 'main')
    const countBeforeMerge = state.commits.length
    state = merge(state, 'feature')

    expect(state.commits).toHaveLength(countBeforeMerge + 1)
    const mergeCommit = state.commits[state.commits.length - 1]
    expect(mergeCommit.parents).toHaveLength(2)
    expect(mergeCommit.parents).toContain(mainTip)
    expect(mergeCommit.parents).toContain(featureTip)
    expect(mainTipBeforeDiverge).not.toBe(mainTip) // sanity: main did move before merging
  })

  it('is a no-op when the target branch is already fully contained', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = createBranch(state, 'feature')
    const before = state
    state = merge(state, 'feature')
    expect(state).toEqual(before)
  })
})

describe('rebase', () => {
  it('replays commits with new hashes and drops the orphaned originals from the visible graph', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = createBranch(state, 'feature')
    state = checkout(state, 'main')
    state = commitOnCurrentBranch(state, 'main avanza')
    state = checkout(state, 'feature')
    state = commitOnCurrentBranch(state, 'feature commit 1')
    const originalFeatureCommit1 = state.branches.feature
    state = commitOnCurrentBranch(state, 'feature commit 2')

    state = rebase(state, 'main')

    // El hash original ya no es alcanzable desde ninguna rama...
    const visibleIds = new Set(simStateToCommits(state).map((c) => c.hash))
    expect(visibleIds.has(originalFeatureCommit1!)).toBe(false)
    // ...pero el mensaje sigue presente, con un hash nuevo.
    expect(state.commits.some((c) => c.message === 'feature commit 1' && c.id !== originalFeatureCommit1)).toBe(
      true
    )
  })
})

describe('fetch vs. pull', () => {
  it('fetch updates the local view of origin/* without touching the local branch', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = push(state)
    state = simulateTeammateCommit(state)

    const localMainBefore = state.branches.main
    expect(state.localOriginRefs.main).not.toBe(state.remoteBranches.main) // aún no lo hemos visto

    state = fetch(state)

    expect(state.localOriginRefs.main).toBe(state.remoteBranches.main)
    expect(state.branches.main).toBe(localMainBefore) // fetch no tocó la rama local
  })

  it('pull fetches AND fast-forwards the local branch to match', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = push(state)
    state = simulateTeammateCommit(state)

    state = pull(state)

    expect(state.branches.main).toBe(state.remoteBranches.main)
  })
})

describe('simStateToCommits (visible graph)', () => {
  it('attaches branch and origin/* labels to the right commits', () => {
    let state = commitOnCurrentBranch(createInitialState(), 'base')
    state = push(state)
    const commits = simStateToCommits(state)
    expect(commits).toHaveLength(1)
    expect(commits[0].refs).toEqual(expect.arrayContaining(['main', 'origin/main']))
  })
})
