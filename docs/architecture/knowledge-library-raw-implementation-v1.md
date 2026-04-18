# Knowledge Library Raw Implementation V1

## 目标

把 iClaw 知识库第一栏 `Raw / 素材` 从当前硬编码 mock 数据，推进到真正可用的 local-first 数据层。

本文件只讨论 Raw 层，不覆盖 Graph 编译与 Output 生成。

## 1. 当前问题

当前知识库第一栏和第二栏的 Raw 相关内容仍然主要依赖：

- 硬编码对象数组
- 静态摘要文案
- 静态标签与元信息

这意味着：

- 插件采集进来的数据不会出现在知识库里
- 本地上传的数据不会形成真实素材对象
- 第二栏详情无法展示真实来源内容

## 2. V1 目标闭环

Raw 真实化的最小闭环定义为：

1. 用户通过本地上传或插件采集生成一条 `RawMaterial`
2. 第一栏 `Raw / 素材` tab 可以读到真实列表
3. 第二栏可以展示真实详情
4. 第三栏可以基于这个真实对象做上下文对话

## 3. 设计原则

### 3.1 local-first

Raw 数据必须先落本地，再考虑远端同步。

原因：

- 导入动作需要即时反馈
- 不应依赖远端成功才完成 UI 写入
- 后续 Graph/Output 也需要本地快速可用的数据源

### 3.2 repository 隔离 UI

UI 组件不应继续直接读取硬编码数组，而应通过 repository/hook 访问数据。

### 3.3 Raw 是统一对象层

RawMaterial 是统一素材对象，来源可以很多，但 UI 不应为每种来源单独长一套列表逻辑。

## 4. 推荐代码组织

## 4.1 目录

建议新增：

- `apps/desktop/src/app/components/knowledge-library/`
- `apps/desktop/src/app/components/knowledge-library/repository/`
- `apps/desktop/src/app/components/knowledge-library/hooks/`
- `apps/desktop/src/app/components/knowledge-library/storage/`

考虑当前已有目录，为了降低迁移成本，V1 可先沿用现有 `thought-library/` 目录，但把数据层拆出去。

### 推荐最小结构

- `apps/desktop/src/app/components/thought-library/types.ts`
- `apps/desktop/src/app/components/thought-library/repository.ts`
- `apps/desktop/src/app/components/thought-library/hooks.ts`
- `apps/desktop/src/app/components/thought-library/raw-storage.ts`
- `apps/desktop/src/app/components/thought-library/raw-mappers.ts`

## 4.2 repository 接口建议

### `KnowledgeLibraryRepository`

```ts
export interface KnowledgeLibraryRepository {
  listRawMaterials(input: {
    query?: string;
    sourceKinds?: string[];
    limit?: number;
  }): Promise<RawMaterial[]>;

  getRawMaterialById(id: string): Promise<RawMaterial | null>;

  createRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterial>;

  upsertRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterial>;

  deleteRawMaterial(id: string): Promise<void>;
}
```

## 4.3 hook 接口建议

### `useRawMaterials`

职责：

- 读取 Raw 列表
- 处理 query/filter
- 处理 loading / empty / error

```ts
function useRawMaterials(input: {
  query: string;
  sourceKinds?: string[];
}) {
  return {
    items,
    loading,
    error,
    refresh,
  };
}
```

### `useRawMaterialDetail`

职责：

- 读取单个 Raw 详情
- 供第二栏 viewer 使用

### `useCreateRawMaterial`

职责：

- 封装上传、采集、导入后的本地创建逻辑

## 5. 本地存储策略

## 5.1 V1 推荐

V1 推荐先用现有前端可快速接入的本地存储层实现 Raw：

- IndexedDB 或等价本地结构化缓存层

重点不是技术名词，而是满足这三个能力：

1. 可持久化
2. 可按字段筛选查询
3. 可去重 upsert

## 5.2 必要能力

### 去重

必须支持 `dedupe_key`：

