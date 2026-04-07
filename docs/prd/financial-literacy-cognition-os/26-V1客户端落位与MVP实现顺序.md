# 26. V1 客户端落位与 MVP 实现顺序

> 目标：把 V1 金融学校从“可讨论”推进到“可排期”  
> 关联文档：
> - [17-结合当前项目 Shell 的低保真 Wireframe](./17-结合当前项目Shell的低保真Wireframe.md)
> - [24-V1 页面状态机与交互流](./24-V1页面状态机与交互流.md)
> - [25-V1 数据对象与事件模型](./25-V1数据对象与事件模型.md)

## 1. 本页回答的问题

这页只回答三件事：

1. V1 学习系统先落在哪个客户端壳里？
2. 在当前 iClaw 代码结构下，最小接入点是什么？
3. MVP 的实现顺序应该怎么排？

## 2. 结论先行

### 客户端落位

V1 学习系统应优先落在：

- `apps/desktop/`

而不是：

- `home-web/`

### 原因

- `home-web` 是官网与下载入口
- 深度学习闭环需要结构化状态、工作台、实验与规则修订
- 这些更适合桌面壳的长期状态容器

这与前面的产品共识一致：

> 官网负责价值解释，学习发生在客户端。

## 3. 与当前项目结构的结合点

结合当前代码，可确认：

### 已存在能力

- `apps/desktop/src/app/App.tsx` 已有 `primaryView`
- 已有 `menuUiConfig`
- 已有 sidebar / header / menu 的壳层配置路径

### 当前限制

- `apps/desktop/src/app/lib/chat-navigation-resolution.ts` 当前只显式识别 `/chat`
- 也就是说，第一版不宜一上来依赖完整 URL 路由系统

### 因此建议

V1 第一版采用：

- **primaryView 级接入**
- **菜单驱动进入**
- **本地持久化当前学习状态**

而不是第一天就追求完整 web-style 路由体系。

## 4. 推荐接入形态

## 4.1 Shell 层

新增一个学习产品域：

- `primaryView = "learning"`

学习域内再做内部二级状态：

- `dashboard`
- `map`
- `lesson`
- `lab`
- `audit`
- `rule-card`
- `review`

### 为什么不一开始把每一页都做成 primaryView

因为：

- 会把学习系统切碎
- 增加壳层菜单复杂度
- 不利于以后 OEM 配置为一个完整产品域

因此：

- `learning` 是一级域
- 内部页面由学习模块自己的状态机管理

## 4.2 Header 层

Header 中增加学习状态摘要：

- 当前阶段
- 当前课程进度
- 待审计数量

例如：

```text
[学习阶段：建立模型] [课程 1/8] [待修规则 1]
```

## 4.3 Sidebar 层

第一版左侧菜单建议：

```text
学习
├─ 今日任务
├─ 学习地图
├─ 实验室
├─ 规则卡
└─ 复盘
```

注意：

- 不建议首版菜单直接叫 “IPS”
- 因为 V1 先用规则卡，不是完整 IPS
- 等规则卡成熟后，再升级为 IPS Workspace 更自然

## 5. MVP 实现顺序

建议严格按顺序做，避免壳先做漂亮、闭环没跑通。

## Phase 1：先打通单机闭环

### 范围

- `learning` 一级入口
- Dashboard 最小版
- 第一课详情页
- 规则卡初始化页
- 首个 Lab
- Audit 页
- Rule Repair 页

### 不做

- 多课并发
- 多实验并发
- 完整 IPS 大工作台
- 花哨游戏化
- 多垂类支持

### 成功标准

用户能从第一课一路走到规则修订，形成第一个完整闭环。

---

## Phase 2：再补学习地图与复盘页

### 范围

- Curriculum Map
- Review 页
- 历史记录
- Dashboard 更强的 CTA 调度

### 成功标准

系统能让用户看到“我已经升级了什么”。

---

## Phase 3：最后再补 OEM 配置与深链

### 范围

- `admin-web` 中学习产品域开关/排序/命名
- 学习域默认落地页配置
- Header / Sidebar OEM 配置映射
- URL / deep link 扩展

### 成功标准

不同 OEM 品牌可决定是否启用学习域、如何命名、默认落点是什么。

## 6. MVP 页面优先级

### P0

- Learning Dashboard
- Lesson 1
- Rule Card Init
- Lab 1
- Audit
- Rule Repair

### P1

- Learning Map
- Review
- Rule history diff

### P2

- IPS Workspace 完整版
- 多场景 Lab 库
- 更细的学习状态可视化

## 7. 实现拆分建议

为了让研发切得更稳，建议按 4 条 lane 切：

### Lane A：Learning Shell

- 新增 `learning` primaryView
- Dashboard 容器
- 学习模块内部状态管理

### Lane B：Lesson + Rule Card

- 第一课页
- 规则卡初始化页
- 规则卡本地存储与快照

### Lane C：Lab + Audit

- 首个实验页
- 时间推进
- Audit 页
- Repair 流程

### Lane D：Persistence + Derived State

- 学习对象 schema
- 事件流
- CTA 推导
- 本地持久化

## 8. 当前阶段明确不做

为了避免失控，这一轮明确不做：

- 多行业内容包
- Team / Org 管理后台
- 全平台统一超级 schema
- 完整资讯流首页
- 交易模拟器
- 实时行情依赖的重型实验

## 9. 我认为“这轮已经够了”的标准

这一环节到这里可以停止，前提是已经满足：

1. **有产品层样板**  
   已有：19–23

2. **有交互状态机**  
   已有：24

3. **有数据对象与事件模型**  
   已有：25

4. **有客户端落位与实现顺序**  
   已有：26

如果四项都成立，那么这轮就已经从“讨论产品”推进到了“可排期实现”。

## 10. 下一轮最合理的讨论主题

在这轮完成后，最合理进入的是二选一：

### A. 设计/原型收敛

- 把 24/26 转成 Figma 页面流与状态图

### B. 工程收敛

- 把 25 转成实际前端对象 schema / store / state 设计

如果不先选 A 或 B，而继续泛讨论，很容易再次发散。
