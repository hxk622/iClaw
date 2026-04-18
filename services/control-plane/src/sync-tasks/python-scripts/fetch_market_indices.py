#!/usr/bin/env python3
import json
import sys
import traceback
from datetime import datetime


TARGET_INDEXES = {
    "000001": {"index_key": "sh_comp", "index_name": "上证指数"},
    "399001": {"index_key": "sz_comp", "index_name": "深证成指"},
    "399006": {"index_key": "chinext", "index_name": "创业板指"},
    "000688": {"index_key": "star50", "index_name": "科创50"},
    "000300": {"index_key": "csi300", "index_name": "沪深300"},
    "000905": {"index_key": "csi500", "index_name": "中证500"},
    "000852": {"index_key": "csi1000", "index_name": "中证1000"},
}


def normalize_code(value):
    text = str(value or "").strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return ""
    return digits.zfill(6)


def safe_float(value):
    try:
        if value is None or value == "" or value == "-":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_row(row, source):
    code = normalize_code(row.get("代码"))
    if code not in TARGET_INDEXES:
        return None
    target = TARGET_INDEXES[code]
    return {
        "index_key": target["index_key"],
        "index_name": target["index_name"],
        "market_scope": "cn",
        "value": safe_float(row.get("最新价")),
        "change_amount": safe_float(row.get("涨跌额")),
        "change_percent": safe_float(row.get("涨跌幅")),
        "source": source,
        "snapshot_at": datetime.now().isoformat(),
        "is_delayed": True,
        "metadata": {
            "code": code,
            "raw_name": str(row.get("名称") or "").strip() or None,
            "open": safe_float(row.get("今开")),
            "high": safe_float(row.get("最高")),
            "low": safe_float(row.get("最低")),
            "prev_close": safe_float(row.get("昨收")),
            "amount": safe_float(row.get("成交额")),
            "volume": safe_float(row.get("成交量")),
        },
    }


def fetch_akshare():
    import akshare as ak

    frames = []
    source_symbols = ["沪深重要指数", "上证系列指数", "深证系列指数", "中证系列指数"]
    for symbol in source_symbols:
        try:
            frames.append(ak.stock_zh_index_spot_em(symbol=symbol))
        except Exception:
            continue
    if not frames:
        return None

    result = {}
    for frame in frames:
        for _, row in frame.iterrows():
            normalized = normalize_row(row, "akshare:stock_zh_index_spot_em")
            if normalized and normalized["index_key"] not in result:
                result[normalized["index_key"]] = normalized
    return list(result.values())


def fetch_sina():
    import akshare as ak

    frame = ak.stock_zh_index_spot_sina()
    result = {}
    for _, row in frame.iterrows():
        normalized = normalize_row(row, "akshare:stock_zh_index_spot_sina")
        if normalized and normalized["index_key"] not in result:
            result[normalized["index_key"]] = normalized
    return list(result.values())


if __name__ == "__main__":
    try:
        try:
            data = fetch_akshare()
            if data:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
        except Exception as e:
            print(f"AKShare EM index spot failed: {e}", file=sys.stderr)
            traceback.print_exc()

        try:
            data = fetch_sina()
            if data:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
        except Exception as e:
            print(f"AKShare Sina index spot failed: {e}", file=sys.stderr)
            traceback.print_exc()

        print(json.dumps([], ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
