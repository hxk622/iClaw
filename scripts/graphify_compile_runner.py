#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return normalized or "item"


def _stable_node_id(prefix: str, seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}_{_slugify(seed)}_{digest}"


def _normalize_text(value: str, max_length: int = 8000) -> str:
    compact = " ".join((value or "").split()).strip()
    if len(compact) <= max_length:
        return compact
    return compact[: max(0, max_length - 1)].rstrip() + "…"


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def _first_heading(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or None
    return None


def _extract_doc_keywords(text: str, limit: int = 6) -> list[str]:
    chinese = re.findall(r"[\u4e00-\u9fa5]{2,10}", text)
    english = re.findall(r"\b[A-Z][a-zA-Z0-9+.-]{1,}(?:\s+[A-Z][a-zA-Z0-9+.-]{1,}){0,2}\b", text)
    result: list[str] = []
    for candidate in chinese + english:
        cleaned = candidate.strip()
        if not cleaned or cleaned in result:
            continue
        result.append(cleaned)
        if len(result) >= limit:
            break
    return result


def _relative(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except Exception:
        return str(path)


def _document_extraction(paths: list[Path], category: str, root: Path) -> dict:
    nodes: list[dict] = []
    edges: list[dict] = []
    for path in paths:
        raw_text = _read_text(path)
        rel_path = _relative(path, root)
        label = _first_heading(raw_text) or path.name
        node_id = _stable_node_id(category, rel_path)
        nodes.append(
            {
                "id": node_id,
                "label": label,
                "file_type": category,
                "source_file": rel_path,
                "source_location": "L1",
            }
        )
        for keyword in _extract_doc_keywords(raw_text):
            keyword_id = _stable_node_id("concept", f"{rel_path}:{keyword}")
            nodes.append(
                {
                    "id": keyword_id,
                    "label": keyword,
                    "file_type": category,
                    "source_file": rel_path,
                    "source_location": "L1",
                }
            )
            edges.append(
                {
                    "source": node_id,
                    "target": keyword_id,
                    "relation": "references",
                    "confidence": "EXTRACTED",
                    "weight": 1.0,
                    "source_file": rel_path,
                    "source_location": "L1",
                }
            )
    return {
        "nodes": nodes,
        "edges": edges,
        "hyperedges": [],
        "input_tokens": 0,
        "output_tokens": 0,
    }


def _build_community_labels(graph, communities: dict[int, list[str]]) -> dict[int, str]:
    labels: dict[int, str] = {}
    for cid, node_ids in communities.items():
        names: list[str] = []
        for node_id in node_ids[:3]:
            label = graph.nodes[node_id].get("label", node_id)
            if label not in names:
                names.append(label)
        labels[cid] = " / ".join(names) if names else f"Community {cid}"
    return labels


def run_compile(corpus_root: Path, output_dir: Path, no_viz: bool = False) -> dict:
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.build import build
    from graphify.cluster import cluster, score_all
    from graphify.detect import detect
    from graphify.export import to_html, to_json
    from graphify.extract import extract
    from graphify.report import generate

    output_dir.mkdir(parents=True, exist_ok=True)

    detection = detect(corpus_root)
    code_paths = [Path(path) for path in detection.get("files", {}).get("code", [])]
    doc_paths = [Path(path) for path in detection.get("files", {}).get("document", [])]
    paper_paths = [Path(path) for path in detection.get("files", {}).get("paper", [])]
    image_paths = [Path(path) for path in detection.get("files", {}).get("image", [])]
    video_paths = [Path(path) for path in detection.get("files", {}).get("video", [])]

    extractions: list[dict] = []
    if code_paths:
        extractions.append(extract(code_paths))
    if doc_paths:
        extractions.append(_document_extraction(doc_paths, "document", corpus_root))
    if paper_paths:
        extractions.append(_document_extraction(paper_paths, "paper", corpus_root))
    if image_paths:
        extractions.append(_document_extraction(image_paths, "image", corpus_root))
    if video_paths:
        extractions.append(_document_extraction(video_paths, "video", corpus_root))

    if not extractions:
        return {
            "available": False,
            "error": "graphify runner found no supported files in corpus",
        }

    graph = build(extractions, directed=True)
    communities = cluster(graph)
    cohesion_scores = score_all(graph, communities)
    community_labels = _build_community_labels(graph, communities)
    surprises = surprising_connections(graph, communities=communities)
    questions = suggest_questions(graph, communities, community_labels)
    token_cost = {
        "input": sum(ext.get("input_tokens", 0) for ext in extractions),
        "output": sum(ext.get("output_tokens", 0) for ext in extractions),
    }
    report = generate(
        graph,
        communities,
        cohesion_scores,
        community_labels,
        god_nodes(graph),
        surprises,
        detection,
        token_cost,
        str(corpus_root),
        suggested_questions=questions,
    )

    graph_json_path = output_dir / "graph.json"
    report_path = output_dir / "GRAPH_REPORT.md"
    html_path = output_dir / "graph.html"

    to_json(graph, communities, str(graph_json_path))
    report_path.write_text(report, encoding="utf-8")

    html_error = None
    if not no_viz:
        try:
            to_html(graph, communities, str(html_path), community_labels=community_labels)
        except Exception as exc:  # noqa: BLE001
            html_error = str(exc)

    return {
        "available": True,
        "graph_json_path": str(graph_json_path),
        "report_path": str(report_path),
        "html_path": str(html_path) if html_path.exists() else None,
        "graph_json_text": graph_json_path.read_text(encoding="utf-8"),
        "report_text": report,
        "html_error": html_error,
        "detection": detection,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Repo-local graphify compile runner")
    parser.add_argument("--corpus", required=True, help="Corpus directory")
    parser.add_argument("--output", required=True, help="graphify-out directory")
    parser.add_argument("--update", action="store_true", help="Incremental compile hint; currently rebuilds whole corpus")
    parser.add_argument("--no-viz", action="store_true", help="Skip HTML generation")
    args = parser.parse_args()

    corpus_root = Path(args.corpus).resolve()
    output_dir = Path(args.output).resolve()
    if not corpus_root.exists():
        print(json.dumps({"available": False, "error": f"corpus not found: {corpus_root}"}))
        return 1

    try:
        result = run_compile(corpus_root, output_dir, no_viz=args.no_viz)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"available": False, "error": str(exc)}))
        return 1

    print(json.dumps(result))
    return 0 if result.get("available") else 1


if __name__ == "__main__":
    raise SystemExit(main())
