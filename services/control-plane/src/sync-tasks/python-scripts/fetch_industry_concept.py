#!/usr/bin/env python3
import os
import sys
import json
import traceback
import pandas as pd

# 项目路径由PYTHONPATH环境变量自动设置，无需硬编码
# sys.path.insert(0, '/Users/shanpeifeng/work/hexun/iClaw')
# sys.path.insert(0, '/Users/shanpeifeng/work/hexun/iClaw/daily_stock_analysis')

from daily_stock_analysis.data_provider import DataFetcherManager

def fetch_industry_concept():
    """使用DataFetcherManager获取股票行业和概念关联，多数据源自动切换"""
    try:
        manager = DataFetcherManager()
        print(f"使用 DataFetcherManager 获取行业概念关联，可用数据源: {[fetcher.__class__.__name__ for fetcher in manager._fetchers]}", file=sys.stderr)

        # 尝试不同的数据源获取方式
        industry_relations = []
        concept_relations = []

        for fetcher in manager._fetchers:
            fetcher_name = fetcher.__class__.__name__
            print(f"尝试使用 {fetcher_name} 获取行业概念数据...", file=sys.stderr)

            try:
                if fetcher_name == 'EfinanceFetcher':
                    # 优先使用efinance，它可以批量获取所有股票的基础信息
                    import efinance as ef

                    print("获取全市场股票列表...", file=sys.stderr)
                    stock_df = ef.stock.get_realtime_quotes()
                    if stock_df is None or stock_df.empty:
                        print("股票列表为空", file=sys.stderr)
                        continue

                    stock_codes = stock_df['股票代码'].tolist()
                    print(f"共 {len(stock_codes)} 只股票，开始批量获取基础信息...", file=sys.stderr)

                    # 批量获取股票基础信息（包含行业和概念）
                    stock_list = ef.stock.get_base_info(stock_codes=stock_codes)
                    print(f"成功获取 {len(stock_list)} 只股票的基础信息", file=sys.stderr)

                    for _, row in stock_list.iterrows():
                        try:
                            stock_code = str(row.get('股票代码', '')).strip().zfill(6)
                            if not stock_code or len(stock_code) != 6:
                                continue

                            # 处理行业信息
                            industry = row.get('所属行业', '')
                            if industry and str(industry).strip():
                                industry = str(industry).strip()
                                industry_relations.append({
                                    'stock_code': stock_code,
                                    'industry_code': industry,  # efinance没有行业代码，用名称当代码
                                    'industry_name': industry
                                })

                            # 处理概念信息
                            concepts = row.get('概念', '')
                            if concepts and str(concepts).strip():
                                concept_list = str(concepts).split(',')
                                for concept in concept_list:
                                    concept = concept.strip()
                                    if concept:
                                        concept_relations.append({
                                            'stock_code': stock_code,
                                            'concept_code': concept,
                                            'concept_name': concept
                                        })
                        except Exception as e:
                            print(f"处理股票 {stock_code} 失败: {e}", file=sys.stderr)
                            continue

                    print(f"✅ EfinanceFetcher 获取到 {len(industry_relations)} 条行业关联, {len(concept_relations)} 条概念关联", file=sys.stderr)
                    break

                elif fetcher_name == 'AkshareFetcher':
                    # 使用akshare的板块接口
                    import akshare as ak

                    # 获取行业关联
                    print("获取行业列表...", file=sys.stderr)
                    industry_df = ak.stock_board_industry_name_em()

                    for _, industry_row in industry_df.iterrows():
                        try:
                            industry_code = industry_row['板块代码']
                            industry_name = industry_row['板块名称']
                            print(f"获取行业 {industry_name} 成分股...", file=sys.stderr)

                            cons_df = ak.stock_board_industry_cons_em(symbol=industry_code)
                            for _, cons_row in cons_df.iterrows():
                                stock_code = str(cons_row['代码']).strip().zfill(6)
                                if len(stock_code) == 6:
                                    industry_relations.append({
                                        'stock_code': stock_code,
                                        'industry_code': industry_code,
                                        'industry_name': industry_name
                                    })
                        except Exception as e:
                            print(f"获取行业 {industry_name} 失败: {e}", file=sys.stderr)
                            continue

                    # 获取概念关联
                    print("获取概念列表...", file=sys.stderr)
                    concept_df = ak.stock_board_concept_name_em()

                    for _, concept_row in concept_df.iterrows():
                        try:
                            concept_code = concept_row['板块代码']
                            concept_name = concept_row['板块名称']
                            print(f"获取概念 {concept_name} 成分股...", file=sys.stderr)

                            cons_df = ak.stock_board_concept_cons_em(symbol=concept_code)
                            for _, cons_row in cons_df.iterrows():
                                stock_code = str(cons_row['代码']).strip().zfill(6)
                                if len(stock_code) == 6:
                                    concept_relations.append({
                                        'stock_code': stock_code,
                                        'concept_code': concept_code,
                                        'concept_name': concept_name
                                    })
                        except Exception as e:
                            print(f"获取概念 {concept_name} 失败: {e}", file=sys.stderr)
                            continue

                    print(f"✅ AkshareFetcher 获取到 {len(industry_relations)} 条行业关联, {len(concept_relations)} 条概念关联", file=sys.stderr)
                    break

            except Exception as e:
                print(f"❌ {fetcher_name} 获取失败: {e}", file=sys.stderr)
                traceback.print_exc()
                continue

        if len(industry_relations) == 0 and len(concept_relations) == 0:
            print(f"所有数据源都无法获取行业概念数据", file=sys.stderr)
            return None

        print(f"成功获取行业概念数据，行业关联 {len(industry_relations)} 条，概念关联 {len(concept_relations)} 条", file=sys.stderr)

        return {
            'industry_relations': industry_relations,
            'concept_relations': concept_relations
        }

    except Exception as e:
        print(f"DataFetcherManager 获取行业概念失败: {e}", file=sys.stderr)
        traceback.print_exc()
        return None

if __name__ == '__main__':
    try:
        # 使用DataFetcherManager获取数据
        data = fetch_industry_concept()
        if data and (len(data['industry_relations']) > 0 or len(data['concept_relations']) > 0):
            print(json.dumps(data, ensure_ascii=False))
            sys.exit(0)
        else:
            print(f"获取行业概念数据为空", file=sys.stderr)
            print(json.dumps({'industry_relations': [], 'concept_relations': []}))
            sys.exit(1)

    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        print(json.dumps({'industry_relations': [], 'concept_relations': []}))
        sys.exit(1)
