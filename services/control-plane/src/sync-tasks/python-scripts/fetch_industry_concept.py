#!/usr/bin/env python3
import os
import json
import sys
import traceback

# ========== 强制清除所有代理，彻底解决代理拦截问题 ==========
# 清除所有可能的代理环境变量（包括大小写变体和所有相关变量）
PROXY_VARS = [
    'http_proxy', 'https_proxy', 'all_proxy', 'ftp_proxy', 'no_proxy',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'FTP_PROXY', 'NO_PROXY',
    'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE', 'SSL_CERT_FILE',
    'HTTP_PROXY_USER', 'HTTP_PROXY_PASS', 'HTTPS_PROXY_USER', 'HTTPS_PROXY_PASS',
    'socks_proxy', 'SOCKS_PROXY', 'ALL_PROXY', 'all_proxy'
]
for var in PROXY_VARS:
    if var in os.environ:
        del os.environ[var]
# 强制所有请求不走代理
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'

# 全局配置requests强制不使用代理，关闭SSL验证
import requests
requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)
DEFAULT_PROXIES = {
    "http": None,
    "https": None,
    "ftp": None,
    "socks": None
}

# 猴子补丁requests的请求方法，强制不使用代理，关闭SSL验证，增加超时
original_request = requests.Session.request
def patched_request(self, method, url, *args, **kwargs):
    kwargs['proxies'] = DEFAULT_PROXIES
    kwargs['verify'] = False
    kwargs['timeout'] = kwargs.get('timeout', 30)
    return original_request(self, method, url, *args, **kwargs)
requests.Session.request = patched_request
# =======================================================

def fetch_akshare():
    """从AKShare获取行业和概念关联"""
    import akshare as ak

    industry_relations = []
    concept_relations = []

    # ---------------------- 获取行业关联 ----------------------
    print("Fetching industry list...", file=sys.stderr)
    industry_df = ak.stock_board_industry_name_em()

    for _, industry_row in industry_df.iterrows():
        industry_code = industry_row['板块代码']
        industry_name = industry_row['板块名称']

        try:
            print(f"Fetching industry {industry_name} components...", file=sys.stderr)
            cons_df = ak.stock_board_industry_cons_em(symbol=industry_code)
            for _, cons_row in cons_df.iterrows():
                stock_code = cons_row['代码']
                industry_relations.append({
                    'stock_code': stock_code,
                    'industry_code': industry_code,
                    'industry_name': industry_name
                })
        except Exception as e:
            print(f"Failed to fetch industry {industry_name}: {e}", file=sys.stderr)
            continue

    # ---------------------- 获取概念关联 ----------------------
    print("Fetching concept list...", file=sys.stderr)
    concept_df = ak.stock_board_concept_name_em()

    for _, concept_row in concept_df.iterrows():
        concept_code = concept_row['板块代码']
        concept_name = concept_row['板块名称']

        try:
            print(f"Fetching concept {concept_name} components...", file=sys.stderr)
            cons_df = ak.stock_board_concept_cons_em(symbol=concept_code)
            for _, cons_row in cons_df.iterrows():
                stock_code = cons_row['代码']
                concept_relations.append({
                    'stock_code': stock_code,
                    'concept_code': concept_code,
                    'concept_name': concept_name
                })
        except Exception as e:
            print(f"Failed to fetch concept {concept_name}: {e}", file=sys.stderr)
            continue

    return {
        'industry_relations': industry_relations,
        'concept_relations': concept_relations
    }

def fetch_efinance():
    """从efinance获取行业和概念关联，兜底"""
    import efinance as ef

    industry_relations = []
    concept_relations = []

    # 获取所有股票的行业概念
    print("Fetching all stock industry info from efinance...", file=sys.stderr)
    # 先获取所有A股股票列表
    stock_df = ef.stock.get_realtime_quotes()
    stock_codes = stock_df['股票代码'].tolist()
    # 批量获取股票基础信息
    stock_list = ef.stock.get_base_info(stock_codes=stock_codes)

    for _, row in stock_list.iterrows():
        stock_code = row['股票代码']
        industry = row.get('所属行业', '')
        if industry and industry.strip():
            industry_relations.append({
                'stock_code': stock_code,
                'industry_code': industry,  # efinance没有行业代码，用名称当代码
                'industry_name': industry
            })

        concepts = row.get('概念', '')
        if concepts and concepts.strip():
            concept_list = concepts.split(',')
            for concept in concept_list:
                concept = concept.strip()
                if concept:
                    concept_relations.append({
                        'stock_code': stock_code,
                        'concept_code': concept,
                        'concept_name': concept
                    })

    return {
        'industry_relations': industry_relations,
        'concept_relations': concept_relations
    }

if __name__ == '__main__':
    try:
        # 先尝试AKShare
        try:
            data = fetch_akshare()
            print(json.dumps(data, ensure_ascii=False))
            sys.exit(0)
        except Exception as e:
            print(f"AKShare fetch failed: {e}", file=sys.stderr)
            traceback.print_exc()

        # AKShare失败尝试efinance
        try:
            data = fetch_efinance()
            print(json.dumps(data, ensure_ascii=False))
            sys.exit(0)
        except Exception as e:
            print(f"efinance fetch failed: {e}", file=sys.stderr)
            traceback.print_exc()

        # 都失败
        print(json.dumps({'industry_relations': [], 'concept_relations': []}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
