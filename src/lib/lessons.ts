import type { SimState } from './gitSimulator'

export interface LessonStep {
  id: string
  title: string
  instruction: string
  hint: string
  isComplete: (state: SimState) => boolean
}

// Secuencia deliberada: cada paso hace divergir main/feature un poco más antes
// de fusionar, para que el merge del paso 7 sea un merge real (con dos padres)
// y no un fast-forward — así se ve el caso más instructivo, no el más simple.
// El paso 'diverge-main' es imprescindible para eso: sin un commit propio en
// main después de crear la rama, main sigue siendo antecesor directo de
// feature y el "merge" sería solo mover el puntero (fast-forward), sin
// generar nunca el commit de dos padres que el paso 'merge' exige completar.
export const LESSONS: LessonStep[] = [
  {
    id: 'first-commit',
    title: 'Tu primer commit',
    instruction: 'Todo repositorio empieza vacío. Simula un cambio en un fichero, prepáralo y haz tu primer commit.',
    hint: '"Simular un cambio en un fichero" → "Stage" → escribe un mensaje → "Commit".',
    isComplete: (state) => state.commits.length >= 1,
  },
  {
    id: 'create-branch',
    title: 'Crear una rama',
    instruction: 'Las ramas son solo punteros a un commit, crearlas es barato. Crea una rama nueva llamada "feature".',
    hint: 'Escribe "feature" en el campo de nueva rama y pulsa "Crear".',
    isComplete: (state) => 'feature' in state.branches,
  },
  {
    id: 'checkout',
    title: 'Cambiar de rama',
    instruction: 'Cambia a la rama "feature" para trabajar ahí sin tocar main todavía.',
    hint: 'En la lista de ramas, pulsa "Checkout" junto a "feature".',
    isComplete: (state) => state.currentBranch === 'feature',
  },
  {
    id: 'second-commit',
    title: 'Un commit en la rama nueva',
    instruction: 'Haz otro commit, esta vez en "feature". A partir de aquí, main y feature empiezan a divergir.',
    hint: 'El mismo proceso de antes: simular cambio → stage → commit.',
    isComplete: (state) =>
      state.currentBranch === 'feature' && !!state.branches.feature && state.commits.length >= 2,
  },
  {
    id: 'back-to-main',
    title: 'Volver a main',
    instruction: 'Vuelve a la rama "main" — es donde vas a traer los cambios de "feature".',
    hint: 'Checkout en "main".',
    isComplete: (state) => state.currentBranch === 'main',
  },
  {
    id: 'diverge-main',
    title: 'Avanzar main también',
    instruction:
      'Para que el merge sea interesante, main también necesita su propio commit — si no, fusionar sería un simple "fast-forward" sin nada que ver. Simula otro cambio y commitea aquí, en main.',
    hint: 'Igual que antes: simular cambio → stage → commit, ahora estando en main.',
    isComplete: (state) => state.currentBranch === 'main' && state.commits.length >= 3,
  },
  {
    id: 'merge',
    title: 'Fusionar (merge)',
    instruction: 'Fusiona "feature" en "main". Como divergieron, verás aparecer un commit de merge con dos padres.',
    hint: 'Selecciona "feature" en el desplegable de ramas y pulsa "Merge en main".',
    isComplete: (state) => {
      const mainTip = state.branches.main
      const mainCommit = mainTip ? state.commits.find((c) => c.id === mainTip) : undefined
      return !!mainCommit && mainCommit.parents.length === 2
    },
  },
  {
    id: 'push',
    title: 'Subir con push',
    instruction: 'Sube tu rama "main" al remoto simulado.',
    hint: 'Botón "Push", abajo del todo.',
    isComplete: (state) => !!state.branches.main && state.remoteBranches.main === state.branches.main,
  },
  {
    id: 'teammate',
    title: 'El cambio de un compañero',
    instruction: 'En un equipo real, otras personas suben cambios sin que tú te enteres al momento. Simula ese escenario.',
    hint: 'Botón "Simular cambio de un compañero".',
    isComplete: (state) =>
      !!state.remoteBranches.main && state.remoteBranches.main !== state.localOriginRefs.main,
  },
  {
    id: 'fetch',
    title: 'Fetch: enterarte sin tocar nada',
    instruction: 'Haz fetch para ver que el remoto avanzó — fíjate en que tu rama local main no se mueve todavía.',
    hint: 'Botón "Fetch".',
    isComplete: (state) => !!state.remoteBranches.main && state.localOriginRefs.main === state.remoteBranches.main,
  },
  {
    id: 'pull',
    title: 'Pull: traértelo de verdad',
    instruction: 'Ahora sí: usa pull para incorporar ese cambio a tu rama local.',
    hint: 'Botón "Pull".',
    isComplete: (state) => !!state.branches.main && state.branches.main === state.remoteBranches.main,
  },
]
