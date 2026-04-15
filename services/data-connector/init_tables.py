import asyncio
import sys
sys.path.append('./src')

from src.db.session import get_db
from sqlalchemy import text

async def init_tables():
    async for db in get_db():
        try:
            # 创建stock_basics表
            create_stock_basics_sql = """
            CREATE TABLE IF NOT EXISTS stock_basics (
                id SERIAL PRIMARY KEY,
                stock_code VARCHAR(10) NOT NULL UNIQUE,
                stock_name VARCHAR(100) NOT NULL,
                exchange VARCHAR(20) NOT NULL,
                company_name VARCHAR(200),
                main_business TEXT,
                industry VARCHAR(100),
                region VARCHAR(100),
                market_cap NUMERIC(18, 4),
                float_cap NUMERIC(18, 4),
                total_shares NUMERIC(20, 4),
                float_shares NUMERIC(20, 4),
                pe_ttm NUMERIC(18, 4),
                pb NUMERIC(18, 4),
                list_date VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            await db.execute(text(create_stock_basics_sql))

            create_basics_index_sql = """
            CREATE INDEX IF NOT EXISTS idx_stock_basics_code ON stock_basics(stock_code);
            """
            await db.execute(text(create_basics_index_sql))

            # 创建stock_quotes表
            create_stock_quotes_sql = """
            CREATE TABLE IF NOT EXISTS stock_quotes (
                id SERIAL PRIMARY KEY,
                stock_code VARCHAR(10) NOT NULL,
                stock_name VARCHAR(100) NOT NULL,
                open NUMERIC(18, 4),
                high NUMERIC(18, 4),
                low NUMERIC(18, 4),
                close NUMERIC(18, 4),
                change NUMERIC(18, 4),
                change_percent NUMERIC(10, 4),
                volume NUMERIC(20, 4),
                amount NUMERIC(20, 4),
                turnover_rate NUMERIC(10, 4),
                pe_ttm NUMERIC(18, 4),
                pb NUMERIC(18, 4),
                total_market_cap NUMERIC(20, 4),
                float_market_cap NUMERIC(20, 4),
                trade_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stock_code, trade_date)
            );
            """
            await db.execute(text(create_stock_quotes_sql))

            create_quotes_index1_sql = """
            CREATE INDEX IF NOT EXISTS idx_stock_quotes_code ON stock_quotes(stock_code);
            """
            await db.execute(text(create_quotes_index1_sql))

            create_quotes_index2_sql = """
            CREATE INDEX IF NOT EXISTS idx_stock_quotes_date ON stock_quotes(trade_date);
            """
            await db.execute(text(create_quotes_index2_sql))

            # 创建stock_industry_relation表
            create_industry_sql = """
            CREATE TABLE IF NOT EXISTS stock_industry_relation (
                id SERIAL PRIMARY KEY,
                stock_code VARCHAR(10) NOT NULL,
                industry_code VARCHAR(50) NOT NULL,
                industry_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stock_code, industry_code)
            );
            """
            await db.execute(text(create_industry_sql))

            create_industry_index_sql = """
            CREATE INDEX IF NOT EXISTS idx_industry_stock_code ON stock_industry_relation(stock_code);
            """
            await db.execute(text(create_industry_index_sql))

            # 创建stock_concept_relation表
            create_concept_sql = """
            CREATE TABLE IF NOT EXISTS stock_concept_relation (
                id SERIAL PRIMARY KEY,
                stock_code VARCHAR(10) NOT NULL,
                concept_code VARCHAR(50) NOT NULL,
                concept_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stock_code, concept_code)
            );
            """
            await db.execute(text(create_concept_sql))

            create_concept_index_sql = """
            CREATE INDEX IF NOT EXISTS idx_concept_stock_code ON stock_concept_relation(stock_code);
            """
            await db.execute(text(create_concept_index_sql))

            # 创建finance_data表
            create_finance_sql = """
            CREATE TABLE IF NOT EXISTS finance_data (
                id SERIAL PRIMARY KEY,
                stock_code VARCHAR(10) NOT NULL,
                report_date DATE NOT NULL,
                total_revenue NUMERIC(20, 4),
                net_profit NUMERIC(20, 4),
                eps NUMERIC(18, 4),
                roe NUMERIC(18, 4),
                gross_margin NUMERIC(10, 4),
                debt_ratio NUMERIC(10, 4),
                cash_flow_per_share NUMERIC(18, 4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stock_code, report_date)
            );
            """
            await db.execute(text(create_finance_sql))

            create_finance_index1_sql = """
            CREATE INDEX IF NOT EXISTS idx_finance_stock_code ON finance_data(stock_code);
            """
            await db.execute(text(create_finance_index1_sql))

            create_finance_index2_sql = """
            CREATE INDEX IF NOT EXISTS idx_finance_report_date ON finance_data(report_date);
            """
            await db.execute(text(create_finance_index2_sql))

            await db.commit()
            print("所有表创建成功！")

        except Exception as e:
            await db.rollback()
            print(f"创建表失败：{str(e)}")
            raise

if __name__ == "__main__":
    asyncio.run(init_tables())
