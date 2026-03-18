# /// script
# requires-python = ">=3.10"
# dependencies = ["mcp[cli]", "httpx"]
# ///
"""
FinGPT MCP Server

Exposes FinGPT (Qwen2.5-7B + LoRA) financial NLP capabilities as MCP tools.
Supports: sentiment analysis, headline classification, NER, relation extraction.

The agent can use these tools to analyze financial news, extract entities,
and understand relationships — forming a powerful financial analysis pipeline
when combined with yahoo-finance, alpaca, sec-edgar, and fmp MCP servers.
"""

import os
import json
import httpx
from mcp.server.fastmcp import FastMCP

FINGPT_API_URL = os.environ.get(
    "FINGPT_API_URL", "https://texture-capable-some-birth.trycloudflare.com"
)
TIMEOUT = 60.0  # FinGPT model inference can take a few seconds

mcp = FastMCP(
    "fingpt",
    instructions="FinGPT financial NLP: sentiment, headline classification, NER, relation extraction",
)

client = httpx.Client(timeout=TIMEOUT)


def _predict(task: str, text: str) -> str:
    """Call FinGPT predict API."""
    # Remove trailing slash from base URL to avoid double slashes
    base_url = FINGPT_API_URL.rstrip('/')
    resp = client.post(
        f"{base_url}/predict",
        json={"task": task, "text": text},
    )
    resp.raise_for_status()
    return resp.json()["output"]


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@mcp.tool()
def fingpt_sentiment(text: str) -> str:
    """Analyze financial sentiment of the given text.

    Returns: "positive", "negative", or "neutral".

    Use this for:
    - Analyzing financial news headlines or articles
    - Gauging market sentiment from earnings reports
    - Evaluating investor sentiment from social media posts

    Example:
        fingpt_sentiment("Apple reported record quarterly revenue, beating analyst expectations.")
        → "positive"
    """
    return _predict("sentiment", text)


@mcp.tool()
def fingpt_headline(text: str) -> str:
    """Classify whether a financial headline is relevant to a specific company/topic.

    Returns: "Yes" or "No".

    Use this for:
    - Filtering news headlines for relevance to a stock or sector
    - Screening large volumes of financial news
    - Determining if a headline impacts a specific company

    Example:
        fingpt_headline("Tesla stock surged 15% after announcing record deliveries in Q4.")
        → "Yes"
    """
    return _predict("headline", text)


@mcp.tool()
def fingpt_ner(text: str) -> str:
    """Extract named entities (people, companies, organizations) from financial text.

    Returns: Structured description of entities found and their types.

    Use this for:
    - Identifying companies mentioned in financial news
    - Extracting key people (CEOs, analysts, investors) from articles
    - Building entity maps from earnings transcripts or SEC filings

    Example:
        fingpt_ner("Warren Buffett increased Berkshire Hathaway position in Apple Inc.")
        → "Warren Buffett is a person, Berkshire Hathaway is an organization, Apple Inc is an organization."
    """
    return _predict("ner", text)


@mcp.tool()
def fingpt_relation(text: str) -> str:
    """Extract relationships between financial entities in the given text.

    Returns: Structured description of relationships found (e.g. acquisition, CEO-of, parent company).

    Use this for:
    - Understanding corporate relationships (parent/subsidiary, acquisitions)
    - Mapping executive relationships to companies
    - Analyzing M&A activity from news articles

    Example:
        fingpt_relation("Elon Musk is the CEO of Tesla. Tesla acquired SolarCity in 2016.")
        → "parent_organization: SolarCity, Tesla"
    """
    return _predict("relation", text)


@mcp.tool()
def fingpt_analyze(text: str) -> str:
    """Run ALL FinGPT analyses (sentiment + NER + relation) on the given text at once.

    Returns: Combined JSON result with sentiment, entities, and relationships.

    Use this when you need a comprehensive financial analysis of a piece of text
    instead of calling each tool separately. More efficient for full analysis.

    Example:
        fingpt_analyze("Apple acquired Beats Electronics for $3 billion, led by CEO Tim Cook.")
        → {"sentiment": "neutral", "ner": "Apple is an organization...", "relation": "..."}
    """
    results = {}
    for task in ("sentiment", "ner", "relation"):
        try:
            results[task] = _predict(task, text)
        except Exception as e:
            results[task] = f"error: {e}"
    return json.dumps(results, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
