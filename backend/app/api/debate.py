from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Depends
import asyncio
from fastapi.responses import StreamingResponse

from app.core.orchestrator import run_debate
from app.core.db_client import supabase_admin
from app.core.rate_limiter import check_rate_limit
from app.core.auth import get_current_user, AuthUser
from app.schemas.debate import DebateRequest, SessionDetail, Turn, VerdictSchema

logger = logging.getLogger("council_of_self.api.debate")
router = APIRouter()


# POST /api/debate — khởi tạo phiên + trả SSE stream (yêu cầu đăng nhập)
@router.post("/api/debate")
async def start_debate(
    payload: DebateRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    allowed = await check_rate_limit(current_user.user_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Bạn đã vượt quá số phiên tranh luận cho phép trong giờ này. Vui lòng thử lại sau.",
        )

    session_id = str(uuid.uuid4())

    try:
        await asyncio.to_thread(
            lambda: supabase_admin.table("sessions").insert({
                "id": session_id,
                "user_id": current_user.user_id,
                "question": payload.question,
                "status": "in_progress",
            }).execute()
        )
    except Exception:
        logger.exception(f"[{session_id}] Không tạo được session record")
        raise HTTPException(status_code=500, detail="Không khởi tạo được phiên tranh luận.")

    logger.info(
        f"[{session_id}] User {current_user.email} bắt đầu debate — "
        f"câu hỏi: {payload.question[:80]!r}"
    )

    return StreamingResponse(
        run_debate(session_id, payload.question),
        media_type="text/event-stream",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


# GET /api/sessions/{session_id} — load lại lịch sử 1 phiên
@router.get("/api/sessions/{session_id}", response_model=SessionDetail)
async def get_session_history(
    session_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> SessionDetail:
    try:
        session_res = await asyncio.to_thread(
            lambda: supabase_admin.table("sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên tranh luận.")

    session_row = session_res.data
    if session_row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên tranh luận.")
    if session_row["user_id"] != current_user.user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem phiên tranh luận này.")

    turns_res = await asyncio.to_thread(
        lambda: supabase_admin.table("debate_turns")
        .select("*")
        .eq("session_id", session_id)
        .order("round")
        .execute()
    )

    turns = [
        Turn(
            role=row["agent_role"],
            display_name=_display_name_for(row["agent_role"]),
            content=row["content"],
            round_number=row["round"],
            is_fallback=row.get("is_fallback", False),
            tokens_input=0,
            tokens_output=row.get("tokens_used", 0),
            latency_ms=row.get("latency_ms", 0),
        )
        for row in (turns_res.data or [])
    ]

    verdict_res = await asyncio.to_thread(
        lambda: supabase_admin.table("council_verdicts")
        .select("verdict_json")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    verdict_row = (verdict_res.data or [None])[0]
    verdict = VerdictSchema.model_validate(verdict_row["verdict_json"]) if verdict_row else None

    return SessionDetail(
        session_id=session_id,
        question=session_row["question"],
        status=session_row["status"],
        turns=turns,
        verdict=verdict,
        total_tokens_used=session_row.get("total_tokens_used", 0),
        total_latency_ms=session_row.get("total_latency_ms", 0),
    )


@router.get("/api/sessions", response_model=list[SessionDetail])
async def list_my_sessions(current_user: AuthUser = Depends(get_current_user)):
    """Danh sách phiên của chính user đang đăng nhập — dùng cho History sidebar."""
    res = await asyncio.to_thread(
        lambda: supabase_admin.table("sessions")
        .select("*")
        .eq("user_id", current_user.user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [
        SessionDetail(
            session_id=row["id"],
            question=row["question"],
            status=row["status"],
            turns=[],
            verdict=None,
            total_tokens_used=row.get("total_tokens_used", 0),
            total_latency_ms=row.get("total_latency_ms", 0),
        )
        for row in (res.data or [])
    ]


# HELPERS
_DISPLAY_NAMES = {
    "logic": "Lý Trí",
    "emotion": "Con Tim",
    "risk": "Người Cẩn Trọng",
    "pleasure": "Người Tự Do",
}


def _display_name_for(role: str) -> str:
    return _DISPLAY_NAMES.get(role, role)