---
name: Remotion 视频生成
slug: remotion-skill
tags: remotion, 视频, react, 动画, composition, 字幕, 数据可视化
description: 使用 Remotion + React 生成动画视频、图表视频、字幕动效和数据驱动视频内容。
market: 通用
category: content
skill_type: 视频生成
publisher: iClaw
metadata: {"openclaw":{"emoji":"🎬","os":["darwin","linux"],"skillKey":"remotion-skill"}}
---

# Remotion 视频生成

这个 skill 适合把内容、数据和视觉动画组合成可导出的视频，适用于 MP4 / WebM / GIF 等输出。

## 适用场景

- 生成宣传片、产品介绍、片头片尾、字幕动效
- 生成图表视频、数据可视化视频、市场复盘视频
- 生成股票走势、组合表现、财报摘要等金融视频
- 需要用 React 组件、时间轴、参数化模板来编排视频内容

## 使用原则

- 默认用 Remotion 的 React 组合方式组织视频，而不是临时拼接 ffmpeg 命令。
- 先确定视频目标、画幅比例、时长、分镜，再设计 Composition。
- 有字幕、转场、图表、素材导入等需求时，按需读取对应规则文件，不要一次性加载全部规则。
- 如果用户目标是做网页或静态图，不要误用这个 skill。

## 推荐工作流

1. 明确输出格式、时长、分辨率和目标平台。
2. 拆成一个或多个 Composition，确认每段内容的时间轴。
3. 需要图表、字幕、转场、音频、素材导入时，再加载对应规则文件。
4. 最后整理 props、参数和渲染方式，保证可复用。

## 规则索引

- `rules/animations.md`：基础动画、spring、easing、插值
- `rules/compositions.md`：Composition、Folder、默认 props、动态元数据
- `rules/timing.md`：时间轴和插值曲线
- `rules/transitions.md`：场景切换和转场
- `rules/text-animations.md`：标题、字幕、文本动画
- `rules/subtitles.md`：字幕工作流
- `rules/audio.md`：音频导入、裁剪、音量、速度
- `rules/videos.md`：视频素材导入、裁剪、循环、倍速
- `rules/images.md`：图片素材导入
- `rules/charts.md`：图表和数据可视化视频
- `rules/parameters.md`：参数化模板和输入 schema
- `rules/tailwind.md`：Tailwind 在 Remotion 中的使用
- `rules/fonts.md`：字体加载与排版
- `rules/3d.md`：Three.js / React Three Fiber 3D 场景
- `rules/maps.md`：地图动画

## 补充规则

- 字幕导入：`rules/import-srt-captions.md`
- 字幕转写：`rules/transcribe-captions.md`
- DOM / 文本尺寸测量：`rules/measuring-dom-nodes.md`、`rules/measuring-text.md`
- 素材能力：`rules/assets.md`、`rules/gifs.md`、`rules/light-leaks.md`、`rules/lottie.md`
- 视频信息提取：`rules/get-video-duration.md`、`rules/get-video-dimensions.md`、`rules/extract-frames.md`

## 输出要求

- 回答时优先给出可直接落地的 Composition 结构、组件建议和关键代码骨架。
- 如果用户场景里包含金融图表或经营数据，要把数据结构、时间轴和视觉编码一起说明。
- 如果需要导出视频，再补充渲染命令和参数，而不是只停留在概念描述。
