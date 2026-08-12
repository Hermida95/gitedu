import type { Commit } from '../../shared/ipc-contract'

// Motor puro (sin IPC, sin disco, sin red) que simula el modelo de datos de git
// lo suficiente para enseñar: commits con padres, ramas como punteros, merge,
// rebase, y la diferencia entre fetch (solo actualiza tu vista de "origin/...")
// y pull (además fusiona). No simula conflictos de contenido de verdad, porque
// aquí no hay ficheros reales con líneas que puedan chocar.

export interface SimCommit {
  id: string
  parents: string[]
  message: string
}

export interface SimState {
  commits: SimCommit[]
  branches: Record<string, string | null> // null = rama "por nacer", sin commits (como recién hecho `git init`)
  currentBranch: string
  hasPendingChange: boolean
  staged: boolean
  remoteBranches: Record<string, string> // estado real del remoto simulado
  localOriginRefs: Record<string, string> // lo que tu copia local sabe del remoto, tras el último fetch
}

function randomHash(): string {
  return Math.random().toString(16).slice(2, 9)
}

export function createInitialState(): SimState {
  return {
    commits: [],
    branches: { main: null },
    currentBranch: 'main',
    hasPendingChange: false,
    staged: false,
    remoteBranches: {},
    localOriginRefs: {},
  }
}

export function editFile(state: SimState): SimState {
  return { ...state, hasPendingChange: true, staged: false }
}

export function stageChange(state: SimState): SimState {
  if (!state.hasPendingChange) return state
  return { ...state, staged: true }
}

export function unstageChange(state: SimState): SimState {
  return { ...state, staged: false }
}

export function commitChange(state: SimState, message: string): SimState {
  if (!state.staged) return state
  const parentId = state.branches[state.currentBranch]
  const newCommit: SimCommit = { id: randomHash(), parents: parentId ? [parentId] : [], message }
  return {
    ...state,
    commits: [...state.commits, newCommit],
    branches: { ...state.branches, [state.currentBranch]: newCommit.id },
    hasPendingChange: false,
    staged: false,
  }
}

export function createBranch(state: SimState, name: string): SimState {
  if (!name || name in state.branches) return state
  return { ...state, branches: { ...state.branches, [name]: state.branches[state.currentBranch] } }
}

export function checkout(state: SimState, name: string): SimState {
  if (!(name in state.branches)) return state
  return { ...state, currentBranch: name }
}

function isAncestor(commits: SimCommit[], ancestorId: string, descendantId: string): boolean {
  const byId = new Map(commits.map((c) => [c.id, c]))
  const stack = [descendantId]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop()!
    if (id === ancestorId) return true
    if (seen.has(id)) continue
    seen.add(id)
    const commit = byId.get(id)
    if (commit) stack.push(...commit.parents)
  }
  return false
}

export function merge(state: SimState, branchName: string): SimState {
  const currentTip = state.branches[state.currentBranch]
  const otherTip = state.branches[branchName]
  if (!otherTip || branchName === state.currentBranch) return state

  if (!currentTip) {
    return { ...state, branches: { ...state.branches, [state.currentBranch]: otherTip } }
  }
  if (currentTip === otherTip || isAncestor(state.commits, otherTip, currentTip)) {
    return state // ya está al día
  }
  if (isAncestor(state.commits, currentTip, otherTip)) {
    // fast-forward: mover el puntero, sin commit de merge
    return { ...state, branches: { ...state.branches, [state.currentBranch]: otherTip } }
  }

  const mergeCommit: SimCommit = {
    id: randomHash(),
    parents: [currentTip, otherTip],
    message: `Merge de '${branchName}' en '${state.currentBranch}'`,
  }
  return {
    ...state,
    commits: [...state.commits, mergeCommit],
    branches: { ...state.branches, [state.currentBranch]: mergeCommit.id },
  }
}

