# RTK Commands

Use this file when you want a quick mapping from a noisy shell command to a token-optimized RTK equivalent.

## File And Search

```bash
ls -la                  -> rtk ls .
find . -name "*.ts"     -> rtk find "*.ts" .
rg "pattern" .          -> rtk grep "pattern" .
cat path/to/file.ts     -> rtk read path/to/file.ts
head -200 file.ts       -> rtk read file.ts
tail -200 app.log       -> rtk proxy tail -200 app.log
```

Notes:

- Prefer `rtk read` over `cat` when the goal is understanding a file, not exact byte-for-byte reproduction.
- Prefer raw `tail` when you need the literal latest log lines in order.

## Git

```bash
git status              -> rtk git status
git diff                -> rtk git diff
git log -n 20           -> rtk git log -n 20
git show HEAD~1         -> rtk git show HEAD~1
```

Notes:

- RTK is strongest when the goal is quick inspection, summary, or review.
- If you need the exact patch text for copying or patching logic, raw `git diff` may still be better.

## Tests And Build

```bash
cargo test              -> rtk cargo test
pytest -q               -> rtk pytest -q
npm test                -> rtk test npm test
pnpm build              -> rtk err pnpm build
tsc --noEmit            -> rtk tsc --noEmit
ruff check .            -> rtk ruff check .
```

Notes:

- Prefer RTK here when the output is long and you mainly need failures, warnings, or grouped errors.
- If diagnosing flaky or ordering-sensitive output, rerun the raw command after the RTK summary.

## Infra And Containers

```bash
docker ps               -> rtk docker ps
docker logs api         -> rtk docker logs api
aws sts get-caller-identity -> rtk aws sts get-caller-identity
aws ec2 describe-instances  -> rtk aws ec2 describe-instances
```

## Fallback

If you are unsure whether RTK preserves the shape you need, do one of these:

```bash
rtk --version
rtk gain
rtk proxy <raw command>
```

`rtk proxy` is the safe fallback when you want RTK involved but do not want output rewriting.
