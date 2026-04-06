# Release Test Report

本目录用于存放**每次发版前**产出的测试报告。

## 规则

- 每次发版都必须新增一份测试报告到 `docs/version_record/test_report/`
- 每份发版文档都必须包含 `test_report` 字段，指向对应测试报告
- 测试报告与发版文档必须一一对应，不允许只发版不留报告
- 测试报告 `md` 进 git；运行产出的截图默认**不进 git**
- 截图等视觉证据统一存到 **dev MinIO**
- 测试报告至少覆盖：
  - 本次发版范围
  - 执行的用户级测试/烟测
  - 结果（pass/fail/block）
  - 截图、日志、临时产物或归档路径
  - 风险结论与是否允许发布

## 证据存储规则

- 测试截图默认上传到 dev MinIO，不直接提交到 git
- 测试报告中必须回填：
  - `minio_prefix`
  - 关键 `evidence_objects`
- 推荐路径按版本号分层，例如：
  - `dev/test-report/<version>/`
  - `dev/test-report/<version>/<case-id>/`
- 不允许覆盖旧版本截图对象，必须保证发版证据可回溯

## 命名建议

- 与发版版本号保持一致：
  - `docs/version_record/test_report/1.0.1.202604062034.md`

## 推荐流程

1. 先在 `tests/` 下执行本次需要的用户级自动化测试
2. 将截图等证据上传到 dev MinIO
3. 汇总结果到 `docs/version_record/test_report/<version>.md`
3. 在 `docs/version_record/<version>.md` 中填写：
   - `test_report: docs/version_record/test_report/<version>.md`
4. 在测试报告中回填 MinIO 路径
5. 再执行正式发版

## 模板

可直接基于：

- `docs/version_record/test_report/_template.md`
