from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import get_problem
from app.db import get_db
from app.kg_service import record_attempt_kg, record_mastered_kg
from app.progress_service import get_or_create_progress, mark_mastered, next_prediction_index, record_attempt
from app.runner.ast_analyzer import analyze_code, generate_viva
from app.runner.performance import default_args_for_problem, measure_scaling
from app.runner.problem_args import (
    edge_case_args,
    normalize_demo_args,
    parse_example_args,
    parse_example_expected,
)
from app.runner.sandbox import run_student_code
from app.runner.trace_check import answer_supported_by_trace, run_reference_trace
from app.runner.viva_grade import grade_problem_viva
from app.schemas import (
    PredictRequest,
    PredictResponse,
    RunRequest,
    RunResponse,
    TestCaseResult,
    TestRequest,
    TestResponse,
    TraceEvent,
    VivaQuestionResult,
    VivaResponse,
    VivaSubmit,
)

router = APIRouter(tags=["run"])
logger = logging.getLogger(__name__)


def _normalize_args(problem: dict[str, Any], args: list[Any] | None) -> list[Any]:
    return normalize_demo_args(problem, args)


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

    progress = await get_or_create_progress(db, body.session_id, body.problem_id, problem["topic"])
    if body.mode == "student" and progress.stage < 3:
        raise HTTPException(status_code=409, detail="Finish Predict before running your code.")

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

    ok = bool(raw.get("ok"))
    if body.mode == "brute" and ok and body.args is None:
        progress.stage = max(progress.stage, 2 if problem.get("predict_steps") else 3)
        await db.commit()
    elif body.mode == "student":
        if progress.stage == 4 and not progress.mastered and progress.last_code != code:
            progress.stage = 3
        progress.last_code = code
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
        stage=max(progress.stage, 1),
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
    progress = await get_or_create_progress(db, body.session_id, body.problem_id, problem["topic"])
    if progress.stage < 2:
        raise HTTPException(status_code=409, detail="Run the demo before checking your prediction.")
    next_index = await next_prediction_index(db, progress, len(steps))
    if body.step_index < next_index:
        return PredictResponse(correct=True, stage=progress.stage, next_predict_index=next_index)
    if body.step_index != next_index:
        raise HTTPException(status_code=409, detail="Complete the previous prediction first.")
    if not _normalize_predict_answer(body.answer):
        raise HTTPException(status_code=422, detail="Enter a prediction before checking it.")
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

    if correct:
        next_index += 1
        if next_index == len(steps):
            progress.stage = max(progress.stage, 3)
    hint = None if correct else step.get("hint")
    if not correct and events:
        hint = ((hint or "") + " Checked against a live code trace.").strip()
    await record_attempt(db, body.session_id, body.problem_id, 2, correct, f"predict:{body.step_index}")
    return PredictResponse(correct=correct, hint=hint, stage=progress.stage, next_predict_index=next_index)


