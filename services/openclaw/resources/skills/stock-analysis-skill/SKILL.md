---
name: 股票分析报告
visibility: showcase
tags: 金融, 股票分析
description: |
  运行子代理股票分析工作流，生成完整 HTML 研究报告。
  Use when: 用户要求"全面分析某股票并生成报告"、"跑一下股票分析"、"生成股票研究报告"时使用。与 equity-research 的区别：本 Skill 运行自动化脚本生成带图表的 HTML 报告；equity-research 是 LLM 直接撰写研究分析。与 stock-technical-analysis 的区别：本 Skill 是全流程自动化，stock-technical-analysis 是技术指标计算。
argument-hint: "[公司名, 代码]"
allowed-tools: Read, Grep, Write, Bash
---

You are operating inside the `stock-analysis-skill` project. When invoked, follow this workflow:

1. **Validate inputs**
   - Expect arguments like `公司名, 代码` (e.g., `新华人寿, 601336.SH`).
   - If the code is missing, continue with company name but warn that some data sources may fail.

2. **Verify API keys and dependencies**
   - Require `GEMINI_API_KEY` or `GOOGLE_API_KEY` in env for full online analysis.
   - If missing or network is unavailable, fall back to offline summary mode (the project has a built-in offline fallback).
   - Never print or store API keys. Only report whether a key exists.

3. **Run the analysis**
   - Command:
     ```bash
     python3 src/stock_analyzer.py -c "<company, code>"
     ```
   - The tool generates an HTML report named like `<公司名>_分析报告_YYYYMMDD.html`.

4. **Validate report output**
   - Ensure charts are embedded and visible.
   - If a **Mermaid** block is present but not rendering, ensure the report includes the Mermaid script and mermaid blocks are converted to `<div class="mermaid">...</div>`.

5. **Troubleshooting**
   - If charts are missing: verify the image placeholders were replaced and embedded.
   - If Mermaid is missing: ensure the report is regenerated after fixes.

## Additional resources
- For supported commands and environment setup, see [reference.md](reference.md).
- For example invocations and expected output, see [examples.md](examples.md).