- 页面 source 不应无限重复
- 同一段 snippet 不应重复写入

### 排序

默认按：

- `updated_at desc`

### 查询

至少支持：

- 按 `id`
- 按 `kind`
- 按 `query`
- 按 `source_url`
- 按 `updated_at`

## 5.3 V1 不强求

- 不强求一开始就做 FTS
- 不强求一开始就做 SQLite
- 不强求一开始就做远端离线同步队列

## 6. RawMaterial 最小字段子集

为了尽快替换 mock，V1 UI 先依赖最小字段子集：

- `id`
- `kind`
- `title`
- `excerpt`
- `content_text`
- `source_url`
- `source_name`
- `source_type`
- `source_icon`
- `tags`
- `timestamp_label`
- `updated_at`
- `created_at`
- `dedupe_key`

这样已经足够支撑：

- 第一栏卡片
- 第二栏详情
- 第三栏上下文 prompt

## 7. 第一栏 Raw 卡片映射规则

第一栏 Raw 列表不应再直接读静态 `title/subtitle/meta`，而应由 mapper 从真实对象生成：

### `mapRawMaterialToListCard(raw)`

输出：

- `id`
- `title`
- `subtitle`
- `summary`
- `tags`
- `icon`
- `meta`

### 例子

#### source
- `title = raw.title`
- `subtitle = 页面保存 · {source_name}`
- `summary = excerpt`
- `meta = formatRelativeTime(updated_at)`

#### snippet
- `title = 截取前 1 行内容`
- `subtitle = 划词摘录 · {source_name}`
- `summary = text/excerpt`
- `meta = timestamp_label 或 relative time`

#### upload
- `title = 文件名 / 标题`
- `subtitle = 本地上传 · mime type`

## 8. 第二栏 Raw 详情映射规则

第二栏应显示真实对象：

### 顶部区

- 标题
- tags
- 来源按钮（打开 source_url）

### 内容区

- 摘要
- 正文/摘录
- 原始来源元信息

### 状态区

- 当前层级：素材输入层
- 推荐动作：加入图谱 / 继续提炼 / 加入对话

## 9. 插件接入点

插件侧进入知识库 Raw 的方式不应直接操作 UI，而应调用统一 Raw 写入接口。

### 建议方式

- 插件同步到 control-plane / 本地桥后
- 桌面端或客户端写入 `RawMaterial`
- 知识库 repository 统一读到该对象

也就是说：

> 插件只负责“产生素材”，知识库只负责“读取素材”。

## 10. 实施顺序

### Step 1：抽离类型与 repository

把当前 `THOUGHT_LIBRARY_ITEMS` 的读取逻辑改成 repository 层。

### Step 2：实现本地 Raw storage

至少实现：

- list
- getById
- upsert
- delete

### Step 3：把 Raw tab 切到真实数据源

- 第一栏 Raw tab 改读真实 repository
- 先不动 Graph / Output

### Step 4：把第二栏 Raw 详情切到真实对象

- 不再展示模板说明文案
- 改成真实对象视图

### Step 5：打通一个真实入口

优先级建议：

1. 本地上传
2. 插件采集写入

### Step 6：第三栏上下文改读真实对象

`buildThoughtLibraryContextPrompt()` 改从真实 `RawMaterial` 组装输入。

## 11. 验收标准

Raw 真实化完成的标准：

- 第一栏 Raw 列表中至少有一条来自真实导入的数据
- 第二栏可展示该对象真实内容
- 搜索可以命中真实字段
- 刷新页面后数据仍存在
- 第三栏可以围绕真实对象继续对话

## 12. 最终结论

Raw 真实化不是“把 mock 数组改成接口返回”这么简单，而是要先建立：

- `RawMaterial` 统一对象
- `repository` 访问层
- `local-first` 存储层
- `mapper` 视图映射层

只有这四层立起来，Graph 和 Output 才不会继续长在假数据之上。
