from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import get_problem
from app.db import get_db
from app.kg_service import record_attempt_kg, record_mastered_kg
from app.progress_service import record_attempt, save_code, set_stage
from app.runner.ast_analyzer import analyze_code, generate_viva
from app.runner.performance import default_args_for_problem, measure_scaling
from app.runner.sandbox import run_student_code
from app.runner.trace_check import answer_supported_by_trace, run_reference_trace
from app.schemas import (
    PredictRequest,
    PredictResponse,
    RunRequest,
    RunResponse,
    TestCaseResult,
    TestRequest,
    TestResponse,
    TraceEvent,
    VivaSubmit,
)
from app.progress_service import mark_mastered

router = APIRouter(tags=["run"])


def _normalize_args(problem: dict[str, Any], args: list[Any] | None) -> list[Any]:
    if args is not None:
        return args
    demo = problem.get("demo_input")
    fn = problem["function_name"]
    if isinstance(demo, dict):
        if fn == "two_sum_sorted":
            return [demo["nums"], demo["target"]]
        if fn == "max_sum_subarray":
            return [demo["arr"], demo["k"]]
        if fn == "has_cycle":
            return [demo["values"], demo["pos"]]
        if fn == "shortest_path":
            return [demo["n"], demo["edges"], demo["src"], demo["dst"]]
        if fn == "count_components":
            return [demo["n"], demo["edges"]]
        if fn == "min_subarray_len":
            return [demo["nums"], demo["k"]]
        if fn == "is_same_tree":
            return [demo["a"], demo["b"]]
        return list(demo.values())
    return [demo]


def _code_for_mode(problem: dict[str, Any], mode: str, code: str | None) -> str:
    if mode == "brute":
        return problem["brute_force_code"]
    if mode == "reference_hidden":
        # Used only server-side for grading expectations if needed; not exposed.
        return problem["reference_solution"]
    if not code:
        raise HTTPException(status_code=400, detail="code required for student mode")
    return code


