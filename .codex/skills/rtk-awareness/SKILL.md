---
name: rtk-awareness
description: Use RTK when shell command output is likely to be verbose and token-heavy, especially for `git`, `ls`, `find`, `grep`, `cat`, `head`, `tail`, test runners, build tools, linters, Docker, and AWS CLI. Prefer `rtk <command>` or native RTK subcommands like `rtk read`, `rtk grep`, `rtk find`, and `rtk git status` when working through the shell and compact output is more useful than raw output.
---

# RTK Awareness

Use RTK to reduce shell-output tokens without changing the task outcome.

## When To Use

Prefer RTK when all of these are true:

- The task is being done through shell commands, not builtin file tools.
- Raw output would be noisy, repetitive, or too long for the current need.
- A compact summary is more useful than the full transcript.

Common cases:

- Git inspection: `status`, `diff`, `log`, `show`
- File inspection: `ls`, `find`, `grep`, `cat`, `head`, `tail`
- Tests and builds: `cargo test`, `npm test`, `pnpm build`, `pytest`, `go test`
- Lint and typecheck: `ruff`, `eslint`, `tsc`, `golangci-lint`
- Infra and ops: `docker ps`, `docker logs`, `aws ...`

## Preferred Forms

Use the explicit RTK form instead of the raw shell command:

```bash
rtk git status
rtk git diff
rtk ls .
rtk find "*.ts" .
rtk grep "pattern" .
rtk read path/to/file.ts
rtk cargo test
rtk pytest -q
rtk docker ps
```

When you need the original command unchanged, use:

```bash
rtk proxy <raw command>
```

## Working Rules

- For file reads through shell, prefer `rtk read <file>`.
- For content search through shell, prefer `rtk grep <pattern> <path>`.
- For tree and file listing through shell, prefer `rtk ls` or `rtk find`.
- For git inspection through shell, prefer `rtk git ...`.
- For test and build commands through shell, try the RTK-wrapped form first.
- If RTK output is too compressed for the current debugging task, rerun the raw command or use `rtk proxy`.

## Important Limits

- RTK mainly helps with shell-command output.
- Builtin agent tools like `Read`, `Grep`, and similar non-shell tools do not automatically benefit from RTK.
- Do not force RTK if exact raw output is required for debugging, machine parsing, or scripted piping behavior.
- Do not prepend `rtk` twice.
- If a command already has careful structure using pipes, heredocs, or other shell composition, verify that RTK is still appropriate before replacing it.

## Verification

Check installation with:

```bash
rtk --version
rtk gain
which rtk
```

If RTK is missing but needed, install or repair it before relying on this skill.

## References

- For common command mappings and usage patterns, read [references/commands.md](references/commands.md).

## Codex Setup Note

If the environment needs Codex-specific RTK setup, the upstream command is:

```bash
rtk init -g --codex
```

Use that only when asked to configure RTK integration, not for ordinary task execution.
