import { describe, expect, it } from 'vitest'
import { LESSONS } from './lessons'
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
  simulateTeammateCommit,
  stageChange,
  type SimState,
} from './gitSimulator'

function commitOnCurrentBranch(state: SimState, message: string): SimState {
  return commitChange(stageChange(editFile(state)), message)
}

function lessonById(id: string) {
  const lesson = LESSONS.find((l) => l.id === id)
  if (!lesson) throw new Error(`Lección no encontrada: ${id}`)
  return lesson
}

// Recorre la MISMA secuencia que se espera que siga alguien usando la UI, paso
// a paso, comprobando en cada punto que el paso correspondiente pasa de
// incompleto a completo exactamente cuando debería — ni antes ni después.
describe('LESSONS sequence', () => {
  it('walks through all 10 steps in order, matching the intended UI flow', () => {
    let state = createInitialState()

    expect(lessonById('first-commit').isComplete(state)).toBe(false)
    state = commitOnCurrentBranch(state, 'primer commit')
    expect(lessonById('first-commit').isComplete(state)).toBe(true)

    expect(lessonById('create-branch').isComplete(state)).toBe(false)
    state = createBranch(state, 'feature')
    expect(lessonById('create-branch').isComplete(state)).toBe(true)

    expect(lessonById('checkout').isComplete(state)).toBe(false)
    state = checkout(state, 'feature')
    expect(lessonById('checkout').isComplete(state)).toBe(true)

    expect(lessonById('second-commit').isComplete(state)).toBe(false)
    state = commitOnCurrentBranch(state, 'commit en feature')
    expect(lessonById('second-commit').isComplete(state)).toBe(true)

    expect(lessonById('back-to-main').isComplete(state)).toBe(false)
    state = checkout(state, 'main')
    expect(lessonById('back-to-main').isComplete(state)).toBe(true)

    // Para que el merge sea un merge real (2 padres) y no un fast-forward,
    // main también necesita haber avanzado desde el punto de la rama.
    state = commitOnCurrentBranch(state, 'commit en main')

    expect(lessonById('merge').isComplete(state)).toBe(false)
    state = merge(state, 'feature')
    expect(lessonById('merge').isComplete(state)).toBe(true)

    expect(lessonById('push').isComplete(state)).toBe(false)
    state = push(state)
    expect(lessonById('push').isComplete(state)).toBe(true)

    expect(lessonById('teammate').isComplete(state)).toBe(false)
    state = simulateTeammateCommit(state)
    expect(lessonById('teammate').isComplete(state)).toBe(true)

    expect(lessonById('fetch').isComplete(state)).toBe(false)
    state = fetch(state)
    expect(lessonById('fetch').isComplete(state)).toBe(true)

    expect(lessonById('pull').isComplete(state)).toBe(false)
    state = pull(state)
    expect(lessonById('pull').isComplete(state)).toBe(true)
  })

  it('has unique, non-empty ids for every step', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id) => expect(id.length).toBeGreaterThan(0))
  })
})
