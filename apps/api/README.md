# DSA API

FastAPI backend for Pointer Lab.

```bash
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8417
```

Optional: `OPENAI_API_KEY` enables live LLM tutors; otherwise deterministic mock tutors are used.

Content is loaded from `../../content` (problems, notes, roadmap).
