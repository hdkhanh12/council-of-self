"""
Nguyên tắc kiến trúc bắt buộc:
- CONTROL FLOW do CODE quyết định bằng rule-based logic.
- LLM chỉ chịu trách nhiệm CONTENT GENERATION, thông qua llm_client.call_agent() / call_moderator().

Luồng dữ liệu: API layer (api/debate.py) gọi run_debate() như một async
generator, mỗi yield là một sự kiện SSE sẵn sàng để gửi thẳng cho client.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import AsyncGenerator, Literal

from app.agents.registry import (
    AGENTS,
    AGENT_ROLES_ORDER,
    MODERATOR_CONFIG,
    FALLBACK_LINES,
)
from app.agents.llm_client import call_agent, call_moderator, AgentCallResult
from app.core.config import settings
from app.core.sse import sse_format
from app.core.db_client import supabase_admin
from app.schemas.debate import Turn, VerdictSchema

logger = logging.getLogger("council_of_self.orchestrator")

MAX_ROUNDS = settings.MAX_ROUNDS
AGENT_TIMEOUT_S = settings.AGENT_TIMEOUT_S

CONFLICT_KEYWORDS = {
    "nhưng", "tuy nhiên", "ngược lại", "trái lại", "mâu thuẫn", "không đồng ý", "khác với", "trong khi đó",
    "but", "however", "contrast", "conflict", "disagree", "whereas", "oppose"
}
CONFLICT_SIGNAL_THRESHOLD = 1


# ==============================================================================
# ENTRY POINT — gọi từ api/debate.py
# ==============================================================================

async def run_debate(
    session_id: str, question: str
) -> AsyncGenerator[str, None]:
    """
    Async generator — mỗi yield là 1 chuỗi SSE-formatted string sẵn sàng gửi cho client.
    """
    session_start = time.monotonic()
    history: list[Turn] = []
    total_tokens = 0

    try:
        # -------------------- VÒNG 1 --------------------
        round_1_turns = await _run_round(
            round_number=1, question=question, history=history,
        )
        for turn in round_1_turns:
            history.append(turn)
            total_tokens += turn.tokens_input + turn.tokens_output
            yield sse_format("turn", turn.model_dump())
            await _save_turn(session_id, turn)

        yield sse_format("round_complete", {"round": 1, "next_action": "round_2"})

        # -------------------- VÒNG 2 (LUÔN CHẠY) --------------------
        round_2_turns = await _run_round(
            round_number=2, question=question, history=history,
        )
        for turn in round_2_turns:
            history.append(turn)
            total_tokens += turn.tokens_input + turn.tokens_output
            yield sse_format("turn", turn.model_dump())
            await _save_turn(session_id, turn)

        yield sse_format("round_complete", {
            "round": 2,
            "next_action": "round_3" if (MAX_ROUNDS >= 3 and needs_second_round(history)) else "moderator",
        })

        # -------------------- VÒNG 3 (CÓ ĐIỀU KIỆN — chỉ nếu vẫn còn xung đột) --------------------
        if MAX_ROUNDS >= 3 and needs_second_round(history):
            round_3_turns = await _run_round(
                round_number=3, question=question, history=history,
            )
            for turn in round_3_turns:
                history.append(turn)
                total_tokens += turn.tokens_input + turn.tokens_output
                yield sse_format("turn", turn.model_dump())
                await _save_turn(session_id, turn)

            yield sse_format("round_complete", {"round": 3, "next_action": "moderator"})

        # -------------------- KIỂM TRA CÓ ĐỦ DỮ LIỆU ĐỂ TỔNG HỢP KHÔNG --------------------
        if _all_turns_are_fallback(history):
            # Toàn bộ 4 agent đều fail — không gọi Moderator trên dữ liệu rỗng/rác.
            logger.error(f"[{session_id}] Toàn bộ Agent đều fallback — dừng sớm.")
            yield sse_format("error", {
                "code": "ALL_AGENTS_FAILED",
                "message": "Tất cả cố vấn đều không phản hồi được. Vui lòng thử lại.",
            })
            await _mark_session_status(session_id, "failed")
            return

        # -------------------- CHỦ TỌA --------------------
        verdict, moderator_meta = await _run_moderator(question, history)

        if verdict is None:
            # Cả lần gọi gốc lẫn retry JSON trong llm_client đều thất bại.
            yield sse_format("error", {
                "code": "MODERATOR_FAILED",
                "message": "Không tổng hợp được kết luận. Bạn vẫn có thể đọc lại toàn bộ tranh luận bên trên.",
            })
            await _mark_session_status(session_id, "failed")
            return

        total_tokens += moderator_meta["tokens_input"] + moderator_meta["tokens_output"]
        total_latency_ms = int((time.monotonic() - session_start) * 1000)

        await _save_verdict(session_id, verdict, total_tokens, total_latency_ms)
        await _update_session_usage(session_id, total_tokens, total_latency_ms)

        yield sse_format("verdict", verdict.model_dump())
        yield sse_format("done", {"session_id": session_id})
        await _mark_session_status(session_id, "completed")

    except Exception as e:
        logger.exception(f"[{session_id}] Lỗi không xác định trong run_debate")
        yield sse_format("error", {
            "code": "INTERNAL_ERROR",
            "message": "Có lỗi không mong muốn xảy ra trong phiên tranh luận.",
        })
        await _mark_session_status(session_id, "failed")


# ==============================================================================
# CHẠY 1 VÒNG TRANH LUẬN
# ==============================================================================

async def _run_round(
    round_number: int, question: str, history: list[Turn]
) -> list[Turn]:
    history_context = _build_history_context(history)

    tasks = [
        _call_single_agent(role, question, history_context, round_number)
        for role in AGENT_ROLES_ORDER
    ]
    # return_exceptions=True: 1 agent lỗi không làm gather() raise và huỷ các task song song khác đang chạy.
    results = await asyncio.gather(*tasks, return_exceptions=True)

    turns: list[Turn] = []
    for role, result in zip(AGENT_ROLES_ORDER, results):
        turns.append(_to_turn(role, round_number, result))
    return turns


async def _call_single_agent(
    role: str, question: str, history_context: str, round_number: int
) -> AgentCallResult:
    config = AGENTS[role]
    user_payload = (
        f"Vòng tranh luận hiện tại: {round_number}\n\n"
        f"Câu hỏi cần phân tích:\n\"{question}\"\n\n"
        f"Bối cảnh tranh luận trước đó (nếu có):\n{history_context}"
    )
    prompt = f"{config.system_prompt}\n\n{user_payload}"
    return await call_agent(
        role=role,
        prompt=prompt,
        timeout_s=AGENT_TIMEOUT_S,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
    )


def _to_turn(role: str, round_number: int, result: AgentCallResult | BaseException) -> Turn:
    """Chuẩn hoá AgentCallResult (hoặc exception) thành Turn cho FE/DB."""
    display_name = AGENTS[role].display_name

    if isinstance(result, BaseException):
        logger.error(f"[{role}] Exception ngoài dự kiến: {result}")
        return Turn(
            role=role, display_name=display_name,
            content=FALLBACK_LINES[role], round_number=round_number,
            is_fallback=True,
        )

    if not result.success:
        logger.warning(f"[{role}] Fallback áp dụng — lý do: {result.error_type}")
        return Turn(
            role=role, display_name=display_name,
            content=FALLBACK_LINES[role], round_number=round_number,
            is_fallback=True,
            latency_ms=result.latency_ms,
        )

    return Turn(
        role=role, display_name=display_name,
        content=result.content, round_number=round_number,
        is_fallback=False,
        tokens_input=result.tokens_input,
        tokens_output=result.tokens_output,
        latency_ms=result.latency_ms,
    )


# ==============================================================================
# CONVERGENCE CHECK — RULE-BASED, KHÔNG GỌI LLM
# ==============================================================================

def needs_second_round(history: list[Turn]) -> bool:
    """
    Quyết định có cần Vòng 2 hay không, dựa trên heuristic đơn giản đếm từ
    khóa xung đột trong các turn của Vòng 1. KHÔNG dùng LLM để quyết định điều này.
    """
    non_fallback_turns = [t for t in history if not t.is_fallback]
    if len(non_fallback_turns) < 2:
        # Không đủ dữ liệu thật để đánh giá xung đột có ý nghĩa — bỏ qua Vòng 2
        return False

    conflict_signals = sum(
        1 for turn in non_fallback_turns
        if any(kw in turn.content.lower() for kw in CONFLICT_KEYWORDS)
    )
    return conflict_signals >= CONFLICT_SIGNAL_THRESHOLD


def _peek_next_action_after_round_1() -> str:
    """Chỉ dùng để báo trước cho FE biết bước tiếp theo dự kiến là gì (UX)."""
    return "round_2"


def _all_turns_are_fallback(history: list[Turn]) -> bool:
    return len(history) > 0 and all(t.is_fallback for t in history)


# ==============================================================================
# CHỦ TỌA
# ==============================================================================

async def _run_moderator(
    question: str, history: list[Turn]
) -> tuple[VerdictSchema | None, dict]:
    history_context = _build_history_context(history, for_moderator=True)
    user_payload = (
        f"Câu hỏi gốc của người dùng:\n\"{question}\"\n\n"
        f"Toàn bộ lịch sử tranh luận của 4 cố vấn qua các vòng:\n{history_context}"
    )
    prompt = f"{MODERATOR_CONFIG.system_prompt}\n\n{user_payload}"

    result = await call_moderator(
        prompt=prompt,
        timeout_s=AGENT_TIMEOUT_S * 2,
        max_tokens=MODERATOR_CONFIG.max_tokens,
        temperature=MODERATOR_CONFIG.temperature,
    )

    meta = {"tokens_input": result.tokens_input, "tokens_output": result.tokens_output}

    if not result.success or result.raw_json is None:
        logger.error(f"Moderator thất bại: {result.error_type} — {result.error_detail}")
        return None, meta

    try:
        verdict = VerdictSchema.model_validate(result.raw_json)
    except Exception as e:
        # JSON parse được nhưng không khớp schema Pydantic - coi như thất bại
        logger.error(f"Moderator JSON không khớp schema: {e}")
        return None, meta

    return verdict, meta


# ==============================================================================
# XÂY DỰNG HISTORY CONTEXT
# ==============================================================================

def _build_history_context(history: list[Turn], for_moderator: bool = False) -> str:
    """
    Vòng 2 chỉ cần thấy tóm tắt Vòng 1
    """
    if not history:
        return "(Chưa có phát biểu nào trước đó — đây là vòng mở đầu.)"

    lines = []
    for turn in history:
        tag = " [KHÔNG PHẢN HỒI]" if turn.is_fallback else ""
        content = turn.content if for_moderator else _truncate(turn.content, 150)
        lines.append(f"- {turn.display_name} (Vòng {turn.round_number}){tag}: {content}")
    return "\n".join(lines)


def _truncate(text: str, max_chars: int) -> str:
    return text if len(text) <= max_chars else text[:max_chars].rstrip() + "..."


# ==============================================================================
# DB PERSISTENCE (async wrapper quanh supabase_admin — xem ghi chú cuối file)
# ==============================================================================

async def _save_turn(session_id: str, turn: Turn) -> None:
    try:
        tokens_used = turn.tokens_input + turn.tokens_output
        await asyncio.to_thread(
            lambda: supabase_admin.table("debate_turns").insert({
                "session_id": session_id,
                "round": turn.round_number,
                "agent_role": turn.role,
                "content": turn.content,
                "tokens_used": tokens_used,
                "latency_ms": turn.latency_ms,
                "is_fallback": bool(turn.is_fallback),
            }).execute()
        )
    except Exception:
        logger.exception(f"[{session_id}] Lỗi khi lưu turn vào DB (role={turn.role})")


async def _save_verdict(
    session_id: str, verdict: VerdictSchema, total_tokens: int, total_latency_ms: int
) -> None:
    try:
        await asyncio.to_thread(
            lambda: supabase_admin.table("council_verdicts").insert({
                "session_id": session_id,
                "verdict_json": verdict.model_dump(),
                "total_tokens_used": total_tokens,
            }).execute()
        )
    except Exception:
        logger.exception(f"[{session_id}] Lỗi khi lưu verdict vào DB")


async def _update_session_usage(session_id: str, total_tokens: int, total_latency_ms: int) -> None:
    try:
        await asyncio.to_thread(
            lambda: supabase_admin.table("sessions").update({
                "total_tokens_used": total_tokens,
                "total_latency_ms": total_latency_ms,
            }).eq("id", session_id).execute()
        )
    except Exception:
        logger.exception(f"[{session_id}] Lỗi khi cập nhật usage cho session")


async def _mark_session_status(
    session_id: str, status: Literal["completed", "failed", "timeout"]
) -> None:
    try:
        await asyncio.to_thread(
            lambda: supabase_admin.table("sessions").update({
                "status": status,
            }).eq("id", session_id).execute()
        )
    except Exception:
        logger.exception(f"[{session_id}] Lỗi khi cập nhật status session")
