---
name: Web Crawl for WeChat Artical
slug: web-crawl-for-wechat-artical
tags: 微信公众号, 微信文章, 网页抓取, 文章提取, Chrome, Headless
description: 使用本机 Chrome Headless 执行微信公众号文章页面 JavaScript，抓取标题、作者、公众号名、发布时间、摘要与正文。
market: 通用
category: content
skill_type: 网页阅读
publisher: iClaw
metadata: {"openclaw":{"emoji":"📖","os":["darwin","linux"],"requires":{"bins":["node"]},"skillKey":"web-crawl-for-wechat-artical"}}
---

# Web Crawl for WeChat Artical

当用户给出微信公众号文章链接，并要求读取正文、提取摘要、结构化信息、时间、作者、公众号名或标题时使用。

## 适用范围

- `https://mp.weixin.qq.com/s/...`

## 工作方式

1. 使用脚本通过本机 Chrome Headless 打开页面并执行前端 JavaScript。
2. 从渲染后的 DOM 中提取：
   - 标题
   - 作者
   - 公众号名
   - 发布时间
   - `#js_content` 正文
3. 将正文 HTML 清洗为纯文本并输出摘要。
4. 输出时区分：
   - 页面原始字段
   - 结构化抽取结果
   - 你的归纳总结

## 运行方式

```bash
node {baseDir}/scripts/fetch_wechat_article.mjs "<url>" --json
```

或输出纯文本：

```bash
node {baseDir}/scripts/fetch_wechat_article.mjs "<url>"
```

## 输出要求

- 默认先给摘要，再给关键证据点。
- 抽取：
  - 标题
  - 作者
  - 公众号名
  - 发布时间
  - 正文纯文本
- 若抓取失败，必须说明：
  - 是 Chrome 缺失
  - 页面渲染失败
  - DOM 中找不到 `#js_content`
  - 还是正文抽取失败

## 注意事项

- 当前实现依赖本机 Chrome/Chromium。
- 仅用于微信公众号文章页，不保证适用于小程序页或其他微信域名页面。
- 有些公众号文章在更强风控/登录态场景下可能需要浏览器 Cookie 才更稳定。
