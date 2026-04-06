# Cognition Education OS PRD

> 版本：v1 平台草案  
> 定位：平台层（内部架构层）  
> 关系：`Financial School` 是该平台的第一个垂类产品（Vertical 01）

## 1. 一句话定义

**Cognition Education OS** 是一套面向认知训练与教育场景的底层操作系统。

它不直接等同于某个行业课程产品，而是定义一套可复用的底层闭环：

- Wiki（知识映射）
- Lab（压力实验）
- Artifact（决策成果件）
- Audit（认知审计）

## 2. 平台与垂类的关系

- **平台层**：定义通用闭环、知识架构、OEM shell 配置原则、扩展阈值
- **垂类层**：定义某个行业如何使用这套平台
- 当前唯一激活垂类：
  - [Financial School / 金融财商认知操作系统](../financial-literacy-cognition-os/README.md)

## 3. 当前战略

- **先做金融，不先做多行业内容包**
- **先把底层闭环跑通，不先做 org / team 管理后台**
- **先做可演化抽象，不做一次性万能 schema**

## 4. 文档导航

- [01-平台定位与ADR](./01-平台定位与ADR.md)
- [02-平台层与垂类层边界](./02-平台层与垂类层边界.md)
- [03-核心闭环：Wiki-Lab-Artifact-Audit](./03-核心闭环：Wiki-Lab-Artifact-Audit.md)
- [04-本地知识架构与Wiki模型](./04-本地知识架构与Wiki模型.md)
- [05-OEM Shell与admin-web配置模型](./05-OEM Shell与admin-web配置模型.md)
- [06-平台成功标准与扩展阈值](./06-平台成功标准与扩展阈值.md)

## 5. 阅读顺序

1. 先看 `01`、`02`，理解为什么要有平台层
2. 再看 `03`、`04`，理解平台的核心闭环与知识架构
3. 再看 `05`，理解 OEM shell 与 admin-web 的平台职责
4. 最后看 `06`，理解什么时候算平台成立、什么时候允许扩展第二垂类
