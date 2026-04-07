# OEM 官网 Shell / Block 平台化设计

更新时间：2026-04-07

## 1. 背景

当前仓库里的 OEM 配置已经具备正确方向：

- control-plane 已通过 `portal/public-config` 对外提供 app 级公开配置
- `admin-web` 已把 `home-web`、`header`、`sidebar`、`input` 作为 surface 进行配置
- `home-web` 已能按 `surface_key=home-web` 拉取配置并渲染官网 / 下载页

但当前 `home-web` 仍然是单模板页面，`admin-web` 对官网的编辑能力也主要停留在：

- 少量品牌字段
- Hero 文案
- 下载标题
- 资产替换
- 少量 preset

这对于 `iclaw` / `licaiclaw` 两个品牌勉强够用，但无法支撑未来更多 OEM 官网并存：

- 不同 OEM 需要不同官网风格与区块组合
- 不同 OEM 需要不同 header / footer / legal / download / hero / 场景模块
- 不能把每个官网都做成单独前端项目长期维护
- 不能让 OEM 自己拥有一整套官网组件定义，否则会破坏“平台 catalog + OEM binding”的总原则

因此，需要把官网从“单个页面”升级为“平台级 marketing site shell + page block catalog + OEM assembly”。

## 2. 核心结论

官网平台化采用三层模型：

1. 平台级 `site shell`
2. 平台级 `page / block catalog`
3. OEM 级 `binding / assembly`

一句话总结：

- 平台定义官网骨架和标准件
- OEM 选择模板、区块、排序与少量覆盖
- 前台根据 platform catalog + OEM binding 计算出最终官网

## 3. 命名与范围

### 3.1 推荐命名

为了避免当前 `home-web` 被误解为“只有首页 / 下载页”，推荐在设计上引入新的概念名：

- 产品域概念：`marketing-web` 或 `site-web`
- 兼容运行时 key：短期仍可保留 `home-web`

建议：

- 数据模型 / 文档 / admin 信息架构中使用 `marketing site`
- 运行时第一阶段继续兼容 `surface_key=home-web`
- 第二阶段再考虑是否升级为 `surface_key=marketing-web`

### 3.2 术语统一

官网层不再使用 `welcome` 命名，统一改为 `hero`。

原因：

- `welcome` 在当前仓库里更接近产品内欢迎页 surface
- 官网首页首屏应使用更稳定的营销站术语 `hero`
- 避免 admin-web 把产品内 surface 与官网 block 混在一起

推荐统一术语：

- `siteShell.header`
- `siteShell.footer`
- `pages.home`
- `pages.download`
- `blocks.hero`
- `blocks.download-grid`
- `blocks.feature-cards`
- `blocks.scenario-cards`
- `blocks.capability-grid`
- `blocks.security`
- `blocks.faq`
- `blocks.cta-banner`

## 4. 设计目标

### 4.1 目标

1. 支持多个 OEM 官网共存，不再为每个 OEM 长期维护一个独立官网项目。
2. 支持不同 OEM 使用不同官网模板、视觉主题与区块组合。
3. 保持平台 catalog 与 OEM binding 分离，避免复制主数据。
4. 让 `admin-web` 成为官网装配统一入口。
5. 官网配置默认为 `cloud-live`，前端可实时读取，必要时可缓存兜底。
6. 首批平滑承接：
   - `iclaw` 继续使用现有官网
   - `licaiclaw` 使用金融感更强的官网模板

### 4.2 非目标

1. 不做“任意上传 React 组件”的 OEM 自定义代码平台。
2. 不做无限制低代码页面搭建器。
3. 不让每个 OEM 自己拥有 block 定义真值。
4. 不把 runtime-bound 能力和 marketing 配置混在一套分发链路里。

## 5. 架构分层

## 5.1 Site Shell

`site shell` 表示官网全站共享的骨架，不绑定单独页面。

包括：

- theme
- header
- footer
- global announcement
- global navigation
- default SEO
- legal links
- download channel defaults

这类内容属于：

- 平台有标准 variant
- OEM 只做启用、variant 选择、文案 / 链接 / 资产覆盖

### 5.2 Pages

`pages` 表示官网有哪些页面。

第一阶段建议只支持：

