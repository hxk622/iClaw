# 01. 平台定位与 ADR

## 平台定位

Cognition Education OS 不是一个单独对外售卖的课程产品名，而是内部平台层名称。

它的职责是提供一套可复用的认知教育闭环底座，使某个垂类产品能够完成：

1. 知识映射
2. 压力实验
3. 成果件沉淀
4. 规则与行动之间的逻辑审计
5. 操作系统级修正

## ADR

### Decision
建立一个平台层 PRD，与现有金融 PRD 分层表达：
- 平台层：`Cognition Education OS`
- 垂类层：`Financial School / 金融财商认知操作系统`

### Drivers
- 当前产品已经不再只是单一金融课程，而是出现了可复用底层：wiki / lab / artifact / audit
- 平台与垂类混写，会让后续 OEM、知识架构、artifact 模板边界模糊
- 但现阶段仍必须坚持 finance-first，避免提前平台化导致空泛抽象

### Alternatives Considered
1. 继续只维护金融 PRD
2. 直接做跨行业统一平台 PRD 并弱化金融
3. 分层：平台 PRD + 金融垂类 PRD

### Why Chosen
第三种最符合当前阶段：
- 平台层负责表达“可复用部分”
- 金融层继续作为压力测试主战场

### Consequences
- 文档结构更清晰
- finance vertical 不再等于全部系统
- 后续扩展第二 vertical 时不需要推翻现有金融 PRD
