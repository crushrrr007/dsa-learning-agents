from __future__ import annotations

import ast
from typing import Any


def analyze_code(code: str) -> dict[str, Any]:
    insights: list[str] = []
    summary: dict[str, Any] = {
        "loops": 0,
        "ifs": 0,
        "functions": [],
        "has_while": False,
        "has_for": False,
        "compares_len": False,
        "insights": insights,
    }
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        insights.append(f"Syntax error: {exc.msg} at line {exc.lineno}")
        summary["insights"] = insights
        return summary

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            summary["functions"].append(node.name)
        elif isinstance(node, ast.For):
            summary["loops"] += 1
            summary["has_for"] = True
        elif isinstance(node, ast.While):
            summary["loops"] += 1
            summary["has_while"] = True
        elif isinstance(node, ast.If):
            summary["ifs"] += 1
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "len":
            summary["compares_len"] = True

    if summary["loops"] == 0 and "return" in code:
        insights.append("No loop detected — check whether you need to scan or move pointers.")
    if summary["has_while"] and not summary["compares_len"] and "left" not in code and "right" not in code:
        insights.append("While-loop without clear bound variables — watch for infinite loops.")
    if "left" in code and "right" in code and "left < right" not in code and "left <= right" not in code:
        insights.append("Two pointers present; confirm the loop condition uses left/right correctly.")
    if summary["loops"] >= 2:
        insights.append("Nested or multiple loops found — think about O(n²) behavior on larger inputs.")
    if not insights:
        insights.append("Structure looks parseable. Focus on the invariant of each iteration.")

    summary["insights"] = insights
    return summary


def generate_viva(code: str, problem_title: str) -> list[dict[str, str]]:
    analysis = analyze_code(code)
    questions: list[dict[str, str]] = []
    if analysis["has_while"] or analysis["has_for"]:
        questions.append(
            {
                "id": "q1",
                "prompt": f"In your solution for '{problem_title}', what is the loop invariant you rely on?",
            }
        )
    else:
        questions.append(
            {
                "id": "q1",
                "prompt": f"Your code for '{problem_title}' has little looping. Which cases does a single pass miss?",
            }
        )

    if "left" in code or "right" in code or "slow" in code or "fast" in code:
        questions.append(
            {
                "id": "q2",
                "prompt": "Point to a variable in your code that acts as a pointer. When does it move, and why?",
            }
        )
    else:
        questions.append(
            {
                "id": "q2",
                "prompt": "Where could an off-by-one boundary bug hide in your current code?",
            }
        )
    return questions[:2]
