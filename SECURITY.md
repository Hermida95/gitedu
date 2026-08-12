# Security

GitEdu runs `git` with real access to your local filesystem, so it's worth being explicit about how it's built to stay safe and what was actually checked.

## Threat model

GitEdu is a single-user desktop tool. The main things worth defending against:

1. A repository (yours, cloned, or someone else's) with a maliciously crafted commit message, branch name, or file path.
2. A malicious or typo'd URL pasted into the "open by URL" field.
3. Bugs in this codebase itself — the audit below wasn't a purely theoretical checklist; two real, exploitable issues were found and fixed.

Explicitly out of scope: a compromised `git` binary or a compromised machine — if either of those is untrusted, no app-level mitigation here would matter.

## What's already in place

- **No shell, ever.** Every git invocation goes through Node's `execFile` with an argument array, never a shell string. Branch names, commit messages, and file paths can contain quotes, `;`, backticks, `$()` — none of it can break out into a second command. See [`electron/services/gitActions.ts`](electron/services/gitActions.ts) and [`gitService.ts`](electron/services/gitService.ts).
- **Standard Electron hardening**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer never gets `require`, `process`, or a raw `ipcRenderer` — [`preload/index.ts`](electron/preload/index.ts) exposes a narrow, fully-typed set of async functions via `contextBridge`, nothing more.
- **No credentials handled or stored.** GitEdu has no login of its own; every clone/fetch/pull/push shells out to your system `git`, which uses whatever credential helper you already have configured. `GIT_TERMINAL_PROMPT=0` is set on every invocation so a missing credential fails with a clear error instead of hanging on an interactive prompt the app has no way to show.
- **Navigation lockdown** (`electron/main/index.ts`): `will-navigate` is blocked outside the app's own origin, and `setWindowOpenHandler` denies every new-window request. Nothing in the UI currently opens external links, but if that ever changed (or a bug introduced one), this stops a remote page from ever loading with the same preload script that exposes `window.gitedu` — which would otherwise let it read/write any local repo.
- **Content-Security-Policy** in `index.html`: blocks loading scripts, styles, or frames from any origin other than the app itself.
- **`maxBuffer` set on every git call** that could plausibly return unbounded output (log, status, refs, diffs), so a repository with a pathological amount of history or refs fails cleanly instead of exhausting memory.

## Issues found during this audit and fixed

**1. Path traversal in "open by URL".** The folder name for a cloned repo was derived from the last path segment of the URL, filtered through a character whitelist. `.` and `-`/`_` were allowed characters — legitimate for real repo names — but that meant a URL ending in `/..` produced the literal folder name `..`, and `path.join(~/GitEdu-Repos, '..')` resolves to the user's home directory, escaping the intended sandbox by one level. Fixed by rejecting `.`/`..` explicitly, plus a defense-in-depth check that the final resolved path is still inside `~/GitEdu-Repos` no matter what. Reproduced before the fix, confirmed blocked after.

**2. Shell injection via a malformed commit hash in interactive rebase.** The scripted `git rebase -i` (see the README's architecture section for how it works without a terminal) injects a `reword` step as an `exec git commit --amend -F "<message-file>"` line inside git's rebase todo file — and git executes `exec` lines through a shell. The message file's path embeds the commit's hash. That hash is always supplied by GitEdu's own UI from real git output, never typed freely by a user — but the IPC handler itself didn't enforce that, so a compromised renderer (e.g. a future XSS bug) could have called the IPC method directly with a hash like `abc123" && <anything> && "` and had it executed as a real shell command during the rebase. Fixed by validating every hash against `/^[0-9a-f]{4,64}$/i` before it touches any file path or git command, rejecting the whole request otherwise. Verified with a proof-of-concept malicious hash (confirmed blocked, zero execution) and a regression test (legitimate reword still works).

## What isn't covered

- The packaged `.dmg` is **unsigned** (no Apple Developer certificate) — documented in the README, not a code vulnerability, but worth knowing before distributing it further.
- No automated dependency scanning is wired into CI (there's no CI at all yet) — `npm audit` was run manually as part of this pass and came back clean (0 vulnerabilities at any severity).
