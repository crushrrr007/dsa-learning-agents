"""Detect leaked full solutions in agent replies (server-side only)."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.agents.llm import STAGE_HINTS, TOPIC_HINTS, chat_complete, resolve_llm_config

logger = logging.getLogger("app.agents.solution_guard")

STRICT_NO_SOLUTION_ADDENDUM = (
    "STRICT REGENERATION: give only a conceptual hint and one guiding question; "
    "no code longer than 2 lines. Do not paste a full solution or the complete function body."
)

_PYTHON_KEYWORDS = {
    "false",
    "none",
    "true",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
}


def _strip_comments(line: str) -> str:
    in_single = False
    in_double = False
    out: list[str] = []
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "'" and not in_double:
            in_single = not in_single
            out.append(ch)
        elif ch == '"' and not in_single:
            in_double = not in_double
            out.append(ch)
        elif ch == "#" and not in_single and not in_double:
            break
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def extract_fenced_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    for match in re.finditer(r"```(?:[\w+-]*)\n?(.*?)```", text, flags=re.DOTALL):
        blocks.append(match.group(1))
    return blocks


def normalize_code_lines(code: str) -> list[str]:
    """Strip comments/whitespace and rename identifiers to stable placeholders."""
    if not code:
        return []
    raw_lines: list[str] = []
    for line in code.splitlines():
        cleaned = _strip_comments(line).strip()
        if cleaned:
            raw_lines.append(cleaned)
    joined = "\n".join(raw_lines)
    mapping: dict[str, str] = {}

    def _replace(match: re.Match[str]) -> str:
        word = match.group(0)
        key = word.lower()
        if key in _PYTHON_KEYWORDS:
            return word
        if word.isdigit():
            return word
        if key not in mapping:
            mapping[key] = f"id{len(mapping)}"
        return mapping[key]

    normalized = re.sub(r"\b[A-Za-z_][A-Za-z0-9_]*\b", _replace, joined)
    lines: list[str] = []
    for line in normalized.splitlines():
        collapsed = re.sub(r"\s+", " ", line).strip()
        if collapsed:
            lines.append(collapsed)
    return lines


def defines_function(text: str, function_name: str) -> bool:
    if not function_name:
        return False
    pattern = rf"\bdef\s+{re.escape(function_name)}\s*\("
    return re.search(pattern, text) is not None


def reference_overlap_ratio(reply: str, reference_solution: str) -> float:
    ref_lines = normalize_code_lines(reference_solution)
    if not ref_lines:
        return 0.0
    # Prefer fenced code for comparison; fall back to whole reply.
    blocks = extract_fenced_blocks(reply)
    hay = "\n".join(blocks) if blocks else reply
    reply_lines = set(normalize_code_lines(hay))
    if not reply_lines:
        return 0.0
    hits = sum(1 for line in ref_lines if line in reply_lines)
    return hits / len(ref_lines)


def cheap_leak_detected(
    reply: str,
    *,
    function_name: str = "",
    reference_solution: str = "",
) -> tuple[bool, str]:
    """Return (leaked, reason) using fenced-code and reference-overlap checks."""
    text = reply or ""
    for block in extract_fenced_blocks(text):
        line_count = len([ln for ln in block.splitlines() if ln.strip()])
        if line_count > 6:
            return True, "fenced_code_too_long"
        if defines_function(block, function_name):
            return True, "fenced_defines_function"
    if defines_function(text, function_name) and (
        text.count("\n") >= 6 or "return " in text
    ):
        # Unfenced but clearly a full def body
        return True, "unfenced_defines_function"
    ratio = reference_overlap_ratio(text, reference_solution)
    if ratio > 0.60:
        return True, f"reference_overlap:{ratio:.2f}"
    return False, ""


async def llm_complete_solution_verdict(reply: str) -> bool:
    """Optional yes/no: does the reply still read like a complete solution?"""
    cfg = resolve_llm_config()
    if not cfg.get("api_key"):
        return False
    system = (
        "You are a leak detector. Answer only YES or NO. "
        "YES means the assistant message contains a complete working solution "
        "(full algorithm implementation a student could copy). "
        "NO means it is a hint, question, or partial fragment."
    )
    user = f"Assistant message:\n<<<\n{(reply or '')[:4000]}\n>>>"
    verdict = await chat_complete(system, user)
    if not verdict or verdict.startswith("(LLM unavailable"):
        return False
    cleaned = verdict.strip().lower()
    if cleaned.startswith("yes"):
        return True
    return False


async def detect_solution_leak(
    reply: str,
    *,
    function_name: str = "",
    reference_solution: str = "",
    use_llm: bool = True,
) -> tuple[bool, str]:
    leaked, reason = cheap_leak_detected(
        reply, function_name=function_name, reference_solution=reference_solution
    )
    if leaked:
        return True, reason
    if use_llm:
        if await llm_complete_solution_verdict(reply):
            return True, "llm_complete_solution"
    return False, ""


def safe_fallback_reply(*, topic: str, stage: int, agent: str) -> dict[str, str]:
    topic_hint = TOPIC_HINTS.get(topic, "Focus on the core invariant.")
    stage_hint = STAGE_HINTS.get(stage, STAGE_HINTS.get(3, "Stay conceptual."))
    reply = (
        f"I will not paste a full solution. {stage_hint} {topic_hint} "
        "Name the invariant or the next micro-step in one sentence."
    )
    guiding = {
        0: "Can you restate the pattern without writing code?",
        1: "In the demo, which variable should change next — and why?",
        2: "What are the pointer or node values after this step?",
        3: "Which single line implements (or breaks) the invariant?",
        4: "What input would break your approach if the invariant slipped?",
    }.get(stage, "What must stay true after each iteration?")
    return {"reply": reply, "guiding_question": guiding}


def log_guard_event(
    *,
    session_id: str,
    agent: str,
    problem_id: str,
    guard_triggered: bool,
    regenerated: bool,
    reason: str = "",
) -> None:
    logger.info(
        "solution_guard session=%s agent=%s problem=%s triggered=%s regenerated=%s reason=%s",
        session_id,
        agent,
        problem_id or "-",
        guard_triggered,
        regenerated,
        reason or "-",
    )


async def regenerate_without_solution(
    *,
    agent: str,
    topic: str,
    stage: int,
    message: str,
    prior_reply: str,
) -> str | None:
    """Ask the model once more with a stricter policy. Never include reference_solution."""
    system = (
        f"You are agent `{agent}` for topic `{topic}` at stage {stage}. "
        f"{STRICT_NO_SOLUTION_ADDENDUM} "
        "Your previous draft was rejected for looking like a full solution."
    )
    user = (
        f"Student message:\n{message}\n\n"
        f"Rejected draft (do not repeat its code):\n{(prior_reply or '')[:500]}"
    )
    out = await chat_complete(system, user)
    if not out or out.startswith("(LLM unavailable"):
        return None
    return out
