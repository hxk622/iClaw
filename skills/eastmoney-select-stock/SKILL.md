---
name: 东方财富智能选股
visibility: showcase
tags: 金融, 东方财富, 选股, A股, 港股, 美股
description: |
  支持通过自然语言描述选股条件，筛选 A股、港股、美股中满足行情指标、财务指标等条件的股票，并返回结构化结果与字段说明。
---

# 东方财富智能选股 Skill

这个 Skill 用于通过自然语言完成智能选股任务。

## 适用场景

- 按行情指标筛选股票
- 按财务指标筛选股票
- 查询行业、板块、指数的成分股
- 根据自然语言条件生成选股结果与说明

## 安装前提

需要在东方财富妙想 Hub 获取 API Key，并在运行时通过环境变量 `EASTMONEY_APIKEY` 提供。

## 调用约定

- 查询接口：`POST https://mkapi2.dfcfs.com/finskillshub/api/claw/stock-screen`
- 请求头：
  - `Content-Type: application/json`
  - `apikey: ${EASTMONEY_APIKEY}`
- 请求体示例：

```json
{
  "keyword": "今日涨幅2%的股票",
  "pageNo": 1,
  "pageSize": 20
}
```

## 输出要求

- 使用返回结果中的 `columns` 作为字段定义
- 将 `dataList` 的英文列名映射为中文后输出
- 当结果较多时，先给摘要，再给完整 CSV 或表格化结果
- 明确说明筛选条件、命中数量和关键列含义

## 注意事项

- 类型支持 `A股`、`港股`、`美股`
- 输出时不要遗漏总数、筛选条件和字段说明
- 当结果为空时，提示用户到东方财富妙想 AI 进行进一步选股