@router.post("/run", response_model=RunResponse)
async def run_code(body: RunRequest, db: AsyncSession = Depends(get_db)) -> RunResponse:
    try:
        problem = get_problem(body.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc

    if body.mode == "reference_hidden":
        raise HTTPException(status_code=403, detail="Reference solutions are not available to clients")

    code = _code_for_mode(problem, body.mode, body.code)
    args = _normalize_args(problem, body.args)
    started = time.perf_counter()
    raw = run_student_code(code, problem["function_name"], args=args)
    duration = (time.perf_counter() - started) * 1000
    analysis = analyze_code(code)
    perf: list[dict[str, Any]] = []
    if body.mode == "brute":
        perf = measure_scaling(
            code,
            problem["function_name"],
            lambda n: default_args_for_problem(problem, n),
            sizes=[40, 80, 120],
        )

    if body.mode == "student" and body.code:
        await save_code(db, body.session_id, body.problem_id, problem["topic"], body.code)
        ok = bool(raw.get("ok"))
        await record_attempt(db, body.session_id, body.problem_id, 3, ok, raw.get("error") or "")
        try:
            await record_attempt_kg(db, body.session_id, body.problem_id, success=ok, topic=problem["topic"])
        except Exception:
            pass

    events = [TraceEvent(**e) for e in raw.get("events", [])]
    return RunResponse(
        ok=bool(raw.get("ok")),
        result=raw.get("result"),
        error=raw.get("error"),
        events=events,
        stdout=raw.get("stdout") or "",
        duration_ms=round(duration, 2),
        ast_insights=analysis.get("insights", []),
        performance=perf,
    )


def _normalize_predict_answer(text: str) -> str:
    cleaned = text.strip().lower()
    for ch in ("'", '"', "`"):
        cleaned = cleaned.replace(ch, "")
    cleaned = cleaned.replace("→", " ").replace("->", " ")
    for token in ("=", ",", ";", ":"):
        cleaned = cleaned.replace(token, " ")
    return " ".join(cleaned.split())


def _predict_matches(expected: str, got: str, alternatives: list[str] | None = None) -> bool:
    candidates = [expected, *(alternatives or [])]
    norm_got = _normalize_predict_answer(got)
    for cand in candidates:
        norm_exp = _normalize_predict_answer(str(cand))
        if not norm_exp:
            continue
        if norm_got == norm_exp or norm_exp in norm_got or norm_got in norm_exp:
            return True
        # Token overlap for short numeric / pointer answers
        exp_tokens = set(norm_exp.split())
        got_tokens = set(norm_got.split())
        if exp_tokens and exp_tokens <= got_tokens:
            return True
    return False


@router.post("/predict", response_model=PredictResponse)
async def predict(body: PredictRequest, db: AsyncSession = Depends(get_db)) -> PredictResponse:
    try:
        problem = get_problem(body.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc
    steps = problem.get("predict_steps", [])
    if body.step_index < 0 or body.step_index >= len(steps):
        raise HTTPException(status_code=400, detail="Invalid step index")
    step = steps[body.step_index]

    # Run a live reference trace so predictions are grounded in real execution facts.
    trace = run_reference_trace(problem, _normalize_args)
    events = trace.get("events") or []
    text_ok = _predict_matches(
        str(step["answer"]),
        body.answer,
        step.get("accepted_answers") or [],
    )
    trace_ok = answer_supported_by_trace(
        body.answer,
        events,
        keys=step.get("trace_keys"),
    )
    # Accept authored/flexible text matches; when the answer is pointer/numeric,
    # also accept freeform answers that clearly appear in the live trace.
    correct = text_ok or (trace_ok and bool(events))

    stage = 2
    if correct:
        if body.step_index >= len(steps) - 1:
            await set_stage(db, body.session_id, body.problem_id, problem["topic"], 3)
            stage = 3
        else:
            await set_stage(db, body.session_id, body.problem_id, problem["topic"], 2)
            stage = 2
    hint = None if correct else step.get("hint")
    if not correct and events:
        hint = ((hint or "") + " Checked against a live code trace.").strip()
    await record_attempt(db, body.session_id, body.problem_id, 2, correct, body.answer)
    return PredictResponse(correct=correct, hint=hint, stage=stage)


@router.post("/stage/see")
async def complete_see(session_id: str, problem_id: str, db: AsyncSession = Depends(get_db)):
    try:
        problem = get_problem(problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc
    row = await set_stage(db, session_id, problem_id, problem["topic"], 2)
    return {"stage": row.stage}


@router.post("/test", response_model=TestResponse)
async def run_tests(body: TestRequest, db: AsyncSession = Depends(get_db)) -> TestResponse:
    try:
        problem = get_problem(body.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc

    await save_code(db, body.session_id, body.problem_id, problem["topic"], body.code)
    analysis = analyze_code(body.code)
    results: list[TestCaseResult] = []
    for idx, case in enumerate(problem.get("hidden_tests", [])):
        raw = run_student_code(body.code, problem["function_name"], args=case["args"])
        expected = case["expected"]
        got = raw.get("result")
        passed = bool(raw.get("ok")) and got == expected
        results.append(
            TestCaseResult(
                index=idx,
                passed=passed,
                input=case["args"],
                expected=expected,
                got=got,
                error=raw.get("error"),
            )
        )

    # Extra edge cases: compare student vs hidden reference on server only
    multi_arg = {
        "two_sum_sorted",
        "max_sum_subarray",
        "has_cycle",
        "shortest_path",
        "count_components",
        "min_subarray_len",
        "is_same_tree",
    }
    for idx, edge in enumerate(problem.get("edge_cases", [])):
        if isinstance(edge, list) and problem["function_name"] in multi_arg:
            args = edge
        else:
            args = [edge]
        ref = run_student_code(problem["reference_solution"], problem["function_name"], args=args)
        stu = run_student_code(body.code, problem["function_name"], args=args)
        expected = ref.get("result") if ref.get("ok") else None
        passed = bool(stu.get("ok")) and expected is not None and stu.get("result") == expected
        results.append(
            TestCaseResult(
                index=100 + idx,
                passed=passed,
                input=args,
                expected=expected,
                got=stu.get("result"),
                error=stu.get("error"),
            )
        )

    passed_all = all(r.passed for r in results) and len(results) > 0
    viva = generate_viva(body.code, problem["title"]) if passed_all else []
    stage = 4
    await set_stage(db, body.session_id, body.problem_id, problem["topic"], 4)
    await record_attempt(db, body.session_id, body.problem_id, 4, passed_all, f"{sum(r.passed for r in results)}/{len(results)}")
    return TestResponse(
        passed_all=passed_all,
        results=results,
        viva=viva,
        ast_insights=analysis.get("insights", []),
        stage=stage,
        mastered=False,
    )


@router.post("/viva")
async def submit_viva(body: VivaSubmit, db: AsyncSession = Depends(get_db)):
    try:
        problem = get_problem(body.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc
    # Accept any thoughtful non-empty answers for lab demo
    ok = len(body.answers) >= 2 and all(len(a.strip()) >= 8 for a in body.answers[:2])
    if not ok:
        return {"passed": False, "detail": "Answer both viva questions with at least a short sentence each."}
    row = await mark_mastered(db, body.session_id, body.problem_id, problem["topic"])
    await record_attempt(db, body.session_id, body.problem_id, 4, True, "viva")
    try:
        await record_mastered_kg(db, body.session_id, body.problem_id)
    except Exception:
        pass
    return {"passed": True, "mastered": True, "stage": row.stage}
