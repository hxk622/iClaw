# Repository Rules

## Port Conventions

- Frontend/web dev server is fixed at `http://127.0.0.1:1520`.
- OAuth browser callback page is served from the frontend origin, so local callback defaults must stay on `http://127.0.0.1:1520/oauth-callback.html`.
- Control-plane auth/billing service is a separate backend on `http://127.0.0.1:2130`.
- OpenClaw local API/runtime remains on `http://127.0.0.1:2126`.

## Change Guardrails

- Do not change the frontend default port away from `1520` unless the user explicitly requests it.
- When adding docs, env examples, login flows, or OAuth config, keep the distinction explicit:
- frontend origin / callback = `1520`
- control-plane backend = `1420`

## Git Workflow

- After completing requested code changes, default to committing the work and running `git push`.
- Only skip commit/push when the user explicitly says not to, or when the branch/worktree state makes auto-push unsafe and requires clarification first.
