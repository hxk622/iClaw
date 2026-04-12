# Version Record

本目录存放每次正式发版或正式线上修复的版本记录。

## 硬规则

- 每次发版/线上修复都必须新增：
  - `docs/version_record/<version>.md`
  - `docs/version_record/test_report/<version>.md`
- 发版文档必须填写：
  - `test_report: docs/version_record/test_report/<version>.md`
- 发版前必须跑通 `P0` 用户级自动化测试；如有豁免，必须在：
  - 发版文档
  - 测试报告
  同时写明原因、影响范围、替代验证、审批人
- 测试报告 `md` 进 git；截图等视觉证据默认不进 git
- 截图等证据统一上传到 dev MinIO，并在测试报告中回填对象路径
- 如发现历史版本漏记，必须在下一次工作日内补录，并在文档中明确标注：
  - 哪些信息是事后追溯
  - 哪些步骤当时没有按标准执行
  - 偏差对追溯、回滚、验收的影响

## baseline 规则

- 平台/OEM baseline 以数据库为准，git 中的 snapshot 只是导出物
- 如本次发布涉及平台/OEM 配置主数据变更，发布单中应明确记录：
  - 是否改动了数据库主数据
  - 是否执行了 `pnpm baseline:export`
  - 是否执行了 `pnpm baseline:doctor`
  - 如做过恢复/回灌，是否执行了 `pnpm baseline:apply`

## 模板

- 发版文档模板：`docs/release/version-record-template.md`
- 测试报告模板：`docs/version_record/test_report/_template.md`
- Windows 桌面正式发版 SOP：`docs/release/windows-desktop-release-sop.md`
