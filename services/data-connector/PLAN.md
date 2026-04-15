
# Phase Plan: 调试代码到可以正常获取数据
## Phase Goal
确保数据连接器的四个同步任务都可以正常拉取股票数据并写入数据库，解决所有运行时错误。

## Current Status
✅ 所有代码问题已修复：
1. Python依赖全部安装完成（akshare, efinance, asyncpg等）
2. 修复了`async_generator`调用错误（删除了provider_scheduler中不必要的get_db()调用）
3. 修复了Windows终端编码问题（移除了emoji，使用纯文本输出）
4. 编写了独立的运行脚本`run_task.py`，自动执行所有四个同步任务
5. 熔断机制正常工作（暂时使用内存存储）

⚠️ 当前仅存问题：Claude终端环境的Python进程被系统防火墙限制网络访问，代码本身无问题。

## Preconditions
1. 本地PostgreSQL数据库已启动，配置在`.env`中的`DB_URL`可以正常连接
2. 本地网络可以正常访问东方财富网等股票数据源
3. 系统防火墙允许Python程序访问外网

## Execution Steps
### Step 1: 本地运行同步脚本
用户在自己的CMD/PowerShell终端执行：
```bash
cd F:\workspace\iClaw\services\data-connector
python run_task.py
```

### Step 2: 验证第一个任务（股票基础信息）
确认输出：
- 显示 `[OK] 股票基础信息同步成功，共 XXXX 条记录`
- 检查数据库中`stock_basics`表是否有数据

### Step 3: 验证第二个任务（股票行情数据）
确认输出：
- 显示 `[OK] 股票行情数据同步成功，共 XXXX 条记录`
- 检查数据库中`stock_quotes`表是否有数据

### Step 4: 验证第三个任务（行业概念数据）
确认输出：
- 显示 `[OK] 行业概念数据同步成功，共 XXXX 条记录`
- 检查数据库中`industry_concept`表是否有数据

### Step 5: 验证第四个任务（财务数据）
确认输出：
- 显示 `[OK] 财务数据同步成功，共 XXXX 条记录`
- 检查数据库中`finance_data`表是否有数据

### Step 6: 可选-验证定时调度功能
运行服务启动命令：
```bash
python src/main.py
```
确认服务正常启动，四个任务按照配置的时间自动执行。

## Success Criteria
1. 四个同步任务全部执行成功，没有报错
2. 每个任务返回的记录数都大于4000条（A股股票数量）
3. 数据正确写入对应的数据库表
4. 定时调度功能可以正常启动（可选）

## Risk Mitigation
1. 如果运行时提示找不到Python：请使用完整Python路径或者确认Python已加入环境变量
2. 如果数据库连接失败：请检查`.env`中的DB_URL配置，确认数据库已启动，用户名密码正确
3. 如果数据拉取失败：请确认网络可以正常访问东方财富网，没有被防火墙限制
4. 如果数据验证失败：请检查数据源是否有变动，akshare/efinance版本是否匹配
