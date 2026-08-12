# Guía de uso de GitEdu (sencilla)

## ¿Qué es?

Una app de escritorio que te enseña un repositorio Git como un mapa de commits y ramas, y que **antes de tocar nada te dice qué comando va a ejecutar y qué va a pasar**. No es magia: por debajo usa tu `git` de siempre.

## ¿Para trabajar o para aprender?

Hoy por hoy: **para aprender, y para el día a día básico**. Le faltan cosas que sí tiene VS Code o GitKraken:

- ❌ No hay `pull`/`fetch` — no puedes traerte cambios del remoto desde la app (solo subir con `push`).
- ❌ No hay visor de diffs línea a línea (ves *qué* fichero cambió, no *qué líneas*).
- ❌ No hay stash, ni tags, ni gestión de remotos.
- ✅ Sí tiene: stage/unstage, commit, crear/cambiar rama, merge, rebase (incluso interactivo), resolución básica de conflictos, y todo con el comando real a la vista.

Úsala para entender qué hace cada botón de tu cliente Git "de verdad", o para repos pequeños del día a día. Para trabajo serio con equipo, sigue usando VS Code/terminal a la vez — de hecho es lo recomendable (ver siguiente punto).

## ¿Puedo usarla junto a VS Code?

Sí, perfectamente. Las dos apps leen y escriben el mismo `.git` con el mismo `git` de tu sistema — es como tener dos terminales abiertas a la vez sobre la misma carpeta. No hay conflicto.

Lo único a tener en cuenta: **GitEdu no vigila el repo sola**. Si haces un commit desde VS Code (o la terminal) mientras GitEdu está abierta, el grafo se queda como estaba hasta que pulses "Cargar grafo" otra vez. Y al revés: si haces algo en GitEdu, puede que VS Code tarde un segundo en refrescar su panel de Git.

## ¿Si cambio algo en la app, se ve en GitHub?

**No, nunca solo.** Como con cualquier `git`:

- `commit`, crear rama, `merge`, `rebase` → solo tocan tu copia local. GitHub no se entera.
- Solo cuando pulsas **"Push"** (y confirmas en el panel que te avisa) es cuando algo sale de tu ordenador hacia GitHub.

## Paso a paso

### 1. Abrir un repositorio

Tienes dos formas, en el campo de arriba de la ventana:

- **Ya lo tienes en el ordenador:** escribe la ruta (ej. `/Users/miguel/Developer/rehab`) o pulsa "Examinar..." y búscalo con el explorador de carpetas.
- **Está en GitHub y no lo tienes descargado:** pega la URL (ej. `https://github.com/Hermida95/rehab`). El botón cambiará a "Clonar y cargar" — al pulsarlo, lo descarga en `~/GitEdu-Repos/` y lo abre. Si es un repo privado tuyo, funciona igual, usa las credenciales que ya tienes guardadas en el Mac.

### 2. Leer el grafo

Cada caja es un commit: hash corto, mensaje, autor y fecha. Las etiquetas verdes son nombres de rama. Las líneas te dicen quién es padre de quién — puedes hacer scroll/zoom con el ratón.

### 3. Guardar cambios (stage → commit)

En la barra lateral izquierda verás los ficheros modificados. "Stage" los mueve a la zona de preparación (equivalente a `git add`); escribe un mensaje abajo y pulsa "Commit". Antes de ejecutarse de verdad, te muestra el comando exacto y qué va a pasar en el árbol — confirmas y ya.

### 4. Trabajar con ramas

Abajo del todo de la barra lateral: crear rama nueva, hacer checkout a otra, fusionar (merge) o rebasar una rama sobre otra. Merge y rebase también pasan por el panel de confirmación, porque son las acciones que de verdad reescriben o combinan historia.

### 5. Rebase interactivo (para ordenar/limpiar commits)

Botón "Rebase interactivo sobre..." — eliges, commit a commit, si lo mantienes (pick), cambias su mensaje (reword), lo fusionas con el anterior (squash) o lo descartas (drop). Puedes reordenarlos con las flechas antes de ejecutar.

### 6. Si hay un conflicto

La app lo detecta sola y te bloquea con un panel: por cada fichero en conflicto puedes quedarte con tu versión, con la entrante, o marcarlo como resuelto si ya lo editaste tú a mano. Luego "Continuar" o "Abortar".

### 7. Subir a GitHub

Botón "Push" en la barra lateral — como todo, primero te enseña el comando y luego confirmas.

## Preguntas rápidas

**¿Necesito tener git instalado?** Sí, GitEdu usa el `git` de tu sistema, no trae uno propio.

**¿Puedo cargar dos repos a la vez?** No, solo uno por ventana. Para otro, cambia la ruta arriba.

**¿Borra algo sin avisar?** No — commit, merge, rebase y push siempre pasan por el panel de confirmación antes de ejecutarse.