@router.post("/test", response_model=TestResponse)
async def run_tests(body: TestRequest, db: AsyncSession = Depends(get_db)) -> TestResponse:
    try:
        problem = get_problem(body.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc

    progress = await get_or_create_progress(db, body.session_id, body.problem_id, problem["topic"])
    if progress.stage < 3:
        raise HTTPException(status_code=409, detail="Finish Predict before submitting tests.")

    analysis = analyze_code(body.code)
    results: list[TestCaseResult] = []

    # Visible examples — show input/expected on failure for student feedback.
    for idx, ex in enumerate(problem.get("examples") or []):
        try:
            args = parse_example_args(problem, ex["input"])
            expected = parse_example_expected(ex["output"])
        except (SyntaxError, ValueError, AssertionError) as exc:
            logger.exception("Invalid example %s for %s", idx + 1, body.problem_id)
            raise HTTPException(status_code=503, detail="Grading is unavailable for this problem. Try a different problem.") from exc
        raw = run_student_code(body.code, problem["function_name"], args=args)
        got = raw.get("result")
        passed = bool(raw.get("ok")) and got == expected
        results.append(
            TestCaseResult(
                index=idx,
                passed=passed,
                input=args,
                expected=expected,
                got=got,
                error=raw.get("error"),
                visible=True,
            )
        )

    # Hidden tests — grade privately; never leak args/expected/got.
    for idx, case in enumerate(problem.get("hidden_tests", [])):
        raw = run_student_code(body.code, problem["function_name"], args=case["args"])
        expected = case["expected"]
        got = raw.get("result")
        passed = bool(raw.get("ok")) and got == expected
        results.append(
            TestCaseResult(
                index=1000 + idx,
                passed=passed,
                input=None,
                expected=None,
                got=None,
                error=None if passed else ("Runtime error" if raw.get("error") else "Wrong answer"),
                visible=False,
            )
        )

    # Edge cases — same privacy rules as hidden tests.
    for idx, edge in enumerate(problem.get("edge_cases", [])):
        args = edge_case_args(problem, edge)
        ref = run_student_code(problem["reference_solution"], problem["function_name"], args=args)
        if not ref.get("ok"):
            logger.error("Reference runner failed on edge case %s for %s", idx + 1, body.problem_id)
            raise HTTPException(status_code=503, detail="Grading is unavailable for this problem. Try a different problem.")
        stu = run_student_code(body.code, problem["function_name"], args=args)
        passed = bool(stu.get("ok")) and stu.get("result") == ref.get("result")
        results.append(
            TestCaseResult(
                index=2000 + idx,
                passed=passed,
                input=None,
                expected=None,
                got=None,
                error=None if passed else ("Runtime error" if stu.get("error") else "Wrong answer"),
                visible=False,
            )
        )

    passed_count = sum(r.passed for r in results)
    passed_all = bool(results) and passed_count == len(results)
    viva: list[dict[str, str]] = []
    if passed_all:
        authored = problem.get("viva") or []
        if authored:
            viva = [
                {"id": f"q{i}", "prompt": str(item.get("question") or "")}
                for i, item in enumerate(authored)
            ]
        else:
            viva = generate_viva(body.code, problem["title"])
    if not progress.mastered:
        progress.stage = 4 if passed_all else 3
    progress.last_code = body.code
    await record_attempt(db, body.session_id, body.problem_id, 4, passed_all, f"{passed_count}/{len(results)}")
    return TestResponse(
        passed_all=passed_all,
        results=results,
        viva=viva,
        ast_insights=analysis.get("insights", []),
        stage=progress.stage,
        mastered=bool(progress.mastered),
    )


@router.post("/viva", response_model=VivaResponse)
async def submit_viva(body: VivaSubmit, db: AsyncSession = Depends(get_db)) -> VivaResponse:
    try:
        problem = get_problem(body.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc

    progress = await get_or_create_progress(db, body.session_id, body.problem_id, problem["topic"])
    if progress.stage < 4:
        raise HTTPException(status_code=409, detail="Pass all tests before submitting Viva answers.")
    if progress.mastered:
        return VivaResponse(passed=True, mastered=True, stage=progress.stage)
    submitted_code = progress.last_code

    viva_spec = problem.get("viva") or []
    if len(viva_spec) < 2:
        raise HTTPException(status_code=500, detail="Problem is missing viva rubrics")

    if len(body.answers) != len(viva_spec) or any(not answer.strip() for answer in body.answers):
        raise HTTPException(status_code=422, detail="Answer every Viva question before submitting.")
    graded = await grade_problem_viva(problem, body.answers)
    await db.refresh(progress)
    if progress.stage < 4 or progress.last_code != submitted_code:
        raise HTTPException(status_code=409, detail="Your submission changed. Pass the tests again before Viva.")
    results = [VivaQuestionResult(**row) for row in graded]
    passed = bool(results) and all(r.passed for r in results)
    if not passed:
        await record_attempt(db, body.session_id, body.problem_id, 4, False, "viva")
        return VivaResponse(
            passed=False,
            mastered=False,
            stage=4,
            detail="Some viva answers need more work — retry the failed questions.",
            results=results,
        )

    row = await mark_mastered(db, body.session_id, body.problem_id, problem["topic"])
    await record_attempt(db, body.session_id, body.problem_id, 4, True, "viva")
    try:
        await record_mastered_kg(db, body.session_id, body.problem_id)
    except Exception:
        pass
    return VivaResponse(
        passed=True,
        mastered=True,
        stage=row.stage,
        detail=None,
        results=results,
    )
