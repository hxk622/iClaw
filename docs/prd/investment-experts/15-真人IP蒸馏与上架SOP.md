# 真人 IP 蒸馏与上架 SOP

## 目标

把金融人物 IP 以可重复方式做成：

- 龙虾商店可见
- 智能投资专家可见（仅金融相关）
- 头像稳定
- 命名统一
- dev / prod 发布一致

---

## 一、平台规则

### 1. 视图定义

- **龙虾商店 = 全集**
- **智能投资专家 = 金融视图**

### 2. surface 规则

- 金融 expert → `both`
- 非金融 expert → `lobster-store`

### 3. 命名规则

真人 IP 的显示名只用**人名本身**：

- `沃伦·巴菲特`
- `段永平`
- `查理·芒格`
- `瑞·达利欧`

不要：

- `巴菲特价值投资观`
- `段永平投资观`
- `达利欧宏观配置观`

风格解释放到：

- `subtitle`
- `description`
- `skill_highlights`

### 4. 智能投资专家一级分类规则

智能投资专家顶部一级分类，统一改为**金融大类**：

- 股票
- 基金
- 黄金
- 债券
- 期货
- 公募
- 私募
- VC/PE
- 宏观
- 组合配置
- 其他

对应元数据字段：

- `metadata.financial_domain`

建议值：

- `stock`
- `fund`
- `gold`
- `bond`
- `futures`
- `public-fund`
- `private-fund`
- `vc-pe`
- `macro`
- `portfolio`
- `other`

### 5. 头像规则

- 优先真人头像
- 优先转成 `data:image/...`
- 不优先依赖外链图片

---

## 二、标准流水线

### Step 1. 准备人物批次 JSON

最少包含：

- `slug`
- `name`
- `source_person`
- `subtitle`
- `description`
- `investment_category`
- `financial_domain`
- `tags`
- `use_cases`

### Step 2. 批量 scaffold

```bash
node .codex/skills/investment-persona-distiller/scripts/run_investment_persona_pipeline.mjs scaffold \
  --batch /abs/path/persona-batch.json \
  --force
```

输出：

- `.tmp/nuwa-distill/<slug>/SKILL.seed.md`
- `.tmp/nuwa-distill/<slug>/package/metadata.json`

### Step 3. 真人头像

用 `avatar-search-and-crop` 生成：

- `.tmp/avatars/<slug>.png`
- `.tmp/avatars/<slug>.data-url.txt`

### Step 4. 准备 candidate publish json

整理成 `agent_catalog_entries` 结构。

### Step 5. 如需改名，先跑改名脚本

```bash
node .codex/skills/investment-persona-distiller/scripts/run_investment_persona_pipeline.mjs rename \
  --candidates /abs/path/candidates.json \
  --rules /abs/path/rename-rules.json
```

### Step 6. 发布前规范化

```bash
node .codex/skills/investment-persona-distiller/scripts/run_investment_persona_pipeline.mjs normalize \
  --candidates /abs/path/candidates.json
```

### Step 7. 发布到 dev

```bash
node .codex/skills/investment-persona-distiller/scripts/run_investment_persona_pipeline.mjs publish \
  --env dev \
  --candidates /abs/path/candidates.json
```

### Step 8. 验证 dev

检查：

- `/agents/catalog`
- `surface`
- `financial_domain`
- `avatar_url`
- UI 登录态可见性

### Step 9. 发布到 prod

```bash
node .codex/skills/investment-persona-distiller/scripts/run_investment_persona_pipeline.mjs publish \
  --env prod \
  --candidates /abs/path/candidates.json
```

### Step 10. 验证 prod

再次检查：

- `/agents/catalog`
- `financial_domain`
- prod UI 登录态可见性

---

## 三、已踩过的坑

### 坑 1：只发到 `investment-experts`

结果：

- 智能投资专家能看到
- 龙虾商店看不到

修正：

- 金融 expert 一律 `surface = both`

### 坑 2：头像用外链

结果：

- 有时显示
- 有时空白
- 两个视图显示不一致

修正：

- 优先 data-url

### 坑 3：发布后数据不更新

原因：

- control-plane cache
- 页面 catalog cache

修正：

- 先 normalize
- 必要时重启本地 control-plane
- 页面刷新要拉最新 catalog

### 坑 4：prod 临时目录脚本相对 import 失效

结果：

- 远端执行 TS 脚本报 `ERR_MODULE_NOT_FOUND`

修正：

- prod 用远端 `services/control-plane/scripts/.tmp-*.ts` 路径执行

### 坑 5：未登录截图验收无效

修正：

- 只接受登录态 UI 验收

---

## 四、相关脚本

- `.codex/skills/investment-persona-distiller/scripts/run_investment_persona_pipeline.mjs`
- `.codex/skills/investment-persona-distiller/scripts/scaffold_real_persona_experts.mjs`
- `.codex/skills/investment-persona-distiller/scripts/rename_real_persona_display_names.mjs`
- `.codex/skills/investment-persona-distiller/scripts/normalize_investment_expert_candidates.mjs`
- `.codex/skills/investment-persona-distiller/scripts/publish_investment_expert_candidates.sh`

---

## 五、相关 skill

- `.codex/skills/investment-persona-distiller/SKILL.md`

这个 skill 用于未来重复执行整套流程，避免重新摸索。
