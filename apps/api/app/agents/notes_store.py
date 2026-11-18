from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.content_loader import load_notes, load_roadmap


@lru_cache
def _collection():
    settings = get_settings()
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    try:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        client = chromadb.PersistentClient(
            path=str(settings.chroma_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        collection = client.get_or_create_collection("dsa_notes")
        # Seed if empty
        if collection.count() == 0:
            roadmap = load_roadmap()
            docs, ids, metas = [], [], []
            for topic in roadmap["topics"]:
                slug = topic["slug"]
                text = load_notes(slug)
                docs.append(text)
                ids.append(slug)
                metas.append({"topic": slug, "title": topic["title"]})
            if docs:
                collection.add(documents=docs, ids=ids, metadatas=metas)
        return collection
    except Exception:
        return None


def retrieve_notes(topic: str | None, query: str, k: int = 2) -> str:
    collection = _collection()
    if collection is None:
        if topic:
            return load_notes(topic)
        return ""
    try:
        where = {"topic": topic} if topic else None
        result = collection.query(query_texts=[query or topic or "arrays"], n_results=k, where=where)
        docs = result.get("documents") or [[]]
        flat = [d for group in docs for d in group]
        if flat:
            return "\n\n".join(flat)
    except Exception:
        pass
    if topic:
        return load_notes(topic)
    # fallback: concatenate first note files
    notes_dir: Path = get_settings().content_dir / "notes"
    parts = []
    for path in sorted(notes_dir.glob("*.md"))[:2]:
        parts.append(path.read_text(encoding="utf-8"))
    return "\n\n".join(parts)
