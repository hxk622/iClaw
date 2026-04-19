# Knowledge Flywheel Architecture

## 目标

定义 iClaw 知识库的真正系统形态：不是“资料页 + 图页 + 聊天页”的拼接，而是一条可持续运行的知识飞轮。

核心闭环：

- Raw / 素材进入
- Ontology / 本体图谱编译
- Output / 成果生成
- Chat 协作与消费
- 新反馈再次回写 Raw / Ontology / Output

这条闭环一旦成立，知识库就不是一个静态容器，而是一个持续生长的知识生产系统。

## 1. 核心定义

### 1.1 Raw / 素材

Raw 是所有原始输入的统一承接层，包括：

- 本地上传
- 浏览器页面保存
- 划词摘录
- 视频时间戳摘录
- 对话沉淀
- 转写结果
- 外部网页抓取结果

Raw 的目标不是“直接可用”，而是“保留来源、保留证据、保留上下文”。

### 1.2 Ontology / 本体图谱

Ontology 是从 Raw 编译得到的中间知识层。

它不是普通 tag 聚合，也不是简单节点图，而是：

- 有实体类型
- 有关系类型
- 有证据链
- 有语义约束
- 有可追溯来源

Ontology 的目标是把碎片素材变成结构化知识网络。

### 1.3 Output / 成果

Output 是用户与 AI 基于 Raw / Ontology 生成的可复用产物。

包括：

- Memo
- Expert persona
- 规则卡
- 小红书内容
- 公众号内容
- Doc / PPT
- 研究纪要

Output 不只是消费结果，也会反哺 Ontology。

### 1.4 Chat

Chat 是知识飞轮的协作层，不是孤立通道。

它有两个作用：

1. 消费知识库对象
2. 产生新的知识反馈

因此 Chat 本身也是飞轮的一部分。

## 2. 飞轮结构

真正的知识飞轮不是单环，而是四段流水：

### Step A：Ingest

外部输入进入 Raw：

- 插件采集
- 本地上传
- 手工导入
- 对话沉淀

### Step B：Compile

Raw 经过编译进入 Ontology：

- 清洗
- chunking
- entity extraction
- relation extraction
- ontology typing
- evidence linking

### Step C：Produce

Raw / Ontology 共同驱动 Output：

- 汇总
- 二创
- 发布
- 专家构建
- 文档输出

### Step D：Feedback

Output 与 Chat 再次回写系统：

- 新摘录进入 Raw
- 新关系进入 Ontology
- 新成果进入 Output
- 用户修正形成新的证据与规则

## 3. 模块边界

## 3.1 浏览器插件

职责：

- 产生 Raw
- 不负责 Ontology 编译
- 不负责 Output 生成
- 不负责知识库主浏览

## 3.2 知识库客户端

职责：

- 浏览 Raw / Ontology / Output
- 发起编译任务
- 发起产出任务
- 作为 Chat 的上下文选择器

## 3.3 Ontology 编译器

职责：

- 把 Raw 转为结构化知识对象
- 建立本体关系
- 绑定证据来源
- 输出可渲染的图谱对象

## 3.4 Output 生成器

职责：

- 基于 Raw / Ontology 生成成果
- 维护成果与来源的可追溯关系

## 3.5 Chat Surface

职责：

- 消费选中对象
- 产生新的结构化反馈
- 不直接绕开知识库对象模型

## 4. 系统不变量

为了避免补丁式开发，必须守住以下不变量：

### 不变量 1

所有进入知识库的输入都必须先成为 Raw 对象。

不能让某类输入直接绕过 Raw 写进图谱或成果。

### 不变量 2

所有图谱节点和边都必须能追溯到证据。

不能出现没有来源的关系图。

### 不变量 3

所有成果都必须可追溯到 Raw / Ontology。

不能让 Output 成为脱离知识层的孤立文本。

### 不变量 4

Chat 只消费对象，不直接成为唯一事实源。

Chat 产生的有价值内容必须沉淀回 Raw / Ontology / Output，而不是只留在会话里。

## 5. 视图层映射

### 第一栏：对象导航

- Raw / 素材
- Ontology / 本体图谱
- Output / 成果

### 第二栏：对象视图

- Raw viewer
- Ontology viewer
- Output viewer

### 第三栏：Chat 协作

- 以当前对象为 context source
- 不维护第二套独立知识模型

## 6. 更新触发

飞轮要成立，系统必须有明确触发器：

### Raw -> Ontology 触发器

- 新素材导入
- 素材更新
- 用户手动要求“编入本体图谱”

### Ontology -> Output 触发器

- 用户要求生成成果
- 模板化产出流程触发
- 专家蒸馏流程触发

### Chat -> Raw / Ontology / Output 触发器

- 用户确认“沉淀到知识库”
- AI 对话生成结构化结论
- 规则卡 / 摘要 / memo 被确认保存

## 7. 为什么这套架构能避免补丁式开发

过去补丁式开发的问题是：

- 先做一个页面
- 再补一个按钮
- 再补一个导入入口
- 再补一个图谱示意
- 再补一个成果页

结果每层都在绕过对象模型。

而知识飞轮架构要求：

- 先有对象层
- 再有编译层
- 再有产出层
- 最后才是视图层与交互层的扩展

这样后续新增能力时，只需要回答：

> 这件事属于 Raw、Ontology、Output、还是 Chat feedback？

而不是重新发明一套临时流程。

## 8. 推荐实现顺序

### Phase 1

- Raw 真实化
- 插件 / 上传入口稳定
- 第二栏 Raw viewer 稳定

### Phase 2

- Ontology schema 与编译 pipeline 建立
- 第二栏 Ontology viewer 接通
- Graphify 作为图谱渲染内核接入

### Phase 3

- OutputArtifact 对象化
- 成果页与模板输出稳定

### Phase 4

- Chat feedback 正式回写
- 完整飞轮闭环形成

## 9. 最终结论

真正的知识库不是 UI 三栏，而是这条系统链：

> Raw -> Ontology -> Output -> Chat Feedback -> Raw

只要后续开发严格围绕这条链推进，就能避免“边做边补、边补边散”的补丁式演进。
