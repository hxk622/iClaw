#!/usr/bin/env python3
import hashlib
import json
import sys
import traceback
from datetime import datetime


def normalize_timestamp(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    text = str(value).strip()
    return text or None


def build_news_id(source, title, published_at, content_url):
    raw = "||".join([source or "", title or "", published_at or "", content_url or ""])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def normalize_item(source, title, summary, published_at, content_url=None):
    normalized_title = str(title or "").strip()
    if not normalized_title:
        return None
    published_value = normalize_timestamp(published_at) or datetime.now().isoformat()
    content_url_value = str(content_url or "").strip() or None
    return {
        "news_id": build_news_id(source, normalized_title, published_value, content_url_value),
        "source": source,
        "source_item_id": content_url_value,
        "title": normalized_title,
        "summary": str(summary or "").strip() or None,
        "content_url": content_url_value,
        "published_at": published_value,
        "occurred_at": None,
        "language": "zh-CN",
        "market_scope": "cn",
        "importance_score": None,
        "sentiment_label": None,
        "related_symbols": [],
        "related_tags": ["财经快讯"],
        "metadata": {},
    }


def fetch_eastmoney():
    import akshare as ak

    frame = ak.stock_info_global_em()
    result = []
    for _, row in frame.iterrows():
        item = normalize_item(
            "eastmoney",
            row.get("标题"),
            row.get("摘要"),
            row.get("发布时间"),
            row.get("链接"),
        )
        if item:
            result.append(item)
    return result


def fetch_cls():
    import akshare as ak

    frame = ak.stock_info_global_cls(symbol="全部")
    result = []
    for _, row in frame.iterrows():
        published_at = None
        publish_date = normalize_timestamp(row.get("发布日期"))
        publish_time = normalize_timestamp(row.get("发布时间"))
        if publish_date and publish_time:
            published_at = f"{publish_date} {publish_time}"
        else:
            published_at = publish_date or publish_time
        item = normalize_item(
            "cls",
            row.get("标题"),
            row.get("内容"),
            published_at,
            None,
        )
        if item:
            item["related_tags"] = ["财经电报"]
            result.append(item)
    return result


def fetch_sina():
    import akshare as ak

    frame = ak.stock_info_global_sina()
    result = []
    for _, row in frame.iterrows():
        item = normalize_item(
            "sina",
            row.get("内容"),
            row.get("内容"),
            row.get("时间"),
            None,
        )
        if item:
            item["related_tags"] = ["财经快讯"]
            result.append(item)
    return result


if __name__ == "__main__":
    try:
        merged = []
        seen = set()
        for fetcher in (fetch_eastmoney, fetch_cls, fetch_sina):
            try:
                items = fetcher()
                for item in items:
                    if item["news_id"] in seen:
                        continue
                    seen.add(item["news_id"])
                    merged.append(item)
            except Exception as e:
                print(f"{fetcher.__name__} failed: {e}", file=sys.stderr)
                traceback.print_exc()
                continue

        merged.sort(key=lambda item: item.get("published_at") or "", reverse=True)
        print(json.dumps(merged[:200], ensure_ascii=False))
        sys.exit(0 if merged else 1)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
