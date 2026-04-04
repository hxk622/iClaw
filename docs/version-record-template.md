# Version Record Template

## 1. 发布基线

- `version_no`:
- `release_id`:
- `environment`: `prod`
- `git_tag`:
- `git_commit`:
- `rollback_tag`:
- `owner`:
- `reviewer`:
- `window`:
- `status`: `draft | running | done | rolled_back`

## 2. 变更摘要

- 本次发布目标：
- 用户可见变化：
- 风险最高的点：

## 3. 发布范围

### 3.1 Code

- [ ] `control-plane`
- [ ] `admin-web`
- [ ] `home-web`
- [ ] `desktop`
- [ ] 其他：

### 3.2 DB Schema

- [ ] 无
- [ ] 有

内容：

### 3.3 DB Data

- [ ] 无
- [ ] 有

内容：

### 3.4 Object Storage

- [ ] 无
- [ ] 有

内容：

### 3.5 Infra Config

- [ ] 无
- [ ] 有

内容：

## 4. 发布前检查

- [ ] 已冻结 `git tag + commit`
- [ ] 已确认发布范围
- [ ] 已确认回滚目标
- [ ] 已确认执行人和复核人
- [ ] 已确认依赖服务可用
- [ ] 已确认脚本默认目标环境正确

## 5. 执行顺序

1. 冻结基线
2. 执行 `DB Schema`
3. 执行 `DB Data`
4. 发布后端
5. 发布前端 / 静态站
6. 发布对象存储内容
7. 执行 smoke test
8. 记录结果

## 6. 执行命令

### 6.1 DB Schema

```bash
# command here
```

### 6.2 DB Data

```bash
# command here
```

### 6.3 Backend

```bash
# command here
```

### 6.4 Frontend

```bash
# command here
```

### 6.5 Object Storage / Desktop

```bash
# command here
```

## 7. 风险点

- 风险 1：
- 风险 2：
- 风险 3：

## 8. 验证项

- [ ] `control-plane /health`
- [ ] `admin-web` 可访问
- [ ] `home-web` 可访问
- [ ] `control-plane /health` 返回 `git_commit / git_tag / release_version / build_time`
- [ ] `admin-web/build-info.json` 字段完整
- [ ] `home-web/build-info.json` 字段完整
- [ ] 登录 / 注册正常
- [ ] chat 发消息正常
- [ ] usage / 计费 / 余额链路正常
- [ ] OEM runtime 拉取正常
- [ ] 下载页可访问
- [ ] 安装包链接不 404

## 9. 回滚方案

### 9.1 Code

```bash
# rollback command
```

### 9.2 DB

```sql
-- rollback sql or note
```

### 9.3 Object Storage

- 恢复方式：

## 10. 实际执行记录

- 开始时间：
- 结束时间：
- 实际执行人：
- 实际结果：
- 偏差说明：