export function rebase(state: SimState, ontoBranch: string): SimState {
  const ontoTip = state.branches[ontoBranch]
  const currentTip = state.branches[state.currentBranch]
  if (!ontoTip || !currentTip || ontoBranch === state.currentBranch) return state
  if (isAncestor(state.commits, ontoTip, currentTip)) return state // ya está basado en eso

  const byId = new Map(state.commits.map((c) => [c.id, c]))
  const ontoAncestors = new Set<string>()
  const collect = (id: string) => {
    if (ontoAncestors.has(id)) return
    ontoAncestors.add(id)
    byId.get(id)?.parents.forEach(collect)
  }
  collect(ontoTip)

  const uniqueChain: SimCommit[] = []
  let cursor: string | undefined = currentTip
  while (cursor && !ontoAncestors.has(cursor)) {
    const c = byId.get(cursor)
    if (!c) break
    uniqueChain.unshift(c)
    cursor = c.parents[0]
  }

  let newParent = ontoTip
  const newCommits: SimCommit[] = []
  for (const c of uniqueChain) {
    const replayed: SimCommit = { id: randomHash(), parents: [newParent], message: c.message }
    newCommits.push(replayed)
    newParent = replayed.id
  }

  return {
    ...state,
    commits: [...state.commits, ...newCommits],
    branches: { ...state.branches, [state.currentBranch]: newParent },
  }
}

export function push(state: SimState): SimState {
  const tip = state.branches[state.currentBranch]
  if (!tip) return state
  return {
    ...state,
    remoteBranches: { ...state.remoteBranches, [state.currentBranch]: tip },
    localOriginRefs: { ...state.localOriginRefs, [state.currentBranch]: tip },
  }
}

export function fetch(state: SimState): SimState {
  return { ...state, localOriginRefs: { ...state.remoteBranches } }
}

export function pull(state: SimState): SimState {
  const fetched = fetch(state)
  const remoteTip = fetched.localOriginRefs[fetched.currentBranch]
  const currentTip = fetched.branches[fetched.currentBranch]
  if (!remoteTip) return fetched

  if (!currentTip) {
    return { ...fetched, branches: { ...fetched.branches, [fetched.currentBranch]: remoteTip } }
  }
  if (currentTip === remoteTip || isAncestor(fetched.commits, remoteTip, currentTip)) {
    return fetched
  }
  if (isAncestor(fetched.commits, currentTip, remoteTip)) {
    return { ...fetched, branches: { ...fetched.branches, [fetched.currentBranch]: remoteTip } }
  }

  const mergeCommit: SimCommit = {
    id: randomHash(),
    parents: [currentTip, remoteTip],
    message: `Merge remote-tracking branch 'origin/${fetched.currentBranch}'`,
  }
  return {
    ...fetched,
    commits: [...fetched.commits, mergeCommit],
    branches: { ...fetched.branches, [fetched.currentBranch]: mergeCommit.id },
  }
}

// Solo para la enseñanza: simula que alguien más ha subido un commit al remoto,
// sin que tú lo sepas todavía (hace falta fetch/pull para verlo).
export function simulateTeammateCommit(state: SimState): SimState {
  const base = state.remoteBranches[state.currentBranch] ?? state.branches[state.currentBranch] ?? null
  const newCommit: SimCommit = {
    id: randomHash(),
    parents: base ? [base] : [],
    message: 'Cambio de un compañero de equipo',
  }
  return {
    ...state,
    commits: [...state.commits, newCommit],
    remoteBranches: { ...state.remoteBranches, [state.currentBranch]: newCommit.id },
  }
}

// Igual que `git log --all`: solo se muestran los commits alcanzables desde
// alguna referencia actual. Tras un rebase, los commits originales (ya sin
// ninguna rama apuntándolos) dejan de ser alcanzables y desaparecen del
// grafo — exactamente como en un repositorio real.
function reachableCommitIds(state: SimState): Set<string> {
  const byId = new Map(state.commits.map((c) => [c.id, c]))
  const reachable = new Set<string>()
  const visit = (id: string | null | undefined) => {
    if (!id || reachable.has(id)) return
    reachable.add(id)
    byId.get(id)?.parents.forEach(visit)
  }
  Object.values(state.branches).forEach(visit)
  Object.values(state.localOriginRefs).forEach(visit)
  return reachable
}

export function simStateToCommits(state: SimState): Commit[] {
  const refsByCommit = new Map<string, string[]>()
  const addRef = (id: string | null, name: string) => {
    if (!id) return
    const existing = refsByCommit.get(id) ?? []
    existing.push(name)
    refsByCommit.set(id, existing)
  }
  for (const [name, id] of Object.entries(state.branches)) addRef(id, name)
  for (const [name, id] of Object.entries(state.localOriginRefs)) addRef(id, `origin/${name}`)

  const reachable = reachableCommitIds(state)

  return state.commits
    .filter((c) => reachable.has(c.id))
    .map((c) => ({
      hash: c.id,
      shortHash: c.id,
      parents: c.parents,
      author: 'Tú',
      date: new Date().toISOString(),
      message: c.message,
      refs: refsByCommit.get(c.id) ?? [],
    }))
}
