export type GitAction =
  | { type: 'commit'; message: string }
  | { type: 'createBranch'; name: string }
  | { type: 'checkoutBranch'; name: string }
  | { type: 'mergeBranch'; branchName: string; currentBranch: string | null }
  | { type: 'rebaseBranch'; ontoBranch: string; currentBranch: string | null }
  | { type: 'push' }
  | { type: 'fetch' }
  | { type: 'pull' }
  | { type: 'stashSave'; message: string }
  | { type: 'stashPop'; index: number; stashMessage: string }
  | { type: 'stashDrop'; index: number; stashMessage: string }

export interface CommandPreview {
  title: string
  command: string
  description: string
  impact: string[]
  danger: boolean
}

export function buildCommandPreview(action: GitAction): CommandPreview {
  switch (action.type) {
    case 'commit':
      return {
        title: 'Crear commit',
        command: `git commit -m "${action.message}"`,
        description:
          'Guarda una nueva instantánea de los cambios que están en el área de stage (index) como un nuevo commit en la rama actual.',
        impact: [
          'Se creará un nuevo nodo en el grafo, hijo del commit donde está HEAD ahora mismo.',
          'HEAD y la rama actual avanzarán para apuntar a este nuevo commit.',
        ],
        danger: false,
      }

    case 'createBranch':
      return {
        title: 'Crear rama',
        command: `git branch ${action.name}`,
        description: `Crea una nueva referencia llamada "${action.name}" que apunta al commit actual (HEAD). No cambia de rama automáticamente.`,
        impact: [`Aparecerá una nueva etiqueta "${action.name}" sobre el commit donde está HEAD ahora mismo.`],
        danger: false,
      }

    case 'checkoutBranch':
      return {
        title: 'Cambiar de rama',
        command: `git checkout ${action.name}`,
        description: `Mueve HEAD a la rama "${action.name}" y actualiza los ficheros del directorio de trabajo para que coincidan con ese commit.`,
        impact: [`HEAD pasará a apuntar a "${action.name}".`],
        danger: false,
      }

    case 'mergeBranch':
      return {
        title: 'Fusionar rama (merge)',
        command: `git merge ${action.branchName}`,
        description: `Combina el historial de "${action.branchName}" en la rama actual${
          action.currentBranch ? ` ("${action.currentBranch}")` : ''
        }. Si ambas ramas divergieron, se creará un commit de merge con dos padres.`,
        impact: [
          `Es probable que se cree un nuevo commit con dos padres: el HEAD actual y la punta de "${action.branchName}".`,
          'Si hay cambios en conflicto en las mismas líneas, git detendrá el merge y pedirá resolución manual.',
        ],
        danger: false,
      }

    case 'rebaseBranch':
      return {
        title: 'Rebasar rama (rebase)',
        command: `git rebase ${action.ontoBranch}`,
        description: `Reescribe los commits de la rama actual${
          action.currentBranch ? ` ("${action.currentBranch}")` : ''
        } aplicándolos uno a uno encima de "${action.ontoBranch}", en vez de crear un commit de merge.`,
        impact: [
          'Los commits reescritos cambiarán de hash: son commits nuevos con el mismo contenido pero distinto padre.',
          'Si esos commits ya se habían subido (push) y otras personas los usan, reescribir su historia puede romper su trabajo.',
        ],
        danger: true,
      }

    case 'push':
      return {
        title: 'Subir cambios (push)',
        command: 'git push',
        description:
          'Envía los commits locales de la rama actual al repositorio remoto configurado, para que estén disponibles para el resto del equipo.',
        impact: [
          'El remoto pasará a tener los mismos commits que tu rama local (si no hay divergencia).',
          'Es una acción visible para otras personas: deshacerla requiere coordinación, no solo un clic local.',
        ],
        danger: true,
      }

    case 'fetch':
      return {
        title: 'Fetch',
        command: 'git fetch',
        description:
          'Descarga los commits y ramas nuevos del remoto, pero no toca tus ficheros ni tu rama actual: solo actualiza las referencias "origin/...".',
        impact: [
          'Las ramas "origin/*" del grafo se pondrán al día con lo que haya en el remoto.',
          'Tu rama local y tu directorio de trabajo no cambian en absoluto.',
        ],
        danger: false,
      }

    case 'pull':
      return {
        title: 'Pull',
        command: 'git pull',
        description:
          'Equivale a hacer fetch y, justo después, fusionar (o rebasar, según tu configuración) los cambios descargados en tu rama actual.',
        impact: [
          'Tu rama local avanzará para incluir los commits nuevos del remoto.',
          'Si tu rama había divergido, puede generar un commit de merge o pedir resolución de conflictos.',
        ],
        danger: false,
      }

    case 'stashSave':
      return {
        title: 'Guardar en stash',
        command: action.message ? `git stash push -m "${action.message}"` : 'git stash push',
        description:
          'Guarda tus cambios sin commitear (staged y sin stage) en una pila aparte, y deja el directorio de trabajo limpio, como si no hubiera cambios.',
        impact: [
          'El directorio de trabajo quedará limpio.',
          'Los cambios no se pierden: quedan guardados en la lista de stashes hasta que los recuperes.',
        ],
        danger: false,
      }

    case 'stashPop':
      return {
        title: 'Recuperar stash',
        command: `git stash pop stash@{${action.index}}`,
        description: `Reaplica los cambios guardados en "${action.stashMessage}" sobre el directorio de trabajo actual, y elimina ese stash de la lista.`,
        impact: [
          'Los ficheros volverán a tener esos cambios sin commitear.',
          'Si el directorio de trabajo cambió mucho desde que se guardó, puede haber conflictos al reaplicar.',
        ],
        danger: false,
      }

    case 'stashDrop':
      return {
        title: 'Eliminar stash',
        command: `git stash drop stash@{${action.index}}`,
        description: `Elimina permanentemente el stash "${action.stashMessage}" sin aplicarlo.`,
        impact: ['Ese conjunto de cambios se pierde para siempre.'],
        danger: true,
      }
  }
}
