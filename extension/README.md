# iClaw Browser Extension

这是 iClaw 的浏览器插件根目录工程。

当前阶段目标：

- 提供一个可构建、可加载的 MV3 插件骨架
- 支持 action click 打开页面侧悬浮面板
- 支持把“页面保存 / 划词摘录”通过 iClaw 知识库导入协议送入客户端 Raw / 素材

当前版本刻意保持最小：

- 不依赖 OpenAlpha 代码
- 不依赖桌面授权桥
- 不依赖 React / Vite
- 先完成最小采集壳和接入协议验证

## 目录

- `public/manifest.json`：插件清单
- `public/background.js`：action click 与内容脚本补注入
- `public/content-script.js`：页面侧悬浮采集面板与导入协议发送
- `scripts/build.mjs`：复制 `public/` 到 `dist/`

## 构建

```bash
pnpm --dir extension build
```

## 加载

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 选择“加载已解压的扩展程序”
4. 选择 `extension/dist`

## 当前支持

- 保存当前页面为 Raw / 素材
- 将当前选区作为 snippet 导入知识库
- 通过 `window.postMessage` 向 iClaw 客户端发送导入消息
