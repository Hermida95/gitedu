# Screenshots

Used by the main [README.md](../../README.md). Current set:

- `graph.png` — the main window, a few steps into the sandbox's guided lessons (a real two-parent merge commit).
- `command-preview.png` — the confirmation modal before a commit.
- `interactive-rebase.png` — the interactive rebase editor (real mode only).
- `conflict.png` — the conflict resolution panel (real mode only).

To regenerate: `graph.png` and `command-preview.png` need nothing but the sandbox (`npm run dev` → Modo aprendizaje → follow the guided lessons up to the merge step). `interactive-rebase.png` and `conflict.png` are real-mode-only views that need repo state hard to reproduce by hand (an in-progress rebase, an actual merge conflict) — they were captured by injecting a mocked `window.gitedu` into the page before it loads (via a headless browser driven by a small script, not part of the app itself) so the real components render against realistic fake data without touching any actual repository.
