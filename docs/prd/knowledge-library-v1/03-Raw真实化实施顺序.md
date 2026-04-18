# 03. Raw 真实化实施顺序

## 目标

定义知识库 V1 中 `Raw / 素材` tab 从 mock 走向真实可用的最短实施顺序。

## 现状

当前 Raw 仍然是静态数据驱动，问题包括：

- 第一栏列表不是实际素材
- 第二栏详情不是实际对象
- 第三栏 context 不是来自真实 RawMaterial

## 实施策略

原则：

- 先让 Raw 真实，再谈 Graph / Output
- 先做本地可用，再做更复杂同步
- 先打通一个入口，再扩展更多来源

## Phase 1：建立 Raw 数据层

### 任务

1. 定义 `RawMaterial` 类型
2. 定义 `KnowledgeLibraryRepository`
3. 实现本地 `raw-storage`
4. 写 `Raw -> 第一栏卡片` 的 mapper

### 结果

- UI 可以不依赖硬编码数组

## Phase 2：第一栏 Raw tab 真数据化

### 任务

1. 把 Raw tab 改成读 repository
2. 搜索框接入真实查询
3. 选中状态仍然复用当前持久化机制

### 结果

- 第一栏 Raw 列表可见真实素材

## Phase 3：第二栏 Raw viewer 真数据化

### 任务

1. 第二栏改读 `useRawMaterialDetail`
2. 展示真实标题、标签、正文、来源
3. 保留“加入图谱 / 继续提炼 / 加入对话”等动作位

### 结果

- Raw viewer 不再是模板页

## Phase 4：接入真实入口

### 优先顺序

#### 4.1 本地上传

理由：

- 最容易控
- 最适合作为知识库第一条真实数据路径

#### 4.2 浏览器插件采集

理由：

- 是知识库真正高频入口
- 但链路更长，依赖插件与授权桥

## Phase 5：第三栏上下文改读真实 Raw

### 任务

1. 用真实对象替换静态 prompt 拼装
2. 确保输入框仍然保持空白
3. 选中对象只作为 context source

## 明确非目标

本阶段不做：

- Graph 编译器
- 图谱 canvas
- Output artifact 生成器
- 多端同步优化
- 大规模导入工具

## 验收清单

- [ ] 本地上传能创建 RawMaterial
- [ ] 第一栏能展示真实素材卡片
- [ ] 第二栏能展示真实详情
- [ ] 搜索命中真实内容
- [ ] 第三栏能围绕真实对象对话
- [ ] 刷新后数据不丢失

## 决策建议

实现上不要跳过 repository 层直接把 IndexedDB / 本地存储写进 UI 组件。

如果不先建立 repository，后续接插件、接 Graph、接 Output 都会再次返工。
