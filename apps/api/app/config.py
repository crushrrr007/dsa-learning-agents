from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]
CONTENT_DIR = REPO_ROOT / "content"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8417
    content_dir: Path = CONTENT_DIR
    database_url: str = f"sqlite+aiosqlite:///{DATA_DIR / 'dsa.db'}"
    chroma_dir: Path = DATA_DIR / "chroma"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:3417,http://127.0.0.1:3417"
    run_timeout_sec: float = 2.0
    run_max_steps: int = 400
    run_max_output_chars: int = 4000
    # subprocess (default) | docker | auto — docker only when DSA_USE_DOCKER=1
    runner_backend: str = "subprocess"


@lru_cache
def get_settings() -> Settings:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return Settings()
