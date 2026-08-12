export type GitAction =
  | { type: 'commit'; message: string }
  | { type: 'createBranch'; name: string }
  | { type: 'checkoutBranch'; name: string }
  | { type: 'mergeBranch'; branchName: string; currentBranch: string | null }
  | { type: 'rebaseBranch'; ontoBranch: string; currentBranch: string | null }
  | { type: 'push' }

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
  }
}
