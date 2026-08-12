# Guía de uso de GitEdu (sencilla)

## ¿Qué es?

Una app de escritorio que te enseña un repositorio Git como un mapa de commits y ramas, y que **antes de tocar nada te dice qué comando va a ejecutar y qué va a pasar**. No es magia: por debajo usa tu `git` de siempre.

## ¿Para trabajar o para aprender?

Para las dos cosas, con matices. Ya tiene lo básico de un cliente Git completo:

- ✅ Stage/unstage, commit, crear/cambiar rama, merge, rebase (incluso interactivo), stash, fetch, pull, push.
- ✅ Visor de diffs (clic en cualquier fichero para ver qué líneas cambiaron).
- ✅ Se entera sola de los cambios que hagas por fuera (terminal, VS Code) y recarga el grafo sin que hagas nada.
- ❌ Sigue sin tener: editor de diffs en 3 vías para conflictos complejos, tags, gestión de remotos (añadir/quitar remotos a mano).

Para repos personales o de trabajo del día a día, ya se sostiene sola. Para conflictos gordos con mucho código, sigue apoyándote en VS Code/terminal a la vez — de hecho es justo lo recomendable (ver siguiente punto).

## ¿Puedo usarla junto a VS Code?

Sí, perfectamente, y además ahora se lleva mejor que al principio: las dos apps leen y escriben el mismo `.git` con el mismo `git` de tu sistema — como tener dos terminales abiertas a la vez sobre la misma carpeta.

Y ahora GitEdu **sí se entera sola**: si ves el indicador verde "en vivo" junto al título, significa que está vigilando ese `.git`. Si haces un commit desde VS Code o la terminal, el grafo se recarga solo, sin que pulses nada. Es justo la forma que comentabas de aprender: escribes el comando en terminal y ves en tiempo real qué le pasó al árbol.

## ¿Si cambio algo en la app, se ve en GitHub?

**No, nunca solo.** Como con cualquier `git`:

- `commit`, crear rama, `merge`, `rebase`, `stash` → solo tocan tu copia local. GitHub no se entera.
- `fetch`/`pull` → es al revés, traen cosas *de* GitHub hacia ti, tampoco suben nada.
- Solo cuando pulsas **"Push"** (y confirmas en el panel que te avisa) es cuando algo sale de tu ordenador hacia GitHub.

## Paso a paso

### 1. Abrir un repositorio

Tienes dos formas, en el campo de arriba de la ventana:

- **Ya lo tienes en el ordenador (por ejemplo, un proyecto que ya estás editando en VS Code):** escribe la ruta (ej. `/Users/miguel/Developer/mi-proyecto`) o pulsa "Examinar..." y búscala con el explorador de carpetas. Es importante que sea la misma carpeta donde tienes el proyecto abierto en VS Code — si no, GitEdu y VS Code estarían mirando dos copias distintas y no se "enterarían" la una de la otra.
- **Está en GitHub y no lo tienes descargado:** pega la URL (ej. `https://github.com/Hermida95/rehab`). El botón cambiará a "Clonar y cargar" — al pulsarlo, lo descarga en `~/GitEdu-Repos/` y lo abre. Si es un repo privado tuyo, funciona igual, usa las credenciales que ya tienes guardadas en el Mac.
- **Es una carpeta nueva que todavía no es un repositorio Git:** si abres una carpeta sin `.git`, te avisará y te dejará un botón "Inicializar repositorio Git aquí" — lo pulsas, confirmas, y ya puedes empezar a hacer stage/commit de tus primeros ficheros sin haber tocado la terminal.

### 2. Leer el grafo

Cada caja es un commit: hash corto, mensaje, autor y fecha. Las etiquetas verdes son nombres de rama. Las líneas te dicen quién es padre de quién — puedes hacer scroll/zoom con el ratón.

### 3. Ver qué cambió

Haz clic en el nombre de cualquier fichero de la barra lateral (staged o sin stage) para abrir su diff: líneas en verde son las que se añaden, en rojo las que se quitan.

### 4. Guardar cambios (stage → commit)

"Stage" mueve un fichero a la zona de preparación (equivalente a `git add`); escribe un mensaje abajo y pulsa "Commit". Antes de ejecutarse de verdad, te muestra el comando exacto y qué va a pasar en el árbol — confirmas y ya.

### 5. Guardar cambios sin commitear (stash)

Si quieres dejar el directorio de trabajo limpio sin hacer commit todavía (por ejemplo, para cambiar de rama), usa "Guardar" en la sección Stash. Luego puedes "Recuperar" esos cambios cuando quieras, o "Eliminar" el stash si ya no lo necesitas.

### 6. Trabajar con ramas

Crear rama nueva, hacer checkout a otra, fusionar (merge) o rebasar una rama sobre otra. Todas estas acciones pasan por el panel de confirmación, porque cambian de verdad el estado del repositorio.

### 7. Rebase interactivo (para ordenar/limpiar commits)

Botón "Rebase interactivo sobre..." — eliges, commit a commit, si lo mantienes (pick), cambias su mensaje (reword), lo fusionas con el anterior (squash) o lo descartas (drop). Puedes reordenarlos con las flechas antes de ejecutar.

### 8. Si hay un conflicto

La app lo detecta sola y te bloquea con un panel: por cada fichero en conflicto puedes quedarte con tu versión, con la entrante, o marcarlo como resuelto si ya lo editaste tú a mano. Luego "Continuar" o "Abortar".

### 9. Traer cambios del remoto (fetch / pull)

"Fetch" descarga lo nuevo de GitHub pero no toca tu rama actual (solo actualiza las referencias `origin/...` del grafo). "Pull" hace lo mismo y además lo fusiona en tu rama — úsalo cuando quieras estar al día antes de seguir trabajando.

### 10. Subir a GitHub

Botón "Push" en la barra lateral — como todo, primero te enseña el comando y luego confirmas.

### ¿Y las credenciales de GitHub?

GitEdu no tiene login propio ni guarda ningún token — usa el mismo `git` que ya tienes instalado, con las credenciales que ya tengas configuradas en tu ordenador (llavero de macOS, SSH, `gh auth login`...). Para repos públicos no hace falta nada. Para repos privados o para hacer push, necesita las mismas credenciales que le harían falta a un `git clone`/`git push` normal por terminal — si nunca has conectado git con tu cuenta de GitHub en ese ordenador, te dará el mismo error que te daría la terminal, no algo especial de la app.

## Preguntas rápidas

**¿Necesito tener git instalado?** Sí, GitEdu usa el `git` de tu sistema, no trae uno propio.

**¿Puedo cargar dos repos a la vez?** No, solo uno por ventana. Para otro, cambia la ruta arriba.

**¿Borra algo sin avisar?** No — commit, merge, rebase, stash, fetch, pull y push siempre pasan por el panel de confirmación antes de ejecutarse. Solo stage/unstage son instantáneos (si no, cada clic sería un modal).

**¿Y si edito el repo desde la terminal mientras tengo GitEdu abierta?** Se entera sola (indicador "en vivo") y recarga el grafo automáticamente — no hace falta que pulses nada.
