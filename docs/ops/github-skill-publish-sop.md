# GitHub Skill Publish SOP

更新时间：2026-04-13

## 目标

把 GitHub skill 仓库中的 `SKILL.md` 目录发布到 control-plane cloud skill catalog，并同步到平台可见技能列表。

当前默认覆盖这 3 个仓库：

- `https://github.com/ArchieIndian/openclaw-superpowers`
- `https://github.com/JimLiu/baoyu-skills`
- `https://github.com/alchaincyf/nuwa-skill`

脚本入口：

```bash
node scripts/publish-github-skill-repos.mjs --env all
```

## 适用场景

- 某些 GitHub skill 已经绑定到平台，但 artifact 缺失、404、结构不合法
- 新增一批 GitHub skill，需要同时补到 `dev` 和 `prod`
- 怀疑某台打包机“没有上传”，需要统一走一条可验证的发布链路

## 设计原则

- 不直接改 control-plane 内部发布逻辑，只复用既有 `publish-github-cloud-skill.ts`
- 不依赖本机 `zip`，统一使用 `tar.gz`
- `dev` 走本地 `scripts/run-with-env.mjs`
- `prod` 走远端 `ssh + scp` 到 control-plane 服务器，再在服务器内执行 `bash scripts/with-env.sh prod`
- 发布后强制校验：
  - `cloud_skill_catalog.origin_type = github_repo`
  - `metadata.portal_artifact_object_key` 已写入
  - `portalStore.listSkills()` 中可见

## 前置条件

- 本机已安装：
  - `git`
  - `tar`
  - `ssh`
  - `scp`
- 本机对 prod control-plane 主机具备免密 SSH
- 仓库根目录存在有效 `.env.dev`
- prod 服务器仓库根目录存在有效 `.env.prod`

默认 prod 目标：

- host: `115.191.6.179`
- user: `root`
- path: `/opt/iclaw`

可通过参数覆盖：

```bash
node scripts/publish-github-skill-repos.mjs --env prod --prod-host <host> --prod-user <user> --prod-path <path>
```

## 常用命令

只发 `dev`：

```bash
node scripts/publish-github-skill-repos.mjs --env dev
```

只发 `prod`：

```bash
node scripts/publish-github-skill-repos.mjs --env prod
```

同时发 `dev + prod`：

```bash
node scripts/publish-github-skill-repos.mjs --env all
```

只看生成结果，不真正发布：

```bash
node scripts/publish-github-skill-repos.mjs --env all --dry-run --keep-artifacts
```

发布自定义 GitHub repo：

```bash
node scripts/publish-github-skill-repos.mjs --env dev \
  --repo-url https://github.com/ArchieIndian/openclaw-superpowers \
  --repo-url https://github.com/JimLiu/baoyu-skills
```

## 脚本行为

脚本会自动完成：

1. clone 目标 GitHub repo 到临时目录
2. 扫描包含 `SKILL.md` 的 skill 目录
3. 自动提炼 name / description
4. 将每个 skill 打包为 `tar.gz`
5. 调用 `services/control-plane/scripts/publish-github-cloud-skill.ts`
6. 在 `dev` 和或 `prod` 完成发布
7. 校验 catalog 与 platform visibility

## 已知规则

- `openclaw-superpowers` 会自动加 slug 前缀 `openclaw-superpowers-`
- `nuwa-skill` 会固定发布成 slug `nuwa-skill`，name 为 `huashu-nuwa`
- 若 GitHub repo 缺失 frontmatter `description`，脚本会从正文首段自动提炼，避免导入失败

## 故障排查

`required command not found`

- 补安装对应命令，尤其是 Windows 上的 `ssh` / `scp`

`verification failed for dev`

- 检查 `.env.dev` 中 `DATABASE_URL` / `S3_*` 是否有效
- 检查 control-plane 数据库和对象存储是否可达

`verification failed for prod`

- 检查 prod 主机 SSH 是否通
- 检查远端 `/opt/iclaw/.env.prod` 是否有效
- 检查远端 control-plane 仓库是否已更新到包含 `publish-github-cloud-skill.ts` 的版本

`artifact 仍然 404 / timeout / does not contain SKILL.md`

- 先确认是否重新跑过本脚本
- 再确认平台/OEM 绑定是否仍引用旧的外链 artifact

## 发布后记录

每次正式补录后，必须在对应版本单补记：

- 发布日期
- 发布人
- 目标环境：`dev / prod`
- 覆盖 repo 列表
- 实际 skill 数量
- 校验结果