- `home`
- `download`
- `privacy`
- `terms`
- `about`
- `contact`

并不是所有 OEM 都必须启用全部页面。

### 5.3 Page Blocks

`blocks` 表示页面内标准化内容块。

第一阶段推荐的 block catalog：

- `hero`
- `download-grid`
- `feature-cards`
- `scenario-cards`
- `workflow-steps`
- `capability-grid`
- `security-badges`
- `rich-text`
- `faq`
- `cta-banner`
- `logo-cloud`
- `footer-links`

### 5.4 OEM Assembly

OEM 不定义 block 本身，只维护：

- 是否启用
- 采用哪个 variant
- 排序
- props override
- 页面挂载关系
- 页面是否可访问

这与 skill / MCP / model 的治理原则一致。

## 6. 数据职责边界

### 6.1 平台级主数据

平台级主数据负责定义：

- 哪些 shell / block / variant 存在
- 每种组件的 schema
- 默认 props
- 可用资产槽位
- 可配置字段说明
- 生命周期与版本

可理解为：

- `block 是什么`
- `header 有哪些标准样式`
- `footer 支持哪些字段`
- `hero.wealth` 需要哪些 props`

### 6.2 OEM 级 binding

OEM 级 binding 只负责：

- 某个 app 是否启用这个页面
- 某个页面挂哪些 block
- block 顺序
- block props override
- shell variant 选择
- 个别品牌级链接、文案、图片和 legal 内容覆盖

OEM 不负责：

- 定义新的 hero 类型
- 定义 footer 的平台字段结构
- 保存一份新的 block 主数据副本

## 7. 配置分类

官网平台化配置默认归类为 `cloud-live`。

原因：

- 不被 OpenClaw runtime / sidecar 直接消费
- 属于前端官网展示层与运营层
- 更适合实时从 control-plane 拉取

推荐策略：

- Web 官网实时读取 `portal/public-config`
- 桌面端如需要打开官网入口，可缓存最近一次成功返回的 shell 配置作为兜底
- 官网相关配置不进入 runtime-bound snapshot 主链路

## 8. 推荐配置模型

第一阶段不强制立刻上新数据库表，先允许继续挂在 app config 的 `surfaces["home-web"].config` 下，但结构必须升级。

推荐结构：

```json
{
  "siteShell": {
    "themeKey": "wealth-gold",
    "header": {
      "enabled": true,
      "variant": "finance-header",
      "props": {
        "brandLabel": "理财客",
        "navItems": [
          {"label": "产品优势", "href": "#features"},
          {"label": "适用场景", "href": "#scenes"}
        ],
        "primaryCta": {"label": "立即下载", "href": "#download"}
      }
    },
    "footer": {
      "enabled": true,
      "variant": "finance-legal-footer",
      "props": {
        "columns": [
          {
            "title": "产品",
            "links": [
              {"label": "下载", "href": "/download"},
              {"label": "关于我们", "href": "/about"}
            ]
          }
        ],
        "legalLinks": [
          {"label": "隐私政策", "href": "/privacy"},
          {"label": "用户协议", "href": "/terms"}
        ],
        "copyrightText": "© 2026 理财客",
        "icpText": ""
      }
    }
  },
  "pages": [
    {
      "pageKey": "home",
      "path": "/",
      "enabled": true,
      "seo": {
        "title": "理财客官网",
        "description": "面向财富管理场景的 AI 工作台"
      },
      "blocks": [
        {
          "blockKey": "hero.wealth",
          "enabled": true,
          "sortOrder": 10,
          "props": {
            "eyebrow": "Wealth AI Desktop",
            "titlePre": "把 AI 装进你的财富工作流",
            "titleMain": "打开就能干活",
            "description": "面向财富管理、投顾与研究交付场景。"
          }
        },
        {
          "blockKey": "download-grid.finance",
          "enabled": true,
          "sortOrder": 20,
          "props": {}
        }
      ]
    }
  ],
  "assets": {
    "logo": {"assetKey": "logo"},
    "heroMascot": {"assetKey": "heroMascot"},
    "heroBackground": {"assetKey": "heroBackground"}
  }
}
```

## 9. 标准 catalog 模型

长期推荐把官网能力显式拆成平台 catalog + OEM binding，而不是长期只靠一坨 app config JSON。

### 9.1 平台 catalog

建议引入：

- `portal_site_shell_catalog`
- `portal_site_shell_variant_catalog`
- `portal_page_catalog`
- `portal_block_catalog`
- `portal_block_variant_catalog`

例如：

- `hero` 是 block 类型
- `hero.basic` / `hero.wealth` 是 block variant
- `finance-header` / `default-header` 是 shell variant

### 9.2 OEM binding

建议引入：

- `portal_app_site_shell_bindings`
- `portal_app_page_bindings`
- `portal_app_block_bindings`

绑定层至少应包含：

- `app_name`
- `page_key` 或 `shell_key`
- `block_key` / `variant_key`
- `enabled`
- `sort_order`
- `props_json`
- `metadata_json`
- `created_at`
- `updated_at`

## 10. 组件治理原则

### 10.1 block 必须来自平台 catalog

不允许 OEM 上传任意前端代码成为 block。

理由：

- 破坏平台治理
- 难以做 schema 校验
- 难以做预览 / 发布 / 回滚
- 难以保证 SEO、兼容性、可维护性

### 10.2 允许扩展 block，但仍由平台注册

如确有新场景，可以新增 block，但流程应是：

1. 平台研发新增 block / variant
2. block 进入 catalog
3. admin-web 暴露选择入口
4. OEM 再绑定使用

### 10.3 shell 与 block 要分离

以下应视为 shell，不应当成普通 page block：

- header
- footer
- global nav
- global announcement
- theme

以下应视为 page block：

- hero
- download-grid
- feature-cards
- scenario-cards
- faq
- cta-banner

## 11. 与现有仓库的映射

### 11.1 当前可复用基础

当前仓库里已经有三块可复用基础：

1. `portal/public-config` 分发链路
2. `admin-web` 的 surface 编辑能力
3. `home-web` 的 runtime merge 能力

因此不需要重做整套系统，只需要把“官网”这一块的抽象从平面字段升级为 shell/page/block。

### 11.2 当前需要替换的局限

当前 `home-web` 的局限：

- 只有一个页面模板
- `website.*` 字段过于扁平
- 不能表达多个页面
- 不能表达 block 排序与显隐
- 不能表达 header/footer variant

当前 `admin-web` 的局限：

- Home 页编辑器主要是固定字段表单
- preset 仍然硬编码在前端
- 缺少页面级 block 装配视图
- 缺少 site shell 与 page block 的明确分栏

## 12. admin-web 信息架构建议

针对单个 OEM app，建议把官网配置拆成四层：

### 12.1 站点骨架

- Theme
- Header
- Footer
- SEO defaults
- Global navigation

### 12.2 页面管理

- Home
- Download
- Privacy
- Terms
- About
- Contact

页面管理负责：

- 是否启用
- 路由
- 页面 SEO

### 12.3 页面装配

针对某个页面：

- 选择 block
- 排序
- variant
- props
- 预览

### 12.4 资源管理

- logo
- hero 素材
- footer 徽章
- legal 文件
- SEO 社交卡片图

## 13. 首页 block 首批建议

首批标准 block 建议收敛为：

1. `hero.basic`
2. `hero.wealth`
3. `download-grid.classic`
4. `download-grid.finance`
5. `feature-cards.basic`
6. `feature-cards.wealth`
7. `scenario-cards.wealth`
8. `workflow-steps.wealth`
9. `capability-grid.wealth`
10. `security-badges.finance`
11. `cta-banner.basic`
12. `faq.basic`

## 14. licaiclaw 映射建议

`/Users/xingkaihan/Documents/Code/caiclaw-home-web` 不建议直接并入为第二套独立官网实现，而应作为 `wealth-premium` 模板来源。

### 14.1 可抽取的结构

可抽取为以下 block / shell：

- `finance-header`
- `hero.wealth`
- `download-grid.finance`
- `feature-cards.wealth`
- `scenario-cards.wealth`
- `workflow-steps.wealth`
- `capability-grid.wealth`
- `security-badges.finance`
- `cta-banner.finance`
- `finance-legal-footer`

### 14.2 不应直接复用的部分

以下内容必须改造成配置，而不是原样搬运：

- `CaiClaw` 固定品牌文案
- 爪子 mascot 与硬编码人民币金币叠层
- 远程图片 URL
- 具体场景卡文案
- 合规声明细节
- 单品牌 footer 文案

### 14.3 对 licaiclaw 的推荐组合

建议 `licaiclaw` 的首页装配为：

1. `hero.wealth`
2. `download-grid.finance`
3. `feature-cards.wealth`
4. `scenario-cards.wealth`
5. `workflow-steps.wealth`
6. `capability-grid.wealth`
7. `security-badges.finance`
8. `cta-banner.finance`

同时使用：

- `finance-header`
- `finance-legal-footer`
- `wealth-gold` theme

## 15. iclaw 映射建议

`iclaw` 第一阶段继续沿用当前官网体验，作为 `classic-download` 模板族。

建议：

- Header：`default-header`
- Footer：`default-footer`
- Theme：`iclaw-default`
- Home blocks：
  - `hero.basic`
  - `download-grid.classic`

这保证：

- 不阻断现有官网
- `licaiclaw` 可先行升级为金融模板
- 后续其他 OEM 再逐步挂更多 block

## 16. 分阶段迁移计划

### Phase 0：文档与 schema 冻结

目标：

- 冻结命名
- 冻结 shell / page / block 三层模型
- 冻结首批 block catalog

产物：

- 本 design doc
- app config 过渡 schema

### Phase 1：双模板渲染器

目标：

- `home-web` 支持两个模板：
  - `classic-download`
  - `wealth-premium`

方式：

- 保留现有 `home-web` 渲染链路
- 新增渲染器层，根据模板 key 选择页面渲染

此阶段可以暂不做 block 级自由装配。

### Phase 2：block 化

目标：

- 把 `wealth-premium` 和 `classic-download` 内部分解为 block
- 允许按页面配置 block 顺序、显隐和 props

方式：

- 建立 block registry
- 建立 shell registry
- 仍然先存在 JSON config 内

### Phase 3：admin-web 装配器

目标：

- admin-web 具备官网 shell/page/block 编辑能力

包括：

- shell 表单
- 页面列表
- block 选择与排序
- props 编辑
- 预览

### Phase 4：catalog / binding 数据库化

目标：

- 把官网 catalog 与 binding 从 app config 大 JSON 中显式拆出

此阶段再引入平台表和 binding 表，避免过早复杂化。

## 17. 风险与约束

### 17.1 风险

1. 如果一开始就做成任意低代码拼装，复杂度会失控。
2. 如果继续把所有官网字段塞在 `website.*` 下，未来会失去结构。
3. 如果允许 OEM 自定义代码块，会破坏平台治理。
4. 如果首页、产品内 welcome、下载页概念混用，admin IA 会迅速混乱。

### 17.2 约束

1. 必须遵守“平台 catalog + OEM binding”原则。
2. 官网能力默认属于 `cloud-live`。
3. 不能影响现有 `iclaw` 官网稳定性。
4. 第一阶段优先利用现有 `portal/public-config` 链路，而不是重做发布系统。

## 18. 待确认事项

1. 官网产品域概念名是否最终采用 `marketing-web`，还是继续保留 `home-web` 作为对外正式名。
2. `privacy` / `terms` 页面是否纳入同一 renderer，还是继续保留静态文档页。
3. footer 的备案、许可证、法律链接是否需要平台级 schema 强约束。
4. 首页下载区是否需要和 desktop release binding 更显式联动。
5. admin-web 是否在 Phase 2 就上预览，还是等 Phase 3。

## 19. 推荐下一步

按优先级建议：

1. 先按本设计冻结官网术语和 schema。
2. 在 `home-web` 内新增 renderer 层，支持 `classic-download` 与 `wealth-premium` 双模板。
3. 把 `caiclaw-home-web` 的结构抽为 `licaiclaw` 的金融模板，而不是整体复制项目。
4. 再推进 `admin-web` 的官网装配 UI。

如果需要继续实现，建议下一份文档直接进入技术拆解：

- `home-web` renderer 目录结构
- `portal/public-config` 新 schema 兼容方案
- `admin-web` 页面装配 UI 详细设计
- `licaiclaw` 金融模板首批 block 字段定义
