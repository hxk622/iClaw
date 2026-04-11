---
name: Web Crawl for Toutiao
slug: web-crawl-for-toutiao
tags: 今日头条, 网页抓取, 文章提取, Chrome, Headless
description: 使用本机 Chrome Headless 执行页面 JavaScript，抓取今日头条文章正文、标题、作者、发布时间与摘要。
market: 通用
category: content
skill_type: 网页阅读
publisher: iClaw
metadata: {"openclaw":{"emoji":"📰","os":["darwin","linux"],"requires":{"bins":["node"]},"skillKey":"web-crawl-for-toutiao"}}
---

# Web Crawl for Toutiao

当用户给出今日头条文章链接，并要求读取正文、提取摘要、结构化信息、时间、作者或标题时使用。

## 适用范围

- `https://www.toutiao.com/article/<id>/...`
- `https://m.toutiao.com/article/<id>/...`

## 工作方式

1. 使用脚本通过本机 Chrome Headless 打开页面并执行前端 JavaScript。
2. 从渲染后的 DOM 中提取 `RENDER_DATA`。
3. 解析文章标题、摘要、发布时间、作者、正文 HTML 与纯文本。
4. 输出时区分：
   - 页面原始字段
   - 结构化抽取结果
   - 你的归纳总结

## 运行方式

```bash
node {baseDir}/scripts/fetch_toutiao_article.mjs "<url>" --json
```

或输出纯文本：

```bash
node {baseDir}/scripts/fetch_toutiao_article.mjs "<url>"
```

## 输出要求

- 默认先给摘要，再给关键证据点。
- 抽取：
  - 标题
  - 摘要
  - 作者
  - 发布时间
  - 正文纯文本
- 若抓取失败，必须说明：
  - 是 Chrome 缺失
  - 页面渲染失败
  - 结构化数据缺失
  - 还是正文抽取失败

## 注意事项

- 当前实现依赖本机 Chrome/Chromium。
- 这是今日头条专用抓取器，不保证适用于其他站点。
- 如果用户给的不是头条文章链接，应明确说明不适用。
